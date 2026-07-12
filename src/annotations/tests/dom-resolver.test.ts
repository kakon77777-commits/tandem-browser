import { describe, it, expect, vi } from 'vitest';
import { resolveDomAtRegion } from '../dom-resolver';
import type { DevToolsManager } from '../../devtools/manager';
import type { SnapshotManager } from '../../snapshot/manager';

function makeDevtools(impl: (method: string, params?: Record<string, unknown>) => unknown): DevToolsManager {
  return {
    sendCommandToTab: vi.fn(async (_wcId: number, method: string, params?: Record<string, unknown>) => impl(method, params)),
  } as unknown as DevToolsManager;
}

function makeSnapshotManager(ref = '@e5'): SnapshotManager {
  return {
    registerBackendNodeId: vi.fn().mockReturnValue(ref),
  } as unknown as SnapshotManager;
}

describe('resolveDomAtRegion()', () => {
  const region = { x: 80, y: 140, width: 220, height: 90 };

  it('resolves the region center to a DOM node and registers a stable ref', async () => {
    const devtools = makeDevtools((method) => {
      if (method === 'DOM.getNodeForLocation') return { backendNodeId: 42 };
      if (method === 'DOM.describeNode') return { node: { nodeName: 'DIV' } };
      return {};
    });
    const snapshotManager = makeSnapshotManager('@e5');

    const result = await resolveDomAtRegion(devtools, snapshotManager, 3, region);

    expect(result).toEqual({ ref: '@e5', tagName: 'DIV' });
    expect(devtools.sendCommandToTab).toHaveBeenCalledWith(3, 'DOM.getNodeForLocation', {
      x: 190, // x + width/2
      y: 185, // y + height/2
      includeUserAgentShadowDOM: false,
    });
    expect(snapshotManager.registerBackendNodeId).toHaveBeenCalledWith(42, 3);
  });

  it('returns null when no element is found at the location', async () => {
    const devtools = makeDevtools(() => ({}));
    const snapshotManager = makeSnapshotManager();

    const result = await resolveDomAtRegion(devtools, snapshotManager, 3, region);

    expect(result).toBeNull();
    expect(snapshotManager.registerBackendNodeId).not.toHaveBeenCalled();
  });

  it('still returns a ref with a null tagName when describeNode fails', async () => {
    const devtools = makeDevtools((method) => {
      if (method === 'DOM.getNodeForLocation') return { backendNodeId: 42 };
      if (method === 'DOM.describeNode') throw new Error('boom');
      return {};
    });
    const snapshotManager = makeSnapshotManager('@e9');

    const result = await resolveDomAtRegion(devtools, snapshotManager, 3, region);

    expect(result).toEqual({ ref: '@e9', tagName: null });
  });

  it('returns null when CDP itself throws (e.g. no attached debugger)', async () => {
    const devtools = makeDevtools(() => {
      throw new Error('No active tab');
    });
    const snapshotManager = makeSnapshotManager();

    const result = await resolveDomAtRegion(devtools, snapshotManager, 3, region);

    expect(result).toBeNull();
  });
});
