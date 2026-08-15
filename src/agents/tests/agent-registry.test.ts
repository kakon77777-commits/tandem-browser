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
import { AgentRegistry } from '../agent-registry';

describe('AgentRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exists = false;
    fsState.readText = '[]';
  });

  it('touch() registers a new agent with firstSeenAt === lastSeenAt', () => {
    const registry = new AgentRegistry();
    const record = registry.touch('claude');

    expect(record.id).toBe('claude');
    expect(record.kind).toBe('ai');
    expect(record.firstSeenAt).toBe(record.lastSeenAt);
  });

  it('touch() defaults "user" to kind human, everything else to ai', () => {
    const registry = new AgentRegistry();
    expect(registry.touch('user').kind).toBe('human');
    expect(registry.touch('gpt').kind).toBe('ai');
  });

  it('touch() with an explicit kind is honored on first sight', () => {
    const registry = new AgentRegistry();
    expect(registry.touch('reviewer-1', 'human').kind).toBe('human');
  });

  it('touch() again on a known id refreshes lastSeenAt but keeps the original kind and firstSeenAt', () => {
    const registry = new AgentRegistry();
    const first = registry.touch('claude');
    const second = registry.touch('claude', 'human'); // kind arg ignored — already registered as 'ai'

    expect(second.firstSeenAt).toBe(first.firstSeenAt);
    expect(second.kind).toBe('ai');
  });

  it('persists to disk only when a new agent id is first seen, not on every touch', () => {
    const registry = new AgentRegistry();
    registry.touch('claude');
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

    registry.touch('claude');
    registry.touch('claude');
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

    registry.touch('gpt');
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('emits agent-touched on every touch, including renewals', () => {
    const registry = new AgentRegistry();
    const handler = vi.fn();
    registry.on('agent-touched', handler);

    registry.touch('claude');
    registry.touch('claude');

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('get() returns a record by id, or null for unknown', () => {
    const registry = new AgentRegistry();
    registry.touch('claude');

    expect(registry.get('claude')).toMatchObject({ id: 'claude', kind: 'ai' });
    expect(registry.get('missing')).toBeNull();
  });

  it('list() returns all agents sorted by lastSeenAt descending', () => {
    fsState.exists = true;
    fsState.readText = JSON.stringify([
      { id: 'claude', kind: 'ai', firstSeenAt: 1, lastSeenAt: 1 },
      { id: 'user', kind: 'human', firstSeenAt: 2, lastSeenAt: 5 },
    ]);

    const registry = new AgentRegistry();
    expect(registry.list().map((r) => r.id)).toEqual(['user', 'claude']);
  });

  it('loads sanitized records from disk, dropping malformed entries', () => {
    fsState.exists = true;
    fsState.readText = JSON.stringify([
      { id: 'claude', kind: 'ai', firstSeenAt: 1, lastSeenAt: 1 },
      { id: 'bad-kind', kind: 'robot', firstSeenAt: 1, lastSeenAt: 1 },
      { kind: 'ai' }, // missing id
      null,
    ]);

    const registry = new AgentRegistry();
    expect(registry.list().map((r) => r.id).sort()).toEqual(['bad-kind', 'claude']);
    expect(registry.get('bad-kind')?.kind).toBe('ai'); // unrecognized kind sanitized to default
  });

  it('recovers from malformed disk state without throwing', () => {
    fsState.exists = true;
    fsState.readText = '{not-json';

    const registry = new AgentRegistry();
    expect(registry.list()).toEqual([]);
  });

  it('destroy() removes all listeners', () => {
    const registry = new AgentRegistry();
    const handler = vi.fn();
    registry.on('agent-touched', handler);

    registry.destroy();
    registry.touch('claude');

    expect(handler).not.toHaveBeenCalled();
  });
});
