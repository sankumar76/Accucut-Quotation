import { EMAIL_INVALID_MESSAGE, emailProblem } from '../auth/sign-in-validation';

/**
 * What the Users screen (SCR-14) checks before it sends anything, and the limits and words the server's schemas
 * (`src/server/views/schemas/users.ts`) use, so a limit or a sentence is written once. Only the shape is checked here: the
 * server decides (a used e-mail, a second Admin). Pure, and without zod, so the page does not carry it (NFR-009).
 * The password rule (FR-098) is story 01.05's; until then a password only has to be present and not longer than the limit.
 */

export { EMAIL_INVALID_MESSAGE };

export const USER_ROLE_VALUES = ['ADMIN', 'LEAD', 'ENGINEER'] as const;
export type UserRoleValue = (typeof USER_ROLE_VALUES)[number];

/** A person's name as the Users list shows it. Proposed limit; there is no rule in the SPEC. */
export const USER_NAME_MAX_LENGTH = 120;
/** An e-mail address, as RFC 5321 allows at most. */
export const USER_EMAIL_MAX_LENGTH = 254;
/** The longest password accepted, checked before hashing so a huge input cannot tie up argon2 (architecture section 8). */
export const PASSWORD_MAX_LENGTH = 128;

export const NAME_REQUIRED_MESSAGE = 'Enter a name.';
export const NAME_TOO_LONG_MESSAGE = `Use ${USER_NAME_MAX_LENGTH} characters or fewer.`;
export const ROLE_REQUIRED_MESSAGE = 'Choose a role.';
export const PASSWORD_REQUIRED_MESSAGE = 'Enter a password.';
export const PASSWORD_TOO_LONG_MESSAGE = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;
export const NOTHING_TO_CHANGE_MESSAGE = 'Change at least one of name, role or active.';

/** The message for the name field, or null. Surrounding spaces are ignored, as the server ignores them. */
export function nameProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return NAME_REQUIRED_MESSAGE;
  return trimmed.length > USER_NAME_MAX_LENGTH ? NAME_TOO_LONG_MESSAGE : null;
}

/** The message for the e-mail field, or null. An empty field gets the same example as a wrong one. */
export function userEmailProblem(value: string): string | null {
  if (value.trim().length > USER_EMAIL_MAX_LENGTH) return EMAIL_INVALID_MESSAGE;
  return emailProblem(value) === null ? null : EMAIL_INVALID_MESSAGE;
}

/** The message for a password field, or null. The password is never trimmed: spaces may be part of it. */
export function newPasswordProblem(value: string): string | null {
  if (value === '') return PASSWORD_REQUIRED_MESSAGE;
  return value.length > PASSWORD_MAX_LENGTH ? PASSWORD_TOO_LONG_MESSAGE : null;
}

export function isUserRole(value: string): value is UserRoleValue {
  return USER_ROLE_VALUES.some((role) => role === value);
}
