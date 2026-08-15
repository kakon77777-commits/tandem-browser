import { describe, it, expect, vi } from 'vitest';
import { TandemCanvasSurfaceController } from '../browser-surface-controller';

function fakeWindow() {
  const scripts: string[] = [];
  const win = {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      executeJavaScript: vi.fn(async (script: string) => {
        scripts.push(script);
        return true;
      }),
    },
  };
  return { win, scripts };
}

describe('TandemCanvasSurfaceController', () => {
  it('mounts two live visible surfaces while keeping one focused', async () => {
    const { win, scripts } = fakeWindow();
    const controller = new TandemCanvasSurfaceController(win);

    await controller.mount({ tabId: 'tab-a', rect: { left: 10, top: 20, width: 500, height: 400 }, focused: true });
    await controller.mount({ tabId: 'tab-b', rect: { left: 520, top: 20, width: 500, height: 400 }, focused: false });

    expect(controller.surfaces.getSurface('tab-a')).toMatchObject({ visible: true, focused: true, mode: 'live' });
    expect(controller.surfaces.getSurface('tab-b')).toMatchObject({ visible: true, focused: false, mode: 'live' });
    expect(scripts.some((script) => script.includes("webview.style.display = 'flex'"))).toBe(true);
    expect(scripts.some((script) => script.includes('520'))).toBe(true);
  });

  it('moves focus without hiding the previously focused live surface', async () => {
    const { win } = fakeWindow();
    const controller = new TandemCanvasSurfaceController(win);
    await controller.mount({ tabId: 'tab-a', rect: { left: 0, top: 0, width: 400, height: 300 }, focused: true });
    await controller.mount({ tabId: 'tab-b', rect: { left: 420, top: 0, width: 400, height: 300 } });
    await controller.focus('tab-b');

    expect(controller.surfaces.getSurface('tab-a')).toMatchObject({ visible: true, focused: false });
    expect(controller.surfaces.getSurface('tab-b')).toMatchObject({ visible: true, focused: true });
  });

  it('unmount removes inline live projection state and returns the tab to legacy shell rendering', async () => {
    const { win, scripts } = fakeWindow();
    const controller = new TandemCanvasSurfaceController(win);
    await controller.mount({ tabId: 'tab-a', rect: { left: 0, top: 0, width: 400, height: 300 }, focused: true });
    await controller.unmount('tab-a');

    expect(controller.surfaces.getSurface('tab-a')).toMatchObject({ visible: false, focused: false, mode: 'snapshot' });
    const last = scripts.at(-1) ?? '';
    expect(last).toContain("webview.style.display = ''");
    expect(last).toContain("delete webview.dataset.pmwCanvasSurface");
  });

  it('fails closed when Tandem renderer is unavailable', async () => {
    const controller = new TandemCanvasSurfaceController({
      isDestroyed: () => true,
      webContents: { isDestroyed: () => true, executeJavaScript: vi.fn() },
    });
    controller.surfaces.ensure('tab-a');
    await expect(controller.sync('tab-a')).rejects.toThrow(/renderer is unavailable/);
  });

  it('serializes tab IDs into the renderer script instead of interpolating executable text', async () => {
    const { win, scripts } = fakeWindow();
    const controller = new TandemCanvasSurfaceController(win);
    const dangerousId = `tab-'); globalThis.pwned=true; ('`;
    await controller.mount({ tabId: dangerousId, rect: { left: 1, top: 2, width: 3, height: 4 } });
    const script = scripts.at(-1) ?? '';
    expect(script).toContain(JSON.stringify(dangerousId));
    expect(script).not.toContain(`tabs?.get('${dangerousId}')`);
  });
});
