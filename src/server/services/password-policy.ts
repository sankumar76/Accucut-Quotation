import { isCommonPassword } from '../../lib/auth/common-passwords';
import { passwordRuleProblem, type PasswordSubject } from '../../lib/auth/password-rule';
import { FieldValidationError, PASSWORD_RULE_CODE } from '../../lib/errors';

/**
 * The password rule where a password is set (FR-098, BR-049; STORY-01.05 AC-2 and AC-4): the one rule of `src/lib/auth/password-rule.ts`
 * with the bundled list of common passwords, and the refusal that names the part that failed. Every service that stores a password
 * calls this before it hashes anything, so an over-long or weak password costs no argon2 work (architecture section 8). Sign-in does
 * not call it: a weak password that already exists still signs in.
 */

export interface PasswordRuleCheck {
  /** The e-mail address of the person the password is for. */
  readonly email: string;
  /** `self` where the person sets their own password, `other` where the Admin sets it for someone. It only changes one sentence. */
  readonly subject: PasswordSubject;
  /** The name of the field the message belongs under in the answer. */
  readonly field: string;
}

/**
 * Throws a 422 `PASSWORD_RULE` whose `errors` hold the message of the first failing part under `field`, or does nothing when the
 * password passes. The message is the UX spec's words and holds nothing of the password.
 */
export function assertPasswordRule(password: string, { email, subject, field }: PasswordRuleCheck): void {
  const message = passwordRuleProblem(password, { email, subject, isCommon: isCommonPassword });
  if (message !== null) throw new FieldValidationError([{ field, message }], { code: PASSWORD_RULE_CODE });
}
