/**
 * What a failed or skipped mail is recorded as (STORY-09.01 AC-5, AC-7, AC-8; architecture section 4.7).
 *
 * A code is a class, never a message: an error from the mail server or from Microsoft's token endpoint can carry a secret, an address or a host, so none of that text is ever
 * kept. `email_outbox.last_error` holds one of these codes and nothing else, and `sendNow` returns one.
 */

/** Why a send failed. */
export const SEND_FAILURE_CODES = [
  /** Microsoft's 5.7.60: the sender is not the mailbox, and the mailbox has no Send As right for it. */
  'SENDER_NOT_ALLOWED',
  /** The sign-in was refused: a wrong password, an expired Entra client secret or a failed token request. */
  'AUTH_FAILED',
  /** The server could not be reached, or the connection broke or timed out. */
  'CONNECTION',
  /** `settings` holds no usable sender (name and mailbox), so there is nothing to put in From. */
  'NO_SENDER',
  'UNKNOWN',
] as const;

/** Why a row was skipped without a send. */
export const SKIP_CODES = [
  /** The To user is inactive or missing at send time. */
  'NO_RECIPIENT',
  /** The row was past `send_before` at claim time. */
  'EXPIRED',
  /** An alert event, and the alerts switch was off at claim time. Final: the row is never sent later, even if the switch is turned on (decision D-d). */
  'ALERTS_OFF',
] as const;

export type SendFailureCode = (typeof SEND_FAILURE_CODES)[number];
export type SkipCode = (typeof SKIP_CODES)[number];

/** Every value `last_error` may hold. */
export type OutboxErrorCode = SendFailureCode | SkipCode;

/** The result of one send: the message left, or it did not and this is the class of the reason. */
export type SendResult = { readonly ok: true } | { readonly ok: false; readonly code: SendFailureCode };
