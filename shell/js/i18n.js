// Shared i18n runtime for all Tandem shell HTML documents.
// Load via: <script src="js/i18n/<locale>.js"></script> for every supported
// locale, THEN <script src="js/i18n.js"></script> (classic scripts — see
// html-escape.js/shortcut-labels.js for the same pattern; window.TandemI18n
// needs to exist synchronously for any later classic script in the page).
// Each locale's dictionary lives in its own file under shell/js/i18n/ (e.g.
// shell/js/i18n/zh-TW.js) rather than inline here — one file per language
// means adding or editing a language never touches this file or any other
// language's file, so parallel translation work (by hand or by dispatching
// one agent per language) has zero merge collisions. Every dictionary file
// sets window.__TANDEM_I18N_DICTS__[locale] as a side effect; this file just
// reads that registry — see TRANSLATIONS below.
//
// Approach: rather than requiring a data-i18n="key" attribute on every one
// of the ~700 hardcoded English strings across the shell, this walks the
// DOM (mirroring shortcut-labels.js's TreeWalker technique for Cmd/Ctrl
// labels) and replaces exact-match English source strings with their
// translation for the active locale — in text nodes and in
// title/placeholder/aria-label/alt attributes. Untranslated strings are left
// as English (safe, incremental — a surface can be translated at any time
// without this file needing changes elsewhere).
//
// Responsibilities:
//   - applyLocale(locale): translate the current document + stamp <html lang>
//   - t(key): programmatic lookup for dynamic strings assembled from
//     concatenation/interpolation, where the English source never appears
//     verbatim as one static DOM chunk for the TreeWalker to match
//   - MutationObserver: auto-translate content injected later by any of the
//     ~15 files that build UI via innerHTML, without those files needing to
//     call anything here themselves
//   - subscribe to the 'tandem-locale' BroadcastChannel for live updates
//     when the user changes the setting in another window (mirrors
//     shell/js/theme.js's 'tandem-theme' channel)
//
// Pre-paint locale (src/preload/locale.ts) avoids a flash on the main
// window; other shell pages (loaded as <webview>s, no preload access) pick
// up the locale from an async /config fetch instead, same tradeoff
// shell/js/theme.js accepts for its own pre-paint story.
//
// Shortcut-label race (found live, non-mac): shortcut-labels.js rewrites
// "Cmd+X"/"⌘X" to "Ctrl+X" on Windows/Linux. Both it and this file gate
// their real work behind an async step — shortcut-labels.js awaits a
// platform IPC round-trip, this file awaits an async /config fetch on any
// page without a preload-stamped locale (i.e. every page except the main
// window). There's no guaranteed order between the two, so any dictionary
// entry whose source text embeds a literal shortcut needs BOTH the Cmd/⌘
// form (translation wins the race) and the Ctrl form (shortcut-labels.js
// wins the race, and this file then matches the already-rewritten text)
// — see the 'Cmd+T' / 'Ctrl+T' pair below for the pattern.

(() => {
  const SKIP_TEXT_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);
  // data-tip: settings.html's .tooltip elements use it as a CSS
  // content:attr(data-tip) hover tooltip — user-facing, needs translation too.
  const TRANSLATABLE_ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip'];
  const BC_NAME = 'tandem-locale';

  // Every supported locale's dictionary is loaded from its own file under
  // shell/js/i18n/ (e.g. shell/js/i18n/zh-TW.js) via a <script> tag that
  // MUST appear BEFORE this one in every shell HTML document's <head> — see
  // this file's module comment above. Each dictionary file sets its own
  // window.__TANDEM_I18N_DICTS__[locale] as a side effect; TRANSLATIONS below
  // just reads that registry once, synchronously, at this file's load time —
  // if a language's <script> tag were ever placed after this one instead,
  // its entries would silently never be seen (TRANSLATIONS would already be
  // a plain {} by the time that script runs), not throw.
  //
  // TRANSLATIONS['zh-TW'] is force-seeded to {} here if absent, purely so
  // shell/tests/i18n.test.js can inject test fixtures via
  // __TRANSLATIONS['zh-TW'][key]=... without first needing to load the real
  // (large, evolving) zh-TW.js file — see that test file's own comment on
  // __TRANSLATIONS.
  const TRANSLATIONS = window.__TANDEM_I18N_DICTS__ || {};
  if (!TRANSLATIONS['zh-TW']) TRANSLATIONS['zh-TW'] = {};

  let currentLocale = 'en-US';
  let observer = null;

  function dictFor(locale) {
    return TRANSLATIONS[locale] || null;
  }

  function translateOne(raw, dict) {
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    const hit = dict[trimmed];
    if (!hit) return raw;
    const leading = raw.slice(0, raw.length - raw.trimStart().length);
    const trailing = raw.slice(raw.trimEnd().length);
    return leading + hit + trailing;
  }

  function translateSubtree(root, dict) {
    if (root.nodeType === Node.TEXT_NODE) {
      const translated = translateOne(root.nodeValue || '', dict);
      if (translated !== root.nodeValue) root.nodeValue = translated;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || SKIP_TEXT_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      const translated = translateOne(node.nodeValue || '', dict);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    }

    for (const attr of TRANSLATABLE_ATTRS) {
      if (typeof root.querySelectorAll === 'function') {
        for (const el of root.querySelectorAll(`[${attr}]`)) {
          const val = el.getAttribute(attr) || '';
          const translated = translateOne(val, dict);
          if (translated !== val) el.setAttribute(attr, translated);
        }
      }
      if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute(attr)) {
        const val = root.getAttribute(attr) || '';
        const translated = translateOne(val, dict);
        if (translated !== val) root.setAttribute(attr, translated);
      }
    }
  }

  /**
   * Programmatic lookup for dynamic strings that don't exist verbatim in the
   * DOM — either fused with data (counts, names, statuses) or written to a
   * spot the DOM scan can't see (an attribute/property set on an
   * already-existing element, <input>/<textarea>.value, or a native
   * alert()/confirm() string).
   *
   * Two modes:
   *   t(key)         — key IS the English display text; returned verbatim
   *                     as fallback on a miss (unchanged pre-existing
   *                     behavior — every non-parameterized call site relies
   *                     on this).
   *   t(key, params) — key is a stable template id containing {name}
   *                     placeholders (e.g. '{count} updates available').
   *                     On a dict hit, placeholders are substituted from
   *                     params. On a miss, returns null rather than the raw
   *                     key: a template id is not itself grammatically valid
   *                     English (pluralization differs per language), so
   *                     every parameterized call site must supply its own
   *                     English fallback, e.g.:
   *                       t('{count} updates available', {count: n})
   *                         ?? `${n} update${n === 1 ? '' : 's'} available`
   */
  function t(key, params) {
    const dict = dictFor(currentLocale);
    const hit = dict && dict[key];
    if (params) {
      if (!hit) return null;
      return hit.replace(/\{(\w+)\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m);
    }
    return hit || key;
  }

  function applyLocale(locale) {
    currentLocale = locale;
    document.documentElement.setAttribute('lang', locale);
    const dict = dictFor(locale);
    if (!dict) return; // en-US (or any locale without a dict yet) = leave source strings as-is
    translateSubtree(document.body, dict);
  }

  function getStampedLocale() {
    return document.documentElement.getAttribute('data-tandem-initial-locale') || null;
  }

  async function loadLocaleFromConfig() {
    try {
      const API = window.__TANDEM_API_BASE__ || 'http://127.0.0.1:8765';
      const res = await fetch(`${API}/config`);
      if (!res.ok) return;
      const config = await res.json();
      const locale = (config && config.general && config.general.language) || 'en-US';
      applyLocale(locale);
    } catch {
      // API not ready — leave whatever locale the preload/HTML already has.
    }
  }

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const dict = dictFor(currentLocale);
      if (!dict) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          translateSubtree(node, dict);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function subscribeToBroadcasts() {
    try {
      const bc = new BroadcastChannel(BC_NAME);
      bc.onmessage = (e) => {
        if (e && e.data && e.data.locale) applyLocale(e.data.locale);
      };
      return bc;
    } catch {
      return null;
    }
  }

  function init() {
    const run = () => {
      const stamped = getStampedLocale();
      if (stamped) applyLocale(stamped);
      // Always reconcile with the authoritative config afterward (catches
      // drift — e.g. the user changed the setting in another window and
      // this page has no preload stamp, such as a <webview>-hosted page).
      void loadLocaleFromConfig();
      startObserving();
      subscribeToBroadcasts();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  window.TandemI18n = {
    applyLocale,
    getLocale: () => currentLocale,
    t,
    // Internal — tests only. Lets shell/tests/i18n.test.js exercise
    // translation behavior without depending on the real (large, evolving)
    // dictionary contents.
    __TRANSLATIONS: TRANSLATIONS,
  };

  if (!window.__TANDEM_I18N_SUPPRESS_AUTOINIT__) {
    try { init(); } catch { /* ignore */ }
  }
})();
