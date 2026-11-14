import { z } from 'zod';

import { PASSWORD_INPUT_CEILING, PASSWORD_REQUIRED_MESSAGE, PASSWORD_TOO_LONG_MESSAGE } from '../../../lib/users/validation';

/**
 * The password field of a protected action's request body (STORY-06.14, ADR-009: "a password field in the same request as the protected
 * action"). A route that takes a step-up puts this in its own strict body schema, as `password: stepUpPasswordSchema`, and passes the parsed
 * value to `verifyStepUp` with the session person. Presence and the ceiling only, so a huge body never reaches argon2; the password is not
 * trimmed or changed, never echoed, and its correctness is the service's to judge (422 `STEP_UP_FAILED`).
 */
export const stepUpPasswordSchema = z.string({ error: PASSWORD_REQUIRED_MESSAGE }).min(1, PASSWORD_REQUIRED_MESSAGE).max(PASSWORD_INPUT_CEILING, PASSWORD_TOO_LONG_MESSAGE);
