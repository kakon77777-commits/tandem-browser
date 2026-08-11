import { describe, it, expect } from 'vitest';
import { parseLocaleArg } from '../locale';

describe('parseLocaleArg', () => {
  it('extracts locale from --tandem-locale=zh-TW', () => {
    expect(parseLocaleArg(['--tandem-locale=zh-TW'])).toBe('zh-TW');
  });

  it('extracts locale from --tandem-locale=en-US with other args', () => {
    expect(parseLocaleArg(['--foo', '--tandem-locale=en-US', '--bar'])).toBe('en-US');
  });

  it('returns null if no matching arg', () => {
    expect(parseLocaleArg(['--other=1'])).toBe(null);
  });

  it('rejects unsupported locale values', () => {
    expect(parseLocaleArg(['--tandem-locale=fr-FR'])).toBe(null);
  });

  it('handles empty argv', () => {
    expect(parseLocaleArg([])).toBe(null);
  });
});
