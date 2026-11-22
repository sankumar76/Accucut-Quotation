import { RESET_LINK_LIFETIME_MINUTES } from '../../../lib/auth/password-reset';
import { PORTAL_NAME, renderMail } from '../layout';

/**
 * The reset-link message (STORY-09.07 AC-2, AC-9; architecture section 4.7): a pure function from a fixed DTO to the subject, the HTML and the plain text.
 *
 * The DTO is the person's name and the link, and nothing else: no cost, no password, no other personal data (NFR-002, NFR-028). The function reads each field by name, so a value that rides
 * along on the object is never read. Every text is escaped by the shared layout. The link holds the raw token, so this message is the one place the token is written outside the person's
 * mailbox: the outbox row that carries it is emptied once the row is sent, finally failed or skipped (`SECRET_BEARING_EVENTS`).
 */

export interface PasswordResetMessage {
  /** The person's name, as stored. The only personal data the message holds. */
  readonly name: string;
  /** A full address built from `APP_ORIGIN`: `<origin>/reset-password?token=<raw token>`. */
  readonly resetLink: string;
}

export interface RenderedPasswordReset {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const PASSWORD_RESET_SUBJECT = 'Reset your password';
export const PASSWORD_RESET_HEADING = 'Reset your password';
export const CHOOSE_A_PASSWORD = 'Choose a new password';

export function renderPasswordReset(message: PasswordResetMessage): RenderedPasswordReset {
  const { name, resetLink } = message;
  const { html, text } = renderMail({
    heading: PASSWORD_RESET_HEADING,
    paragraphs: [
      `Hello ${name},`,
      `Someone asked to reset the password of your ${PORTAL_NAME} account. Use the button below to choose a new password. The link works once and for ${RESET_LINK_LIFETIME_MINUTES} minutes.`,
      'If you did not ask for this, ignore this message. Your password stays as it is.',
    ],
    action: { label: CHOOSE_A_PASSWORD, url: resetLink },
  });
  return { subject: PASSWORD_RESET_SUBJECT, html, text };
}
