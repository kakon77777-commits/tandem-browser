import fs from 'fs';
import { EventEmitter } from 'events';
import { ensureDir, tandemDir } from '../utils/paths';
import { checkVersion } from '../utils/version-conflict';
import type { AgentKind } from '../agents/agent-registry';
import type { RiskLevel } from '../agents/task-manager';

export const HANDOFF_STATUSES = [
  'needs_human',
  'blocked',
  'waiting_approval',
  'ready_to_resume',
  'completed_review',
  'resolved',
] as const;

export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

/**
 * Thrown by accept()/reject() when the handoff's current status doesn't
 * permit that transition (e.g. accepting an already-resolved handoff).
 * Distinct from VersionConflictError: this is a business-rule violation,
 * not a stale-read race.
 */
export class InvalidHandoffTransitionError extends Error {
  constructor(
    public readonly handoffId: string,
    public readonly fromStatus: HandoffStatus,
    public readonly action: 'accept' | 'reject',
  ) {
    super(`Cannot ${action} handoff ${handoffId} from status "${fromStatus}"`);
    this.name = 'InvalidHandoffTransitionError';
  }
}

/**
 * PMW invariant I4 (Authority Separation): does the accepting/rejecting
 * party's kind actually cover the risk of what it's resolving? `riskLevel`
 * is the linked task step's risk (null for a standalone handoff with no
 * linked step). See assertAuthority().
 */
export type AuthorityContext = { kind: AgentKind; riskLevel: RiskLevel | null };

/**
 * Thrown by accept()/reject() when `authority` is supplied and denies the
 * transition — an `'ai'`-kind actor resolving a `'medium'`/`'high'`-risk
 * step. Distinct from InvalidHandoffTransitionError: this is a permission
 * denial (403), not a state-machine violation (409).
 */
export class InsufficientAuthorityError extends Error {
  constructor(
    public readonly handoffId: string,
    public readonly actorKind: AgentKind,
    public readonly riskLevel: RiskLevel,
  ) {
    super(`Actor of kind "${actorKind}" cannot resolve handoff ${handoffId} at risk level "${riskLevel}"`);
    this.name = 'InsufficientAuthorityError';
  }
}

/**
 * I4 check for accept()/reject(). No-op when `authority` is omitted (the
 * CAS-style opt-in pattern — existing callers that never pass it keep
 * today's behavior). A step with no risk, or risk 'none'/'low', needs no
 * elevated authority; 'medium'/'high' can only be resolved by a
 * `kind: 'human'` actor.
 */
function assertAuthority(handoffId: string, authority?: AuthorityContext): void {
  if (!authority) return;
  const { kind, riskLevel } = authority;
  if (riskLevel === null || riskLevel === 'none' || riskLevel === 'low') return;
  if (kind === 'ai') {
    throw new InsufficientAuthorityError(handoffId, kind, riskLevel);
  }
}

/** Statuses accept() may transition out of. Not resolved (terminal) or already ready_to_resume. */
const ACCEPTABLE_FROM = new Set<HandoffStatus>(['needs_human', 'blocked', 'waiting_approval', 'completed_review']);
/** Statuses reject() may transition out of. Anything open — not already resolved. */
const REJECTABLE_FROM = new Set<HandoffStatus>(['needs_human', 'blocked', 'waiting_approval', 'ready_to_resume', 'completed_review']);

export interface Handoff {
  id: string;
  status: HandoffStatus;
  title: string;
  body: string;
  reason: string;
  workspaceId: string | null;
  tabId: string | null;
  agentId: string | null;
  source: string | null;
  actionLabel: string | null;
  taskId: string | null;
  stepId: string | null;
  open: boolean;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  /** Compare-and-set version, incremented on every update(). See src/utils/version-conflict.ts. */
  version: number;
}

export interface CreateHandoffInput {
  status: HandoffStatus;
  title: string;
  body?: string;
  reason?: string;
  workspaceId?: string | null;
  tabId?: string | null;
  agentId?: string | null;
  source?: string | null;
  actionLabel?: string | null;
  taskId?: string | null;
  stepId?: string | null;
  open?: boolean;
}

export interface UpdateHandoffInput {
  status?: HandoffStatus;
  title?: string;
  body?: string;
  reason?: string;
  workspaceId?: string | null;
  tabId?: string | null;
  agentId?: string | null;
  source?: string | null;
  actionLabel?: string | null;
  taskId?: string | null;
  stepId?: string | null;
  open?: boolean;
}

export interface HandoffListFilters {
  openOnly?: boolean;
  status?: HandoffStatus;
  workspaceId?: string;
  tabId?: string;
  taskId?: string;
  stepId?: string;
}

function isHandoffStatus(value: unknown): value is HandoffStatus {
  return typeof value === 'string' && HANDOFF_STATUSES.includes(value as HandoffStatus);
}

function trimText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function textOrFallback(value: unknown, fallback: string): string {
  const trimmed = trimText(value);
  return trimmed.length > 0 ? trimmed : fallback;
}

function nullableText(value: unknown): string | null {
  const trimmed = trimText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function cloneHandoff(handoff: Handoff): Handoff {
  return { ...handoff };
}

function isOpenStatus(status: HandoffStatus): boolean {
  return status !== 'resolved';
}

function sanitizeHandoff(raw: unknown): Handoff | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Partial<Record<keyof Handoff, unknown>>;
  if (!isHandoffStatus(value.status)) {
    return null;
  }

  const id = trimText(value.id);
  const title = textOrFallback(value.title, 'Agent handoff');
  if (!id || !title) {
    return null;
  }

  const createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : createdAt;
  const status = value.status;
  const open = typeof value.open === 'boolean' ? value.open : isOpenStatus(status);
  // Records written before this field existed load as version 1 — the same
  // value a fresh create() would have assigned, so old and new records are
  // indistinguishable to a CAS caller.
  const version = typeof value.version === 'number' && Number.isInteger(value.version) && value.version > 0
    ? value.version
    : 1;

  const handoff: Handoff = {
    id,
    status,
    title,
    body: trimText(value.body),
    reason: textOrFallback(value.reason, 'human_help'),
    workspaceId: nullableText(value.workspaceId),
    tabId: nullableText(value.tabId),
    agentId: nullableText(value.agentId),
    source: nullableText(value.source),
    actionLabel: nullableText(value.actionLabel),
    taskId: nullableText(value.taskId),
    stepId: nullableText(value.stepId),
    open: status === 'resolved' ? false : open,
    createdAt,
    updatedAt,
    version,
  };

  if (typeof value.resolvedAt === 'number') {
    handoff.resolvedAt = value.resolvedAt;
  } else if (!handoff.open) {
    handoff.resolvedAt = updatedAt;
  }

  return handoff;
}

/**
 * HandoffManager — durable human↔agent escalation records shared across HTTP, MCP, and UI.
 */
export class HandoffManager extends EventEmitter {
  private readonly handoffsPath: string;
  private readonly handoffs = new Map<string, Handoff>();

  constructor() {
    super();
    ensureDir(tandemDir());
    this.handoffsPath = tandemDir('handoffs.json');
    this.loadFromDisk();
  }

  list(filters: HandoffListFilters = {}): Handoff[] {
    let handoffs = Array.from(this.handoffs.values());

    if (filters.openOnly) {
      handoffs = handoffs.filter(handoff => handoff.open);
    }
    if (filters.status) {
      handoffs = handoffs.filter(handoff => handoff.status === filters.status);
    }
    if (filters.workspaceId) {
      handoffs = handoffs.filter(handoff => handoff.workspaceId === filters.workspaceId);
    }
    if (filters.tabId) {
      handoffs = handoffs.filter(handoff => handoff.tabId === filters.tabId);
    }
    if (filters.taskId) {
      handoffs = handoffs.filter(handoff => handoff.taskId === filters.taskId);
    }
    if (filters.stepId) {
      handoffs = handoffs.filter(handoff => handoff.stepId === filters.stepId);
    }

    return handoffs
      .sort((a, b) => {
        if (a.open !== b.open) {
          return a.open ? -1 : 1;
        }
        return b.updatedAt - a.updatedAt;
      })
      .map(cloneHandoff);
  }

  get(id: string): Handoff | null {
    const handoff = this.handoffs.get(id);
    return handoff ? cloneHandoff(handoff) : null;
  }

  create(input: CreateHandoffInput): Handoff {
    const now = Date.now();
    const status = input.status;
    const open = status === 'resolved'
      ? false
      : typeof input.open === 'boolean'
        ? input.open
        : isOpenStatus(status);

    const handoff: Handoff = {
      id: `handoff-${now}-${Math.random().toString(36).slice(2, 8)}`,
      status,
      title: textOrFallback(input.title, 'Agent handoff'),
      body: trimText(input.body),
      reason: textOrFallback(input.reason, 'human_help'),
      workspaceId: nullableText(input.workspaceId),
      tabId: nullableText(input.tabId),
      agentId: nullableText(input.agentId),
      source: nullableText(input.source),
      actionLabel: nullableText(input.actionLabel),
      taskId: nullableText(input.taskId),
      stepId: nullableText(input.stepId),
      open,
      createdAt: now,
      updatedAt: now,
      resolvedAt: open ? undefined : now,
      version: 1,
    };

    this.handoffs.set(handoff.id, handoff);
    this.saveToDisk();
    this.emit('handoff-created', cloneHandoff(handoff));
    return cloneHandoff(handoff);
  }

  /**
   * @param expectedVersion - optional CAS guard. Omit for today's
   * last-write-wins behavior; pass `existing.version` to reject the write
   * with VersionConflictError if something else updated the handoff first.
   */
  update(id: string, patch: UpdateHandoffInput, expectedVersion?: number): Handoff | null {
    const existing = this.handoffs.get(id);
    if (!existing) {
      return null;
    }
    checkVersion(id, existing.version, expectedVersion);

    const nextStatus = patch.status ?? existing.status;
    const nextOpen = nextStatus === 'resolved'
      ? false
      : typeof patch.open === 'boolean'
        ? patch.open
        : existing.open;

    const updated: Handoff = {
      ...existing,
      status: nextStatus,
      title: patch.title !== undefined ? textOrFallback(patch.title, existing.title) : existing.title,
      body: patch.body !== undefined ? trimText(patch.body) : existing.body,
      reason: patch.reason !== undefined ? textOrFallback(patch.reason, existing.reason) : existing.reason,
      workspaceId: patch.workspaceId !== undefined ? nullableText(patch.workspaceId) : existing.workspaceId,
      tabId: patch.tabId !== undefined ? nullableText(patch.tabId) : existing.tabId,
      agentId: patch.agentId !== undefined ? nullableText(patch.agentId) : existing.agentId,
      source: patch.source !== undefined ? nullableText(patch.source) : existing.source,
      actionLabel: patch.actionLabel !== undefined ? nullableText(patch.actionLabel) : existing.actionLabel,
      taskId: patch.taskId !== undefined ? nullableText(patch.taskId) : existing.taskId,
      stepId: patch.stepId !== undefined ? nullableText(patch.stepId) : existing.stepId,
      open: nextOpen,
      updatedAt: Date.now(),
      resolvedAt: nextOpen ? undefined : (existing.resolvedAt ?? Date.now()),
      version: existing.version + 1,
    };

    this.handoffs.set(id, updated);
    this.saveToDisk();
    this.emit('handoff-updated', cloneHandoff(updated));
    return cloneHandoff(updated);
  }

  /** @param expectedVersion - optional CAS guard, see update(). */
  resolve(id: string, expectedVersion?: number): Handoff | null {
    return this.update(id, { status: 'resolved', open: false }, expectedVersion);
  }

  /**
   * Accept an open handoff — the only path that may transition a handoff to
   * `ready_to_resume`. Throws InvalidHandoffTransitionError if the current
   * status isn't one accept() can move out of (e.g. already resolved).
   *
   * Authority checking (PMW invariant I4, Authority_B ⊆ Authority_A) is
   * enforced via the optional `authority` param — omit it to keep prior
   * behavior (opt-in, same CAS-style pattern as `expectedVersion`). When
   * supplied, an `'ai'`-kind actor cannot accept a handoff linked to a
   * `'medium'`/`'high'`-risk step; see assertAuthority(). This only covers
   * `accept()`'s own callers (`TaskHandoffCoordinator.markReady()`) -
   * `reject()`'s authority path has no production caller yet, the
   * primitive just ships ready for one.
   *
   * @param patch - same fields as update(), status/open are fixed by this method
   * @param expectedVersion - optional CAS guard, see update()
   * @param authority - optional I4 guard, see assertAuthority()
   */
  accept(id: string, patch: Omit<UpdateHandoffInput, 'status' | 'open'> = {}, expectedVersion?: number, authority?: AuthorityContext): Handoff {
    const existing = this.handoffs.get(id);
    if (!existing) {
      throw new Error(`Handoff ${id} not found`);
    }
    assertAuthority(id, authority);
    if (!ACCEPTABLE_FROM.has(existing.status)) {
      throw new InvalidHandoffTransitionError(id, existing.status, 'accept');
    }
    const updated = this.update(id, { ...patch, status: 'ready_to_resume', open: true }, expectedVersion);
    if (!updated) {
      throw new Error(`Handoff ${id} not found`);
    }
    return updated;
  }

  /**
   * Reject an open handoff — closes it (`resolved`) without a successful
   * hand-back. Throws InvalidHandoffTransitionError if already resolved.
   *
   * @param patch - same fields as update(), status/open are fixed by this method
   * @param expectedVersion - optional CAS guard, see update()
   * @param authority - optional I4 guard, see assertAuthority() on accept()
   */
  reject(id: string, patch: Omit<UpdateHandoffInput, 'status' | 'open'> = {}, expectedVersion?: number, authority?: AuthorityContext): Handoff {
    const existing = this.handoffs.get(id);
    if (!existing) {
      throw new Error(`Handoff ${id} not found`);
    }
    assertAuthority(id, authority);
    if (!REJECTABLE_FROM.has(existing.status)) {
      throw new InvalidHandoffTransitionError(id, existing.status, 'reject');
    }
    const updated = this.update(id, { ...patch, status: 'resolved', open: false }, expectedVersion);
    if (!updated) {
      throw new Error(`Handoff ${id} not found`);
    }
    return updated;
  }

  findOpenByTaskStep(taskId: string, stepId: string): Handoff | null {
    const match = Array.from(this.handoffs.values()).find(handoff =>
      handoff.open && handoff.taskId === taskId && handoff.stepId === stepId,
    );
    return match ? cloneHandoff(match) : null;
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.handoffsPath)) {
        return;
      }

      const raw = JSON.parse(fs.readFileSync(this.handoffsPath, 'utf-8'));
      if (!Array.isArray(raw)) {
        return;
      }

      for (const item of raw) {
        const handoff = sanitizeHandoff(item);
        if (handoff) {
          this.handoffs.set(handoff.id, handoff);
        }
      }
    } catch {
      this.handoffs.clear();
    }
  }

  private saveToDisk(): void {
    const serialized = JSON.stringify(
      Array.from(this.handoffs.values()).sort((a, b) => b.updatedAt - a.updatedAt),
      null,
      2,
    );
    fs.writeFileSync(this.handoffsPath, serialized);
  }
}
