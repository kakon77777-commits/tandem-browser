import { describe, it, expect, vi } from 'vitest';
import type { Tab } from '../../tabs/manager';
import {
  TandemBrowserPortalProvider,
  type BrowserPortalTabSource,
  type BrowserPortalWorkspaceSource,
} from '../browser-portal-provider';

function makeTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1',
    webContentsId: 17,
    title: 'Research',
    url: 'https://example.com/research',
    favicon: '',
    groupId: null,
    active: true,
    createdAt: 0,
    source: 'user',
    pinned: false,
    partition: 'persist:tandem',
    emoji: null,
    emojiFlash: false,
    ...overrides,
  };
}

function sources(input: { tab?: Tab | null; loading?: boolean; destroyed?: boolean; dataUrl?: string } = {}) {
  const tab = input.tab === undefined ? makeTab() : input.tab;
  const contents = tab ? {
    isDestroyed: vi.fn().mockReturnValue(input.destroyed ?? false),
    isLoading: vi.fn().mockReturnValue(input.loading ?? false),
    capturePage: vi.fn().mockResolvedValue({
      isEmpty: vi.fn().mockReturnValue(false),
      toDataURL: vi.fn().mockReturnValue(input.dataUrl ?? 'data:image/png;base64,AAAA'),
    }),
  } : null;
  const tabs = {
    listTabs: vi.fn().mockReturnValue(tab ? [tab] : []),
    getTab: vi.fn().mockReturnValue(tab),
    getWebContents: vi.fn().mockReturnValue(contents),
  } as unknown as BrowserPortalTabSource;
  const workspaces = {
    getWorkspaceIdForTab: vi.fn().mockReturnValue('workspace-1'),
  } as unknown as BrowserPortalWorkspaceSource;
  return { tabs, workspaces, contents };
}

describe('TandemBrowserPortalProvider', () => {
  it('emits a stable PMW browser resource descriptor without taking ownership of browser state', () => {
    const { tabs, workspaces } = sources({ loading: true });
    const provider = new TandemBrowserPortalProvider(tabs, workspaces);
    const resource = provider.describe('tab-1');

    expect(resource.provider).toBe('tandem');
    expect(resource.resourceKind).toBe('browser_tab');
    expect(resource.providerResourceId).toBe('tab-1');
    expect(resource.resourceUri).toBe('tandem://browser/tab/tab-1');
    expect(resource.workspaceId).toBe('workspace-1');
    expect(resource.state).toEqual({
      mounted: true,
      loading: true,
      focused: true,
      visible: true,
      legacyFocusVisibilityCoupled: true,
    });
    expect(resource.projection.preferredDisplayMode).toBe('snapshot');
    expect(resource.projection.liveMountKind).toBe('electron-webview');
    expect(resource.capabilities).toContain('live');
    expect(resource.capabilities).toContain('mcp');
  });

  it('captures a real WebContents preview as a provider-owned PNG projection', async () => {
    const { tabs, workspaces, contents } = sources();
    const provider = new TandemBrowserPortalProvider(tabs, workspaces);
    const preview = await provider.capturePreview('tab-1');

    expect(contents?.capturePage).toHaveBeenCalledOnce();
    expect(preview.resourceUri).toBe('tandem://browser/tab/tab-1/preview.png');
    expect(preview.sourceResourceUri).toBe('tandem://browser/tab/tab-1');
    expect(preview.mimeType).toBe('image/png');
    expect(preview.dataUrl).toMatch(/^data:image\/png/);
  });

  it('fails closed when the provider resource has no live WebContents', async () => {
    const { tabs, workspaces } = sources({ destroyed: true });
    const provider = new TandemBrowserPortalProvider(tabs, workspaces);
    await expect(provider.capturePreview('tab-1')).rejects.toThrow(/no live WebContents/);
  });

  it('exposes the current focus/visibility coupling instead of pretending multi-visible tabs already exist', () => {
    const tab = makeTab({ active: false, id: 'tab-background', webContentsId: 22 });
    const { tabs, workspaces } = sources({ tab });
    const provider = new TandemBrowserPortalProvider(tabs, workspaces);
    const resource = provider.describe('tab-background');

    expect(resource.state.focused).toBe(false);
    expect(resource.state.visible).toBe(false);
    expect(resource.state.legacyFocusVisibilityCoupled).toBe(true);
  });

  it('lists provider resources using current Tandem tab identity', () => {
    const { tabs, workspaces } = sources();
    const provider = new TandemBrowserPortalProvider(tabs, workspaces);
    expect(provider.list().map((resource) => resource.providerResourceId)).toEqual(['tab-1']);
  });
});
