import { z } from 'zod';

import { CURRENT_PASSWORD_REQUIRED_MESSAGE, CURRENT_PASSWORD_WRONG_MESSAGE } from '../../../lib/auth/change-password';
import { PASSWORD_INPUT_CEILING, PASSWORD_REQUIRED_MESSAGE, PASSWORD_TOO_LONG_MESSAGE } from '../../../lib/users/validation';

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
