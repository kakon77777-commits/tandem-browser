import { describe, it, expect } from 'vitest';
import { resolveInitialLocale, buildLocaleAdditionalArg } from '../resolver';

describe('resolveInitialLocale', () => {
  it('passes through a supported locale', () => {
    expect(resolveInitialLocale('zh-TW')).toBe('zh-TW');
    expect(resolveInitialLocale('en-US')).toBe('en-US');
  });

  it('falls back to en-US for an unsupported or malformed locale', () => {
    expect(resolveInitialLocale('fr-FR')).toBe('en-US');
    expect(resolveInitialLocale('')).toBe('en-US');
    expect(resolveInitialLocale('nl-BE')).toBe('en-US');
  });
});

describe('buildLocaleAdditionalArg', () => {
  it('returns --tandem-locale=zh-TW for zh-TW', () => {
    expect(buildLocaleAdditionalArg('zh-TW')).toBe('--tandem-locale=zh-TW');
  });
  it('returns --tandem-locale=en-US for en-US', () => {
    expect(buildLocaleAdditionalArg('en-US')).toBe('--tandem-locale=en-US');
  });
});
