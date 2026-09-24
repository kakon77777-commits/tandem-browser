import type { WebContents } from 'electron';
import { createLogger } from './logger';

const log = createLogger('Screenshot');

// Live-verified against a running instance (2026-07-12): a genuinely hidden
// tab still doesn't resolve within this window (Chromium submits zero
// compositor frames for a `display:none` <webview> — see the module-level
// comment below), so this exists to fail fast with a clear error instead of
// hanging the HTTP request forever. Comfortably above the ~0.1s a real
// capture takes.
const CAPTURE_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/**
 * Capture a tab's WebContents as a PNG buffer.
 *
 * Electron's native `webContents.capturePage()` has been observed to hang
 * indefinitely (never resolve or reject — see GET /screenshot in
 * api/routes/browser.ts) when a Chrome DevTools Protocol debugger session is
 * already attached to the target. That's the common case for a live tab:
 * main.ts attaches a CDP session to nearly every webview for stealth
 * injection, and DevToolsManager attaches a fuller session (Page/Debugger/
 * Network domains) the first time console, network, snapshot, or evaluate
 * features touch a tab. Electron's native capture and the CDP session both
 * try to claim the same compositor frame sink; when a session is already
 * attached, native capture loses that race silently instead of erroring.
 *
 * Puppeteer/Playwright never hit this because they always screenshot
 * through the CDP session itself (`Page.captureScreenshot`) rather than a
 * separate native API. Do the same here whenever a debugger already owns
 * the target, and only fall back to the native path when nothing is
 * attached (the one case where native capture is safe and fastest).
 *
 * SEPARATE, UNFIXABLE-HERE caveat found while live-verifying the above: a
 * tab that isn't the currently active one is hidden via `display: none` on
 * its <webview> (shell/css/sidebar.css) — Electron ties guest-view paint
 * suspension directly to that, so Chromium stops submitting compositor
 * frames entirely. Both `capturePage()` AND `Page.captureScreenshot` (raw
 * CDP, confirmed directly against a live hidden tab) hang forever in that
 * state — this isn't the native-vs-CDP race above, there's just no frame to
 * capture. Making that work would mean force-showing tabs before capture,
 * which changes what the user sees; not attempted here. The timeout below
 * is the honest fallback: fail fast with a clear reason instead of hanging.
 */
export async function capturePagePng(wc: WebContents): Promise<Buffer> {
  return withTimeout(
    capturePagePngUnbounded(wc),
    CAPTURE_TIMEOUT_MS,
    'Screenshot capture timed out — the tab may not be visible (Tandem suspends rendering for background tabs)',
  );
}

async function capturePagePngUnbounded(wc: WebContents): Promise<Buffer> {
  if (wc.debugger.isAttached()) {
    try {
      const result = await wc.debugger.sendCommand('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      }) as { data?: string };
      if (result?.data) {
        return Buffer.from(result.data, 'base64');
      }
    } catch (e) {
      log.warn('CDP Page.captureScreenshot failed, falling back to capturePage:', e instanceof Error ? e.message : e);
    }
  }

  const image = await wc.capturePage();
  return image.toPNG();
}
