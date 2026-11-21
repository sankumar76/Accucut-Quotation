import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SendFailureCode, SkipCode } from '@/lib/mail/codes';
import { createFixedClock, MILLISECONDS_PER_MINUTE } from '@/lib/time';
import {
  describeOutboxSend,
  OUTBOX_CLAIM_LIMIT,
  OUTBOX_LOCK_MILLISECONDS,
  OUTBOX_SEND_CRON,
  OUTBOX_SEND_TIMEZONE,
  performOutboxSend,
  runOutboxSend,
  scheduleMailJobs,
  type ClaimEnded,
  type OutboxJobMessage,
  type OutboxJobRun,
  type OutboxRowRef,
  type OutboxSendDependencies,
  type OutboxSendStore,
  type SendLease,
} from '@/server/jobs/outbox-send';
import { runJob, type FailedJobRun, type JobLogFields, type JobLogLevel } from '@/server/jobs/run-job';
import type { Mailer, OutgoingMail } from '@/server/mail/send';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ schedule: cron.schedule }));

/**
 * STORY-09.01 AC-4 (claim and send), AC-5 (skipped rows and the sender read at send time), AC-6 (`FEATURE_EMAIL`) and AC-7 (nothing but counts and codes in the log); STORY-09.06 AC-1
 * (retry and final failure), AC-2 (recovery), AC-4 (the lease), AC-5 (one log line per attempt), AC-6 (the `job_runs` row) and AC-7 (alerts off between attempts), with the store, the mailer
 * and the clock stubbed. The statements themselves (the claim, the marks) are tested against PostgreSQL in `tests/integration/mail`.
 */

const NOW = new Date('2026-11-18T10:00:00.000Z');
const IDS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'] as const;

function row(index: number, attempts = 1): OutboxJobMessage {
  return {
    id: IDS[index] ?? 'x',
    event: 'task-assigned',
    attempts,
    toUserId: `to-${index}`,
    ccUserIds: [`cc-${index}`],
    subject: `Subject ${index} with a name`,
    bodyHtml: `<p>Body ${index}</p>`,
    bodyText: `Body ${index}`,
  };
}

interface Marks {
  sent: Array<{ ref: OutboxRowRef; at: Date }>;
  retry: Array<{ ref: OutboxRowRef; code: SendFailureCode; at: Date }>;
  failed: Array<{ ref: OutboxRowRef; code: SendFailureCode; at: Date }>;
  skipped: Array<{ ref: OutboxRowRef; code: SkipCode }>;
}

type LogLine = { message: string; level: JobLogLevel | undefined; fields: JobLogFields | undefined };

function harness(
  options: {
    claimed?: OutboxJobMessage[];
    skipped?: Array<ClaimEnded<SkipCode>>;
    failed?: Array<ClaimEnded<SendFailureCode>>;
    lease?: (ref: OutboxRowRef) => SendLease | Error;
    recipients?: (toUserId: string) => { to: string | null; cc: string[] } | Error;
    sendResult?: (mail: OutgoingMail) => Awaited<ReturnType<Mailer['send']>> | Error;
    settings?: { senderName: string; senderMailbox: string };
  } = {},
) {
  const marks: Marks = { sent: [], retry: [], failed: [], skipped: [] };
  const recorded: Array<OutboxJobRun | FailedJobRun> = [];
  const lines: LogLine[] = [];
  const clock = createFixedClock(NOW);
  const claimDue = vi.fn<OutboxSendStore['claimDue']>(() => Promise.resolve({ claimed: options.claimed ?? [], skipped: options.skipped ?? [], failed: options.failed ?? [] }));
  const beginSend = vi.fn<OutboxSendStore['beginSend']>((ref) => {
    const answer = options.lease?.(ref) ?? 'go';
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  });
  const readMailSettings = vi.fn<OutboxSendStore['readMailSettings']>(() => Promise.resolve(options.settings ?? { senderName: 'Accucut Portal', senderMailbox: 'portal@example.com' }));
  const store: OutboxSendStore = {
    claimDue,
    beginSend,
    readMailSettings,
    resolveRecipients: (toUserId) => {
      const answer = options.recipients?.(toUserId) ?? { to: `${toUserId}@example.com`, cc: [`cc-of-${toUserId}@example.com`] };
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    markSent: (ref, at) => Promise.resolve(marks.sent.push({ ref, at }) > 0),
    markRetry: (ref, code, at) => Promise.resolve(marks.retry.push({ ref, code, at }) > 0),
    markFailed: (ref, code, at) => Promise.resolve(marks.failed.push({ ref, code, at }) > 0),
    markSkipped: (ref, code) => Promise.resolve(marks.skipped.push({ ref, code }) > 0),
  };
  const sentMail: Array<{ mail: OutgoingMail; sender: { name: string; mailbox: string } }> = [];
  const mailer: Mailer = {
    send: (mail, sender) => {
      sentMail.push({ mail, sender });
      const answer = options.sendResult?.(mail) ?? { ok: true as const };
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  const dependencies: OutboxSendDependencies = {
    store,
    mailer,
    clock,
    log: (message, level, fields) => void lines.push({ message, level, fields }),
    jobRuns: { recordRun: (run) => Promise.resolve(void recorded.push(run)) },
  };
  return { dependencies, marks, sentMail, claimDue, beginSend, readMailSettings, clock, recorded, lines };
}

const attemptLines = (lines: LogLine[]): LogLine[] => lines.filter((line) => line.message.startsWith('outbox attempt'));

beforeEach(() => {
  cron.schedule.mockReset();
});

describe('runOutboxSend: the claim (AC-4)', () => {
  it('AC-4, AC-9: claims at most 25 rows, locked for 5 minutes from the clock\'s now', async () => {
    const { dependencies, claimDue } = harness();
    await runOutboxSend(dependencies);
    expect(OUTBOX_CLAIM_LIMIT).toBe(25);
    expect(OUTBOX_LOCK_MILLISECONDS).toBe(5 * 60_000);
    expect(claimDue).toHaveBeenCalledWith(NOW, 25, new Date(NOW.getTime() + 5 * 60_000));
  });

  it('AC-4: sends each claimed row with an HTML body and a plain-text body, to and cc from the resolved addresses, and marks it sent with the clock\'s time', async () => {
    const { dependencies, marks, sentMail, clock } = harness({ claimed: [row(0), row(1)] });
    clock.advance(1_000);
    const summary = await runOutboxSend(dependencies);
    expect(summary).toMatchObject({ claimed: 2, sent: 2, skipped: 0, retrying: 0, failed: 0 });
    expect(sentMail.map((entry) => entry.mail)).toEqual([
      { to: 'to-0@example.com', cc: ['cc-of-to-0@example.com'], subject: 'Subject 0 with a name', html: '<p>Body 0</p>', text: 'Body 0' },
      { to: 'to-1@example.com', cc: ['cc-of-to-1@example.com'], subject: 'Subject 1 with a name', html: '<p>Body 1</p>', text: 'Body 1' },
    ]);
    expect(marks.sent).toEqual([
      { ref: { id: IDS[0], attempts: 1 }, at: new Date(NOW.getTime() + 1_000) },
      { ref: { id: IDS[1], attempts: 1 }, at: new Date(NOW.getTime() + 1_000) },
    ]);
  });
});

describe('runOutboxSend: skipped rows (STORY-09.01 AC-5, STORY-09.06 AC-7)', () => {
  it('AC-5: rows the claim skipped (alerts off, expired) are counted and never sent', async () => {
    const { dependencies, sentMail } = harness({
      skipped: [
        { id: 'a', event: 'task-overdue', attempts: 2, code: 'ALERTS_OFF' },
        { id: 'b', event: 'task-overdue', attempts: 1, code: 'EXPIRED' },
      ],
    });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 2, skipped: 2, sent: 0 });
    expect(sentMail).toEqual([]);
  });

  it('AC-7: a row skipped by the claim at its retry (alerts switched off after the first failure) is logged as a skipped attempt with its number and ALERTS_OFF, and is not sent', async () => {
    const { dependencies, sentMail, lines } = harness({ skipped: [{ id: IDS[0], event: 'task-assigned', attempts: 2, code: 'ALERTS_OFF' }] });
    await runOutboxSend(dependencies);
    expect(sentMail).toEqual([]);
    expect(attemptLines(lines)).toEqual([
      { message: 'outbox attempt skipped', level: 'info', fields: { job: 'outbox-send', outboxId: IDS[0], event: 'task-assigned', attempt: 2, result: 'skipped', code: 'ALERTS_OFF' } },
    ]);
  });

  it('AC-5: a To user who is inactive or missing at send time marks the row skipped with NO_RECIPIENT and sends nothing', async () => {
    const { dependencies, marks, sentMail } = harness({ claimed: [row(0)], recipients: () => ({ to: null, cc: [] }) });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, skipped: 1, sent: 0, failed: 0, retrying: 0 });
    expect(marks.skipped).toEqual([{ ref: { id: IDS[0], attempts: 1 }, code: 'NO_RECIPIENT' }]);
    expect(sentMail).toEqual([]);
  });

  it('a skip whose mark cannot be saved is still one skipped attempt, not a failed one (the row stays sending and is taken back)', async () => {
    const base = harness({ claimed: [row(0)], recipients: () => ({ to: null, cc: [] }) });
    const dependencies: OutboxSendDependencies = { ...base.dependencies, store: { ...base.dependencies.store, markSkipped: () => Promise.reject(new Error('db down')) } };
    expect(await runOutboxSend(dependencies)).toMatchObject({ skipped: 1, retrying: 0, failed: 0 });
    expect(base.marks.retry).toEqual([]);
  });

  it('AC-5: the From is read from the settings at send time, for each message', async () => {
    const { dependencies, sentMail, readMailSettings } = harness({ claimed: [row(0), row(1)], settings: { senderName: 'Sender', senderMailbox: 'box@example.com' } });
    await runOutboxSend(dependencies);
    expect(readMailSettings).toHaveBeenCalledTimes(2);
    expect(sentMail.map((entry) => entry.sender)).toEqual([
      { name: 'Sender', mailbox: 'box@example.com' },
      { name: 'Sender', mailbox: 'box@example.com' },
    ]);
  });
});

describe('runOutboxSend: failed sends are retried (STORY-09.06 AC-1)', () => {
  it.each([
    [1, 1],
    [2, 5],
    [3, 15],
  ])('AC-1: a send that fails as attempt %i leaves the row pending with its code and the next attempt exactly %i minutes later, and is not marked failed', async (attempts, minutes) => {
    const { dependencies, marks } = harness({ claimed: [row(0, attempts)], sendResult: () => ({ ok: false, code: 'CONNECTION' }) });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, sent: 0, retrying: 1, failed: 0 });
    expect(marks.retry).toEqual([{ ref: { id: IDS[0], attempts }, code: 'CONNECTION', at: new Date(NOW.getTime() + minutes * MILLISECONDS_PER_MINUTE) }]);
    expect(marks.failed).toEqual([]);
  });

  it('AC-1: the 4th failed attempt (the first send and three retries) is final: failed with the code, never retried', async () => {
    const { dependencies, marks } = harness({ claimed: [row(0, 4)], sendResult: () => ({ ok: false, code: 'SENDER_NOT_ALLOWED' }) });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, retrying: 0, failed: 1, failures: { SENDER_NOT_ALLOWED: 1 } });
    expect(marks.failed).toEqual([{ ref: { id: IDS[0], attempts: 4 }, code: 'SENDER_NOT_ALLOWED', at: NOW }]);
    expect(marks.retry).toEqual([]);
  });

  it('AC-1: the backoff is measured from the moment the send failed, by the clock', async () => {
    const base = harness({ claimed: [row(0)] });
    const dependencies: OutboxSendDependencies = {
      ...base.dependencies,
      mailer: {
        send: () => {
          base.clock.advance(20_000);
          return Promise.resolve({ ok: false, code: 'CONNECTION' });
        },
      },
    };
    await runOutboxSend(dependencies);
    expect(base.marks.retry[0]?.at).toEqual(new Date(NOW.getTime() + 20_000 + MILLISECONDS_PER_MINUTE));
  });

  it('AC-1: a failed send does not stop the run; the other rows are sent', async () => {
    let calls = 0;
    const { dependencies, marks } = harness({
      claimed: [row(0), row(1), row(2)],
      sendResult: () => (++calls === 2 ? { ok: false, code: 'AUTH_FAILED' } : { ok: true }),
    });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 3, sent: 2, retrying: 1, failed: 0 });
    expect(marks.retry.map((entry) => entry.ref.id)).toEqual([IDS[1]]);
    expect(marks.sent.map((entry) => entry.ref.id)).toEqual([IDS[0], IDS[2]]);
  });

  it('AC-1: an empty sender fails the attempt with NO_SENDER (the mailer says so), and it is retried like any other', async () => {
    const { dependencies, marks } = harness({ claimed: [row(0)], settings: { senderName: '', senderMailbox: '' }, sendResult: () => ({ ok: false, code: 'NO_SENDER' }) });
    expect(await runOutboxSend(dependencies)).toMatchObject({ retrying: 1 });
    expect(marks.retry.map((entry) => entry.code)).toEqual(['NO_SENDER']);
  });

  it('AC-1: a database problem on one row is a failed attempt with UNKNOWN (retried), keeps its error text out of the mark, and the run goes on', async () => {
    const { dependencies, marks } = harness({
      claimed: [row(0), row(1)],
      recipients: (toUserId) => (toUserId === 'to-0' ? new Error('connection to server at "10.1.2.3" failed') : { to: 'ok@example.com', cc: [] }),
    });
    expect(await runOutboxSend(dependencies)).toMatchObject({ sent: 1, retrying: 1, failed: 0 });
    expect(marks.retry.map((entry) => entry.code)).toEqual(['UNKNOWN']);
    expect(JSON.stringify(marks)).not.toContain('10.1.2.3');
  });

  it('a mailer that throws (it should not) is a failed attempt with UNKNOWN, not a stuck run', async () => {
    const { dependencies, marks } = harness({ claimed: [row(0)], sendResult: () => new Error('boom') });
    expect(await runOutboxSend(dependencies)).toMatchObject({ retrying: 1 });
    expect(marks.retry.map((entry) => entry.code)).toEqual(['UNKNOWN']);
  });

  it('if even the retry mark cannot be written, the run does not throw (the row stays sending and is taken back when its lease passes)', async () => {
    const base = harness({ claimed: [row(0)], sendResult: () => ({ ok: false, code: 'CONNECTION' }) });
    const dependencies: OutboxSendDependencies = { ...base.dependencies, store: { ...base.dependencies.store, markRetry: () => Promise.reject(new Error('db down')) } };
    await expect(runOutboxSend(dependencies)).resolves.toMatchObject({ claimed: 1, retrying: 1 });
  });

  it('if even the final failed mark cannot be written, the run does not throw', async () => {
    const base = harness({ claimed: [row(0, 4)], sendResult: () => ({ ok: false, code: 'CONNECTION' }) });
    const dependencies: OutboxSendDependencies = { ...base.dependencies, store: { ...base.dependencies.store, markFailed: () => Promise.reject(new Error('db down')) } };
    await expect(runOutboxSend(dependencies)).resolves.toMatchObject({ claimed: 1, failed: 1 });
  });

  it('a row the claim gave up on (a taken-back row with no attempt left) is counted as failed with UNKNOWN and logged', async () => {
    const { dependencies, lines } = harness({ failed: [{ id: IDS[0], event: 'password-reset', attempts: 4, code: 'UNKNOWN' }] });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, failed: 1, failures: { UNKNOWN: 1 } });
    expect(attemptLines(lines)).toEqual([
      { message: 'outbox attempt failed', level: 'error', fields: { job: 'outbox-send', outboxId: IDS[0], event: 'password-reset', attempt: 4, result: 'failed', code: 'UNKNOWN' } },
    ]);
  });
});

describe('runOutboxSend: recovery (STORY-09.06 AC-2)', () => {
  it('AC-2: a stub that fails twice then accepts: three runs send one message, and the third attempt is the one marked sent', async () => {
    const accepted: string[] = [];
    let calls = 0;
    const base = harness();
    const mailer: Mailer = {
      send: (mail) => {
        calls += 1;
        if (calls <= 2) return Promise.resolve({ ok: false, code: 'CONNECTION' });
        accepted.push(mail.subject);
        return Promise.resolve({ ok: true });
      },
    };
    // The store hands the row over at each due time with the attempt number the claim gave it.
    for (const attempts of [1, 2, 3]) {
      const run = harness({ claimed: [row(0, attempts)] });
      await runOutboxSend({ ...run.dependencies, mailer });
      Object.assign(base.marks, {
        retry: [...base.marks.retry, ...run.marks.retry],
        sent: [...base.marks.sent, ...run.marks.sent],
      });
    }
    expect(accepted).toEqual(['Subject 0 with a name']);
    expect(base.marks.retry.map((entry) => entry.ref.attempts)).toEqual([1, 2]);
    expect(base.marks.sent.map((entry) => entry.ref.attempts)).toEqual([3]);
  });
});

describe('runOutboxSend: the lease (STORY-09.06 AC-4, review follow-up SQR-03)', () => {
  it('AC-4: the lease of each row is renewed for 5 minutes from the clock, with the row\'s attempt number, just before its send', async () => {
    const { dependencies, beginSend, clock } = harness({ claimed: [row(0, 2), row(1)] });
    clock.advance(10_000);
    await runOutboxSend(dependencies);
    expect(beginSend).toHaveBeenNthCalledWith(1, { id: IDS[0], attempts: 2 }, new Date(NOW.getTime() + 10_000), new Date(NOW.getTime() + 10_000 + 5 * 60_000));
    expect(beginSend).toHaveBeenNthCalledWith(2, { id: IDS[1], attempts: 1 }, new Date(NOW.getTime() + 10_000), new Date(NOW.getTime() + 10_000 + 5 * 60_000));
  });

  it('AC-4: a row another run took (the lease passed while this run was busy) is not sent, marked or logged here, and the run goes on', async () => {
    const { dependencies, sentMail, marks, lines } = harness({ claimed: [row(0), row(1)], lease: (ref) => (ref.id === IDS[0] ? 'lost' : 'go') });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 2, sent: 1, lost: 1 });
    expect(sentMail.map((entry) => entry.mail.subject)).toEqual(['Subject 1 with a name']);
    expect(marks.sent.map((entry) => entry.ref.id)).toEqual([IDS[1]]);
    expect(attemptLines(lines).map((line) => line.fields?.['outboxId'])).toEqual([IDS[1]]);
  });

  it('SQR-03: a row past its send_before by the time its turn comes is skipped as EXPIRED, never sent, and logged', async () => {
    const { dependencies, sentMail, lines } = harness({ claimed: [row(0)], lease: () => 'expired' });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, skipped: 1, sent: 0 });
    expect(sentMail).toEqual([]);
    expect(attemptLines(lines).map((line) => line.fields)).toEqual([{ job: 'outbox-send', outboxId: IDS[0], event: 'task-assigned', attempt: 1, result: 'skipped', code: 'EXPIRED' }]);
  });

  it('a lease check that throws is a failed attempt (UNKNOWN), not a send', async () => {
    const { dependencies, sentMail, marks } = harness({ claimed: [row(0)], lease: () => new Error('db down') });
    expect(await runOutboxSend(dependencies)).toMatchObject({ retrying: 1, sent: 0 });
    expect(sentMail).toEqual([]);
    expect(marks.retry.map((entry) => entry.code)).toEqual(['UNKNOWN']);
  });
});

// SQR-02 (review of PR #503): a message the mail server accepted is sent, whatever happens to its mark. A retry would send it twice (NFR-014).
describe('the result of a message that was sent (SQR-02, NFR-014)', () => {
  function withMarkSent(markSent: OutboxSendStore['markSent'], claimed = [row(0), row(1)]) {
    const base = harness({ claimed });
    const markRetry = vi.fn<OutboxSendStore['markRetry']>(base.dependencies.store.markRetry);
    const markFailed = vi.fn<OutboxSendStore['markFailed']>(base.dependencies.store.markFailed);
    const dependencies: OutboxSendDependencies = { ...base.dependencies, store: { ...base.dependencies.store, markSent, markRetry, markFailed } };
    return { ...base, dependencies, markRetry, markFailed };
  }

  it('AC-4: if saving `sent` fails after the server accepted the message, the run counts it as sent, never retries or fails the row, and goes on with the next row', async () => {
    const saved: string[] = [];
    const { dependencies, markRetry, markFailed } = withMarkSent((ref) => {
      if (ref.id === IDS[0]) return Promise.reject(new Error('connection to server at "10.1.2.3" failed'));
      saved.push(ref.id);
      return Promise.resolve(true);
    });
    const summary = await runOutboxSend(dependencies);
    expect(summary).toMatchObject({ claimed: 2, sent: 2, failed: 0, retrying: 0, notRecorded: 1, failures: {} });
    expect(markRetry).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(saved).toEqual([IDS[1]]);
  });

  it('a mark that changes no row (the row is no longer sending) is also not recorded, and not a failure', async () => {
    const { dependencies, markRetry, markFailed } = withMarkSent(() => Promise.resolve(false), [row(0)]);
    expect(await runOutboxSend(dependencies)).toMatchObject({ sent: 1, failed: 0, retrying: 0, notRecorded: 1 });
    expect(markRetry).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('the log says NOT_RECORDED at error level, with a count and no id, address or error text in the summary', async () => {
    const { dependencies } = withMarkSent(() => Promise.reject(new Error('connection to server at "10.1.2.3" failed')), [row(0)]);
    const outcome = await performOutboxSend(dependencies);
    expect(outcome).toEqual({
      summary: 'outbox-send: claimed 1, sent 1, retrying 0, skipped 0, failed 0; NOT_RECORDED 1 (sent, but the result could not be saved, so the row stays sending)',
      level: 'error',
    });
    expect(JSON.stringify(outcome)).not.toMatch(/10.1.2.3|example.com|Subject|Body/);
  });
});

describe('the log: one line per attempt (STORY-09.06 AC-5; STORY-09.01 AC-7)', () => {
  it('AC-5: every attempt writes one line with the row id, the event, the attempt number, the result and the code, and nothing else', async () => {
    let calls = 0;
    const { dependencies, lines } = harness({
      claimed: [row(0), row(1, 4), row(2)],
      sendResult: () => {
        calls += 1;
        return calls === 1 ? { ok: true } : { ok: false, code: 'AUTH_FAILED' };
      },
      recipients: (toUserId) => (toUserId === 'to-2' ? { to: null, cc: [] } : { to: `${toUserId}@example.com`, cc: [] }),
    });
    await runOutboxSend(dependencies);
    expect(attemptLines(lines)).toEqual([
      { message: 'outbox attempt sent', level: 'info', fields: { job: 'outbox-send', outboxId: IDS[0], event: 'task-assigned', attempt: 1, result: 'sent' } },
      { message: 'outbox attempt failed', level: 'error', fields: { job: 'outbox-send', outboxId: IDS[1], event: 'task-assigned', attempt: 4, result: 'failed', code: 'AUTH_FAILED' } },
      { message: 'outbox attempt skipped', level: 'info', fields: { job: 'outbox-send', outboxId: IDS[2], event: 'task-assigned', attempt: 1, result: 'skipped', code: 'NO_RECIPIENT' } },
    ]);
  });

  it('AC-5: a retry is logged as retry with the code, at info', async () => {
    const { dependencies, lines } = harness({ claimed: [row(0, 2)], sendResult: () => ({ ok: false, code: 'CONNECTION' }) });
    await runOutboxSend(dependencies);
    expect(attemptLines(lines)).toEqual([
      { message: 'outbox attempt retry', level: 'info', fields: { job: 'outbox-send', outboxId: IDS[0], event: 'task-assigned', attempt: 2, result: 'retry', code: 'CONNECTION' } },
    ]);
  });

  it('AC-5: no line holds an e-mail address, a subject, a body, a user id or the text of an error', async () => {
    const { dependencies, lines } = harness({
      claimed: [row(0), row(1)],
      recipients: (toUserId) => (toUserId === 'to-0' ? new Error('connection to server at "10.1.2.3" failed for portal@example.com') : { to: 'to-1@example.com', cc: ['cc-1@example.com'] }),
      sendResult: () => ({ ok: false, code: 'CONNECTION' }),
    });
    await runOutboxSend(dependencies);
    const printed = JSON.stringify(lines);
    expect(attemptLines(lines)).toHaveLength(2);
    for (const value of ['@', 'example.com', 'Subject', 'Body', 'to-0', 'to-1', 'cc-', '10.1.2.3', 'connection to server']) expect(printed).not.toContain(value);
  });

  it('AC-5: a logger that throws does not stop the run or change what was sent', async () => {
    const base = harness({ claimed: [row(0), row(1)] });
    const dependencies: OutboxSendDependencies = {
      ...base.dependencies,
      log: () => {
        throw new Error('stream closed');
      },
    };
    expect(await runOutboxSend(dependencies)).toMatchObject({ sent: 2 });
  });

  it('describes a run with counts and codes only', () => {
    expect(describeOutboxSend({ claimed: 6, sent: 2, skipped: 1, retrying: 1, failed: 2, failures: { AUTH_FAILED: 1, CONNECTION: 1 }, lost: 0, notRecorded: 0 })).toBe(
      'outbox-send: claimed 6, sent 2, retrying 1, skipped 1, failed 2 (AUTH_FAILED 1, CONNECTION 1)',
    );
    expect(describeOutboxSend({ claimed: 1, sent: 1, skipped: 0, retrying: 0, failed: 0, failures: {}, lost: 0, notRecorded: 0 })).toBe('outbox-send: claimed 1, sent 1, retrying 0, skipped 0, failed 0');
    expect(describeOutboxSend({ claimed: 2, sent: 1, skipped: 0, retrying: 0, failed: 0, failures: {}, lost: 1, notRecorded: 0 })).toContain('lost 1');
  });

  it('a run writes counts and codes, and never an address, a subject, a body or an id', async () => {
    const { dependencies } = harness({ claimed: [row(0), row(1, 4)], sendResult: (mail) => (mail.to.startsWith('to-1') ? { ok: false, code: 'CONNECTION' } : { ok: true }) });
    const outcome = await performOutboxSend(dependencies);
    expect(outcome).toEqual({ summary: 'outbox-send: claimed 2, sent 1, retrying 0, skipped 0, failed 1 (CONNECTION 1)', level: 'error' });
    const printed = JSON.stringify(outcome);
    for (const value of ['example.com', 'Subject', 'Body', IDS[0], 'to-0']) expect(printed).not.toContain(value);
  });

  it('a run with a row waiting for its retry is logged at info (the failure is not final)', async () => {
    const { dependencies } = harness({ claimed: [row(0)], sendResult: () => ({ ok: false, code: 'CONNECTION' }) });
    expect(await performOutboxSend(dependencies)).toEqual({ summary: 'outbox-send: claimed 1, sent 0, retrying 1, skipped 0, failed 0', level: 'info' });
  });

  it('STORY-10.09a AC-3, STORY-09.06 AC-6: a run with nothing due is a debug line and writes no job_runs row', async () => {
    const { dependencies, recorded } = harness();
    expect(await performOutboxSend(dependencies)).toEqual({ level: 'debug' });
    expect(recorded).toEqual([]);
  });

  it('a clean run is logged at info', async () => {
    const { dependencies } = harness({ claimed: [row(0)] });
    expect(await performOutboxSend(dependencies)).toEqual({ summary: 'outbox-send: claimed 1, sent 1, retrying 0, skipped 0, failed 0', level: 'info' });
  });

  it('STORY-10.09a AC-3, STORY-09.06 AC-6: a claim that fails throws, and the wrapper logs it as one error line with the job name and the class of the error and none of the error text, and writes a failed job_runs row', async () => {
    const { dependencies, recorded } = harness();
    const failing: OutboxSendDependencies = { ...dependencies, store: { ...dependencies.store, claimDue: () => Promise.reject(new Error('password authentication failed for user "accucut_app"')) } };
    await expect(performOutboxSend(failing)).rejects.toThrow();
    const lines: Array<[string, JobLogLevel | undefined, JobLogFields | undefined]> = [];
    await expect(
      runJob(
        { name: 'outbox-send', log: (message, level, fields) => void lines.push([message, level, fields]), now: () => NOW, frequent: true, recordFailure: (run) => failing.jobRuns.recordRun(run) },
        () => performOutboxSend(failing),
      ),
    ).resolves.toBeUndefined();
    expect(lines.filter(([, level]) => level === 'error')).toEqual([['outbox-send failed after 0 ms', 'error', { job: 'outbox-send', durationMs: 0, errorName: 'Error' }]]);
    expect(JSON.stringify(lines)).not.toMatch(/password|accucut_app/);
    expect(recorded).toEqual([{ job: 'outbox-send', startedAt: NOW, finishedAt: NOW, result: { status: 'failed', message: 'the run failed' } }]);
  });
});

describe('the job_runs row (STORY-09.06 AC-6, NFR-024)', () => {
  it('AC-6: a run that handled rows writes one row with the counts claimed, sent, retrying, failed and skipped, and nothing else', async () => {
    const { dependencies, recorded, clock } = harness({
      claimed: [row(0), row(1), row(2, 4)],
      skipped: [{ id: 'z', event: 'task-overdue', attempts: 1, code: 'EXPIRED' }],
      sendResult: (mail) => (mail.to.startsWith('to-1') ? { ok: false, code: 'CONNECTION' } : mail.to.startsWith('to-2') ? { ok: false, code: 'AUTH_FAILED' } : { ok: true }),
    });
    clock.advance(0);
    await performOutboxSend(dependencies);
    expect(recorded).toEqual([{ job: 'outbox-send', startedAt: NOW, finishedAt: NOW, result: { status: 'ok', claimed: 4, sent: 1, retrying: 1, failed: 1, skipped: 1 } }]);
    expect(JSON.stringify(recorded)).not.toMatch(/example.com|Subject|Body|to-0/);
  });

  it('AC-6: a run that only skipped rows (the claim ended them) still writes its row', async () => {
    const { dependencies, recorded } = harness({ skipped: [{ id: 'z', event: 'task-overdue', attempts: 2, code: 'ALERTS_OFF' }] });
    await performOutboxSend(dependencies);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.result).toMatchObject({ claimed: 1, skipped: 1 });
  });

  it('AC-6: a database fault while the row is written throws to the wrapper, which logs it at error and still lets the next run happen', async () => {
    const base = harness({ claimed: [row(0)] });
    const failing: OutboxSendDependencies = { ...base.dependencies, jobRuns: { recordRun: () => Promise.reject(new Error('db down')) } };
    const lines: Array<[string, JobLogLevel | undefined]> = [];
    await expect(runJob({ name: 'outbox-send', log: (message, level) => void lines.push([message, level]), now: () => NOW }, () => performOutboxSend(failing))).resolves.toBeUndefined();
    expect(lines.some(([message, level]) => message.includes('failed') && level === 'error')).toBe(true);
  });
});

describe('scheduleMailJobs: FEATURE_EMAIL (AC-6)', () => {
  it('AC-6: off: nothing is scheduled, one info line says so, and nothing is built', () => {
    const build = vi.fn<() => OutboxSendDependencies>();
    const lines: Array<[string, string | undefined]> = [];
    expect(scheduleMailJobs(false, build, (message, level) => lines.push([message, level]))).toEqual([]);
    expect(cron.schedule).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    expect(lines).toEqual([['mail jobs are off: FEATURE_EMAIL is not on, so outbox-send is not scheduled', undefined]]);
  });

  it('AC-4, AC-6: on: outbox-send is scheduled every minute in Asia/Kolkata with no overlap', () => {
    const task = { stop: vi.fn() };
    cron.schedule.mockReturnValue(task);
    const { dependencies } = harness();
    const lines: string[] = [];
    expect(scheduleMailJobs(true, () => dependencies, (message) => lines.push(message))).toEqual([task]);
    expect(OUTBOX_SEND_CRON).toBe('* * * * *');
    expect(OUTBOX_SEND_TIMEZONE).toBe('Asia/Kolkata');
    expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function), { name: 'outbox-send', timezone: 'Asia/Kolkata', noOverlap: true });
    expect(lines).toEqual(['outbox-send scheduled every minute']);
  });

  it('AC-4: the scheduled callback runs one send', async () => {
    cron.schedule.mockReturnValue({ stop: vi.fn() });
    const { dependencies, marks } = harness({ claimed: [row(0)] });
    scheduleMailJobs(true, () => dependencies, () => undefined);
    const callback: unknown = cron.schedule.mock.calls[0]?.[1];
    if (typeof callback !== 'function') throw new Error('No callback was scheduled.');
    await callback();
    expect(marks.sent).toHaveLength(1);
  });
});
