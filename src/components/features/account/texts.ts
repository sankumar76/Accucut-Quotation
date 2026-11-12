import { BLOCK_MINUTES } from '@/lib/auth/change-password';

/**
 * The words of SCR-23 (UX spec section 6, "SCR-23 Account", and section 6.0 "Password messages"). The messages of the fields are in
 * `src/lib/auth/change-password.ts` and `password-rule.ts`; what is here is the page's own.
 */

export const ACCOUNT_TITLE = 'Your account';
export const ACCOUNT_DESCRIPTION = 'Your name and e-mail are set by the Admin. You can change your own password.';

export const MUST_CHANGE_TITLE = 'Set a new password';
export const MUST_CHANGE_DESCRIPTION = 'You must do this before you can use the portal.';
export const MUST_CHANGE_NOTICE_TITLE = 'Choose a new password to continue.';
export const MUST_CHANGE_NOTICE_BODY =
  'The password you were given is only for your first sign-in. Until you change it, every page opens this one. After that you go straight to your work.';

export const SUCCESS_TITLE = 'Your password has been changed.';
export const SUCCESS_BODY = 'Use the new one the next time you sign in.';

/** No usable answer: the change may or may not have been saved, so the second sentence is true either way (UX spec SCR-23 "final words"). */
export const FAILED_TITLE = 'We could not change your password.';
export const FAILED_BODY = 'Check your connection and try again. If you are asked to sign in, try your new password first.';
/** The 429 of the change form (AC-6). The minutes are the throttle policy's number; an Admin reset clears this block (DL-191 F4). */
export const BLOCKED_TITLE = 'Too many attempts.';
export const BLOCKED_BODY = `Try again in ${BLOCK_MINUTES} minutes, or ask the Admin to reset your password. Your password has not been changed.`;

/** The title of the summary of errors above the form (UX spec: "3 things need fixing."). */
export function errorSummaryTitle(count: number): string {
  return count === 1 ? '1 thing needs fixing.' : `${count} things need fixing.`;
}
