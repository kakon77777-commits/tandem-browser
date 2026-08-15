export type BrowserSurfaceMode = 'snapshot' | 'live';

export interface BrowserSurfaceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BrowserSurfaceState {
  tabId: string;
  visible: boolean;
  focused: boolean;
  mode: BrowserSurfaceMode;
  rect?: BrowserSurfaceRect;
  revision: number;
}

export interface BrowserSurfaceSource {
  getSurface(tabId: string): BrowserSurfaceState | null;
}

function clone(state: BrowserSurfaceState): BrowserSurfaceState {
  return {
    ...state,
    ...(state.rect ? { rect: { ...state.rect } } : {}),
  };
}

function validateRect(rect: BrowserSurfaceRect): void {
  if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) {
    throw new Error('browser surface rect values must be finite');
  }
  if (rect.width < 0 || rect.height < 0) throw new Error('browser surface rect size cannot be negative');
}

/**
 * Canvas-facing browser surface state.
 *
 * This registry deliberately does not own WebContents or navigation state.
 * It only separates projection visibility/focus/mode/geometry from Tandem's
 * existing Tab lifecycle. Multiple surfaces may be visible while at most one
 * is focused. Focus implies visibility.
 */
export class BrowserSurfaceRegistry implements BrowserSurfaceSource {
  private readonly states = new Map<string, BrowserSurfaceState>();
  private focusedTabId: string | null = null;

  ensure(tabId: string, defaults: Partial<Omit<BrowserSurfaceState, 'tabId' | 'revision'>> = {}): BrowserSurfaceState {
    if (!tabId) throw new Error('tabId is required');
    const existing = this.states.get(tabId);
    if (existing) return clone(existing);
    if (defaults.rect) validateRect(defaults.rect);
    const created: BrowserSurfaceState = {
      tabId,
      visible: defaults.visible ?? false,
      focused: false,
      mode: defaults.mode ?? 'snapshot',
      ...(defaults.rect ? { rect: { ...defaults.rect } } : {}),
      revision: 0,
    };
    this.states.set(tabId, created);
    if (defaults.focused) return this.focus(tabId);
    return clone(created);
  }

  getSurface(tabId: string): BrowserSurfaceState | null {
    const state = this.states.get(tabId);
    return state ? clone(state) : null;
  }

  list(): BrowserSurfaceState[] {
    return [...this.states.values()].map(clone);
  }

  setVisible(tabId: string, visible: boolean): BrowserSurfaceState {
    const state = this.require(tabId);
    if (state.visible === visible && (!state.focused || visible)) return clone(state);
    state.visible = visible;
    if (!visible && state.focused) {
      state.focused = false;
      this.focusedTabId = null;
    }
    state.revision += 1;
    return clone(state);
  }

  focus(tabId: string): BrowserSurfaceState {
    const target = this.require(tabId);
    if (this.focusedTabId && this.focusedTabId !== tabId) {
      const previous = this.states.get(this.focusedTabId);
      if (previous?.focused) {
        previous.focused = false;
        previous.revision += 1;
      }
    }
    this.focusedTabId = tabId;
    let changed = false;
    if (!target.visible) { target.visible = true; changed = true; }
    if (!target.focused) { target.focused = true; changed = true; }
    if (changed) target.revision += 1;
    return clone(target);
  }

  blur(tabId: string): BrowserSurfaceState {
    const state = this.require(tabId);
    if (state.focused) {
      state.focused = false;
      state.revision += 1;
      if (this.focusedTabId === tabId) this.focusedTabId = null;
    }
    return clone(state);
  }

  setMode(tabId: string, mode: BrowserSurfaceMode): BrowserSurfaceState {
    const state = this.require(tabId);
    if (mode !== 'snapshot' && mode !== 'live') throw new Error('browser surface mode is invalid');
    if (state.mode !== mode) {
      state.mode = mode;
      state.revision += 1;
    }
    return clone(state);
  }

  setRect(tabId: string, rect: BrowserSurfaceRect): BrowserSurfaceState {
    validateRect(rect);
    const state = this.require(tabId);
    state.rect = { ...rect };
    state.revision += 1;
    return clone(state);
  }

  remove(tabId: string): boolean {
    const state = this.states.get(tabId);
    if (!state) return false;
    if (this.focusedTabId === tabId) this.focusedTabId = null;
    return this.states.delete(tabId);
  }

  private require(tabId: string): BrowserSurfaceState {
    const state = this.states.get(tabId);
    if (!state) throw new Error(`Browser surface ${tabId} is not registered`);
    return state;
  }
}
