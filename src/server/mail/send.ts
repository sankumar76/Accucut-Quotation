import type { SendMailOptions } from 'nodemailer';
import { z } from 'zod';

import type { SendFailureCode, SendResult } from '../../lib/mail/codes';

import { LOGO_CONTENT_ID } from './layout';
import { LOGO_BYTES, LOGO_CONTENT_TYPE, LOGO_FILE_NAME } from './logo';
import { MailTokenError } from './microsoft-token';
import type { MailTransport } from './transport';

/**
 * Sending one message through the transport, and what a failure is recorded as (STORY-09.01 AC-3, AC-7, AC-8; architecture section 4.7).
 *
 * `createMailer` is the single path to the mail server: the worker's `outbox-send` job and the web process's `sendNow` (the Settings test e-mail, STORY-09.02) both end here, so
 * nothing else in the portal sends. A failure is turned into a class code (`classifySendError`) and the error itself is dropped: Nodemailer's messages can carry the
 * server's own words, an address or a host, and an error from the token request or the sign-in must never carry a secret. The code is all that is logged or stored.
 */

export interface MailSender {
  /** The From name, which may be empty. */
  readonly name: string;
  /** The From mailbox, as `settings.sender_mailbox` holds it. Empty or not an address means "no sender". */
  readonly mailbox: string;
}

export interface OutgoingMail {
  /** The To address, read from `users.email` (outbox) or given by the caller (`sendNow`). */
  readonly to: string;
  readonly cc: ReadonlyArray<string>;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export interface Mailer {
  /** Sends one message and says how it went. It does not throw. */
  send(mail: OutgoingMail, sender: MailSender): Promise<SendResult>;
}

const mailboxSchema = z.email();

/** Microsoft's refusal when the sender is neither the mailbox nor one it may Send As (architecture section 4.7). */
const SENDER_NOT_ALLOWED_STATUS = /\b5\.7\.60\b/;

/** Nodemailer's codes for a server that could not be reached or a connection that broke. */
const CONNECTION_CODES: ReadonlySet<string> = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EDNS', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH']);

/** The SMTP replies that mean "who you are is refused": 535 authentication failed, 534 mechanism too weak. */
const AUTH_REPLY_CODES: ReadonlySet<number> = new Set([534, 535]);

const errorFieldsSchema = z.object({ code: z.string().optional(), responseCode: z.number().optional(), response: z.string().optional() }).loose();

/**
 * The class of a failure. Only three fields of the error are looked at (Nodemailer's `code`, the SMTP `responseCode` and the server's `response` line, for the 5.7.60 text), and
 * none of them is returned or kept.
 */
export function classifySendError(error: unknown): SendFailureCode {
  if (error instanceof MailTokenError) return 'AUTH_FAILED';
  const parsed = errorFieldsSchema.safeParse(error);
  if (!parsed.success) return 'UNKNOWN';
  const { code, responseCode, response } = parsed.data;
  if (response !== undefined && SENDER_NOT_ALLOWED_STATUS.test(response)) return 'SENDER_NOT_ALLOWED';
  if (code === 'EAUTH' || (responseCode !== undefined && AUTH_REPLY_CODES.has(responseCode))) return 'AUTH_FAILED';
  if (code !== undefined && CONNECTION_CODES.has(code)) return 'CONNECTION';
  return 'UNKNOWN';
}

export function createMailer(transport: MailTransport): Mailer {
  return {
    async send(mail, sender) {
      // No usable sender, no send: the transport is not touched, so a missing setting is a quiet `NO_SENDER` and not a server refusal.
      if (!mailboxSchema.safeParse(sender.mailbox).success) return { ok: false, code: 'NO_SENDER' };

      const message: SendMailOptions = {
        from: { name: sender.name, address: sender.mailbox },
        to: mail.to,
        cc: [...mail.cc],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // The logo goes inline, by content ID, whenever the HTML refers to it.
        attachments: mail.html.includes(`cid:${LOGO_CONTENT_ID}`)
          ? [{ filename: LOGO_FILE_NAME, content: LOGO_BYTES, contentType: LOGO_CONTENT_TYPE, cid: LOGO_CONTENT_ID, contentDisposition: 'inline' }]
          : [],
      };
      try {
        await transport.sendMail(message);
        return { ok: true };
      } catch (error) {
        return { ok: false, code: classifySendError(error) };
      }
    },
  };
}
