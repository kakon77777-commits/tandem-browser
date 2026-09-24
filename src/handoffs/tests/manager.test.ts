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
import { HandoffManager, InsufficientAuthorityError } from '../manager';

describe('HandoffManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exists = false;
    fsState.readText = '[]';
  });

  it('loads sanitized handoffs from disk and applies filters with open-first sorting', () => {
    fsState.exists = true;
    fsState.readText = JSON.stringify([
      {
        id: 'resolved-1',
        status: 'resolved',
        title: 'Already handled',
        body: 'Done',
        reason: 'done',
        workspaceId: 'ws-1',
        tabId: 'tab-1',
        open: true,
        createdAt: 10,
        updatedAt: 30,
      },
      {
        id: 'open-1',
        status: 'needs_human',
        title: ' Need review ',
        body: ' Please review ',
        reason: ' human_help ',
        workspaceId: ' ws-1 ',
        tabId: ' tab-2 ',
        taskId: 'task-1',
        stepId: 'step-1',
        createdAt: 1,
        updatedAt: 20,
      },
      {
        id: 'open-2',
        status: 'blocked',
        title: 'Second',
        createdAt: 2,
        updatedAt: 40,
      },
      {
        id: 'broken-1',
        status: 'oops',
        title: 'Invalid',
      },
    ]);

    const manager = new HandoffManager();

    expect(manager.list().map(handoff => handoff.id)).toEqual([
      'open-2',
      'open-1',
      'resolved-1',
    ]);
    expect(manager.list({ openOnly: true }).map(handoff => handoff.id)).toEqual([
      'open-2',
      'open-1',
    ]);
    expect(manager.list({ workspaceId: 'ws-1', taskId: 'task-1', stepId: 'step-1' })).toEqual([
      expect.objectContaining({
        id: 'open-1',
        workspaceId: 'ws-1',
        tabId: 'tab-2',
        open: true,
      }),
    ]);
    expect(manager.get('resolved-1')).toEqual(expect.objectContaining({
      open: false,
      resolvedAt: 30,
    }));

    const copy = manager.get('open-1');
    expect(copy).not.toBeNull();
    copy!.title = 'Changed externally';
    expect(manager.get('open-1')?.title).toBe('Need review');
  });

  it('creates handoffs with trimmed values, fallback defaults, persistence, and events', () => {
    const manager = new HandoffManager();
    const createdListener = vi.fn();
    manager.on('handoff-created', createdListener);

    const handoff = manager.create({
      status: 'resolved',
      title: '   ',
      body: '  Review done  ',
      reason: '   ',
      workspaceId: ' ws-9 ',
      tabId: ' tab-9 ',
      agentId: ' agent-1 ',
      source: ' source-1 ',
      actionLabel: '   ',
      taskId: ' task-9 ',
      stepId: ' step-9 ',
    });

    expect(handoff).toEqual(expect.objectContaining({
      status: 'resolved',
      title: 'Agent handoff',
      body: 'Review done',
      reason: 'human_help',
      workspaceId: 'ws-9',
      tabId: 'tab-9',
      agentId: 'agent-1',
      source: 'source-1',
      actionLabel: null,
      taskId: 'task-9',
      stepId: 'step-9',
      open: false,
    }));
    expect(handoff.resolvedAt).toBeTypeOf('number');
    expect(createdListener).toHaveBeenCalledWith(expect.objectContaining({
      id: handoff.id,
      open: false,
    }));
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      '/tmp/tandem/handoffs.json',
      expect.stringContaining('"status": "resolved"'),
    );
  });

  it('updates, reopens, resolves, and finds open handoffs by task step', () => {
    const manager = new HandoffManager();
    const updatedListener = vi.fn();
    manager.on('handoff-updated', updatedListener);

    const first = manager.create({
      status: 'blocked',
      title: 'Login required',
      reason: 'login_required',
      workspaceId: 'ws-1',
      tabId: 'tab-1',
      source: 'claude',
      taskId: 'task-1',
      stepId: 'step-1',
    });
    manager.create({
      status: 'resolved',
      title: 'Done',
      taskId: 'task-1',
      stepId: 'step-1',
    });

    expect(manager.findOpenByTaskStep('task-1', 'step-1')?.id).toBe(first.id);

    const paused = manager.update(first.id, {
      title: '   ',
      body: '  Sign in first  ',
      reason: '   ',
      workspaceId: '',
      tabId: '',
      source: '',
      open: false,
    });
    expect(paused).toEqual(expect.objectContaining({
      title: 'Login required',
      body: 'Sign in first',
      reason: 'login_required',
      workspaceId: null,
      tabId: null,
      source: null,
      open: false,
    }));
    expect(paused?.resolvedAt).toBeTypeOf('number');

    const reopened = manager.update(first.id, {
      status: 'ready_to_resume',
      open: true,
      actionLabel: 'Resume agent',
    });
    expect(reopened).toEqual(expect.objectContaining({
      status: 'ready_to_resume',
      open: true,
      actionLabel: 'Resume agent',
      resolvedAt: undefined,
    }));

    const resolved = manager.resolve(first.id);
    expect(resolved).toEqual(expect.objectContaining({
      status: 'resolved',
      open: false,
    }));
    expect(manager.findOpenByTaskStep('task-1', 'step-1')).toBeNull();
    expect(manager.resolve('missing')).toBeNull();
    expect(manager.update('missing', { open: false })).toBeNull();
    expect(updatedListener).toHaveBeenCalled();
  });

  it('recovers from malformed disk state without throwing', () => {
    fsState.exists = true;
    fsState.readText = '{not-json';

    const manager = new HandoffManager();

    expect(manager.list()).toEqual([]);
    expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith('/tmp/tandem/handoffs.json', 'utf-8');
  });

  describe('version (CAS)', () => {
    it('create() starts at version 1, update() increments it', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      expect(created.version).toBe(1);

      const updated = manager.update(created.id, { title: 'Still need help' });
      expect(updated?.version).toBe(2);
    });

    it('update() with a matching expectedVersion succeeds', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      const updated = manager.update(created.id, { title: 'Updated' }, created.version);
      expect(updated?.version).toBe(2);
    });

    it('update() with a stale expectedVersion throws VersionConflictError and does not write', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      manager.update(created.id, { title: 'First writer' }); // now version 2

      expect(() => manager.update(created.id, { title: 'Second writer' }, 1)).toThrow('Version conflict');

      // The first writer's update stands — the stale write never landed.
      expect(manager.get(created.id)?.title).toBe('First writer');
    });

    it('update() without expectedVersion keeps today\'s last-write-wins behavior', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      manager.update(created.id, { title: 'First writer' });

      // No expectedVersion passed — succeeds even though version has moved on.
      const updated = manager.update(created.id, { title: 'Second writer' });
      expect(updated?.title).toBe('Second writer');
    });

    it('sanitizes a pre-existing on-disk record with no version field as version 1', () => {
      fsState.exists = true;
      fsState.readText = JSON.stringify([{
        id: 'legacy-1', status: 'needs_human', title: 'Old record', open: true, createdAt: 1, updatedAt: 1,
      }]);

      const manager = new HandoffManager();
      expect(manager.get('legacy-1')?.version).toBe(1);
    });
  });

  describe('accept() / reject()', () => {
    it('accept() transitions to ready_to_resume from an open, non-terminal status', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      const accepted = manager.accept(created.id, { actionLabel: 'Resume agent' });
      expect(accepted.status).toBe('ready_to_resume');
      expect(accepted.open).toBe(true);
      expect(accepted.actionLabel).toBe('Resume agent');
    });

    it('accept() throws InvalidHandoffTransitionError when already resolved', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      manager.resolve(created.id);

      expect(() => manager.accept(created.id)).toThrow('Cannot accept handoff');
    });

    it('accept() throws InvalidHandoffTransitionError when already ready_to_resume', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      manager.accept(created.id);

      expect(() => manager.accept(created.id)).toThrow('Cannot accept handoff');
    });

    it('accept() throws for an unknown handoff id', () => {
      const manager = new HandoffManager();
      expect(() => manager.accept('missing')).toThrow('not found');
    });

    it('accept() honors expectedVersion (CAS)', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      manager.update(created.id, { body: 'someone else wrote first' }); // version now 2

      expect(() => manager.accept(created.id, {}, 1)).toThrow('Version conflict');
    });

    it('reject() transitions to resolved from any open status, including ready_to_resume', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      const accepted = manager.accept(created.id);

      const rejected = manager.reject(accepted.id, { actionLabel: 'Rejected' });
      expect(rejected.status).toBe('resolved');
      expect(rejected.open).toBe(false);
    });

    it('reject() throws InvalidHandoffTransitionError when already resolved', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });
      manager.reject(created.id);

      expect(() => manager.reject(created.id)).toThrow('Cannot reject handoff');
    });

    it('reject() throws for an unknown handoff id', () => {
      const manager = new HandoffManager();
      expect(() => manager.reject('missing')).toThrow('not found');
    });
  });

  describe('authority (I4) — accept() / reject()', () => {
    it('accept() throws InsufficientAuthorityError for an ai actor on a high-risk step', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      expect(() => manager.accept(created.id, {}, undefined, { kind: 'ai', riskLevel: 'high' }))
        .toThrow(InsufficientAuthorityError);
      expect(manager.get(created.id)!.status).toBe('needs_human'); // unchanged — denial doesn't leak a transition
    });

    it('accept() throws InsufficientAuthorityError for an ai actor on a medium-risk step', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      expect(() => manager.accept(created.id, {}, undefined, { kind: 'ai', riskLevel: 'medium' }))
        .toThrow(InsufficientAuthorityError);
    });

    it.each(['none', 'low', null] as const)('accept() succeeds for an ai actor when riskLevel is %s', (riskLevel) => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      const accepted = manager.accept(created.id, {}, undefined, { kind: 'ai', riskLevel });
      expect(accepted.status).toBe('ready_to_resume');
    });

    it('accept() succeeds for a human actor regardless of risk level', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      const accepted = manager.accept(created.id, {}, undefined, { kind: 'human', riskLevel: 'high' });
      expect(accepted.status).toBe('ready_to_resume');
    });

    it('accept() with no authority arg keeps last-write-wins behavior (regression)', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      const accepted = manager.accept(created.id);
      expect(accepted.status).toBe('ready_to_resume');
    });

    it('reject() throws InsufficientAuthorityError for an ai actor on a high-risk step', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      expect(() => manager.reject(created.id, {}, undefined, { kind: 'ai', riskLevel: 'high' }))
        .toThrow(InsufficientAuthorityError);
      expect(manager.get(created.id)!.status).toBe('needs_human');
    });

    it('reject() succeeds for a human actor on a high-risk step', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      const rejected = manager.reject(created.id, {}, undefined, { kind: 'human', riskLevel: 'high' });
      expect(rejected.status).toBe('resolved');
    });

    it('InsufficientAuthorityError carries the handoff id, actor kind, and risk level', () => {
      const manager = new HandoffManager();
      const created = manager.create({ status: 'needs_human', title: 'Need help' });

      try {
        manager.accept(created.id, {}, undefined, { kind: 'ai', riskLevel: 'high' });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(InsufficientAuthorityError);
        expect((e as InsufficientAuthorityError).handoffId).toBe(created.id);
        expect((e as InsufficientAuthorityError).actorKind).toBe('ai');
        expect((e as InsufficientAuthorityError).riskLevel).toBe('high');
      }
    });
  });
});
