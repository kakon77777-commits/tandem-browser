/**
 * Read --tandem-locale=<locale> from process.argv (passed via
 * webPreferences.additionalArguments) and stamp it onto <html lang> before
 * paint. Mirrors src/preload/theme.ts's --tandem-theme= handling.
 *
 * This runs in the preload's isolated world at document-start. At that point
 * <html> exists but <body>/children may not — setAttribute on documentElement
 * is safe and lets shell/js/i18n.js read the resolved locale synchronously
 * (no flash-of-English on the main window) instead of waiting on a config
 * fetch.
 */

// See theme.ts for why this is a hand-declared shape rather than pulling in
// the DOM lib: the preload tsconfig targets node types (Buffer/fetch), which
// conflict with the full DOM lib.
interface LocaleDocumentElement {
  setAttribute(name: string, value: string): void;
}
interface LocaleDocument {
  documentElement: LocaleDocumentElement | null;
}
declare const document: LocaleDocument | undefined;

const VALID = new Set(['en-US', 'zh-TW']);

export function parseLocaleArg(argv: readonly string[]): string | null {
  const prefix = '--tandem-locale=';
  for (const a of argv) {
    if (a.startsWith(prefix)) {
      const v = a.slice(prefix.length);
      if (VALID.has(v)) return v;
      return null;
    }
  }
  return null;
}

/**
 * Called from the preload entry. Stamps two attributes on <html>:
 *   - lang="zh-TW"                       (or whatever locale was resolved)
 *   - data-tandem-initial-locale=...     always, so shell/js/i18n.js can
 *                                        read what we decided without a
 *                                        second parse of process.argv
 */
export function applyInitialLocale(): void {
  if (typeof document === 'undefined' || !document || !document.documentElement) return;
  const locale = parseLocaleArg(process.argv);
  if (!locale) return;
  document.documentElement.setAttribute('lang', locale);
  document.documentElement.setAttribute('data-tandem-initial-locale', locale);
}
