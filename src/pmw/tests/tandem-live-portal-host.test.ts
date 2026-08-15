import { describe, it, expect, vi } from 'vitest';
import { TandemLivePortalHost } from '../tandem-live-portal-host';

function fakeWindow() {
  return {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      executeJavaScript: vi.fn(async () => true),
    },
  };
}

const handle = {
  portalObjectId: 'portal-object-1',
  provider: 'tandem',
  providerResourceId: 'tab-17',
};

describe('TandemLivePortalHost', () => {
  it('accepts MRMIC-shaped live portal handles and overlay rects', async () => {
    const host = new TandemLivePortalHost(fakeWindow());
    await host.mount(handle, { left: 100, top: 50, width: 900, height: 600, visible: true });
    expect(host.controller.surfaces.getSurface('tab-17')).toMatchObject({
      visible: true,
      focused: false,
      mode: 'live',
      rect: { left: 100, top: 50, width: 900, height: 600 },
    });
  });

  it('updates geometry and preserves live state', async () => {
    const host = new TandemLivePortalHost(fakeWindow());
    await host.mount(handle, { left: 0, top: 0, width: 500, height: 400, visible: true });
    await host.update(handle, { left: 300, top: 200, width: 700, height: 500, visible: true });
    expect(host.controller.surfaces.getSurface('tab-17')).toMatchObject({
      visible: true,
      mode: 'live',
      rect: { left: 300, top: 200, width: 700, height: 500 },
    });
  });

  it('turns an offscreen projection into a non-visible surface without destroying provider state', async () => {
    const host = new TandemLivePortalHost(fakeWindow());
    await host.mount(handle, { left: 0, top: 0, width: 500, height: 400, visible: true });
    await host.update(handle, { left: -2000, top: 0, width: 500, height: 400, visible: false });
    expect(host.controller.surfaces.getSurface('tab-17')).toMatchObject({ visible: false, mode: 'live' });
  });

  it('unmount falls back to snapshot mode while retaining the provider resource identity', async () => {
    const host = new TandemLivePortalHost(fakeWindow());
    await host.mount(handle, { left: 0, top: 0, width: 500, height: 400, visible: true });
    await host.unmount(handle);
    expect(host.controller.surfaces.getSurface('tab-17')).toMatchObject({ visible: false, mode: 'snapshot' });
  });

  it('fails closed for a non-Tandem live portal handle', async () => {
    const host = new TandemLivePortalHost(fakeWindow());
    await expect(host.mount(
      { ...handle, provider: 'herdr' },
      { left: 0, top: 0, width: 500, height: 400, visible: true },
    )).rejects.toThrow(/Unsupported live portal provider/);
  });
});
