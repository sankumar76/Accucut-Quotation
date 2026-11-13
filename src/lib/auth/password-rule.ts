/**
 * The password rule (FR-098, BR-049, D-19; architecture section 8 "Password rule"; STORY-01.05 AC-1 and AC-2). One place, used by the
 * server wherever a password is set (`src/server/services/password-policy.ts`) and by the screens that ask for one, so a limit or a
 * sentence is written once. Sign-in never runs it: an existing weak password still signs in (AC-4).
 *
 *   - Length: 10 to 128 characters, counted in code points (an emoji is one), checked before the password is hashed.
 *   - Number: at least one digit.
 *   - Symbol: at least one character that is neither a letter nor a digit (ASSUMPTION-56). A space is a symbol; a letter of any
 *     alphabet is a letter, never a symbol.
 *   - E-mail: not the person's e-mail address, in any letter case.
 *   - Common: not on the bundled list (`common-passwords.ts`). The list is read by the server only, so the check is handed in as
 *     `isCommon`; the page leaves it out and the server names "too common" (UX spec section 6.0).
 *
 * Pure, and without zod or the list, so the page does not carry them (NFR-009). The failing part is the first that fails, in the
 * order above, and its message is the UX spec's words.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** The hint under a new-password field (UX spec section 6.0). */
export const PASSWORD_RULE_HINT = `At least ${PASSWORD_MIN_LENGTH} and at most ${PASSWORD_MAX_LENGTH} characters, with at least one number and one symbol, such as ! # $ or %.`;

export type PasswordRuleFailure = 'TOO_SHORT' | 'TOO_LONG' | 'SAME_AS_EMAIL' | 'NO_NUMBER_OR_SYMBOL' | 'NO_NUMBER' | 'NO_SYMBOL' | 'TOO_COMMON';

/** Whose password it is, for the one sentence that names the e-mail address: your own, or a user's that the Admin sets. */
export type PasswordSubject = 'self' | 'other';

export interface PasswordRuleContext {
  /** The e-mail address the password must not equal. Surrounding spaces and letter case are ignored. */
  readonly email: string;
  readonly subject: PasswordSubject;
  /** The check against the list of common passwords. Left out where the list is not available (the browser). */
  readonly isCommon?: (password: string) => boolean;
}

const SYMBOL_EXAMPLES = 'such as ! # $ or %';

const MESSAGES: Readonly<Record<Exclude<PasswordRuleFailure, 'SAME_AS_EMAIL'>, string>> = {
  TOO_SHORT: `The new password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  TOO_LONG: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`,
  NO_NUMBER_OR_SYMBOL: `Add at least one number and one symbol, ${SYMBOL_EXAMPLES}.`,
  NO_NUMBER: 'Add at least one number.',
  NO_SYMBOL: `Add at least one symbol, ${SYMBOL_EXAMPLES}.`,
  TOO_COMMON: 'That password is too common. Choose a different one.',
};

const SAME_AS_EMAIL_MESSAGES: Readonly<Record<PasswordSubject, string>> = {
  self: 'The password cannot be the same as your e-mail address.',
  other: "The password cannot be the same as the user's e-mail address.",
};

/** The words for a failing part (UX spec section 6.0 "Password messages"). */
export function passwordRuleMessage(failure: PasswordRuleFailure, subject: PasswordSubject): string {
  return failure === 'SAME_AS_EMAIL' ? SAME_AS_EMAIL_MESSAGES[subject] : MESSAGES[failure];
}

/** The length in code points: "😀" is one character, not two. */
export function passwordLength(password: string): number {
  return Array.from(password).length;
}

const DIGIT = /\p{Nd}/u;
const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{Nd}]/u;

function lengthFailure(password: string): 'TOO_SHORT' | 'TOO_LONG' | null {
  const length = passwordLength(password);
  if (length < PASSWORD_MIN_LENGTH) return 'TOO_SHORT';
  return length > PASSWORD_MAX_LENGTH ? 'TOO_LONG' : null;
}

function compositionFailure(password: string): 'NO_NUMBER_OR_SYMBOL' | 'NO_NUMBER' | 'NO_SYMBOL' | null {
  const hasNumber = DIGIT.test(password);
  const hasSymbol = NOT_LETTER_OR_DIGIT.test(password);
  if (hasNumber && hasSymbol) return null;
  if (!hasNumber && !hasSymbol) return 'NO_NUMBER_OR_SYMBOL';
  return hasNumber ? 'NO_SYMBOL' : 'NO_NUMBER';
}

/** The first part of the rule the password fails, or null when it passes. */
export function checkPasswordRule(password: string, { email, isCommon }: PasswordRuleContext): PasswordRuleFailure | null {
  const length = lengthFailure(password);
  if (length !== null) return length;
  if (password.toLowerCase() === email.trim().toLowerCase()) return 'SAME_AS_EMAIL';
  const composition = compositionFailure(password);
  if (composition !== null) return composition;
  return isCommon?.(password) === true ? 'TOO_COMMON' : null;
}

/** The message for the first part the password fails, or null when it passes. */
export function passwordRuleProblem(password: string, context: PasswordRuleContext): string | null {
  const failure = checkPasswordRule(password, context);
  return failure === null ? null : passwordRuleMessage(failure, context.subject);
}
