import fs from 'fs';
import { EventEmitter } from 'events';
import { ensureDir, tandemDir } from '../utils/paths';

// ─── Types ──────────────────────────────────────────────────────────

/**
 * A node in the branching Browser State Tree (SRW whitepaper §14-15).
 *
 * Unlike linear browser history (A → B → C), nodes form a tree via
 * `parentId` so alternative attempts can branch off the same point and be
 * compared later, instead of overwriting each other.
 *
 * This is a Level 0-2 snapshot (metadata + screenshot + DOM summary) —
 * it does NOT capture or restore full runtime state (cookies, JS heap,
 * storage). Forking re-observes whatever the browser shows *right now*
 * and records it as a child of the referenced node; it does not roll the
 * browser back to a past state.
 */
export interface StateNode {
  id: string;
  parentId: string | null;
  taskId: string | null;
  tabId: string | null;
  webContentsId: number | null;
  label: string;
  url: string | null;
  domSummary: string | null;
  screenshotPath: string | null;
  createdAt: number;
}

export interface CaptureStateNodeInput {
  parentId?: string | null;
  taskId?: string | null;
  tabId?: string | null;
  webContentsId?: number | null;
  label?: string;
  url?: string | null;
  domSummary?: string | null;
  screenshotPath?: string | null;
}

export interface StateTreeListFilters {
  taskId?: string;
  tabId?: string;
  rootsOnly?: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeStateNode(raw: unknown): StateNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Partial<StateNode>;
  if (typeof n.id !== 'string' || !n.id) return null;

  return {
    id: n.id,
    parentId: typeof n.parentId === 'string' ? n.parentId : null,
    taskId: typeof n.taskId === 'string' ? n.taskId : null,
    tabId: typeof n.tabId === 'string' ? n.tabId : null,
    webContentsId: isFiniteNumber(n.webContentsId) ? n.webContentsId : null,
    label: typeof n.label === 'string' ? n.label : 'snapshot',
    url: typeof n.url === 'string' ? n.url : null,
    domSummary: typeof n.domSummary === 'string' ? n.domSummary : null,
    screenshotPath: typeof n.screenshotPath === 'string' ? n.screenshotPath : null,
    createdAt: isFiniteNumber(n.createdAt) ? n.createdAt : Date.now(),
  };
}

function cloneStateNode(node: StateNode): StateNode {
  return { ...node };
}

// ─── Manager ─────────────────────────────────────────────────────────────────

/**
 * StateTreeManager — durable branching Browser State Tree.
 *
 * Persistence: ~/.tandem/state-tree.json
 * Screenshots: ~/.tandem/state-tree-screenshots/ (see src/state-tree/capture.ts)
 * API routes:  src/api/routes/state-tree.ts
 * MCP tools:   src/mcp/tools/state-tree.ts
 */
export class StateTreeManager extends EventEmitter {

  // === 1. Private state ===

  private readonly statePath: string;
  private readonly nodes = new Map<string, StateNode>();

  // === 2. Constructor ===

  constructor() {
    super();
    ensureDir(tandemDir());
    this.statePath = tandemDir('state-tree.json');
    this.loadFromDisk();
  }

  // === 4. Public methods ===

  list(filters: StateTreeListFilters = {}): StateNode[] {
    let items = Array.from(this.nodes.values());

    if (filters.taskId) {
      items = items.filter((n) => n.taskId === filters.taskId);
    }
    if (filters.tabId) {
      items = items.filter((n) => n.tabId === filters.tabId);
    }
    if (filters.rootsOnly) {
      items = items.filter((n) => n.parentId === null);
    }

    return items.sort((a, b) => a.createdAt - b.createdAt).map(cloneStateNode);
  }

  get(id: string): StateNode | null {
    const node = this.nodes.get(id);
    return node ? cloneStateNode(node) : null;
  }

  children(id: string): StateNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.parentId === id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(cloneStateNode);
  }

  capture(input: CaptureStateNodeInput): StateNode {
    if (input.parentId && !this.nodes.has(input.parentId)) {
      throw new Error(`Parent state node ${input.parentId} not found`);
    }

    const now = Date.now();
    const node: StateNode = {
      id: `state-${now}-${Math.random().toString(36).slice(2, 8)}`,
      parentId: input.parentId ?? null,
      taskId: input.taskId ?? null,
      tabId: input.tabId ?? null,
      webContentsId: input.webContentsId ?? null,
      label: input.label || 'snapshot',
      url: input.url ?? null,
      domSummary: input.domSummary ?? null,
      screenshotPath: input.screenshotPath ?? null,
      createdAt: now,
    };

    this.nodes.set(node.id, node);
    this.saveToDisk();
    this.emit('state-captured', cloneStateNode(node));
    return cloneStateNode(node);
  }

  /**
   * Branch off an existing node. Re-observes whatever the browser shows
   * right now (via the same `capture` input the caller assembled) and
   * records it as a child of `parentId` — see the class-level note about
   * this NOT restoring the browser to `parentId`'s historical state.
   */
  fork(parentId: string, input: Omit<CaptureStateNodeInput, 'parentId'>): StateNode {
    if (!this.nodes.has(parentId)) {
      throw new Error(`State node ${parentId} not found`);
    }
    return this.capture({ ...input, parentId });
  }

  /** Side-by-side lookup of two nodes for the caller to diff (screenshots, DOM summaries, URLs). */
  compare(idA: string, idB: string): { a: StateNode; b: StateNode } | null {
    const a = this.nodes.get(idA);
    const b = this.nodes.get(idB);
    if (!a || !b) return null;
    return { a: cloneStateNode(a), b: cloneStateNode(b) };
  }

  remove(id: string): boolean {
    const removed = this.nodes.delete(id);
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
      if (!fs.existsSync(this.statePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
      if (!Array.isArray(raw)) return;
      for (const item of raw) {
        const node = sanitizeStateNode(item);
        if (node) this.nodes.set(node.id, node);
      }
    } catch {
      this.nodes.clear();
    }
  }

  private saveToDisk(): void {
    try {
      const serialized = JSON.stringify(
        Array.from(this.nodes.values()).sort((a, b) => a.createdAt - b.createdAt),
        null,
        2,
      );
      fs.writeFileSync(this.statePath, serialized);
    } catch {
      // best-effort persistence, same pattern as HandoffManager/AnnotationManager
    }
  }
}
