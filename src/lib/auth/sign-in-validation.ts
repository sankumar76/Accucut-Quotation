import { z } from 'zod';

/**
 * What the sign-in form checks before it sends anything (SCR-01 "Form fields"). The words are the UX spec's.
 * Only the shape is checked here: whether the e-mail and password are right is the server's answer, and the
 * password rule (BR-049) is never applied at sign-in (architecture section 8).
 */

export const EMAIL_REQUIRED_MESSAGE = 'Enter your e-mail address.';
export const EMAIL_INVALID_MESSAGE = 'Enter an e-mail address like name@company.com.';
export const PASSWORD_REQUIRED_MESSAGE = 'Enter your password.';

const emailSchema = z.email();

/** The message for the e-mail field, or null when it is acceptable. Surrounding spaces are ignored, as the server ignores them. */
export function emailProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return EMAIL_REQUIRED_MESSAGE;
  return emailSchema.safeParse(trimmed).success ? null : EMAIL_INVALID_MESSAGE;
}

/** The message for the password field, or null. The password is never trimmed or changed: spaces may be part of it. */
export function passwordProblem(value: string): string | null {
  return value === '' ? PASSWORD_REQUIRED_MESSAGE : null;
}
