/**
 * Shared compare-and-set (CAS) primitive for durable objects across the SRW
 * layer (tasks, handoffs, annotations). Each of those managers persists to
 * its own JSON file with its own read-then-overwrite write path and no
 * version check today — two concurrent writers (e.g. two API requests
 * touching the same task) silently clobber each other. This is the PMW
 * "State CAS" invariant (I1): writes carry an expected version, and a
 * mismatch is a real, catchable error instead of silent data loss.
 *
 * `expectedVersion` is optional everywhere it's threaded through — callers
 * that don't pass it keep today's last-write-wins behavior unchanged. This
 * is deliberate: retrofitting CAS onto ~30 existing route/MCP call sites in
 * one pass isn't this change's scope; new/careful callers can opt in today,
 * and call sites can be upgraded incrementally.
 */
export class VersionConflictError extends Error {
  constructor(
    public readonly entityId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
  ) {
    super(`Version conflict for ${entityId}: expected ${expectedVersion}, current ${actualVersion}`);
    this.name = 'VersionConflictError';
  }
}

/** Throws VersionConflictError if expectedVersion is given and doesn't match. No-op when expectedVersion is undefined. */
export function checkVersion(entityId: string, actualVersion: number, expectedVersion?: number): void {
  if (expectedVersion === undefined) return;
  if (expectedVersion !== actualVersion) {
    throw new VersionConflictError(entityId, expectedVersion, actualVersion);
  }
}
