import fs from 'fs';
import { EventEmitter } from 'events';
import { ensureDir, tandemDir } from '../utils/paths';
import type { RiskLevel } from './task-manager';

// ─── Types ──────────────────────────────────────────────────────────

/**
 * PMW invariant I6 (Explicit Receipt): a wake that reaches a real decision
 * point must leave a receipt. Vocabulary matches the PMW MVP spec exactly
 * (ACK/NO_ACTION/ACTION/ERROR) rather than this codebase's own
 * 'approved'/'rejected' TaskActivityEntry wording, so a receipt reads the
 * same regardless of which system produced it.
 *
 *   ACK       - acknowledged, no decision content yet (rare here; mostly
 *               relevant for async/multi-step wakes this codebase doesn't
 *               have yet)
 *   NO_ACTION - a real decision was made not to act (e.g. a human rejected
 *               a step)
 *   ACTION    - a real decision was made to act (e.g. a human approved a
 *               step, and the agent proceeded)
 *   ERROR     - the decision process itself failed
 */
export type Decision = 'ACK' | 'NO_ACTION' | 'ACTION' | 'ERROR';

export interface DecisionReceipt {
  id: string;
  taskId: string | null;
  stepId: string | null;
  handoffId: string | null;
  /** Who made the decision — a human via the UI, an agent name, etc. Free text, not yet a real agent identity (see the SRW agents registry work). */
  actor: string;
  decision: Decision;
  riskLevel: RiskLevel | null;
  /** IDs of StateNode/Annotation records consulted when making this decision — the evidence trail. May be empty when no specific evidence was cited. */
  evidenceRefs: string[];
  note: string;
  createdAt: number;
}

export interface RecordDecisionReceiptInput {
  taskId?: string | null;
  stepId?: string | null;
  handoffId?: string | null;
  actor: string;
  decision: Decision;
  riskLevel?: RiskLevel | null;
  evidenceRefs?: string[];
  note?: string;
}

export interface DecisionReceiptListFilters {
  taskId?: string;
  stepId?: string;
  handoffId?: string;
  decision?: Decision;
}

const DECISIONS: readonly Decision[] = ['ACK', 'NO_ACTION', 'ACTION', 'ERROR'];

function isDecision(value: unknown): value is Decision {
  return typeof value === 'string' && (DECISIONS as readonly string[]).includes(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeReceipt(raw: unknown): DecisionReceipt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<DecisionReceipt>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (!isDecision(r.decision)) return null;
  if (typeof r.actor !== 'string' || !r.actor) return null;

  return {
    id: r.id,
    taskId: typeof r.taskId === 'string' ? r.taskId : null,
    stepId: typeof r.stepId === 'string' ? r.stepId : null,
    handoffId: typeof r.handoffId === 'string' ? r.handoffId : null,
    actor: r.actor,
    decision: r.decision,
    riskLevel: typeof r.riskLevel === 'string' ? r.riskLevel as RiskLevel : null,
    evidenceRefs: Array.isArray(r.evidenceRefs) ? r.evidenceRefs.filter((ref): ref is string => typeof ref === 'string') : [],
    note: typeof r.note === 'string' ? r.note : '',
    createdAt: isFiniteNumber(r.createdAt) ? r.createdAt : Date.now(),
  };
}

function cloneReceipt(receipt: DecisionReceipt): DecisionReceipt {
  return { ...receipt, evidenceRefs: [...receipt.evidenceRefs] };
}

// ─── Manager ─────────────────────────────────────────────────────────────────

/**
 * DecisionReceiptManager — append-only log of real decisions (PMW's
 * decision_receipts primitive, invariant I6). Unlike TaskActivityEntry
 * (a general, bounded, wholesale-rewritten activity feed used by the UI's
 * Activity tab — still the right tool for "what happened recently"), a
 * receipt is: immutable once written (no update/delete API at all —
 * matches invariant I5, append events), one row per real decision (not
 * every action), and carries an explicit evidence trail (StateNode/
 * Annotation IDs the decision was based on) plus the risk level the
 * decision was classified under.
 *
 * NOT unbounded storage-layer append-only: like every other durable
 * object in this codebase (Handoff/Annotation/StateNode), the on-disk
 * file is rewritten wholesale on each record() — same limitation, not a
 * regression introduced here.
 *
 * Persistence: ~/.tandem/decision-receipts.json
 * API routes:  src/api/routes/decision-receipts.ts
 * MCP tools:   src/mcp/tools/decision-receipts.ts
 */
export class DecisionReceiptManager extends EventEmitter {

  // === 1. Private state ===

  private readonly receiptsPath: string;
  private readonly receipts = new Map<string, DecisionReceipt>();

  // === 2. Constructor ===

  constructor() {
    super();
    ensureDir(tandemDir());
    this.receiptsPath = tandemDir('decision-receipts.json');
    this.loadFromDisk();
  }

  // === 4. Public methods ===

  list(filters: DecisionReceiptListFilters = {}): DecisionReceipt[] {
    let items = Array.from(this.receipts.values());

    if (filters.taskId) items = items.filter((r) => r.taskId === filters.taskId);
    if (filters.stepId) items = items.filter((r) => r.stepId === filters.stepId);
    if (filters.handoffId) items = items.filter((r) => r.handoffId === filters.handoffId);
    if (filters.decision) items = items.filter((r) => r.decision === filters.decision);

    return items.sort((a, b) => b.createdAt - a.createdAt).map(cloneReceipt);
  }

  get(id: string): DecisionReceipt | null {
    const receipt = this.receipts.get(id);
    return receipt ? cloneReceipt(receipt) : null;
  }

  /** Append a new decision receipt. No update/delete API — receipts are immutable once written. */
  record(input: RecordDecisionReceiptInput): DecisionReceipt {
    const now = Date.now();
    const receipt: DecisionReceipt = {
      id: `receipt-${now}-${Math.random().toString(36).slice(2, 8)}`,
      taskId: input.taskId ?? null,
      stepId: input.stepId ?? null,
      handoffId: input.handoffId ?? null,
      actor: input.actor,
      decision: input.decision,
      riskLevel: input.riskLevel ?? null,
      evidenceRefs: input.evidenceRefs ? [...input.evidenceRefs] : [],
      note: input.note ?? '',
      createdAt: now,
    };

    this.receipts.set(receipt.id, receipt);
    this.saveToDisk();
    this.emit('receipt-recorded', cloneReceipt(receipt));
    return cloneReceipt(receipt);
  }

  // === 6. Cleanup ===

  destroy(): void {
    this.removeAllListeners();
  }

  // === 7. Private I/O ===

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.receiptsPath)) return;
      const raw = JSON.parse(fs.readFileSync(this.receiptsPath, 'utf-8'));
      if (!Array.isArray(raw)) return;
      for (const item of raw) {
        const receipt = sanitizeReceipt(item);
        if (receipt) this.receipts.set(receipt.id, receipt);
      }
    } catch {
      this.receipts.clear();
    }
  }

  private saveToDisk(): void {
    try {
      const serialized = JSON.stringify(
        Array.from(this.receipts.values()).sort((a, b) => b.createdAt - a.createdAt),
        null,
        2,
      );
      fs.writeFileSync(this.receiptsPath, serialized);
    } catch {
      // best-effort persistence, same pattern as HandoffManager/AnnotationManager
    }
  }
}
