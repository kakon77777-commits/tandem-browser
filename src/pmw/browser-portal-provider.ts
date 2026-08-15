import type { Tab } from '../tabs/manager';
import type { BrowserSurfaceSource } from './browser-surface-registry';

export type BrowserPortalDisplayMode = 'snapshot' | 'live';

export interface BrowserPortalWebContents {
  isDestroyed(): boolean;
  isLoading(): boolean;
  capturePage(): Promise<{
    toDataURL(): string;
    isEmpty?(): boolean;
  }>;
}

export interface BrowserPortalTabSource {
  listTabs(): Tab[];
  getTab(tabId: string): Tab | null;
  getWebContents(tabId: string): BrowserPortalWebContents | null;
}

export interface BrowserPortalWorkspaceSource {
  getWorkspaceIdForTab(webContentsId: number): string | null;
}

export interface TandemBrowserResourceDescriptor {
  provider: 'tandem';
  resourceKind: 'browser_tab';
  providerResourceId: string;
  resourceUri: string;
  title: string;
  url: string;
  workspaceId: string | null;
  webContentsId: number;
  partition: string;
  source: Tab['source'];
  state: {
    mounted: boolean;
    loading: boolean;
    focused: boolean;
    visible: boolean;
    legacyFocusVisibilityCoupled: boolean;
    surfaceRevision?: number;
  };
  projection: {
    preferredDisplayMode: BrowserPortalDisplayMode;
    previewUri: string;
    liveMountUri: string;
    liveMountKind: 'electron-webview';
    rect?: { left: number; top: number; width: number; height: number };
  };
  capabilities: Array<'snapshot' | 'live' | 'navigate' | 'dom' | 'mcp' | 'session_state'>;
}

export interface TandemBrowserPreview {
  provider: 'tandem';
  resourceKind: 'browser_tab_preview';
  providerResourceId: string;
  resourceUri: string;
  sourceResourceUri: string;
  mimeType: 'image/png';
  dataUrl: string;
  title: string;
  url: string;
  capturedAt: string;
}

function tabResourceUri(tabId: string): string {
  return `tandem://browser/tab/${encodeURIComponent(tabId)}`;
}

function previewResourceUri(tabId: string): string {
  return `${tabResourceUri(tabId)}/preview.png`;
}

function liveMountResourceUri(tabId: string): string {
  return `${tabResourceUri(tabId)}/live`;
}

/**
 * Provider-neutral projection adapter for exposing Tandem browser tabs to a
 * Canvas-first PMW host. Tandem remains canonical for browser runtime state;
 * consumers receive stable descriptors and preview/live handles only.
 *
 * A BrowserSurfaceSource is optional for backward compatibility. Without one,
 * the provider reports Tandem's legacy active==visible coupling. With one,
 * projection visibility/focus/mode/geometry are independent of Tab.active.
 */
export class TandemBrowserPortalProvider {
  constructor(
    private readonly tabs: BrowserPortalTabSource,
    private readonly workspaces?: BrowserPortalWorkspaceSource,
    private readonly surfaces?: BrowserSurfaceSource,
  ) {}

  list(): TandemBrowserResourceDescriptor[] {
    return this.tabs.listTabs().map((tab) => this.describeTab(tab));
  }

  describe(tabId: string): TandemBrowserResourceDescriptor {
    const tab = this.tabs.getTab(tabId);
    if (!tab) throw new Error(`Browser tab ${tabId} not found`);
    return this.describeTab(tab);
  }

  async capturePreview(tabId: string): Promise<TandemBrowserPreview> {
    const tab = this.tabs.getTab(tabId);
    if (!tab) throw new Error(`Browser tab ${tabId} not found`);
    const contents = this.tabs.getWebContents(tabId);
    if (!contents || contents.isDestroyed()) throw new Error(`Browser tab ${tabId} has no live WebContents`);

    const image = await contents.capturePage();
    if (image.isEmpty?.()) throw new Error(`Browser tab ${tabId} produced an empty preview`);
    const dataUrl = image.toDataURL();
    if (!dataUrl.startsWith('data:image/png')) throw new Error(`Browser tab ${tabId} preview is not PNG`);

    return {
      provider: 'tandem',
      resourceKind: 'browser_tab_preview',
      providerResourceId: tab.id,
      resourceUri: previewResourceUri(tab.id),
      sourceResourceUri: tabResourceUri(tab.id),
      mimeType: 'image/png',
      dataUrl,
      title: tab.title,
      url: tab.url,
      capturedAt: new Date().toISOString(),
    };
  }

  private describeTab(tab: Tab): TandemBrowserResourceDescriptor {
    const contents = this.tabs.getWebContents(tab.id);
    const mounted = Boolean(contents && !contents.isDestroyed());
    const surface = this.surfaces?.getSurface(tab.id) ?? null;
    return {
      provider: 'tandem',
      resourceKind: 'browser_tab',
      providerResourceId: tab.id,
      resourceUri: tabResourceUri(tab.id),
      title: tab.title,
      url: tab.url,
      workspaceId: this.workspaces?.getWorkspaceIdForTab(tab.webContentsId) ?? null,
      webContentsId: tab.webContentsId,
      partition: tab.partition,
      source: tab.source,
      state: {
        mounted,
        loading: mounted ? Boolean(contents?.isLoading()) : false,
        focused: surface?.focused ?? tab.active,
        visible: surface?.visible ?? tab.active,
        legacyFocusVisibilityCoupled: surface === null,
        ...(surface ? { surfaceRevision: surface.revision } : {}),
      },
      projection: {
        preferredDisplayMode: surface?.mode ?? 'snapshot',
        previewUri: previewResourceUri(tab.id),
        liveMountUri: liveMountResourceUri(tab.id),
        liveMountKind: 'electron-webview',
        ...(surface?.rect ? { rect: { ...surface.rect } } : {}),
      },
      capabilities: ['snapshot', 'live', 'navigate', 'dom', 'mcp', 'session_state'],
    };
  }
}
