import { describe, it, expect, vi } from 'vitest';
import type { Tab } from '../../tabs/manager';
import { TandemBrowserPortalProvider } from '../browser-portal-provider';
import { BrowserSurfaceRegistry } from '../browser-surface-registry';

function makeTab(id: string, webContentsId: number, active = false): Tab {
  return {
    id,
    webContentsId,
    title: id,
    url: `https://example.com/${id}`,
    favicon: '',
    groupId: null,
    active,
    createdAt: 0,
    source: 'user',
    pinned: false,
    partition: 'persist:tandem',
    emoji: null,
    emojiFlash: false,
  };
}

describe('BrowserSurfaceRegistry', () => {
  it('allows multiple visible surfaces while keeping a single focus owner', () => {
    const registry = new BrowserSurfaceRegistry();
    registry.ensure('tab-a');
    registry.ensure('tab-b');
    registry.setVisible('tab-a', true);
    registry.setVisible('tab-b', true);
    registry.focus('tab-a');

    expect(registry.getSurface('tab-a')).toMatchObject({ visible: true, focused: true });
    expect(registry.getSurface('tab-b')).toMatchObject({ visible: true, focused: false });

    registry.focus('tab-b');
    expect(registry.getSurface('tab-a')).toMatchObject({ visible: true, focused: false });
    expect(registry.getSurface('tab-b')).toMatchObject({ visible: true, focused: true });
  });

  it('focus implies visibility and hiding a focused surface blurs it', () => {
    const registry = new BrowserSurfaceRegistry();
    registry.ensure('tab-a');
    registry.focus('tab-a');
    expect(registry.getSurface('tab-a')).toMatchObject({ visible: true, focused: true });
    registry.setVisible('tab-a', false);
    expect(registry.getSurface('tab-a')).toMatchObject({ visible: false, focused: false });
  });

  it('stores live/snapshot mode and Canvas-projected screen geometry independently', () => {
    const registry = new BrowserSurfaceRegistry();
    registry.ensure('tab-a');
    registry.setMode('tab-a', 'live');
    registry.setRect('tab-a', { left: 120, top: 80, width: 900, height: 600 });
    expect(registry.getSurface('tab-a')).toMatchObject({
      mode: 'live',
      rect: { left: 120, top: 80, width: 900, height: 600 },
    });
  });

  it('rejects invalid projection geometry', () => {
    const registry = new BrowserSurfaceRegistry();
    registry.ensure('tab-a');
    expect(() => registry.setRect('tab-a', { left: 0, top: 0, width: -1, height: 10 })).toThrow(/cannot be negative/);
  });
});

describe('TandemBrowserPortalProvider with BrowserSurfaceRegistry', () => {
  it('reports Canvas visibility/focus independently of legacy Tab.active', () => {
    const a = makeTab('tab-a', 1, true);
    const b = makeTab('tab-b', 2, false);
    const entries = new Map([[a.id, a], [b.id, b]]);
    const tabs = {
      listTabs: vi.fn().mockReturnValue([a, b]),
      getTab: vi.fn((id: string) => entries.get(id) ?? null),
      getWebContents: vi.fn().mockReturnValue({
        isDestroyed: () => false,
        isLoading: () => false,
        capturePage: vi.fn(),
      }),
    };
    const workspaces = { getWorkspaceIdForTab: vi.fn().mockReturnValue('ws-1') };
    const surfaces = new BrowserSurfaceRegistry();
    surfaces.ensure('tab-a', { visible: true, focused: false, mode: 'live', rect: { left: 0, top: 0, width: 500, height: 400 } });
    surfaces.ensure('tab-b', { visible: true, focused: true, mode: 'live', rect: { left: 520, top: 0, width: 500, height: 400 } });

    const provider = new TandemBrowserPortalProvider(tabs, workspaces, surfaces);
    const resourceA = provider.describe('tab-a');
    const resourceB = provider.describe('tab-b');

    expect(resourceA.state).toMatchObject({ visible: true, focused: false, legacyFocusVisibilityCoupled: false });
    expect(resourceB.state).toMatchObject({ visible: true, focused: true, legacyFocusVisibilityCoupled: false });
    expect(resourceA.projection).toMatchObject({ preferredDisplayMode: 'live', rect: { left: 0, top: 0, width: 500, height: 400 } });
    expect(resourceB.projection).toMatchObject({ preferredDisplayMode: 'live', rect: { left: 520, top: 0, width: 500, height: 400 } });
  });

  it('preserves legacy active==visible semantics when no surface registry is supplied', () => {
    const tab = makeTab('tab-a', 1, true);
    const tabs = {
      listTabs: () => [tab],
      getTab: () => tab,
      getWebContents: () => ({ isDestroyed: () => false, isLoading: () => false, capturePage: vi.fn() }),
    };
    const provider = new TandemBrowserPortalProvider(tabs);
    expect(provider.describe('tab-a').state).toMatchObject({
      focused: true,
      visible: true,
      legacyFocusVisibilityCoupled: true,
    });
  });
});
