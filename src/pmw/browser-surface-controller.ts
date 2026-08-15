import { BrowserSurfaceRegistry, type BrowserSurfaceRect, type BrowserSurfaceState } from './browser-surface-registry';

export interface CanvasSurfaceRendererWindow {
  isDestroyed(): boolean;
  webContents: {
    isDestroyed(): boolean;
    executeJavaScript(script: string): Promise<unknown>;
  };
}

export interface MountBrowserSurfaceInput {
  tabId: string;
  rect: BrowserSurfaceRect;
  focused?: boolean;
}

function rendererScript(state: BrowserSurfaceState): string {
  const tabId = JSON.stringify(state.tabId);
  const payload = JSON.stringify(state);
  return `(() => {
    const state = ${payload};
    const tabs = window.__tandemRenderer?.getTabs?.();
    const entry = tabs?.get(${tabId});
    if (!entry?.webview) return false;
    const webview = entry.webview;
    const live = state.mode === 'live' && state.visible && state.rect;
    if (!live) {
      delete webview.dataset.pmwCanvasSurface;
      webview.style.display = '';
      webview.style.left = '';
      webview.style.top = '';
      webview.style.width = '';
      webview.style.height = '';
      webview.style.zIndex = '';
      webview.style.pointerEvents = '';
      return true;
    }
    webview.dataset.pmwCanvasSurface = state.focused ? 'focused' : 'visible';
    webview.style.display = 'flex';
    webview.style.left = state.rect.left + 'px';
    webview.style.top = state.rect.top + 'px';
    webview.style.width = state.rect.width + 'px';
    webview.style.height = state.rect.height + 'px';
    webview.style.zIndex = state.focused ? '30' : '20';
    webview.style.pointerEvents = 'auto';
    if (state.focused) {
      try { webview.focus(); } catch {}
    } else {
      try { webview.blur(); } catch {}
    }
    return true;
  })()`;
}

/**
 * Applies BrowserSurfaceRegistry state to Tandem's existing renderer without
 * changing Tab/WebContents lifecycle or the legacy active-tab path.
 *
 * Multiple PMW live surfaces can remain visible because inline display/rect
 * styles override the shell's legacy webview {display:none} rule. Clearing a
 * surface removes those inline styles, immediately returning control to the
 * existing `.active` CSS behavior.
 */
export class TandemCanvasSurfaceController {
  constructor(
    private readonly window: CanvasSurfaceRendererWindow,
    readonly surfaces: BrowserSurfaceRegistry = new BrowserSurfaceRegistry(),
  ) {}

  async mount(input: MountBrowserSurfaceInput): Promise<BrowserSurfaceState> {
    const existing = this.surfaces.getSurface(input.tabId);
    if (!existing) this.surfaces.ensure(input.tabId);
    this.surfaces.setRect(input.tabId, input.rect);
    this.surfaces.setMode(input.tabId, 'live');
    this.surfaces.setVisible(input.tabId, true);
    if (input.focused) this.surfaces.focus(input.tabId);
    await this.syncAll();
    return this.require(input.tabId);
  }

  async updateRect(tabId: string, rect: BrowserSurfaceRect): Promise<BrowserSurfaceState> {
    this.surfaces.setRect(tabId, rect);
    await this.sync(tabId);
    return this.require(tabId);
  }

  async setVisible(tabId: string, visible: boolean): Promise<BrowserSurfaceState> {
    this.surfaces.setVisible(tabId, visible);
    await this.syncAll();
    return this.require(tabId);
  }

  async focus(tabId: string): Promise<BrowserSurfaceState> {
    this.surfaces.focus(tabId);
    await this.syncAll();
    return this.require(tabId);
  }

  async unmount(tabId: string): Promise<boolean> {
    const current = this.surfaces.getSurface(tabId);
    if (!current) return false;
    this.surfaces.setMode(tabId, 'snapshot');
    this.surfaces.setVisible(tabId, false);
    await this.sync(tabId);
    return true;
  }

  async close(tabId: string): Promise<boolean> {
    const current = this.surfaces.getSurface(tabId);
    if (current) {
      this.surfaces.setMode(tabId, 'snapshot');
      this.surfaces.setVisible(tabId, false);
      await this.sync(tabId);
    }
    return this.surfaces.remove(tabId);
  }

  async sync(tabId: string): Promise<boolean> {
    const state = this.surfaces.getSurface(tabId);
    if (!state) return false;
    if (this.window.isDestroyed() || this.window.webContents.isDestroyed()) {
      throw new Error('Tandem renderer is unavailable');
    }
    return Boolean(await this.window.webContents.executeJavaScript(rendererScript(state)));
  }

  async syncAll(): Promise<void> {
    for (const state of this.surfaces.list()) await this.sync(state.tabId);
  }

  private require(tabId: string): BrowserSurfaceState {
    const state = this.surfaces.getSurface(tabId);
    if (!state) throw new Error(`Browser surface ${tabId} is not registered`);
    return state;
  }
}
