import type { Response } from 'express';
import { VersionConflictError } from './version-conflict';

/** Error names that represent a client-side conflict (409), not a server failure (500). */
const CONFLICT_ERROR_NAMES = new Set([VersionConflictError.name, 'InvalidHandoffTransitionError', 'InvalidScopePromotionError', 'InvalidJoinError']);

/**
 * Error names that represent a permission denial (403), not a state
 * conflict (409) or server failure (500). This is this codebase's first
 * named-Error→403 dispatch — every other 403 today is a hand-written
 * inline check for a human declining a live prompt (script injection, JS
 * execution), not a manager-thrown class. InsufficientAuthorityError is a
 * genuine new use of this table, not "matches an existing 403 pattern".
 */
const FORBIDDEN_ERROR_NAMES = new Set(['InsufficientAuthorityError']);

/** Standard error handler for API route catch blocks */
export function handleRouteError(res: Response, e: unknown): void {
  const message = e instanceof Error ? e.message : String(e);
  const status = e instanceof Error && CONFLICT_ERROR_NAMES.has(e.name)
    ? 409
    : e instanceof Error && FORBIDDEN_ERROR_NAMES.has(e.name)
      ? 403
      : 500;
  res.status(status).json({ error: message });
}
