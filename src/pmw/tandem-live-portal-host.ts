import {
  TandemCanvasSurfaceController,
  type CanvasSurfaceRendererWindow,
} from './browser-surface-controller';

export interface LivePortalHandleLike {
  portalObjectId: string;
  provider: string;
  providerResourceId: string;
}

export interface OverlayRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Structural counterpart of MRMIC's LivePortalHost for Tandem browser tabs.
 * It intentionally avoids a cross-repository package dependency: PMW hosts can
 * depend on the shared method/field contract while MRMIC and Tandem remain
 * independently versionable providers.
 */
export class TandemLivePortalHost {
  readonly controller: TandemCanvasSurfaceController;

  constructor(window: CanvasSurfaceRendererWindow, controller?: TandemCanvasSurfaceController) {
    this.controller = controller ?? new TandemCanvasSurfaceController(window);
  }

  async mount(handle: LivePortalHandleLike, rect: OverlayRectLike): Promise<void> {
    const tabId = this.tabId(handle);
    if (!rect.visible) {
      const existing = this.controller.surfaces.getSurface(tabId);
      if (existing) await this.controller.setVisible(tabId, false);
      return;
    }
    await this.controller.mount({
      tabId,
      rect: this.rect(rect),
      focused: false,
    });
  }

  async update(handle: LivePortalHandleLike, rect: OverlayRectLike): Promise<void> {
    const tabId = this.tabId(handle);
    const existing = this.controller.surfaces.getSurface(tabId);
    if (!existing) {
      await this.mount(handle, rect);
      return;
    }
    if (!rect.visible) {
      await this.controller.setVisible(tabId, false);
      return;
    }
    await this.controller.updateRect(tabId, this.rect(rect));
    if (!existing.visible) await this.controller.setVisible(tabId, true);
  }

  async unmount(handle: LivePortalHandleLike): Promise<void> {
    const tabId = this.tabId(handle);
    await this.controller.unmount(tabId);
  }

  async focus(handle: LivePortalHandleLike): Promise<void> {
    await this.controller.focus(this.tabId(handle));
  }

  private tabId(handle: LivePortalHandleLike): string {
    if (handle.provider !== 'tandem') throw new Error(`Unsupported live portal provider: ${handle.provider}`);
    if (!handle.providerResourceId) throw new Error('providerResourceId is required');
    return handle.providerResourceId;
  }

  private rect(rect: OverlayRectLike) {
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }
}
