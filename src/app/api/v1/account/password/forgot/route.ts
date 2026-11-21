import { FORGOT_ACCEPTED_MESSAGE } from '@/lib/auth/password-reset';
import { getPasswordResetService } from '@/server/composition';
import { withPublicRoute } from '@/server/http/with-public-route';
import { forgotPasswordBodySchema, forgotPasswordResponseSchema } from '@/server/views/schemas/account';

const ACCEPTED = 202;

/**
 * `POST /api/v1/account/password/forgot` (STORY-09.07 AC-1 to AC-4; architecture section 6): a person who forgot their password asks for a reset link. Public: they cannot sign in. The
 * answer is 202 with one fixed message for a known e-mail, an unknown one, a deactivated person and `FEATURE_EMAIL` off alike, with the same headers (FR-001: no way to tell which e-mails
 * exist); a malformed address is 422 for everyone, and more than 5 requests in 15 minutes for one typed e-mail or from one address is 429, known or not. The recipient of the message is read from
 * the database at send time and nothing the caller sends is used as an address. Nothing is logged here: the line a request could write would hold the e-mail or the outcome.
 */
export const POST = withPublicRoute({
  route: '/api/v1/account/password/forgot',
  method: 'POST',
  status: ACCEPTED,
  body: forgotPasswordBodySchema,
  output: forgotPasswordResponseSchema,
  handler: async ({ body, ipAddress }) => {
    await getPasswordResetService().requestReset({ email: body.email, ipAddress });
    return { message: FORGOT_ACCEPTED_MESSAGE };
  },
});
