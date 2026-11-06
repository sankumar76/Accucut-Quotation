import { z } from 'zod';

import {
  EMAIL_INVALID_MESSAGE,
  NAME_REQUIRED_MESSAGE,
  NAME_TOO_LONG_MESSAGE,
  NOTHING_TO_CHANGE_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REQUIRED_MESSAGE,
  PASSWORD_TOO_LONG_MESSAGE,
  ROLE_REQUIRED_MESSAGE,
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_ROLE_VALUES,
} from '../../../lib/users/validation';

/**
 * The contract of the user routes (STORY-01.04, architecture section 6 "Users" and "Reset user password"). Every body,
 * path parameter and answer is a strict object: a key that is not named is an error, so a field added to a person later
 * (the password hash, the session version) cannot reach a client by being spread (NFR-002), and a client cannot set one.
 * The limits and the messages are the ones the screen uses (`src/lib/users/validation.ts`); the messages are the UX spec's
 * words for SCR-14 and are shown under the field they name.
 */

const name = z
  .string({ error: NAME_REQUIRED_MESSAGE })
  .trim()
  .min(1, NAME_REQUIRED_MESSAGE)
  .max(USER_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE);

const email = z
  .string({ error: EMAIL_INVALID_MESSAGE })
  .trim()
  .max(USER_EMAIL_MAX_LENGTH, EMAIL_INVALID_MESSAGE)
  .pipe(z.email(EMAIL_INVALID_MESSAGE));

const role = z.enum(USER_ROLE_VALUES, { error: ROLE_REQUIRED_MESSAGE });

/** The password is never trimmed or changed: spaces may be part of it. The rule (FR-098) is story 01.05's. */
const password = z
  .string({ error: PASSWORD_REQUIRED_MESSAGE })
  .min(1, PASSWORD_REQUIRED_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_TOO_LONG_MESSAGE);

/** What the Users list shows about a person, and what an add or an edit returns. No password hash, no session version. */
export const userSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  role: z.enum(USER_ROLE_VALUES),
  isActive: z.boolean(),
});

export const usersResponseSchema = z.strictObject({ users: z.array(userSchema) });

/** `POST /api/v1/users` (AC-1). */
export const createUserBodySchema = z.strictObject({ name, email, role, password });

/** `PATCH /api/v1/users/{id}` (AC-1, AC-4): name, role, or the active flag; not the e-mail. At least one field. */
export const updateUserBodySchema = z
  .strictObject({ name, role, isActive: z.boolean({ error: 'Choose active or not active.' }) })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: NOTHING_TO_CHANGE_MESSAGE });

/** `POST /api/v1/users/{id}/password-reset` (AC-5). */
export const resetPasswordBodySchema = z.strictObject({ password });

/**
 * The path parameter of `/api/v1/users/{id}`: a UUID, or the request is refused as invalid before anything is looked up.
 * It is written in lower case, the way PostgreSQL returns an ID, because the database ignores case and a string comparison must not.
 */
export const userIdParamsSchema = z.strictObject({ id: z.uuid('Not a user ID.').transform((id) => id.toLowerCase()) });
