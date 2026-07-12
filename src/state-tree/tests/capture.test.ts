import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', () => ({
  default: { writeFileSync: vi.fn() },
  writeFileSync: vi.fn(),
}));

vi.mock('../../utils/paths', () => ({
  ensureDir: vi.fn((...parts: string[]) => `/tmp/tandem/${parts.join('/')}`),
  tandemDir: vi.fn((...parts: string[]) => `/tmp/tandem/${parts.join('/')}`),
}));

import fs from 'fs';
import { saveStateScreenshot, truncateDomSummary } from '../capture';

describe('saveStateScreenshot()', () => {
  it('writes the PNG buffer under the state-tree-screenshots dir named by node id', () => {
    const path = saveStateScreenshot(Buffer.from('fake-png'), 'state-123');

    expect(path).toContain('state-tree-screenshots');
    expect(path).toContain('state-123.png');
    expect(fs.writeFileSync).toHaveBeenCalledWith(path, Buffer.from('fake-png'));
  });
});

describe('truncateDomSummary()', () => {
  it('returns short text unchanged', () => {
    expect(truncateDomSummary('short')).toBe('short');
  });

  it('truncates long text and appends a marker', () => {
    const long = 'x'.repeat(5000);
    const result = truncateDomSummary(long);

    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('truncated');
    expect(result.startsWith('x'.repeat(4000))).toBe(true);
  });
});
