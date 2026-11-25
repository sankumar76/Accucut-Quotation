import { BLOCK_MINUTES } from './change-password';
import { passwordRuleProblem } from './password-rule';

/**
 * What the reset by e-mailed link (STORY-09.07; FR-003, FR-098, FR-001; UX spec SCR-02) fixes in one place for the server and for the two
 * screens: the numbers of its policy, the paths, the codes and every sentence. Pure and without zod, so the pages do not carry more than they
 * must (NFR-009). The token itself is made and hashed on the server (`src/server/auth/reset-token.ts`).
 */

/** How long a link works (A-1, confirmed by the solution-architect on 2026-11-18, architecture v0.55 section 8). The e-mail and the stored expiry both read this. */
export const RESET_LINK_LIFETIME_MINUTES = 60;

/**
 * The limit on asking for links (AC-4, NFR-003, PROPOSED like the sign-in numbers; owner: Santhosh): more than 5 requests within 15 minutes for one typed
 * e-mail, or from one address, are refused. The window is the block, so the sixth request is refused until the window that began with the first has ended.
 */
export const RESET_REQUEST_LIMIT = 5;
export const RESET_REQUEST_WINDOW_MINUTES = BLOCK_MINUTES;

/** The pages, and the address a link leads to. `token` is the one query parameter of the reset page. */
export const FORGOT_PASSWORD_PATH = '/forgot-password';
export const RESET_PASSWORD_PATH = '/reset-password';
export const RESET_TOKEN_PARAMETER = 'token';

export const FORGOT_PASSWORD_API_PATH = '/api/v1/account/password/forgot';
export const RESET_PASSWORD_API_PATH = '/api/v1/account/password/reset';

/** The `code` of the 400 of a link that is used, expired or unknown (AC-7). One code for all three, so the answer says nothing more. */
export const RESET_LINK_INVALID_CODE = 'RESET_LINK_INVALID';

/** The sentence of SCR-02 for a link that is used, expired or unknown (AC-5, AC-7): the same words for all three. */
export const RESET_LINK_INVALID_MESSAGE = 'This link has already been used or has expired. Ask for a new link.';

/** The one answer to every request for a link, whoever asked for whom (AC-2, AC-3, FR-001). */
export const FORGOT_ACCEPTED_MESSAGE = 'Check your e-mail. If that address is registered, a reset link is on its way. It can be used once.';

export const TOO_MANY_RESET_REQUESTS_MESSAGE = `Too many requests. Try again in ${RESET_REQUEST_WINDOW_MINUTES} minutes.`;

/** What the form says on success (UX spec SCR-02). */
export const RESET_DONE_TITLE = 'Your password has been changed.';
export const RESET_DONE_BODY = 'Sign in with your new password.';

/** The words of the request page and the reset page (UX spec SCR-02, SCR-01). */
export const FORGOT_TITLE = 'Forgot your password?';
export const FORGOT_DESCRIPTION = 'Enter your e-mail address and we will send you a link to choose a new one.';
export const RESET_TITLE = 'Choose a new password';
export const RESET_DESCRIPTION = 'The link works once and for one hour.';
/**
 * While e-mail is off (`FEATURE_EMAIL` absent, empty or `off`) no link is ever sent, so `/forgot-password` shows this explanation in place of the form (STORY-01.10 AC-10, DEF-083; UX ruling
 * `docs/03-ux/rulings/forgot-password-email-off-2026-11-24.md`). The words are the ruling's, exactly. The lead is the sentence of the sign-in page ("Forgot your password? Ask the Admin to reset it."),
 * word for word, so the two pages give one instruction (SC 3.2.6).
 */
export const FORGOT_EMAIL_OFF_LEAD = 'Ask the Admin to reset it.';
export const EMAIL_OFF_NOTICE_TITLE = 'Reset links are not sent by e-mail yet.';
export const EMAIL_OFF_NOTICE_PARAGRAPHS: ReadonlyArray<string> = [
  'The Admin sets a temporary password and gives it to you in person or by phone. Sign in with it, then choose a password of your own.',
  'If you are the Admin, ask Accucut IT.',
];
export const BACK_TO_SIGN_IN_TEXT = 'Back to sign in';

/** The reset page for a link that is used, expired or unknown while e-mail is off (G-2b, UX-AC-G2.6): no "Ask for a new link", because no link can be sent. */
export const RESET_LINK_INVALID_TITLE = 'This link has already been used or has expired.';
export const RESET_LINK_INVALID_EMAIL_OFF_BODY = 'Ask the Admin to reset your password.';

export const REQUEST_FAILED_TITLE = 'We could not send the request.';
export const REQUEST_FAILED_BODY = 'Check your connection and try again.';
export const RESET_FAILED_TITLE = 'We could not change your password.';
/** No usable answer: the change may or may not have been saved, so the second sentence is true either way (as the account form's). */
export const RESET_FAILED_BODY = 'Check your connection and try again. If the link then says it was already used, try signing in with your new password.';

export type ResetPasswordField = 'newPassword' | 'repeatPassword';
export type ResetPasswordProblems = Readonly<Partial<Record<ResetPasswordField, string>>>;

export const NEW_PASSWORD_REQUIRED = 'Enter a new password.';
export const REPEAT_PASSWORD_REQUIRED = 'Repeat the new password.';
export const PASSWORDS_DO_NOT_MATCH = 'The two passwords do not match.';

/**
 * What the reset form checks before it sends anything (UX spec SCR-02): both fields are filled, the parts of the rule that need no list (length, number, symbol) and the two match. The page
 * does not know the person's e-mail address (it is never put in the page), so "not your e-mail" and "too common" are the server's, which names the part (422 under `newPassword`). No password is trimmed.
 */
export function resetPasswordProblems(values: { readonly newPassword: string; readonly repeatPassword: string }): ResetPasswordProblems {
  const found: Partial<Record<ResetPasswordField, string>> = {};
  if (values.newPassword === '') found.newPassword = NEW_PASSWORD_REQUIRED;
  else {
    const rule = passwordRuleProblem(values.newPassword, { email: '', subject: 'self' });
    if (rule !== null) found.newPassword = rule;
  }
  if (values.repeatPassword === '') found.repeatPassword = REPEAT_PASSWORD_REQUIRED;
  else if (values.newPassword !== '' && values.repeatPassword !== values.newPassword) found.repeatPassword = PASSWORDS_DO_NOT_MATCH;
  return found;
}
