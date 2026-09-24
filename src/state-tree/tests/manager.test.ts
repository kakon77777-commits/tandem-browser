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
import { StateTreeManager, InvalidJoinError } from '../manager';

describe('StateTreeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exists = false;
    fsState.readText = '[]';
  });

  it('captures a root node with no parent', () => {
    const manager = new StateTreeManager();

    const node = manager.capture({ taskId: 'task-1', tabId: 'tab-1', label: 'before fix', url: 'https://example.com' });

    expect(node.id).toMatch(/^state-/);
    expect(node.parentId).toBeNull();
    expect(node.label).toBe('before fix');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('defaults label to "snapshot" when omitted', () => {
    const manager = new StateTreeManager();
    const node = manager.capture({});
    expect(node.label).toBe('snapshot');
  });

  it('throws when capturing with a parentId that does not exist', () => {
    const manager = new StateTreeManager();
    expect(() => manager.capture({ parentId: 'ghost' })).toThrow('ghost');
  });

  it('fork() creates a child node under an existing parent', () => {
    const manager = new StateTreeManager();
    const root = manager.capture({ taskId: 'task-1', label: 'root' });

    const child = manager.fork(root.id, { label: 'Agent A attempt', taskId: 'task-1' });

    expect(child.parentId).toBe(root.id);
    expect(child.label).toBe('Agent A attempt');
  });

  it('fork() throws when the parent does not exist', () => {
    const manager = new StateTreeManager();
    expect(() => manager.fork('ghost', {})).toThrow('ghost');
  });

  it('supports branching: two children under the same parent', () => {
    const manager = new StateTreeManager();
    const root = manager.capture({ label: 'root' });

    const childA = manager.fork(root.id, { label: 'attempt A' });
    const childB = manager.fork(root.id, { label: 'attempt B' });

    const kids = manager.children(root.id);
    expect(kids.map((k) => k.id).sort()).toEqual([childA.id, childB.id].sort());
  });

  it('children() returns an empty array for a leaf node', () => {
    const manager = new StateTreeManager();
    const root = manager.capture({ label: 'root' });
    expect(manager.children(root.id)).toEqual([]);
  });

  it('list() filters by taskId, tabId, and rootsOnly', () => {
    const manager = new StateTreeManager();
    const root = manager.capture({ taskId: 'task-1', tabId: 'tab-1', label: 'root' });
    manager.fork(root.id, { taskId: 'task-1', tabId: 'tab-1', label: 'child' });
    manager.capture({ taskId: 'task-2', tabId: 'tab-2', label: 'other' });

    expect(manager.list({ taskId: 'task-1' })).toHaveLength(2);
    expect(manager.list({ tabId: 'tab-2' })).toHaveLength(1);
    expect(manager.list({ rootsOnly: true })).toHaveLength(2); // root + the task-2 capture
    expect(manager.list()).toHaveLength(3);
  });

  it('compare() returns both nodes, or null if either is missing', () => {
    const manager = new StateTreeManager();
    const a = manager.capture({ label: 'A' });
    const b = manager.capture({ label: 'B' });

    expect(manager.compare(a.id, b.id)).toEqual({ a, b });
    expect(manager.compare(a.id, 'ghost')).toBeNull();
    expect(manager.compare('ghost', b.id)).toBeNull();
  });

  it('get() returns a clone, not a live reference', () => {
    const manager = new StateTreeManager();
    const created = manager.capture({ label: 'root' });

    const fetched = manager.get(created.id);
    (fetched as any).label = 'mutated';

    expect(manager.get(created.id)!.label).toBe('root');
  });

  it('remove() deletes an existing node and returns false for an unknown id', () => {
    const manager = new StateTreeManager();
    const created = manager.capture({ label: 'root' });

    expect(manager.remove('missing')).toBe(false);
    expect(manager.remove(created.id)).toBe(true);
    expect(manager.get(created.id)).toBeNull();
  });

  describe('join() — PMW JOIN operator', () => {
    it('creates a node with both parentId and joinedFromId set', () => {
      const manager = new StateTreeManager();
      const root = manager.capture({ label: 'root' });
      const a = manager.fork(root.id, { label: 'Agent A path' });
      const b = manager.fork(root.id, { label: 'Agent B path' });

      const joined = manager.join(a.id, b.id, { label: 'reconciled' });

      expect(joined.parentId).toBe(a.id);
      expect(joined.joinedFromId).toBe(b.id);
      expect(joined.label).toBe('reconciled');
    });

    it('throws InvalidJoinError with reason "self" when joining a node with itself', () => {
      const manager = new StateTreeManager();
      const root = manager.capture({ label: 'root' });

      expect(() => manager.join(root.id, root.id, {})).toThrow(InvalidJoinError);
      try {
        manager.join(root.id, root.id, {});
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidJoinError);
        expect((e as InvalidJoinError).reason).toBe('self');
      }
    });

    it('throws InvalidJoinError with reason "different-roots" across unrelated captures', () => {
      const manager = new StateTreeManager();
      const rootA = manager.capture({ label: 'root A' });
      const rootB = manager.capture({ label: 'root B' });
      const a = manager.fork(rootA.id, { label: 'branch of A' });
      const b = manager.fork(rootB.id, { label: 'branch of B' });

      try {
        manager.join(a.id, b.id, {});
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidJoinError);
        expect((e as InvalidJoinError).reason).toBe('different-roots');
      }
    });

    it('throws when parentId or joinedFromId does not exist', () => {
      const manager = new StateTreeManager();
      const root = manager.capture({ label: 'root' });

      expect(() => manager.join('ghost', root.id, {})).toThrow('ghost');
      expect(() => manager.join(root.id, 'ghost', {})).toThrow('ghost');
    });

    it('children() returns the join node from both source branches', () => {
      const manager = new StateTreeManager();
      const root = manager.capture({ label: 'root' });
      const a = manager.fork(root.id, { label: 'Agent A path' });
      const b = manager.fork(root.id, { label: 'Agent B path' });

      const joined = manager.join(a.id, b.id, { label: 'reconciled' });

      expect(manager.children(a.id).map((n) => n.id)).toContain(joined.id);
      expect(manager.children(b.id).map((n) => n.id)).toContain(joined.id);
    });

    it('does not affect list()/rootsOnly filtering', () => {
      const manager = new StateTreeManager();
      const root = manager.capture({ label: 'root' });
      const a = manager.fork(root.id, { label: 'A' });
      const b = manager.fork(root.id, { label: 'B' });
      manager.join(a.id, b.id, { label: 'reconciled' });

      expect(manager.list({ rootsOnly: true }).map((n) => n.id)).toEqual([root.id]);
      expect(manager.list()).toHaveLength(4);
    });

    it('preserves joinedFromId through a disk round-trip', () => {
      fsState.exists = true;
      fsState.readText = JSON.stringify([
        { id: 'state-a', parentId: null, joinedFromId: null, label: 'a', createdAt: 1 },
        { id: 'state-b', parentId: null, joinedFromId: 'state-a', label: 'joined', createdAt: 2 },
      ]);

      const manager = new StateTreeManager();
      expect(manager.get('state-b')?.joinedFromId).toBe('state-a');
    });
  });

  it('loads sanitized nodes from disk, dropping malformed entries', () => {
    fsState.exists = true;
    fsState.readText = JSON.stringify([
      { id: 'state-good', parentId: null, label: 'ok', createdAt: 1 },
      { parentId: null, label: 'missing id' },
      null,
    ]);

    const manager = new StateTreeManager();

    expect(manager.list()).toHaveLength(1);
    expect(manager.get('state-good')).toMatchObject({ id: 'state-good', label: 'ok' });
  });
});
