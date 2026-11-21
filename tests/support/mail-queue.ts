import type { SendMailOptions } from 'nodemailer';

import { createFixedClock, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import type { MailEvent } from '@/lib/mail/events';
import type { OutboxSendDependencies } from '@/server/jobs/outbox-send';
import type { JobLogFields, JobLogLevel } from '@/server/jobs/run-job';
import { createMailer } from '@/server/mail/send';
import type { MailTransport } from '@/server/mail/transport';
import type { OutboxMessage } from '@/server/repositories/email-outbox-repository';
import { createJobRunWriter } from '@/server/repositories/job-run-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';

import { capture, clock, db, engineerId, outbox } from './overdue-world';

/**
 * What the mail-reliability tests of STORY-09.06 share on top of `overdue-world.ts`: queue a row, a transport that refuses a chosen number of sends and then accepts, the job's dependencies with the
 * logger and the real `job_runs` writer, and a look at a row. Every value is invented.
 */

let counter = 0;
const RUN_TAG = `${process.pid}-${Date.now() % 100_000}`;

/** A message with a subject that is unique to the test, so a shared Mailpit can be searched for it. */
export function plantMessage(overrides: Partial<OutboxMessage> = {}): OutboxMessage {
  counter += 1;
  return {
    idempotencyKey: `backup-missed:reliability-${RUN_TAG}-${counter}`,
    event: 'backup-missed' satisfies MailEvent,
    toUserId: engineerId,
    ccUserIds: [],
    subject: `AQP-353 test ${RUN_TAG}-${counter}`,
    bodyHtml: `<p>Reliability ${counter}</p>`,
    bodyText: `Reliability ${counter}`,
    ...overrides,
  };
}

export async function queue(overrides: Partial<OutboxMessage> = {}): Promise<OutboxMessage> {
  const planted = plantMessage(overrides);
  await createTransactionRunner(db.prisma).run((tx) => outbox.enqueue(tx, planted, clock.now()));
  return planted;
}

export interface OutboxRowView {
  readonly status: string;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly next_attempt_at: Date;
  readonly locked_until: Date | null;
  readonly sent_at: Date | null;
  readonly body_html: string;
  readonly body_text: string;
}

export async function rowOf(key: string): Promise<OutboxRowView> {
  const { rows } = await db.owner.query<OutboxRowView>('SELECT status, attempts, last_error, next_attempt_at, locked_until, sent_at, body_html, body_text FROM email_outbox WHERE idempotency_key = $1', [key]);
  const row = rows[0];
  if (row === undefined) throw new Error(`No row for ${key}.`);
  return row;
}

export const minutesAfter = (base: Date, minutes: number): Date => new Date(base.getTime() + minutes * MILLISECONDS_PER_MINUTE);

/** A transport that refuses the first `failures` sends the way a mail server that cannot be reached does, and then hands every message to the capturing server. */
export function flakyTransport(failures: number): MailTransport & { readonly calls: { count: number } } {
  const calls = { count: 0 };
  return {
    calls,
    sendMail: (message: SendMailOptions) => {
      calls.count += 1;
      if (calls.count <= failures) return Promise.reject(Object.assign(new Error('connect ECONNREFUSED 10.9.8.7:587 portal@example.com'), { code: 'ECONNREFUSED' }));
      return capture.transport.sendMail(message);
    },
  };
}

export interface LoggedLine {
  readonly message: string;
  readonly level: JobLogLevel | undefined;
  readonly fields: JobLogFields | undefined;
}

/** The job's dependencies over the world's database, with the real `job_runs` writer, a given transport and the lines the job logs kept. */
export function sendWith(transport: MailTransport, at: Date = clock.now()): { readonly dependencies: OutboxSendDependencies; readonly lines: LoggedLine[]; readonly clock: ReturnType<typeof createFixedClock> } {
  const lines: LoggedLine[] = [];
  const fixed = createFixedClock(at);
  return {
    lines,
    clock: fixed,
    dependencies: { store: outbox, mailer: createMailer(transport), clock: fixed, log: (message, level, fields) => void lines.push({ message, level, fields }), jobRuns: createJobRunWriter(db.prisma) },
  };
}

export async function messagesWithSubject(subject: string): Promise<number> {
  return (await capture.list()).filter((mail) => mail.subject === subject).length;
}
