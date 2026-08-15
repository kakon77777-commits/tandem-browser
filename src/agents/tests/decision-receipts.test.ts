import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsState = vi.hoisted(() => ({
  exists: false,
  readText: '[]',
}));

vi.mock('fs', () => {
  const existsSync = vi.fn(() => fsState.exists);
  const readFileSync = vi.fn(() => fsState.readText);
  const writeFileSync = vi.fn();
  return {
    default: { existsSync, readFileSync, writeFileSync },
    existsSync,
    readFileSync,
    writeFileSync,
  };
});

vi.mock('../../utils/paths', () => ({
  ensureDir: vi.fn(),
  tandemDir: vi.fn((...parts: string[]) => `/tmp/tandem/${parts.join('/')}`),
}));

import fs from 'fs';
import { DecisionReceiptManager } from '../decision-receipts';

describe('DecisionReceiptManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exists = false;
    fsState.readText = '[]';
  });

  it('records a receipt with defaults for optional fields', () => {
    const manager = new DecisionReceiptManager();
    const receipt = manager.record({ actor: 'user', decision: 'ACTION' });

    expect(receipt.id).toMatch(/^receipt-/);
    expect(receipt.taskId).toBeNull();
    expect(receipt.stepId).toBeNull();
    expect(receipt.handoffId).toBeNull();
    expect(receipt.riskLevel).toBeNull();
    expect(receipt.evidenceRefs).toEqual([]);
    expect(receipt.note).toBe('');
    expect(receipt.createdAt).toEqual(expect.any(Number));
  });

  it('records a receipt with all fields populated', () => {
    const manager = new DecisionReceiptManager();
    const receipt = manager.record({
      taskId: 'task-1',
      stepId: 'task-1-step-0',
      handoffId: 'handoff-1',
      actor: 'user',
      decision: 'NO_ACTION',
      riskLevel: 'high',
      evidenceRefs: ['state-1', 'ann-1'],
      note: 'Rejected — looked risky',
    });

    expect(receipt).toMatchObject({
      taskId: 'task-1',
      stepId: 'task-1-step-0',
      handoffId: 'handoff-1',
      actor: 'user',
      decision: 'NO_ACTION',
      riskLevel: 'high',
      evidenceRefs: ['state-1', 'ann-1'],
      note: 'Rejected — looked risky',
    });
  });

  it('persists to disk on record()', () => {
    const manager = new DecisionReceiptManager();
    manager.record({ actor: 'user', decision: 'ACTION' });
    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/tandem/decision-receipts.json', expect.any(String));
  });

  it('emits receipt-recorded', () => {
    const manager = new DecisionReceiptManager();
    const handler = vi.fn();
    manager.on('receipt-recorded', handler);

    const receipt = manager.record({ actor: 'user', decision: 'ACTION' });
    expect(handler).toHaveBeenCalledWith(receipt);
  });

  it('get() returns a receipt by id, or null for unknown', () => {
    const manager = new DecisionReceiptManager();
    const created = manager.record({ actor: 'user', decision: 'ACTION' });

    expect(manager.get(created.id)).toEqual(created);
    expect(manager.get('missing')).toBeNull();
  });

  it('list() filters by taskId/stepId/handoffId/decision', () => {
    const manager = new DecisionReceiptManager();
    const r1 = manager.record({ actor: 'user', decision: 'ACTION', taskId: 'task-1', stepId: 'step-1' });
    const r2 = manager.record({ actor: 'user', decision: 'NO_ACTION', taskId: 'task-2', stepId: 'step-2', handoffId: 'handoff-2' });

    expect(manager.list().map((r) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(manager.list({ taskId: 'task-1' }).map((r) => r.id)).toEqual([r1.id]);
    expect(manager.list({ stepId: 'step-2' }).map((r) => r.id)).toEqual([r2.id]);
    expect(manager.list({ handoffId: 'handoff-2' }).map((r) => r.id)).toEqual([r2.id]);
    expect(manager.list({ decision: 'NO_ACTION' }).map((r) => r.id)).toEqual([r2.id]);
  });

  it('list() sorts newest first when createdAt genuinely differs', () => {
    fsState.exists = true;
    fsState.readText = JSON.stringify([
      { id: 'receipt-old', actor: 'user', decision: 'ACTION', createdAt: 1 },
      { id: 'receipt-new', actor: 'user', decision: 'ACTION', createdAt: 2 },
    ]);

    const manager = new DecisionReceiptManager();
    expect(manager.list().map((r) => r.id)).toEqual(['receipt-new', 'receipt-old']);
  });

  it('has no update or delete API — receipts are immutable once written', () => {
    const manager = new DecisionReceiptManager();
    expect((manager as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((manager as unknown as Record<string, unknown>).remove).toBeUndefined();
    expect((manager as unknown as Record<string, unknown>).delete).toBeUndefined();
  });

  it('loads sanitized receipts from disk, dropping malformed entries', () => {
    fsState.exists = true;
    fsState.readText = JSON.stringify([
      { id: 'receipt-good', actor: 'user', decision: 'ACTION', createdAt: 1 },
      { id: 'receipt-bad-decision', actor: 'user', decision: 'MAYBE' },
      { actor: 'user', decision: 'ACTION' }, // missing id
      { id: 'receipt-no-actor', decision: 'ACTION' }, // missing actor
      null,
    ]);

    const manager = new DecisionReceiptManager();

    expect(manager.list()).toHaveLength(1);
    expect(manager.get('receipt-good')).toMatchObject({ id: 'receipt-good', actor: 'user', decision: 'ACTION' });
  });

  it('recovers from malformed disk state without throwing', () => {
    fsState.exists = true;
    fsState.readText = '{not-json';

    const manager = new DecisionReceiptManager();

    expect(manager.list()).toEqual([]);
  });

  it('destroy() removes all listeners', () => {
    const manager = new DecisionReceiptManager();
    const handler = vi.fn();
    manager.on('receipt-recorded', handler);

    manager.destroy();
    manager.record({ actor: 'user', decision: 'ACTION' });

    expect(handler).not.toHaveBeenCalled();
  });
});
