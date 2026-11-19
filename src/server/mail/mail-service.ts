import { z } from 'zod';

import type { SendResult } from '../../lib/mail/codes';
import type { Clock } from '../../lib/time';
import type { EmailOutboxRepository, EnqueueResult, OutboxMessage } from '../repositories/email-outbox-repository';
import type { Transaction } from '../repositories/transaction';

import type { Mailer } from './send';

/**
 * What the web process (`app`) uses to send e-mail (STORY-09.01 AC-2, AC-8; architecture section 4.7). It is the interface the later stories build on:
 *
 *   `enqueue(tx, message)`  queues one message in the caller's own transaction (assignment, overdue, digest, backup missed, reset link). The same idempotency key twice queues once and
 *                           answers `already-queued`; a rolled-back transaction leaves no row. The worker's `outbox-send` job sends it.
 *   `sendNow(message)`      sends one message at once, through the same transport, and answers `{ ok: true }` or `{ ok: false, code }`. It exists for the Settings test e-mail
 *                           (STORY-09.02), which must report success or failure on the spot and goes only to the signed-in Admin's own address. Nothing else in `app` sends.
 *
 * Recipients of queued mail are user IDs (the address is read at send time). `sendNow` takes an address because its caller is the signed-in person, never a request body.
 */

export interface DirectMessage {
  /** The signed-in person's own address, from their session. Never a value from a request. */
  readonly to: string;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
}

export interface MailService {
  enqueue(tx: Transaction, message: OutboxMessage): Promise<EnqueueResult>;
  sendNow(message: DirectMessage): Promise<SendResult>;
}

export interface MailServiceDependencies {
  readonly outbox: Pick<EmailOutboxRepository, 'enqueue' | 'readMailSettings'>;
  readonly mailer: Mailer;
  readonly clock: Clock;
}

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 200_000;

/** The subject is one line, so no caller can add a header; the address is a single address. */
const directMessageSchema = z.object({
  to: z.email(),
  subject: z
    .string()
    .min(1)
    .max(MAX_SUBJECT_LENGTH)
    .regex(/^[^\r\n]*$/),
  bodyHtml: z.string().min(1).max(MAX_BODY_LENGTH),
  bodyText: z.string().min(1).max(MAX_BODY_LENGTH),
});

export function createMailService(dependencies: MailServiceDependencies): MailService {
  const { outbox, mailer, clock } = dependencies;
  return {
    enqueue: (tx, message) => outbox.enqueue(tx, message, clock.now()),

    async sendNow(message) {
      const parsed = directMessageSchema.safeParse(message);
      if (!parsed.success) return { ok: false, code: 'UNKNOWN' };
      try {
        const settings = await outbox.readMailSettings();
        return await mailer.send(
          { to: parsed.data.to, cc: [], subject: parsed.data.subject, html: parsed.data.bodyHtml, text: parsed.data.bodyText },
          { name: settings.senderName, mailbox: settings.senderMailbox },
        );
      } catch {
        // The settings could not be read. The reason is not kept: a database error can carry a connection detail.
        return { ok: false, code: 'UNKNOWN' };
      }
    },
  };
}
