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
import { AnnotationManager } from '../manager';

describe('AnnotationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exists = false;
    fsState.readText = '[]';
  });

  it('creates an annotation with a region, optional DOM ref, task, and message', () => {
    const manager = new AnnotationManager();

    const annotation = manager.create({
      taskId: 'task-1',
      tabId: 'tab-1',
      webContentsId: 3,
      url: 'https://example.com/pricing',
      region: { x: 80, y: 140, width: 220, height: 90 },
      dom: { ref: '@e17', tagName: 'DIV' },
      message: '這裡太擠',
    });

    expect(annotation.id).toMatch(/^ann-/);
    expect(annotation.taskId).toBe('task-1');
    expect(annotation.dom).toEqual({ ref: '@e17', tagName: 'DIV' });
    expect(annotation.region).toEqual({ x: 80, y: 140, width: 220, height: 90 });
    expect(annotation.resolvedAt).toBeNull();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('defaults taskId/tabId/dom to null and message to empty string when omitted', () => {
    const manager = new AnnotationManager();
    const annotation = manager.create({ region: { x: 0, y: 0, width: 10, height: 10 } });

    expect(annotation.taskId).toBeNull();
    expect(annotation.tabId).toBeNull();
    expect(annotation.dom).toBeNull();
    expect(annotation.message).toBe('');
  });

  it('lists annotations filtered by taskId and tabId', () => {
    const manager = new AnnotationManager();
    manager.create({ taskId: 'task-1', tabId: 'tab-1', region: { x: 0, y: 0, width: 1, height: 1 } });
    manager.create({ taskId: 'task-2', tabId: 'tab-1', region: { x: 0, y: 0, width: 1, height: 1 } });
    manager.create({ taskId: 'task-1', tabId: 'tab-2', region: { x: 0, y: 0, width: 1, height: 1 } });

    expect(manager.list({ taskId: 'task-1' })).toHaveLength(2);
    expect(manager.list({ tabId: 'tab-2' })).toHaveLength(1);
    expect(manager.list({ taskId: 'task-1', tabId: 'tab-2' })).toHaveLength(1);
    expect(manager.list()).toHaveLength(3);
  });

  it('filters resolvedOnly / unresolvedOnly', () => {
    const manager = new AnnotationManager();
    const a = manager.create({ region: { x: 0, y: 0, width: 1, height: 1 } });
    manager.create({ region: { x: 0, y: 0, width: 1, height: 1 } });
    manager.resolve(a.id);

    expect(manager.list({ resolvedOnly: true })).toHaveLength(1);
    expect(manager.list({ unresolvedOnly: true })).toHaveLength(1);
  });

  it('get() returns a clone, not a live reference', () => {
    const manager = new AnnotationManager();
    const created = manager.create({ region: { x: 0, y: 0, width: 1, height: 1 } });

    const fetched = manager.get(created.id);
    fetched!.region.x = 999;

    expect(manager.get(created.id)!.region.x).toBe(0);
  });

  it('get() returns null for an unknown id', () => {
    const manager = new AnnotationManager();
    expect(manager.get('missing')).toBeNull();
  });

  it('resolve() sets resolvedAt and returns null for an unknown id', () => {
    const manager = new AnnotationManager();
    const created = manager.create({ region: { x: 0, y: 0, width: 1, height: 1 } });

    expect(manager.resolve('missing')).toBeNull();

    const resolved = manager.resolve(created.id);
    expect(resolved!.resolvedAt).toEqual(expect.any(Number));
  });

  it('remove() deletes an existing annotation and returns false for an unknown id', () => {
    const manager = new AnnotationManager();
    const created = manager.create({ region: { x: 0, y: 0, width: 1, height: 1 } });

    expect(manager.remove('missing')).toBe(false);
    expect(manager.remove(created.id)).toBe(true);
    expect(manager.get(created.id)).toBeNull();
  });

  it('loads sanitized annotations from disk, dropping malformed entries', () => {
    fsState.exists = true;
    fsState.readText = JSON.stringify([
      { id: 'ann-good', region: { x: 1, y: 2, width: 3, height: 4 }, message: 'ok', createdAt: 5, resolvedAt: null },
      { id: 'ann-bad-region', region: { x: 'nope' }, message: 'broken' },
      { region: { x: 1, y: 2, width: 3, height: 4 } }, // missing id
      null,
    ]);

    const manager = new AnnotationManager();

    expect(manager.list()).toHaveLength(1);
    expect(manager.get('ann-good')).toMatchObject({ id: 'ann-good', message: 'ok' });
  });
});
