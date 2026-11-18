import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutboxErrorCode, SkipCode } from '@/lib/mail/codes';
import { createFixedClock } from '@/lib/time';
import {
  describeOutboxSend,
  OUTBOX_CLAIM_LIMIT,
  OUTBOX_LOCK_MILLISECONDS,
  OUTBOX_SEND_CRON,
  OUTBOX_SEND_TIMEZONE,
  performOutboxSend,
  runOutboxSend,
  scheduleMailJobs,
  type OutboxJobMessage,
  type OutboxSendDependencies,
  type OutboxSendStore,
} from '@/server/jobs/outbox-send';
import type { Mailer, OutgoingMail } from '@/server/mail/send';

const cron = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ schedule: cron.schedule }));

/**
 * STORY-09.01 AC-4 (claim and send), AC-5 (skipped rows and the sender read at send time), AC-6 (`FEATURE_EMAIL`) and AC-7 (nothing but counts and codes in the log), with the
 * store, the mailer and the clock stubbed. The statements themselves (the claim, the marks) are tested against PostgreSQL in `tests/integration/mail`.
 */

const NOW = new Date('2026-11-18T10:00:00.000Z');
const IDS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'] as const;

function row(index: number): OutboxJobMessage {
  return {
    id: IDS[index] ?? 'x',
    toUserId: `to-${index}`,
    ccUserIds: [`cc-${index}`],
    subject: `Subject ${index} with a name`,
    bodyHtml: `<p>Body ${index}</p>`,
    bodyText: `Body ${index}`,
  };
}

interface Marks {
  sent: Array<{ id: string; at: Date }>;
  failed: Array<{ id: string; code: OutboxErrorCode }>;
  skipped: Array<{ id: string; code: SkipCode }>;
}

function harness(
  options: {
    claimed?: OutboxJobMessage[];
    skipped?: Array<{ id: string; code: SkipCode }>;
    recipients?: (toUserId: string) => { to: string | null; cc: string[] } | Error;
    sendResult?: (mail: OutgoingMail) => Awaited<ReturnType<Mailer['send']>> | Error;
    settings?: { senderName: string; senderMailbox: string };
  } = {},
) {
  const marks: Marks = { sent: [], failed: [], skipped: [] };
  const clock = createFixedClock(NOW);
  const claimDue = vi.fn<OutboxSendStore['claimDue']>(() => Promise.resolve({ claimed: options.claimed ?? [], skipped: options.skipped ?? [] }));
  const readMailSettings = vi.fn<OutboxSendStore['readMailSettings']>(() => Promise.resolve(options.settings ?? { senderName: 'Accucut Portal', senderMailbox: 'portal@example.com' }));
  const store: OutboxSendStore = {
    claimDue,
    readMailSettings,
    resolveRecipients: (toUserId) => {
      const answer = options.recipients?.(toUserId) ?? { to: `${toUserId}@example.com`, cc: [`cc-of-${toUserId}@example.com`] };
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    markSent: (id, at) => Promise.resolve(marks.sent.push({ id, at }) > 0),
    markFailed: (id, code) => Promise.resolve(marks.failed.push({ id, code }) > 0),
    markSkipped: (id, code) => Promise.resolve(marks.skipped.push({ id, code }) > 0),
  };
  const sentMail: Array<{ mail: OutgoingMail; sender: { name: string; mailbox: string } }> = [];
  const mailer: Mailer = {
    send: (mail, sender) => {
      sentMail.push({ mail, sender });
      const answer = options.sendResult?.(mail) ?? { ok: true as const };
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  const dependencies: OutboxSendDependencies = { store, mailer, clock };
  return { dependencies, marks, sentMail, claimDue, readMailSettings, clock };
}

beforeEach(() => {
  cron.schedule.mockReset();
});

describe('runOutboxSend: the claim (AC-4)', () => {
  it('AC-4: claims at most 25 rows, locked for 5 minutes from the clock\'s now', async () => {
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
    expect(summary).toMatchObject({ claimed: 2, sent: 2, skipped: 0, failed: 0 });
    expect(sentMail.map((entry) => entry.mail)).toEqual([
      { to: 'to-0@example.com', cc: ['cc-of-to-0@example.com'], subject: 'Subject 0 with a name', html: '<p>Body 0</p>', text: 'Body 0' },
      { to: 'to-1@example.com', cc: ['cc-of-to-1@example.com'], subject: 'Subject 1 with a name', html: '<p>Body 1</p>', text: 'Body 1' },
    ]);
    expect(marks.sent).toEqual([
      { id: IDS[0], at: new Date(NOW.getTime() + 1_000) },
      { id: IDS[1], at: new Date(NOW.getTime() + 1_000) },
    ]);
  });
});

describe('runOutboxSend: skipped and failed rows (AC-5, AC-7)', () => {
  it('AC-5: rows the claim skipped (alerts off, expired) are counted and never sent', async () => {
    const { dependencies, sentMail } = harness({ skipped: [{ id: 'a', code: 'ALERTS_OFF' }, { id: 'b', code: 'EXPIRED' }] });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 0, skipped: 2, sent: 0 });
    expect(sentMail).toEqual([]);
  });

  it('AC-5: a To user who is inactive or missing at send time marks the row skipped with NO_RECIPIENT and sends nothing', async () => {
    const { dependencies, marks, sentMail } = harness({ claimed: [row(0)], recipients: () => ({ to: null, cc: [] }) });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, skipped: 1, sent: 0, failed: 0 });
    expect(marks.skipped).toEqual([{ id: IDS[0], code: 'NO_RECIPIENT' }]);
    expect(sentMail).toEqual([]);
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

  it('AC-5: an empty sender fails the row with NO_SENDER (the mailer says so)', async () => {
    const { dependencies, marks } = harness({ claimed: [row(0)], settings: { senderName: '', senderMailbox: '' }, sendResult: () => ({ ok: false, code: 'NO_SENDER' }) });
    expect(await runOutboxSend(dependencies)).toMatchObject({ failed: 1, failures: { NO_SENDER: 1 } });
    expect(marks.failed).toEqual([{ id: IDS[0], code: 'NO_SENDER' }]);
  });

  it('AC-7: a failed send is marked failed once with its class code, and the run goes on with the next row', async () => {
    let calls = 0;
    const { dependencies, marks } = harness({
      claimed: [row(0), row(1), row(2)],
      sendResult: () => (++calls === 2 ? { ok: false, code: 'AUTH_FAILED' } : { ok: true }),
    });
    expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 3, sent: 2, failed: 1, failures: { AUTH_FAILED: 1 } });
    expect(marks.failed).toEqual([{ id: IDS[1], code: 'AUTH_FAILED' }]);
    expect(marks.sent.map((entry) => entry.id)).toEqual([IDS[0], IDS[2]]);
  });

  it('AC-7: a database problem on one row marks that row failed with UNKNOWN, keeps its error text out of the mark, and the run goes on', async () => {
    const { dependencies, marks } = harness({
      claimed: [row(0), row(1)],
      recipients: (toUserId) => (toUserId === 'to-0' ? new Error('connection to server at "10.1.2.3" failed') : { to: 'ok@example.com', cc: [] }),
    });
    expect(await runOutboxSend(dependencies)).toMatchObject({ sent: 1, failed: 1, failures: { UNKNOWN: 1 } });
    expect(marks.failed).toEqual([{ id: IDS[0], code: 'UNKNOWN' }]);
    expect(JSON.stringify(marks)).not.toContain('10.1.2.3');
  });

  // SQR-02 (review of PR #503): a message the mail server accepted is sent, whatever happens to its mark. A `failed` row is one that STORY-09.06 may retry, and a retry would send it twice (NFR-014).
  describe('the result of a message that was sent (SQR-02, NFR-014)', () => {
    function withMarkSent(markSent: OutboxSendStore['markSent'], claimed = [row(0), row(1)]) {
      const base = harness({ claimed });
      const markFailed = vi.fn<OutboxSendStore['markFailed']>(base.dependencies.store.markFailed);
      const dependencies: OutboxSendDependencies = { ...base.dependencies, store: { ...base.dependencies.store, markSent, markFailed } };
      return { ...base, dependencies, markFailed };
    }

    it('AC-4: if saving `sent` fails after the server accepted the message, the run counts it as sent 1, failed 0, never marks the row failed, and goes on with the next row', async () => {
      const saved: string[] = [];
      const { dependencies, markFailed, marks } = withMarkSent((id) => {
        if (id === IDS[0]) return Promise.reject(new Error('connection to server at "10.1.2.3" failed'));
        saved.push(id);
        return Promise.resolve(true);
      });
      const summary = await runOutboxSend(dependencies);
      expect(summary).toMatchObject({ claimed: 2, sent: 2, failed: 0, notRecorded: 1, failures: {} });
      expect(markFailed).not.toHaveBeenCalled();
      expect(marks.failed).toEqual([]);
      expect(saved).toEqual([IDS[1]]);
    });

    it('with only that row: sent 1, failed 0', async () => {
      const { dependencies, markFailed } = withMarkSent(() => Promise.reject(new Error('statement timeout')), [row(0)]);
      expect(await runOutboxSend(dependencies)).toMatchObject({ claimed: 1, sent: 1, failed: 0, notRecorded: 1 });
      expect(markFailed).not.toHaveBeenCalled();
    });

    it('a mark that changes no row (the row is no longer sending) is also not recorded, and not a failure', async () => {
      const { dependencies, markFailed } = withMarkSent(() => Promise.resolve(false), [row(0)]);
      expect(await runOutboxSend(dependencies)).toMatchObject({ sent: 1, failed: 0, notRecorded: 1 });
      expect(markFailed).not.toHaveBeenCalled();
    });

    it('the log says NOT_RECORDED at error level, with a count and no id, address or error text', async () => {
      const { dependencies } = withMarkSent(() => Promise.reject(new Error('connection to server at "10.1.2.3" failed')), [row(0)]);
      const lines: Array<[string, string | undefined]> = [];
      await performOutboxSend(dependencies, (message, level) => lines.push([message, level]));
      expect(lines).toEqual([['outbox-send: claimed 1, sent 1, skipped 0, failed 0; NOT_RECORDED 1 (sent, but the result could not be saved, so the row stays sending)', 'error']]);
      expect(JSON.stringify(lines)).not.toMatch(/10.1.2.3|example.com|Subject|Body/);
    });

    it('a send that failed whose `failed` mark also cannot be saved does not throw, and leaves the row sending for 09.06', async () => {
      const base = harness({ claimed: [row(0)], sendResult: () => ({ ok: false, code: 'CONNECTION' }) });
      const dependencies: OutboxSendDependencies = { ...base.dependencies, store: { ...base.dependencies.store, markFailed: () => Promise.reject(new Error('db down')) } };
      await expect(runOutboxSend(dependencies)).resolves.toMatchObject({ claimed: 1, sent: 0, failed: 1, notRecorded: 0 });
    });
  });

  it('a mailer that throws (it should not) is still a failed row, not a stuck run', async () => {
    const { dependencies, marks } = harness({ claimed: [row(0)], sendResult: () => new Error('boom') });
    expect(await runOutboxSend(dependencies)).toMatchObject({ failed: 1 });
    expect(marks.failed).toEqual([{ id: IDS[0], code: 'UNKNOWN' }]);
  });

  it('if even the failed mark cannot be written, the run does not throw (the row stays sending for 09.06)', async () => {
    const { dependencies } = harness({ claimed: [row(0)], recipients: () => new Error('db down') });
    const failing: OutboxSendDependencies = { ...dependencies, store: { ...dependencies.store, markFailed: () => Promise.reject(new Error('db down')) } };
    await expect(runOutboxSend(failing)).resolves.toMatchObject({ claimed: 1 });
  });
});

describe('the log (AC-7)', () => {
  it('describes a run with counts and codes only', () => {
    expect(describeOutboxSend({ claimed: 5, sent: 2, skipped: 1, failed: 2, failures: { AUTH_FAILED: 1, CONNECTION: 1 }, notRecorded: 0 })).toBe('outbox-send: claimed 5, sent 2, skipped 1, failed 2 (AUTH_FAILED 1, CONNECTION 1)');
    expect(describeOutboxSend({ claimed: 1, sent: 1, skipped: 0, failed: 0, failures: {}, notRecorded: 0 })).toBe('outbox-send: claimed 1, sent 1, skipped 0, failed 0');
  });

  it('AC-7: a run writes counts and codes, and never an address, a subject, a body or an id', async () => {
    const { dependencies } = harness({ claimed: [row(0), row(1)], sendResult: (mail) => (mail.to.startsWith('to-1') ? { ok: false, code: 'CONNECTION' } : { ok: true }) });
    const lines: Array<[string, string | undefined]> = [];
    await performOutboxSend(dependencies, (message, level) => lines.push([message, level]));
    expect(lines).toEqual([['outbox-send: claimed 2, sent 1, skipped 0, failed 1 (CONNECTION 1)', 'error']]);
    const printed = JSON.stringify(lines);
    for (const value of ['example.com', 'Subject', 'Body', IDS[0], 'to-0']) expect(printed).not.toContain(value);
  });

  it('a run with nothing due writes no line', async () => {
    const { dependencies } = harness();
    const lines: string[] = [];
    await performOutboxSend(dependencies, (message) => lines.push(message));
    expect(lines).toEqual([]);
  });

  it('a clean run is logged at info', async () => {
    const { dependencies } = harness({ claimed: [row(0)] });
    const lines: Array<[string, string | undefined]> = [];
    await performOutboxSend(dependencies, (message, level) => lines.push([message, level]));
    expect(lines).toEqual([['outbox-send: claimed 1, sent 1, skipped 0, failed 0', 'info']]);
  });

  it('AC-7: a claim that fails is logged as one fixed line at error, with none of the error text, and the callback does not throw', async () => {
    const { dependencies } = harness();
    const failing: OutboxSendDependencies = { ...dependencies, store: { ...dependencies.store, claimDue: () => Promise.reject(new Error('password authentication failed for user "accucut_app"')) } };
    const lines: Array<[string, string | undefined]> = [];
    await expect(performOutboxSend(failing, (message, level) => lines.push([message, level]))).resolves.toBeUndefined();
    expect(lines).toEqual([['outbox-send could not read or write the outbox', 'error']]);
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
