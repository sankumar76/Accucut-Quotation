import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MILLISECONDS_PER_MINUTE } from '@/lib/time';
import { OUTBOX_CLAIM_LIMIT, performOutboxSend, runOutboxSend, type OutboxSendDependencies } from '@/server/jobs/outbox-send';
import { runJob } from '@/server/jobs/run-job';
import type { Mailer } from '@/server/mail/send';

import { closeWorld, db, NOW, openWorld, outbox, resetWorld, setAlerts } from '../../support/overdue-world';
import { flakyTransport, messagesWithSubject, minutesAfter, queue, rowOf, sendWith } from '../../support/mail-queue';

/**
 * STORY-09.06 AC-1, AC-2, AC-4, AC-5, AC-6, AC-7 and AC-9 against real PostgreSQL in a throwaway database, as the runtime role, with the real `outbox-send` job, the real outbox and a capturing mail
 * server (Mailpit when the run has one, an in-process stub otherwise). The clock is controlled: a run is made "at" a chosen minute by giving the job a clock set to it. A transport that refuses
 * a chosen number of sends stands for a mail server that is down. Every value is invented.
 */

// Many messages go through SMTP to a shared capture server: a busy machine needs more than Vitest's 5 s.
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => openWorld(4));
afterAll(closeWorld);
beforeEach(resetWorld);

/** The first run is at the time the row was queued; each later run is "at" the minute given. */
const runAt = (transport: ReturnType<typeof flakyTransport>, minutes: number) => {
  const world = sendWith(transport, minutesAfter(NOW, minutes));
  return { ...world, run: () => runOutboxSend(world.dependencies) };
};

describe('AC-1: a failed send is retried at +1, +5 and +15 minutes, and the 4th failure is final', () => {
  it('AC-1: the row stays pending with attempts + 1, the class code and next_attempt_at exactly 1, 5 and 15 minutes after each failure; the 4th failure is failed and is never claimed again', async () => {
    const planted = await queue();
    const transport = flakyTransport(99);

    // Attempt 1 at +0: fails, retry due 1 minute later.
    expect(await runAt(transport, 0).run()).toMatchObject({ claimed: 1, sent: 0, retrying: 1, failed: 0 });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'pending', attempts: 1, last_error: 'CONNECTION', next_attempt_at: minutesAfter(NOW, 1), locked_until: null });

    // Not due yet at +59 s: nothing is claimed and nothing is sent.
    const early = sendWith(transport, new Date(NOW.getTime() + MILLISECONDS_PER_MINUTE - 1_000));
    expect(await runOutboxSend(early.dependencies)).toMatchObject({ claimed: 0 });
    expect(transport.calls.count).toBe(1);

    // Attempt 2 at +1: fails, retry due 5 minutes later.
    expect(await runAt(transport, 1).run()).toMatchObject({ claimed: 1, retrying: 1 });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'pending', attempts: 2, last_error: 'CONNECTION', next_attempt_at: minutesAfter(NOW, 6) });

    // Attempt 3 at +6: fails, retry due 15 minutes later.
    expect(await runAt(transport, 6).run()).toMatchObject({ claimed: 1, retrying: 1 });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'pending', attempts: 3, last_error: 'CONNECTION', next_attempt_at: minutesAfter(NOW, 21) });

    // Attempt 4 at +21: fails, final.
    expect(await runAt(transport, 21).run()).toMatchObject({ claimed: 1, retrying: 0, failed: 1, failures: { CONNECTION: 1 } });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', attempts: 4, last_error: 'CONNECTION', locked_until: null, next_attempt_at: minutesAfter(NOW, 21) });

    // Never claimed again, however late.
    expect(await runAt(transport, 600).run()).toMatchObject({ claimed: 0 });
    expect(transport.calls.count).toBe(4);
    expect(await messagesWithSubject(planted.subject)).toBe(0);
  });

  it('AC-1: a secret-bearing row keeps its link while it can still be retried and has it emptied when it fails for good', async () => {
    const planted = await queue({ event: 'password-reset', idempotencyKey: 'password-reset:retry-tok', bodyText: 'https://portal.example.com/reset/live', bodyHtml: '<a href="https://portal.example.com/reset/live">x</a>' });
    const transport = flakyTransport(99);
    await runAt(transport, 0).run();
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'pending', body_text: 'https://portal.example.com/reset/live' });
    for (const minutes of [1, 6]) await runAt(transport, minutes).run();
    await runAt(transport, 21).run();
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', body_html: '', body_text: '' });
  });
});

describe('AC-2: a stub that fails twice then accepts', () => {
  it('AC-2: the job runs at the due times; exactly one message arrives, status sent, attempts 3, sent_at set, last_error cleared', async () => {
    const planted = await queue();
    const transport = flakyTransport(2);
    await runAt(transport, 0).run();
    await runAt(transport, 1).run();
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'pending', attempts: 2 });
    const third = runAt(transport, 6);
    expect(await third.run()).toMatchObject({ claimed: 1, sent: 1, retrying: 0, failed: 0 });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'sent', attempts: 3, last_error: null, sent_at: minutesAfter(NOW, 6), locked_until: null });
    // Later runs find nothing to do, and the capture server shows 1 message, not 3.
    expect(await runAt(transport, 60).run()).toMatchObject({ claimed: 0 });
    expect(await messagesWithSubject(planted.subject)).toBe(1);
    expect(transport.calls.count).toBe(3);
  });
});

describe('AC-7: the alerts switch holds at every attempt (BR-040)', () => {
  it('AC-7: a row waiting for its retry, alerts then switched OFF: at the retry it is skipped as ALERTS_OFF and not sent', async () => {
    const planted = await queue({ event: 'task-overdue', idempotencyKey: 'task-overdue:retry-off:2026-11-20T09:00:00.000Z' });
    const transport = flakyTransport(1);
    await runAt(transport, 0).run();
    expect((await rowOf(planted.idempotencyKey)).status).toBe('pending');
    await setAlerts(false);
    expect(await runAt(transport, 1).run()).toMatchObject({ claimed: 0, sent: 0, skipped: 1 });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'skipped', last_error: 'ALERTS_OFF', attempts: 1 });
    // Switching ON later does not send it (decision D-d), and the transport was never asked again.
    await setAlerts(true);
    expect(await runAt(transport, 10).run()).toMatchObject({ claimed: 0 });
    expect(transport.calls.count).toBe(1);
    expect(await messagesWithSubject(planted.subject)).toBe(0);
  });

  it('AC-7: a password-reset row (not an alert) is still retried with alerts OFF', async () => {
    await setAlerts(false);
    const planted = await queue({ event: 'password-reset', idempotencyKey: 'password-reset:retry-off', bodyText: 'link', bodyHtml: '<p>link</p>' });
    const transport = flakyTransport(1);
    await runAt(transport, 0).run();
    expect(await runAt(transport, 1).run()).toMatchObject({ sent: 1 });
    expect(await messagesWithSubject(planted.subject)).toBe(1);
  });
});

describe('AC-4: the lease', () => {
  it('AC-4: a worker stopped after claiming a row (sending, locked until 10:05) is not taken by a run inside the lease, and is claimed again and sent once the lease has passed', async () => {
    const planted = await queue();
    // The "dead worker": it claimed the row and stopped.
    const lock = minutesAfter(NOW, 5);
    expect((await outbox.claimDue(NOW, 25, lock)).claimed).toHaveLength(1);
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'sending', attempts: 1, locked_until: lock });

    const transport = flakyTransport(0);
    expect(await runAt(transport, 4).run()).toMatchObject({ claimed: 0 });
    expect(transport.calls.count).toBe(0);

    expect(await runAt(transport, 5).run()).toMatchObject({ claimed: 1, sent: 1 });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'sent', attempts: 2, last_error: null });
    expect(await messagesWithSubject(planted.subject)).toBe(1);
  });

  it('AC-4: a taken-back row that has already used its 4 attempts is failed with UNKNOWN, never sent again, and a secret body is emptied', async () => {
    const planted = await queue({ event: 'password-reset', idempotencyKey: 'password-reset:dead', bodyText: 'https://portal.example.com/reset/dead', bodyHtml: '<p>dead</p>' });
    await db.owner.query("UPDATE email_outbox SET status = 'sending', attempts = 4, locked_until = $2 WHERE idempotency_key = $1", [planted.idempotencyKey, minutesAfter(NOW, 5)]);
    const transport = flakyTransport(0);
    const world = runAt(transport, 6);
    expect(await world.run()).toMatchObject({ claimed: 0, sent: 0, failed: 1, failures: { UNKNOWN: 1 } });
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'failed', attempts: 4, last_error: 'UNKNOWN', body_html: '', body_text: '', locked_until: null });
    expect(transport.calls.count).toBe(0);
    expect(await runAt(transport, 60).run()).toMatchObject({ claimed: 0 });
  });

  it('AC-4 (SQR-03): a run whose lease passed while it was busy sends nothing for that row: the other run that took the row is the one that sends it, and the late marks change nothing', async () => {
    const planted = await queue();
    const lockA = minutesAfter(NOW, 5);
    const [slow] = (await outbox.claimDue(NOW, 25, lockA)).claimed;
    if (slow === undefined) throw new Error('Nothing was claimed.');

    // Run B starts after A's lease has passed and takes the row (attempt 2).
    const [taken] = (await outbox.claimDue(minutesAfter(NOW, 6), 25, minutesAfter(NOW, 11))).claimed;
    expect(taken).toMatchObject({ id: slow.id, attempts: 2 });

    // A finally gets to its send: its fence (attempt 1) no longer matches, so it is told "lost" and may not write.
    expect(await outbox.beginSend({ id: slow.id, attempts: 1 }, minutesAfter(NOW, 7), minutesAfter(NOW, 12))).toBe('lost');
    expect(await outbox.markSent({ id: slow.id, attempts: 1 }, minutesAfter(NOW, 7))).toBe(false);
    expect(await outbox.markRetry({ id: slow.id, attempts: 1 }, 'UNKNOWN', minutesAfter(NOW, 8))).toBe(false);
    expect(await outbox.markFailed({ id: slow.id, attempts: 1 }, 'UNKNOWN', minutesAfter(NOW, 8))).toBe(false);
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'sending', attempts: 2 });

    // B, holding attempt 2, is renewed and sends.
    expect(await outbox.beginSend({ id: slow.id, attempts: 2 }, minutesAfter(NOW, 7), minutesAfter(NOW, 12))).toBe('go');
    expect(await outbox.markSent({ id: slow.id, attempts: 2 }, minutesAfter(NOW, 7))).toBe(true);
  });

  it('AC-4: a lease that has passed but that nobody took is renewed by its own run (the fence is the attempt number, not the clock), so a slow batch still sends its later rows', async () => {
    const planted = await queue();
    const [row] = (await outbox.claimDue(NOW, 25, minutesAfter(NOW, 5))).claimed;
    if (row === undefined) throw new Error('Nothing was claimed.');
    expect(await outbox.beginSend({ id: row.id, attempts: row.attempts }, minutesAfter(NOW, 9), minutesAfter(NOW, 14))).toBe('go');
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'sending', locked_until: minutesAfter(NOW, 14) });
  });

  it('AC-4 (SQR-03): a row whose send_before passes between the claim and its send is skipped as EXPIRED and never sent; a secret body is emptied', async () => {
    const planted = await queue({
      event: 'password-reset',
      idempotencyKey: 'password-reset:expiring',
      bodyText: 'https://portal.example.com/reset/expiring',
      bodyHtml: '<p>x</p>',
      sendBefore: minutesAfter(NOW, 1),
    });
    const [row] = (await outbox.claimDue(NOW, 25, minutesAfter(NOW, 5))).claimed;
    if (row === undefined) throw new Error('Nothing was claimed.');
    expect(await outbox.beginSend({ id: row.id, attempts: row.attempts }, minutesAfter(NOW, 2), minutesAfter(NOW, 7))).toBe('expired');
    expect(await rowOf(planted.idempotencyKey)).toMatchObject({ status: 'skipped', last_error: 'EXPIRED', body_html: '', body_text: '', locked_until: null });
    expect(await outbox.markSent({ id: row.id, attempts: row.attempts }, minutesAfter(NOW, 2))).toBe(false);
  });
});

describe('AC-9: at most 25 rows are claimed in one run', () => {
  it('AC-9: 60 due rows: a run claims 25, the next 25, the last 10; each is sent once', async () => {
    const planted = [];
    for (let index = 0; index < 60; index += 1) planted.push(await queue());
    const sentSubjects: string[] = [];
    const counting: Mailer = {
      send: (mail) => {
        sentSubjects.push(mail.subject);
        return Promise.resolve({ ok: true });
      },
    };
    const world = sendWith(flakyTransport(0), NOW);
    const dependencies: OutboxSendDependencies = { ...world.dependencies, mailer: counting };
    expect(OUTBOX_CLAIM_LIMIT).toBe(25);
    expect((await runOutboxSend(dependencies)).claimed).toBe(25);
    expect((await runOutboxSend(dependencies)).claimed).toBe(25);
    expect((await runOutboxSend(dependencies)).claimed).toBe(10);
    expect((await runOutboxSend(dependencies)).claimed).toBe(0);
    expect(sentSubjects).toHaveLength(60);
    expect(new Set(sentSubjects).size).toBe(60);
    expect(planted).toHaveLength(60);
  });
});

describe('AC-5: every attempt is logged, with no address, subject, body or secret', () => {
  it('AC-5: a failing row, a retry and a success: one line per attempt with the row id, the event, the attempt number, the result and the code, and no "@" anywhere', async () => {
    const planted = await queue({ toUserId: (await db.owner.query<{ id: string }>("SELECT id::text FROM users WHERE role = 'ENGINEER' ORDER BY email LIMIT 1")).rows[0]?.id ?? '' });
    const transport = flakyTransport(1);
    const first = runAt(transport, 0);
    await first.run();
    const second = runAt(transport, 1);
    await second.run();

    const attempts = [...first.lines, ...second.lines].filter((line) => line.message.startsWith('outbox attempt'));
    expect(attempts.map((line) => line.fields)).toEqual([
      { job: 'outbox-send', outboxId: expect.stringMatching(/^[0-9a-f-]{36}$/), event: 'backup-missed', attempt: 1, result: 'retry', code: 'CONNECTION' },
      { job: 'outbox-send', outboxId: expect.stringMatching(/^[0-9a-f-]{36}$/), event: 'backup-missed', attempt: 2, result: 'sent' },
    ]);
    const printed = JSON.stringify(attempts);
    expect(printed).not.toContain('@');
    expect(printed).not.toContain(planted.subject);
    expect(printed).not.toContain('Reliability');
    // The text of the error from the transport (it held an address and a host) is nowhere.
    expect(printed).not.toMatch(/ECONNREFUSED|10\.9\.8\.7|portal/);
  });
});

describe('AC-6: the job_runs row', () => {
  const rows = async (): Promise<Array<{ job: string; result: Record<string, unknown> }>> =>
    (await db.owner.query<{ job: string; result: Record<string, unknown> }>("SELECT job, result FROM job_runs WHERE job = 'outbox-send' ORDER BY finished_at, id")).rows;

  it('AC-6: a run that claimed rows writes one row with the counts claimed, sent, retrying, failed and skipped', async () => {
    await queue();
    await queue();
    const world = sendWith(flakyTransport(1), NOW);
    await performOutboxSend(world.dependencies);
    expect(await rows()).toEqual([{ job: 'outbox-send', result: { status: 'ok', claimed: 2, sent: 1, retrying: 1, failed: 0, skipped: 0 } }]);
  });

  it('AC-6 (decision D-e): a run that found nothing due writes no row', async () => {
    const world = sendWith(flakyTransport(0), NOW);
    expect(await performOutboxSend(world.dependencies)).toEqual({ level: 'debug' });
    expect(await rows()).toEqual([]);
  });

  it('AC-6: a database fault is logged at error by the wrapper, writes a failed row when it can, and the next run still happens', async () => {
    const planted = await queue();
    const world = sendWith(flakyTransport(0), NOW);
    const lines: string[] = [];
    const broken: OutboxSendDependencies = { ...world.dependencies, store: { ...outbox, claimDue: () => Promise.reject(new Error('connection to server at "10.1.2.3" failed')) } };
    await runJob({ name: 'outbox-send', log: (message, level) => void lines.push(`${level ?? 'info'} ${message}`), now: () => NOW, recordFailure: (run) => broken.jobRuns.recordRun(run) }, () => performOutboxSend(broken));
    expect(lines.some((line) => line.startsWith('error outbox-send failed'))).toBe(true);
    expect(JSON.stringify(lines)).not.toContain('10.1.2.3');
    expect(await rows()).toEqual([{ job: 'outbox-send', result: { status: 'failed', message: 'the run failed' } }]);
    // The next run works.
    expect(await runOutboxSend(world.dependencies)).toMatchObject({ claimed: 1, sent: 1 });
    expect(await messagesWithSubject(planted.subject)).toBe(1);
  });
});
