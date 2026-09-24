import fs from 'fs';
import { EventEmitter } from 'events';
import { ensureDir, tandemDir } from '../utils/paths';
import { checkVersion } from '../utils/version-conflict';
import { isScope, InvalidScopePromotionError, type Scope } from '../utils/scope';

export { InvalidScopePromotionError } from '../utils/scope';

// ─── Types ──────────────────────────────────────────────────────────

export interface AnnotationRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Best-effort DOM element resolved at the region's center via CDP. */
export interface AnnotationDomTarget {
  ref: string;
  tagName: string | null;
}

/**
 * PMW scoped-memory primitive (Private→Shared): PRIVATE is visible only to
 * `ownerAgent`, SHARED is visible to everyone. New annotations default to
 * SHARED — matches the pre-existing behavior (every annotation was
 * implicitly visible to all callers before this field existed), so nothing
 * gets more restrictive by default. Promoting PRIVATE→SHARED is the SHARE
 * operator, see promote(). See src/utils/scope.ts for the shared primitive
 * (TaskStep uses the same one).
 *
 * NOT YET ENFORCED: list()/get() don't filter PRIVATE annotations by
 * caller today — there's no real agent identity/capability registry in
 * this codebase yet to check `ownerAgent` against (see the SRW agents
 * registry work). This only models the scope and the promotion
 * transition; visibility enforcement is future work once that registry
 * exists, same honesty pattern as HandoffManager.accept()'s authority gap.
 */
export type AnnotationScope = Scope;

export interface Annotation {
  id: string;
  /** Goal context — the task this annotation serves. See src/agents/task-tree.ts */
  taskId: string | null;
  tabId: string | null;
  webContentsId: number | null;
  url: string | null;
  region: AnnotationRegion;
  dom: AnnotationDomTarget | null;
  message: string;
  createdAt: number;
  resolvedAt: number | null;
  /** Compare-and-set version, incremented on every resolve()/promote(). See src/utils/version-conflict.ts. */
  version: number;
  scope: AnnotationScope;
  /** Agent that created this annotation, when known. See the scope doc comment re: enforcement. */
  ownerAgent: string | null;
}

export interface CreateAnnotationInput {
  taskId?: string | null;
  tabId?: string | null;
  webContentsId?: number | null;
  url?: string | null;
  region: AnnotationRegion;
  dom?: AnnotationDomTarget | null;
  message?: string;
  /** Defaults to SHARED — see the AnnotationScope doc comment. */
  scope?: AnnotationScope;
  ownerAgent?: string | null;
}

export interface AnnotationListFilters {
  taskId?: string;
  tabId?: string;
  resolvedOnly?: boolean;
  unresolvedOnly?: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeRegion(raw: unknown): AnnotationRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AnnotationRegion>;
  if (!isFiniteNumber(r.x) || !isFiniteNumber(r.y) || !isFiniteNumber(r.width) || !isFiniteNumber(r.height)) {
    return null;
  }
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

function sanitizeDom(raw: unknown): AnnotationDomTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<AnnotationDomTarget>;
  if (typeof d.ref !== 'string' || !d.ref) return null;
  return { ref: d.ref, tagName: typeof d.tagName === 'string' ? d.tagName : null };
}

function sanitizeAnnotation(raw: unknown): Annotation | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<Annotation>;
  if (typeof a.id !== 'string' || !a.id) return null;
  const region = sanitizeRegion(a.region);
  if (!region) return null;

  // Records written before this field existed load as version 1 — the same
  // value a fresh create() would have assigned.
  const version = typeof a.version === 'number' && Number.isInteger(a.version) && a.version > 0 ? a.version : 1;
  // Same for scope — records written before this field existed load as
  // SHARED, matching their actual pre-existing (always-visible) behavior.
  const scope = isScope(a.scope) ? a.scope : 'SHARED';

  return {
    id: a.id,
    taskId: typeof a.taskId === 'string' ? a.taskId : null,
    tabId: typeof a.tabId === 'string' ? a.tabId : null,
    webContentsId: isFiniteNumber(a.webContentsId) ? a.webContentsId : null,
    url: typeof a.url === 'string' ? a.url : null,
    region,
    dom: sanitizeDom(a.dom),
    message: typeof a.message === 'string' ? a.message : '',
    createdAt: isFiniteNumber(a.createdAt) ? a.createdAt : Date.now(),
    resolvedAt: isFiniteNumber(a.resolvedAt) ? a.resolvedAt : null,
    version,
    scope,
    ownerAgent: typeof a.ownerAgent === 'string' ? a.ownerAgent : null,
  };
}

function cloneAnnotation(annotation: Annotation): Annotation {
  return { ...annotation, region: { ...annotation.region }, dom: annotation.dom ? { ...annotation.dom } : null };
}

// ─── Manager ─────────────────────────────────────────────────────────────────

/**
 * AnnotationManager — durable Human Annotation objects binding a pixel
 * region, a best-effort DOM element candidate, a goal (task), and a
 * human message. See §12 of the Shared Referential Workspace whitepaper:
 * A_n = (r_p, e_d, v, g, m).
 *
 * Persistence: ~/.tandem/annotations.json
 * API routes:  src/api/routes/annotations.ts
 * MCP tools:   src/mcp/tools/annotations.ts
 */
export class AnnotationManager extends EventEmitter {

  // === 1. Private state ===

  private readonly annotationsPath: string;
  private readonly annotations = new Map<string, Annotation>();

  // === 2. Constructor ===

  constructor() {
    super();
    ensureDir(tandemDir());
    this.annotationsPath = tandemDir('annotations.json');
    this.loadFromDisk();
  }

  // === 4. Public methods ===

  list(filters: AnnotationListFilters = {}): Annotation[] {
    let items = Array.from(this.annotations.values());

    if (filters.taskId) {
      items = items.filter((a) => a.taskId === filters.taskId);
    }
    if (filters.tabId) {
      items = items.filter((a) => a.tabId === filters.tabId);
    }
    if (filters.resolvedOnly) {
      items = items.filter((a) => a.resolvedAt !== null);
    }
    if (filters.unresolvedOnly) {
      items = items.filter((a) => a.resolvedAt === null);
    }

    return items.sort((a, b) => b.createdAt - a.createdAt).map(cloneAnnotation);
  }

  get(id: string): Annotation | null {
    const annotation = this.annotations.get(id);
    return annotation ? cloneAnnotation(annotation) : null;
  }

  create(input: CreateAnnotationInput): Annotation {
    const now = Date.now();
    const annotation: Annotation = {
      id: `ann-${now}-${Math.random().toString(36).slice(2, 8)}`,
      taskId: input.taskId ?? null,
      tabId: input.tabId ?? null,
      webContentsId: input.webContentsId ?? null,
      url: input.url ?? null,
      region: { ...input.region },
      dom: input.dom ?? null,
      message: input.message ?? '',
      createdAt: now,
      resolvedAt: null,
      version: 1,
      scope: input.scope ?? 'SHARED',
      ownerAgent: input.ownerAgent ?? null,
    };

    this.annotations.set(annotation.id, annotation);
    this.saveToDisk();
    this.emit('annotation-created', cloneAnnotation(annotation));
    return cloneAnnotation(annotation);
  }

  /** @param expectedVersion - optional CAS guard. Omit for last-write-wins; pass `existing.version` to reject a stale resolve(). */
  resolve(id: string, expectedVersion?: number): Annotation | null {
    const existing = this.annotations.get(id);
    if (!existing) return null;
    checkVersion(id, existing.version, expectedVersion);

    const updated: Annotation = { ...existing, resolvedAt: Date.now(), version: existing.version + 1 };
    this.annotations.set(id, updated);
    this.saveToDisk();
    this.emit('annotation-resolved', cloneAnnotation(updated));
    return cloneAnnotation(updated);
  }

  /**
   * Promote a PRIVATE annotation to SHARED — the PMW SHARE operator
   * (Private→Shared promotion). Throws InvalidScopePromotionError if the
   * annotation is already SHARED (nothing to promote).
   *
   * @param expectedVersion - optional CAS guard, see resolve()
   */
  promote(id: string, expectedVersion?: number): Annotation {
    const existing = this.annotations.get(id);
    if (!existing) {
      throw new Error(`Annotation ${id} not found`);
    }
    checkVersion(id, existing.version, expectedVersion);
    if (existing.scope === 'SHARED') {
      throw new InvalidScopePromotionError('annotation', id, existing.scope);
    }

    const updated: Annotation = { ...existing, scope: 'SHARED', version: existing.version + 1 };
    this.annotations.set(id, updated);
    this.saveToDisk();
    this.emit('annotation-promoted', cloneAnnotation(updated));
    return cloneAnnotation(updated);
  }

  remove(id: string): boolean {
    const removed = this.annotations.delete(id);
    if (removed) this.saveToDisk();
    return removed;
  }

  // === 6. Cleanup ===

  destroy(): void {
    this.removeAllListeners();
  }

  // === 7. Private I/O ===

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.annotationsPath)) return;
      const raw = JSON.parse(fs.readFileSync(this.annotationsPath, 'utf-8'));
      if (!Array.isArray(raw)) return;
      for (const item of raw) {
        const annotation = sanitizeAnnotation(item);
        if (annotation) this.annotations.set(annotation.id, annotation);
      }
    } catch {
      this.annotations.clear();
    }
  }

  private saveToDisk(): void {
    try {
      const serialized = JSON.stringify(
        Array.from(this.annotations.values()).sort((a, b) => b.createdAt - a.createdAt),
        null,
        2,
      );
      fs.writeFileSync(this.annotationsPath, serialized);
    } catch {
      // best-effort persistence, same pattern as HandoffManager
    }
  }
}
