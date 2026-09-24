import { describe, it, expect, vi } from 'vitest';
import { capturePagePng } from '../screenshot';

function makeWC(overrides: {
  isAttached?: boolean;
  sendCommand?: ReturnType<typeof vi.fn>;
  capturePage?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    debugger: {
      isAttached: vi.fn().mockReturnValue(overrides.isAttached ?? false),
      sendCommand: overrides.sendCommand ?? vi.fn(),
    },
    capturePage: overrides.capturePage ?? vi.fn().mockResolvedValue({
      toPNG: () => Buffer.from('native-png'),
    }),
  } as any;
}

describe('capturePagePng', () => {
  it('uses native capturePage() when no debugger is attached', async () => {
    const wc = makeWC({ isAttached: false });

    const png = await capturePagePng(wc);

    expect(png.toString()).toBe('native-png');
    expect(wc.capturePage).toHaveBeenCalled();
    expect(wc.debugger.sendCommand).not.toHaveBeenCalled();
  });

  it('captures via CDP Page.captureScreenshot when a debugger is already attached', async () => {
    const sendCommand = vi.fn().mockResolvedValue({ data: Buffer.from('cdp-png').toString('base64') });
    const wc = makeWC({ isAttached: true, sendCommand });

    const png = await capturePagePng(wc);

    expect(png.toString()).toBe('cdp-png');
    expect(sendCommand).toHaveBeenCalledWith('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    expect(wc.capturePage).not.toHaveBeenCalled();
  });

  it('falls back to native capturePage() when the CDP capture throws', async () => {
    const sendCommand = vi.fn().mockRejectedValue(new Error('detached mid-flight'));
    const wc = makeWC({ isAttached: true, sendCommand });

    const png = await capturePagePng(wc);

    expect(png.toString()).toBe('native-png');
    expect(wc.capturePage).toHaveBeenCalled();
  });

  it('falls back to native capturePage() when the CDP capture returns no data', async () => {
    const sendCommand = vi.fn().mockResolvedValue({});
    const wc = makeWC({ isAttached: true, sendCommand });

    const png = await capturePagePng(wc);

    expect(png.toString()).toBe('native-png');
    expect(wc.capturePage).toHaveBeenCalled();
  });
});
