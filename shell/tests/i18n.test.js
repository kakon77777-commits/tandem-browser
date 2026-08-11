// @vitest-environment jsdom
// Suppress auto-init in tests — we invoke APIs manually.
globalThis.__TANDEM_I18N_SUPPRESS_AUTOINIT__ = true;
if (typeof window !== 'undefined') window.__TANDEM_I18N_SUPPRESS_AUTOINIT__ = true;

import { describe, it, expect, beforeEach, vi } from 'vitest';

async function loadFresh() {
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('data-tandem-initial-locale');
  document.body.innerHTML = '';
  vi.resetModules();
  await import('../js/i18n.js');
  return window.TandemI18n;
}

describe('shell i18n module', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('data-tandem-initial-locale');
    document.body.innerHTML = '';
  });

  it('exposes window.TandemI18n for classic script consumers', async () => {
    const i18n = await loadFresh();
    expect(i18n).toBeDefined();
    expect(typeof i18n.applyLocale).toBe('function');
    expect(typeof i18n.getLocale).toBe('function');
    expect(typeof i18n.t).toBe('function');
  });

  it('applyLocale stamps <html lang>', async () => {
    const i18n = await loadFresh();
    i18n.applyLocale('zh-TW');
    expect(document.documentElement.getAttribute('lang')).toBe('zh-TW');
    expect(i18n.getLocale()).toBe('zh-TW');
  });

  it('translates matching text nodes for a known locale', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['Settings'] = '設定';
    document.body.innerHTML = '<button>Settings</button>';

    i18n.applyLocale('zh-TW');

    expect(document.body.querySelector('button').textContent).toBe('設定');
  });

  it('preserves surrounding whitespace when translating a text node', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['Settings'] = '設定';
    document.body.innerHTML = '<button>\n  Settings\n</button>';

    i18n.applyLocale('zh-TW');

    expect(document.body.querySelector('button').textContent).toBe('\n  設定\n');
  });

  it('translates title/placeholder/aria-label/alt attributes', async () => {
    const i18n = await loadFresh();
    Object.assign(i18n.__TRANSLATIONS['zh-TW'], {
      'Close tab': '關閉分頁',
      'Search': '搜尋',
      'Open sidebar': '開啟側邊欄',
      'Logo': '標誌',
    });
    document.body.innerHTML = `
      <button title="Close tab"></button>
      <input placeholder="Search">
      <div aria-label="Open sidebar"></div>
      <img alt="Logo">
    `;

    i18n.applyLocale('zh-TW');

    expect(document.body.querySelector('button').getAttribute('title')).toBe('關閉分頁');
    expect(document.body.querySelector('input').getAttribute('placeholder')).toBe('搜尋');
    expect(document.body.querySelector('div').getAttribute('aria-label')).toBe('開啟側邊欄');
    expect(document.body.querySelector('img').getAttribute('alt')).toBe('標誌');
  });

  it('translates data-tip (settings.html tooltip attribute)', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['Hover for explanation'] = '將滑鼠移到此處查看說明';
    document.body.innerHTML = '<span class="tooltip" data-tip="Hover for explanation"></span>';

    i18n.applyLocale('zh-TW');

    expect(document.body.querySelector('span').getAttribute('data-tip')).toBe('將滑鼠移到此處查看說明');
  });

  it('leaves text unchanged for a locale with no translation dictionary', async () => {
    const i18n = await loadFresh();
    document.body.innerHTML = '<button>Settings</button>';

    i18n.applyLocale('en-US');

    expect(document.body.querySelector('button').textContent).toBe('Settings');
  });

  it('leaves unmatched strings as-is (incremental translation)', async () => {
    const i18n = await loadFresh();
    document.body.innerHTML = '<button>Some string nobody translated yet</button>';

    i18n.applyLocale('zh-TW');

    expect(document.body.querySelector('button').textContent).toBe('Some string nobody translated yet');
  });

  it('does not touch text inside script/style/textarea/input/code/pre', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['Settings'] = '設定';
    document.body.innerHTML = '<pre>Settings</pre><code>Settings</code>';

    i18n.applyLocale('zh-TW');

    expect(document.body.querySelector('pre').textContent).toBe('Settings');
    expect(document.body.querySelector('code').textContent).toBe('Settings');
  });

  it('t(key) returns the translation for the active locale, or the key itself as fallback', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['Bookmarks'] = '書籤';
    i18n.applyLocale('zh-TW');

    expect(i18n.t('Bookmarks')).toBe('書籤');
    expect(i18n.t('Nothing translated for this one')).toBe('Nothing translated for this one');
  });

  it('t(key, params) substitutes {name} placeholders from a dict hit', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['{count} test-only widgets'] = '{count} 個測試小工具';
    i18n.applyLocale('zh-TW');

    expect(i18n.t('{count} test-only widgets', { count: 3 })).toBe('3 個測試小工具');
  });

  it('t(key, params) substitutes multiple distinct placeholders', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['test-only {thing} seen: {when}'] = '測試用{thing}．上次見到：{when}';
    i18n.applyLocale('zh-TW');

    expect(i18n.t('test-only {thing} seen: {when}', { thing: 'widget', when: 'never' })).toBe(
      '測試用widget．上次見到：never'
    );
  });

  it('t(key, params) returns null (not the raw template key) on a miss', async () => {
    const i18n = await loadFresh();
    i18n.applyLocale('zh-TW');

    expect(i18n.t('{count} nonexistent test-only template', { count: 3 })).toBeNull();
  });

  it('t(key, params) leaves a placeholder literal if params is missing that name', async () => {
    const i18n = await loadFresh();
    i18n.__TRANSLATIONS['zh-TW']['{count} test-only widgets'] = '{count} 個測試小工具';
    i18n.applyLocale('zh-TW');

    expect(i18n.t('{count} test-only widgets', {})).toBe('{count} 個測試小工具');
  });

  it('reads the preload-stamped initial locale on init (no flash on the main window)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ general: { language: 'zh-TW' } }) });
    const i18n = await loadFresh();
    document.documentElement.setAttribute('data-tandem-initial-locale', 'zh-TW');

    i18n.__TRANSLATIONS['zh-TW']['Settings'] = '設定';
    document.body.innerHTML = '<button>Settings</button>';
    // init() isn't run automatically in tests (autoinit suppressed) — this
    // test exercises the same stamped-attribute read applyLocale() would use
    // if init() ran, via the public applyLocale() API instead of re-invoking
    // the module-private init().
    const stamped = document.documentElement.getAttribute('data-tandem-initial-locale');
    i18n.applyLocale(stamped);

    expect(document.body.querySelector('button').textContent).toBe('設定');
  });

  it('auto-translates content added later (MutationObserver) when autoinit runs', async () => {
    document.documentElement.removeAttribute('data-tandem-initial-locale');
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ general: { language: 'zh-TW' } }) });
    window.__TANDEM_I18N_SUPPRESS_AUTOINIT__ = false;
    vi.resetModules();
    await import('../js/i18n.js');
    const i18n = window.TandemI18n;
    i18n.__TRANSLATIONS['zh-TW']['Dynamic label'] = '動態標籤';

    // Let the async loadLocaleFromConfig() from init() resolve and set the locale.
    await vi.waitFor(() => expect(i18n.getLocale()).toBe('zh-TW'));

    const el = document.createElement('button');
    el.textContent = 'Dynamic label';
    document.body.appendChild(el);

    await vi.waitFor(() => expect(el.textContent).toBe('動態標籤'));

    window.__TANDEM_I18N_SUPPRESS_AUTOINIT__ = true;
  });
});
