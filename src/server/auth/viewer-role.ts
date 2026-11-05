import 'server-only';

import { unstable_rethrow } from 'next/navigation';

import type { RoleName } from '../../lib/auth/roles';
import { isAppError } from '../../lib/errors';
import { logger } from '../../lib/logger';

import { getCurrentUser } from './session';

/**
 * The role of the person looking at a system page, or `null` when it cannot be read (UX spec v0.12, SCR-26). It only picks
 * the words of the page's one button (`homeActionLabel`): it must never decide whether a page is shown, and it takes no
 * input, so the answer cannot depend on which address was asked for (UX-22, AC-8).
 *
 * A failure to read it, for example a database that is busy, must not turn a "not found" or "no access" page into an error
 * page: the page then says "Go to the task list", the accepted role-neutral wording, and the log gets the kind of failure
 * and its code, never the message (STD-01). Next.js's own control-flow errors (a request that has to be rendered
 * dynamically) are let through, or the page would be built once and served to everyone.
 */
export async function readViewerRole(): Promise<RoleName | null> {
  try {
    return (await getCurrentUser())?.role ?? null;
  } catch (error) {
    unstable_rethrow(error);
    logger.warn(
      { errorName: error instanceof Error ? error.name : 'NonError', errorCode: isAppError(error) ? error.code : undefined },
      'the role of the viewer could not be read for a system page',
    );
    return null;
  }
}
