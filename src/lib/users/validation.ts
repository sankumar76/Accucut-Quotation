import { passwordRuleMessage, passwordRuleProblem } from '../auth/password-rule';
import { EMAIL_INVALID_MESSAGE, emailProblem } from '../auth/sign-in-validation';

/**
 * What the Users screen (SCR-14) checks before it sends anything, and the limits and words the server's schemas
 * (`src/server/views/schemas/users.ts`) use, so a limit or a sentence is written once. Only the shape is checked here: the
 * server decides (a used e-mail, a second Admin). Pure, and without zod, so the page does not carry it (NFR-009).
 * The password rule (FR-098, STORY-01.05) is `../auth/password-rule.ts`; the page applies the parts that need no list of common passwords,
 * and the server names that one ("too common", UX spec section 6.0).
 */

export { EMAIL_INVALID_MESSAGE };

export const USER_ROLE_VALUES = ['ADMIN', 'LEAD', 'ENGINEER'] as const;
export type UserRoleValue = (typeof USER_ROLE_VALUES)[number];

/** A person's name as the Users list shows it. Proposed limit; there is no rule in the SPEC. */
export const USER_NAME_MAX_LENGTH = 120;
/** An e-mail address, as RFC 5321 allows at most. */
export const USER_EMAIL_MAX_LENGTH = 254;
/**
 * The most characters of a password the routes read at all, so a huge body never reaches the rule or argon2 (architecture section 8).
 * It is well above the rule's 128 (`PASSWORD_MAX_LENGTH` of `password-rule.ts`): a password between the two reaches the rule, which
 * answers 422 `PASSWORD_RULE` with "Use 128 characters or fewer." like every other weak password (STORY-01.05 AC-2).
 */
export const PASSWORD_INPUT_CEILING = 1_024;

export const NAME_REQUIRED_MESSAGE = 'Enter a name.';
export const NAME_TOO_LONG_MESSAGE = `Use ${USER_NAME_MAX_LENGTH} characters or fewer.`;
export const ROLE_REQUIRED_MESSAGE = 'Choose a role.';
export const PASSWORD_REQUIRED_MESSAGE = 'Enter a password.';
export const PASSWORD_TOO_LONG_MESSAGE = passwordRuleMessage('TOO_LONG', 'other');
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

/**
 * The message for the password the Admin sets for `email`, or null. The password is never trimmed: spaces may be part of it. The parts
 * of the rule that need no list are checked here, on submit (UX spec section 6.0); the server repeats them and names "too common".
 */
export function newPasswordProblem(value: string, email: string): string | null {
  if (value === '') return PASSWORD_REQUIRED_MESSAGE;
  return passwordRuleProblem(value, { email, subject: 'other' });
}

export function isUserRole(value: string): value is UserRoleValue {
  return USER_ROLE_VALUES.some((role) => role === value);
}
