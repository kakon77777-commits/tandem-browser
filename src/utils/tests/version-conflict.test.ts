import { describe, it, expect } from 'vitest';
import { checkVersion, VersionConflictError } from '../version-conflict';

describe('checkVersion', () => {
  it('is a no-op when expectedVersion is undefined', () => {
    expect(() => checkVersion('task-1', 5, undefined)).not.toThrow();
  });

  it('passes when expectedVersion matches actualVersion', () => {
    expect(() => checkVersion('task-1', 3, 3)).not.toThrow();
  });

  it('throws VersionConflictError on mismatch', () => {
    expect(() => checkVersion('task-1', 3, 2)).toThrow(VersionConflictError);
  });

  it('the thrown error carries entityId/expectedVersion/actualVersion', () => {
    try {
      checkVersion('task-1', 3, 2);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(VersionConflictError);
      const err = e as VersionConflictError;
      expect(err.entityId).toBe('task-1');
      expect(err.expectedVersion).toBe(2);
      expect(err.actualVersion).toBe(3);
    }
  });
});
