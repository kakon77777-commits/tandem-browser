export const SUPPORTED_LOCALES = ['en-US', 'zh-TW'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const SUPPORTED_SET = new Set<string>(SUPPORTED_LOCALES);

/** Fall back to en-US for any locale the shell doesn't have translations for yet. */
export function resolveInitialLocale(setting: string): SupportedLocale {
  return SUPPORTED_SET.has(setting) ? (setting as SupportedLocale) : 'en-US';
}

export function buildLocaleAdditionalArg(locale: SupportedLocale): string {
  return `--tandem-locale=${locale}`;
}
