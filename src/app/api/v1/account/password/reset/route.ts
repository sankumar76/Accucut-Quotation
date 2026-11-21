import { z } from 'zod';

import { logger } from '@/lib/logger';
import { getPasswordResetService } from '@/server/composition';
import { withPublicRoute } from '@/server/http/with-public-route';
import { resetByLinkBodySchema } from '@/server/views/schemas/account';

const NO_CONTENT = 204;

/** The one line a successful reset writes (STORY-09.07 AC-9, assumption A-2): who and which request, never the token, the password, a hash or the e-mail. */
const PASSWORD_RESET_LOG_MESSAGE = 'A person reset their password with an e-mailed link.';

/**
 * `POST /api/v1/account/password/reset` (STORY-09.07 AC-5 to AC-8; architecture section 6): the person chooses a new password with the link. Public: they cannot sign in. 204 with no body
 * (so no password and no hash can be in it) when the link was used; 400 `RESET_LINK_INVALID` for a link that is used, expired or unknown, the same for all three; 422 naming the failing part when
 * the password breaks the rule, with the link still usable. The token is claimed by one atomic statement, so two requests at once with it give one 204 and one 400. No session is issued: the
 * person signs in with the new password, and every session they had has ended.
 */
export const POST = withPublicRoute({
  route: '/api/v1/account/password/reset',
  method: 'POST',
  status: NO_CONTENT,
  body: resetByLinkBodySchema,
  output: z.undefined(),
  handler: async ({ body, requestId }) => {
    const { userId } = await getPasswordResetService().resetPassword(body);
    logger.info({ requestId, userId }, PASSWORD_RESET_LOG_MESSAGE);
    return undefined;
  },
});
