/**
 * What the sign-in form checks before it sends anything (SCR-01 "Form fields"). The words are the UX spec's.
 * Only the shape is checked here: whether the e-mail and password are right is the server's answer, and the
 * password rule (BR-049) is never applied at sign-in (architecture section 8).
 */

export const EMAIL_REQUIRED_MESSAGE = 'Enter your e-mail address.';
export const EMAIL_INVALID_MESSAGE = 'Enter an e-mail address like name@company.com.';
export const PASSWORD_REQUIRED_MESSAGE = 'Enter your password.';

/**
 * What an address looks like: a local part, an @, and a domain with at least one dot and a top level of letters. The
 * same rule as zod's default e-mail check, written out so the sign-in page does not carry zod (about 30 KB gzip) in its
 * first load (NFR-009). It is a hint for a typing slip; whether the address belongs to anyone is the server's answer.
 */
const EMAIL_SHAPE = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

/** The message for the e-mail field, or null when it is acceptable. Surrounding spaces are ignored, as the server ignores them. */
export function emailProblem(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return EMAIL_REQUIRED_MESSAGE;
  return EMAIL_SHAPE.test(trimmed) ? null : EMAIL_INVALID_MESSAGE;
}

/** The message for the password field, or null. The password is never trimmed or changed: spaces may be part of it. */
export function passwordProblem(value: string): string | null {
  return value === '' ? PASSWORD_REQUIRED_MESSAGE : null;
}
