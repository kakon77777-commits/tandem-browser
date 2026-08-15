/**
 * Shared PRIVATE/SHARED scoped-memory primitive (PMW's Private↔Shared
 * layer) and the SHARE operator's error type. PRIVATE is visible only to
 * the owning agent; SHARED is visible to everyone. Promotion only ever
 * flows one way — PRIVATE → SHARED — there is no demotion, matching PMW's
 * Isolate/Share/Join vocabulary (§4 of the theory series).
 */
export type Scope = 'PRIVATE' | 'SHARED';

export function isScope(value: unknown): value is Scope {
  return value === 'PRIVATE' || value === 'SHARED';
}

/** Thrown by a promote()-style method when the target isn't PRIVATE (nothing to promote). */
export class InvalidScopePromotionError extends Error {
  constructor(
    /** Human-readable kind, e.g. 'annotation', 'task step' — shows up in the error message. */
    public readonly entityKind: string,
    public readonly entityId: string,
    public readonly fromScope: Scope,
  ) {
    super(`Cannot promote ${entityKind} ${entityId} from scope "${fromScope}" (already shared)`);
    this.name = 'InvalidScopePromotionError';
  }
}
