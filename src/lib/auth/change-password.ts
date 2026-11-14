import { passwordRuleProblem } from './password-rule';

/**
 * What the change-password form (SCR-23, STORY-01.05) checks before it sends anything, and the words the server's route and service use,
 * so a sentence is written once (UX spec section 6.0 "Password messages"). Only the shape and the parts of the rule that need no list
 * are checked here: the server decides (the current password, a common password, the attempt limit). Pure, and without zod, so the page
 * does not carry it (NFR-009).
 */

export const CURRENT_PASSWORD_REQUIRED_MESSAGE = 'Enter your current password.';
export const CURRENT_PASSWORD_WRONG_MESSAGE = 'Your current password is not correct.';
export const NEW_PASSWORD_REQUIRED_MESSAGE = 'Enter a new password.';
export const REPEAT_PASSWORD_REQUIRED_MESSAGE = 'Repeat the new password.';
export const PASSWORDS_DIFFER_MESSAGE = 'The two new passwords do not match.';
export const NEW_PASSWORD_SAME_MESSAGE = 'Choose a new password that is different from your current one.';

/** How long five wrong tries block a form, in minutes. The throttle policy (`auth-service.ts`) and every sentence that names the time read this one number. */
export const BLOCK_MINUTES = 15;

export const TOO_MANY_CHANGE_ATTEMPTS_MESSAGE = `Too many attempts. Try again in ${BLOCK_MINUTES} minutes.`;

export type ChangePasswordField = 'currentPassword' | 'newPassword' | 'repeatPassword';

export interface ChangePasswordValues {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly repeatPassword: string;
}

export type ChangePasswordProblems = Readonly<Partial<Record<ChangePasswordField, string>>>;

/**
 * The messages for the three fields, or an empty object when the form can be sent. The fields in the order of the form; no password is
 * trimmed (spaces may be part of one). The new password is judged by the rule for `email`, in the person's own words ("your e-mail address").
 */
export function changePasswordProblems(values: ChangePasswordValues, email: string): ChangePasswordProblems {
  const found: Partial<Record<ChangePasswordField, string>> = {};
  if (values.currentPassword === '') found.currentPassword = CURRENT_PASSWORD_REQUIRED_MESSAGE;
  if (values.newPassword === '') {
    found.newPassword = NEW_PASSWORD_REQUIRED_MESSAGE;
  } else {
    const rule = passwordRuleProblem(values.newPassword, { email, subject: 'self' });
    // The rule's messages come first; this one shows only when the rule is met. The two typed values are compared exactly: no trimming, case counts.
    if (rule !== null) found.newPassword = rule;
    else if (values.newPassword === values.currentPassword) found.newPassword = NEW_PASSWORD_SAME_MESSAGE;
  }
  if (values.repeatPassword === '') found.repeatPassword = REPEAT_PASSWORD_REQUIRED_MESSAGE;
  else if (values.repeatPassword !== values.newPassword) found.repeatPassword = PASSWORDS_DIFFER_MESSAGE;
  return found;
}
