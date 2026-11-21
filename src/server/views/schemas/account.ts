import { z } from 'zod';

import { CURRENT_PASSWORD_REQUIRED_MESSAGE, CURRENT_PASSWORD_WRONG_MESSAGE } from '../../../lib/auth/change-password';
import { RESET_LINK_INVALID_MESSAGE } from '../../../lib/auth/password-reset';
import { EMAIL_INVALID_MESSAGE, PASSWORD_INPUT_CEILING, PASSWORD_REQUIRED_MESSAGE, PASSWORD_TOO_LONG_MESSAGE, USER_EMAIL_MAX_LENGTH } from '../../../lib/users/validation';

/**
 * The contract of `POST /api/v1/account/password` (STORY-01.05 AC-3, architecture section 6 "Change password"): the current password
 * and the new one. The two new passwords being the same is the screen's check (UX spec section 6.0); the server never sees the repeat.
 * Strict: a key that is not named is an error. Neither password is trimmed or changed, and neither is ever echoed. Only presence and the
 * ceiling are the schema's; the rule on the new password (length in code points, number, symbol, e-mail, common) is `assertPasswordRule`,
 * which names the failing part (422 `PASSWORD_RULE`).
 */

const password = z
  .string({ error: PASSWORD_REQUIRED_MESSAGE })
  .min(1, PASSWORD_REQUIRED_MESSAGE)
  .max(PASSWORD_INPUT_CEILING, PASSWORD_TOO_LONG_MESSAGE);

export const changePasswordBodySchema = z.strictObject({
  // Longer than any password the portal could have stored (sign-in reads up to the same ceiling): it can only be wrong.
  currentPassword: z
    .string({ error: CURRENT_PASSWORD_REQUIRED_MESSAGE })
    .min(1, CURRENT_PASSWORD_REQUIRED_MESSAGE)
    .max(PASSWORD_INPUT_CEILING, CURRENT_PASSWORD_WRONG_MESSAGE),
  newPassword: password,
});

/**
 * The contracts of the two public routes of STORY-09.07 (architecture section 6 "Forgot password", "Reset password"). Strict, like every body: a key that is not named is an error.
 *
 * `forgot`: only an e-mail. A malformed one is 422 for everyone alike (AC-3); whether it belongs to anyone is never in the answer, which is always `{ message }` with one sentence.
 * `reset`: the token and the new password. The token is only length-limited here: one that is not the shape of an issued token is the same 400 `RESET_LINK_INVALID` as a used or unknown
 * one (the service decides), so the answer never tells a wrong guess from an old link. The password is never trimmed or echoed; the rule is `assertPasswordRule`, which names the failing part.
 */
const RESET_TOKEN_CEILING = 256;

export const forgotPasswordBodySchema = z.strictObject({
  email: z
    .string({ error: EMAIL_INVALID_MESSAGE })
    .trim()
    .max(USER_EMAIL_MAX_LENGTH, EMAIL_INVALID_MESSAGE)
    .pipe(z.email(EMAIL_INVALID_MESSAGE)),
});

export const forgotPasswordResponseSchema = z.strictObject({ message: z.string().min(1) });

export const resetByLinkBodySchema = z.strictObject({
  token: z.string({ error: RESET_LINK_INVALID_MESSAGE }).min(1, RESET_LINK_INVALID_MESSAGE).max(RESET_TOKEN_CEILING, RESET_LINK_INVALID_MESSAGE),
  newPassword: password,
});
