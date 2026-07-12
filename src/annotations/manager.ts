import fs from 'fs';
import { EventEmitter } from 'events';
import { ensureDir, tandemDir } from '../utils/paths';

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
}

export interface CreateAnnotationInput {
  taskId?: string | null;
  tabId?: string | null;
  webContentsId?: number | null;
  url?: string | null;
  region: AnnotationRegion;
  dom?: AnnotationDomTarget | null;
  message?: string;
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
    };

    this.annotations.set(annotation.id, annotation);
    this.saveToDisk();
    this.emit('annotation-created', cloneAnnotation(annotation));
    return cloneAnnotation(annotation);
  }

  resolve(id: string): Annotation | null {
    const existing = this.annotations.get(id);
    if (!existing) return null;

    const updated: Annotation = { ...existing, resolvedAt: Date.now() };
    this.annotations.set(id, updated);
    this.saveToDisk();
    this.emit('annotation-resolved', cloneAnnotation(updated));
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
