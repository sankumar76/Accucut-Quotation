import { z } from 'zod';

import { logger } from '@/lib/logger';
import { getAccountService, getSessionCookieIssuer } from '@/server/composition';
import { withRoute } from '@/server/http/with-route';
import { changePasswordBodySchema } from '@/server/views/schemas/account';

const NO_CONTENT = 204;

/** The one line a successful change writes (STD-07, DL-193): who and which request, never the password, a hash, the e-mail or the body. */
const PASSWORD_CHANGED_LOG_MESSAGE = 'A person changed their own password.';

/**
 * `POST /api/v1/account/password` (STORY-01.05 AC-3, AC-5, AC-6): the signed-in person changes their own password with the current
 * one. Every role, and the one API route open to a person who still has to set a new password (`mustChangeAllowed`). The answer is
 * 204 with no body, so no password and no hash can be in it, and it carries a fresh session cookie: the change raises
 * `session_version`, which ends every session issued before, and this browser keeps working with the new one. A refusal sets no cookie.
 */
export const POST = withRoute({
  route: '/api/v1/account/password',
  method: 'POST',
  status: NO_CONTENT,
  body: changePasswordBodySchema,
  output: z.undefined(),
  handler: async ({ user, body, requestId, setSessionCookie }) => {
    const { sessionVersion } = await getAccountService().changePassword(user.id, body);
    setSessionCookie(await getSessionCookieIssuer().issue(user.id, sessionVersion));
    logger.info({ requestId, userId: user.id }, PASSWORD_CHANGED_LOG_MESSAGE);
    return undefined;
  },
});
