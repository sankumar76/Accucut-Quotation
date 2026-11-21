import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AssignInput } from '@/lib/tasks/assign';
import { createFixedClock, type FixedClock } from '@/lib/time';
import { runOutboxSend, type OutboxSendDependencies } from '@/server/jobs/outbox-send';
import { createMailService } from '@/server/mail/mail-service';
import { createMailer } from '@/server/mail/send';
import { createEmailOutboxRepository, type EmailOutboxRepository } from '@/server/repositories/email-outbox-repository';
import { createSettingsRepository } from '@/server/repositories/settings-repository';
import { createTaskRepository } from '@/server/repositories/task-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';
import { createTaskMail } from '@/server/services/task-mail';
import { createTaskService, type TaskService } from '@/server/services/task-service';

import { forbiddenStrings } from '../../support/canary-masters';
import { defined } from '../../support/defined';
import { AUDIT_REQUEST_ID, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { openMailCapture, type CapturedMail, type MailCapture } from '../../support/mail-capture';

/**
 * STORY-09.03 AC-1 to AC-5, AC-7 and AC-8 against real PostgreSQL in a throwaway database, as the runtime role, with the real outbox, the real worker job and a capturing mail server
 * (Mailpit when the run has one, an in-process stub otherwise): an assignment with alerts ON writes one row in the task's own transaction and the message comes out with the Engineer
 * as To, the assigner as Cc and the deadline in IST; with alerts OFF there is no row; a failure after the row was written leaves no task and no row; the same key twice is one message;
 * a hostile title is text; a reassign through the real `reassignTask` sends to the new Engineer with the new revision and copies the person who made the change; and no canary value is in
 * any message. The clock is controlled. Every name, address, path and date is invented.
 */

const NOW = new Date('2026-11-09T04:00:00.000Z');
const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuditDatabase;
let clock: FixedClock;
/** What `FEATURE_EMAIL` reads as for this server, set per test. */
let emailOn = true;
let capture: MailCapture;
let transactions: TransactionRunner;
let outbox: EmailOutboxRepository;
let service: TaskService;
let sendDependencies: OutboxSendDependencies;
let leadId: string;
let adminId: string;
let otherLeadId: string;
let arjunId: string;
let meeraId: string;
const addressOf: Record<string, string> = {};

async function person(label: string, role: 'ADMIN' | 'LEAD' | 'ENGINEER', active = true): Promise<string> {
  const id = await insertPersonAsOwner(db, label, role, active);
  const { rows } = await db.owner.query<{ email: string }>('SELECT email FROM users WHERE id = $1::uuid', [id]);
  addressOf[id] = defined(rows[0]).email;
  return id;
}

const input = (overrides: Partial<AssignInput> = {}): AssignInput => ({
  engineerId: arjunId,
  folderPath: PATH,
  deadline: '2026-11-12T17:00',
  title: 'Hopper cover',
  notes: 'Sheet-metal parts only.',
  ...overrides,
});

const by = (actorId: string, actorLabel: string) => ({ actorId, actorLabel, requestId: AUDIT_REQUEST_ID });

interface OutboxRow {
  readonly idempotency_key: string;
  readonly event: string;
  readonly to_user_id: string;
  readonly cc_user_ids: string[];
  readonly status: string;
  readonly last_error: string | null;
  readonly subject: string;
  readonly body_html: string;
  readonly body_text: string;
}

async function outboxRows(): Promise<OutboxRow[]> {
  const { rows } = await db.owner.query<OutboxRow>(
    'SELECT idempotency_key, event, to_user_id::text, cc_user_ids::text[] AS cc_user_ids, status, last_error, subject, body_html, body_text FROM email_outbox ORDER BY created_at, idempotency_key',
  );
  return rows;
}

const taskCount = async (): Promise<number> => Number(defined((await db.owner.query<{ n: string }>('SELECT count(*) AS n FROM tasks')).rows[0]).n);

/** The last task number issued for the year (0 when none): a number that was rolled back goes back, so it does not move. */
const lastNumber = async (): Promise<number> =>
  Number(defined((await db.owner.query<{ n: string }>('SELECT coalesce(max(last_value), 0) AS n FROM task_sequences WHERE year = 2026')).rows[0]).n);

async function setAlerts(on: boolean): Promise<void> {
  await db.owner.query('UPDATE settings SET alerts_enabled = $1 WHERE id = 1', [on]);
}

/** The messages the capture holds for one task code (the subject names it), so a shared Mailpit and the other tests do not mix in. */
const messagesFor = async (code: string): Promise<ReadonlyArray<CapturedMail>> => (await capture.list()).filter((mail) => mail.subject === `Task assigned: ${code}`);

/** The assignment e-mail as the composition builds it: the real outbox and settings, the controlled clock, and `FEATURE_EMAIL` as the test set it. */
const taskMail = () =>
  createTaskMail({
    mail: createMailService({ outbox, mailer: createMailer(capture.transport), clock }),
    outbox,
    settings: createSettingsRepository(db.prisma),
    appOrigin: () => 'https://portal.example.com',
    clock,
    emailEnabled: () => emailOn,
  });

beforeAll(async () => {
  db = await openAuditDatabase();
  clock = createFixedClock(NOW);
  transactions = createTransactionRunner(db.prisma);
  outbox = createEmailOutboxRepository(db.prisma);
  capture = openMailCapture();
  await capture.clear();
  service = createTaskService({ tasks: createTaskRepository(db.prisma), transactions, clock, audit: db.audit, mail: taskMail() });
  sendDependencies = { store: outbox, mailer: createMailer(capture.transport), clock, log: () => undefined, jobRuns: { recordRun: () => Promise.resolve() } };
  leadId = await person('Mail Lead', 'LEAD');
  otherLeadId = await person('Mail Other Lead', 'LEAD');
  adminId = await person('Mail Admin', 'ADMIN');
  arjunId = await person('Mail Arjun', 'ENGINEER');
  meeraId = await person('Mail Meera', 'ENGINEER');
});

afterAll(async () => {
  await capture.close();
  await db.close();
});

beforeEach(async () => {
  clock.set(NOW);
  emailOn = true;
  await db.owner.query('DELETE FROM email_outbox');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query("UPDATE settings SET alerts_enabled = true, sender_name = 'Accucut Portal', sender_mailbox = 'portal@example.com' WHERE id = 1");
});

describe('AC-1, AC-2: an assignment with alerts ON writes one row in its own transaction, and the message comes out', () => {
  it('writes task-assigned:<taskId>:1, To the Engineer and Cc the Lead, by user ID, and the worker sends it: To, Cc, subject, both bodies, the IST deadline and the links', async () => {
    const assigned = await service.assignTask(leadId, input());
    const rows = await outboxRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ idempotency_key: `task-assigned:${assigned.id}:1`, event: 'task-assigned', to_user_id: arjunId, cc_user_ids: [leadId], status: 'pending' });
    // The row holds user IDs: no address of any person is in it.
    for (const address of Object.values(addressOf)) expect(JSON.stringify(rows), address).not.toContain(address);

    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, failed: 0, skipped: 0 });
    const [mail] = await messagesFor(assigned.code);
    expect(mail?.to).toEqual([addressOf[arjunId]]);
    expect(mail?.cc).toEqual([addressOf[leadId]]);
    expect(mail?.from).toEqual({ name: 'Accucut Portal', address: 'portal@example.com' });
    for (const body of [mail?.html ?? '', mail?.text ?? '']) {
      expect(body).toContain(assigned.code);
      expect(body).toContain('Hopper cover');
      expect(body).toContain('Sheet-metal parts only.');
      expect(body).toContain('Invented Mail Lead');
      expect(body).toContain(PATH);
      expect(body).toContain('file:////invented-server/invented-share/RFQ-123');
      expect(body).toContain('12 Nov 2026, 17:00 IST');
      expect(body).toContain(`https://portal.example.com/estimates/${assigned.code}`);
    }
    expect(mail?.text).not.toMatch(/<[a-z]/i);
  });

  it('AC-8: a deadline of 23:30 IST reads 23:30 on that date in the message, not the UTC date', async () => {
    const assigned = await service.assignTask(leadId, input({ deadline: '2026-11-12T23:30' }));
    await runOutboxSend(sendDependencies);
    const [mail] = await messagesFor(assigned.code);
    expect(mail?.text).toContain('12 Nov 2026, 23:30 IST');
    expect(mail?.html).toContain('12 Nov 2026, 23:30 IST');
  });

  it('a hostile title and notes are text: the HTML holds them escaped, the plain text as typed', async () => {
    const assigned = await service.assignTask(leadId, input({ title: '<script>alert(1)</script>', notes: '<img src=x onerror=alert(1)>' }));
    await runOutboxSend(sendDependencies);
    const [mail] = await messagesFor(assigned.code);
    expect(mail?.html).not.toContain('<script>');
    expect(mail?.html).not.toContain('<img src=x');
    expect(mail?.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail?.text).toContain('<script>alert(1)</script>');
  });

  it('AC-1: a failure after the row was written rolls the whole assignment back: no task, no estimate, no number used, no row, and nothing is sent', async () => {
    // A runner that fails after the work, inside the real transaction: the task, the estimate, the number and the outbox row were all written by then.
    const failing: TransactionRunner = {
      run: (work) =>
        transactions.run(async (tx) => {
          await work(tx);
          throw new Error('Invented late failure.');
        }),
    };
    const faulty = createTaskService({
      tasks: createTaskRepository(db.prisma),
      transactions: failing,
      clock,
      audit: db.audit,
      mail: taskMail(),
    });
    const numberBefore = await lastNumber();
    await expect(faulty.assignTask(leadId, input())).rejects.toThrow('Invented late failure.');
    expect(await taskCount()).toBe(0);
    expect(await outboxRows()).toEqual([]);
    expect(await lastNumber()).toBe(numberBefore);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 0, sent: 0 });
  });

  it('the same key twice is one row and one message', async () => {
    const assigned = await service.assignTask(leadId, input());
    const mail = taskMail();
    const task = { id: assigned.id, code: assigned.code, title: null, notes: null, folderPath: PATH, deadlineAt: assigned.deadlineAt, assignmentRevision: 1, engineer: assigned.engineer };
    const again = await transactions.run((tx) => mail.enqueueTaskAssigned(tx, task, { id: leadId, name: 'Invented Mail Lead', isActive: true }));
    expect(again).toBe('already-queued');
    expect(await outboxRows()).toHaveLength(1);
    await runOutboxSend(sendDependencies);
    expect(await messagesFor(assigned.code)).toHaveLength(1);
  });
});

describe('AC-4 (BR-040): alerts OFF', () => {
  it('writes no row and creates the task and its estimate exactly as before', async () => {
    await setAlerts(false);
    const assigned = await service.assignTask(leadId, input());
    expect(await outboxRows()).toEqual([]);
    expect(assigned).toMatchObject({ code: expect.stringMatching(/^Q-2026-\d{4}$/), engineer: { id: arjunId }, estimate: { status: 'DRAFT', customerId: null } });
    expect(await taskCount()).toBe(1);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 0, sent: 0 });
    expect(await messagesFor(assigned.code)).toEqual([]);
  });

  it('a row written while alerts were ON is marked skipped at claim time when they are switched OFF, and is never sent later (09.01 AC-5, decision D-d)', async () => {
    const assigned = await service.assignTask(leadId, input());
    await setAlerts(false);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 0, sent: 0, skipped: 1 });
    expect(await outboxRows()).toMatchObject([{ status: 'skipped', last_error: 'ALERTS_OFF' }]);
    await setAlerts(true);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 0, sent: 0, skipped: 0 });
    expect(await messagesFor(assigned.code)).toEqual([]);
  });
});

describe('AC-5: the Admin as assigner; who is copied is judged when the row is written', () => {
  it('copies the Admin like a Lead', async () => {
    const assigned = await service.assignTask(adminId, input());
    expect(await outboxRows()).toMatchObject([{ to_user_id: arjunId, cc_user_ids: [adminId] }]);
    await runOutboxSend(sendDependencies);
    const [mail] = await messagesFor(assigned.code);
    expect(mail?.to).toEqual([addressOf[arjunId]]);
    expect(mail?.cc).toEqual([addressOf[adminId]]);
    expect(mail?.text).toContain('Assigned by: Invented Mail Admin');
  });

  it('does not put an assigner who is not active when the row is written in the Cc, and still writes the row for the Engineer', async () => {
    const goneLeadId = await person('Mail Gone Lead', 'LEAD', false);
    await service.assignTask(goneLeadId, input());
    expect(await outboxRows()).toMatchObject([{ to_user_id: arjunId, cc_user_ids: [] }]);
  });

  it('refuses an Engineer who is not active, and writes no row (the Engineer is judged when the row is written)', async () => {
    const goneId = await person('Mail Gone Engineer', 'ENGINEER', false);
    await expect(service.assignTask(leadId, input({ engineerId: goneId }))).rejects.toMatchObject({ fields: [{ field: 'engineerId' }] });
    expect(await outboxRows()).toEqual([]);
    expect(await taskCount()).toBe(0);
  });

  it('a Cc deactivated between the write and the send is left out at send time, and the Engineer is still mailed (active judged again by outbox-send; PO ruling on AQP-350 comment 12394)', async () => {
    const shortLivedLeadId = await person('Mail Short Lived Lead', 'LEAD');
    const assigned = await service.assignTask(shortLivedLeadId, input());
    expect(await outboxRows()).toMatchObject([{ to_user_id: arjunId, cc_user_ids: [shortLivedLeadId] }]);
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [shortLivedLeadId]);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    const [mail] = await messagesFor(assigned.code);
    expect(mail?.to).toEqual([addressOf[arjunId]]);
    expect(mail?.cc).toEqual([]);
  });

  it('an Engineer deactivated between the write and the send is not mailed: the row is skipped with NO_RECIPIENT', async () => {
    const shortLivedEngineerId = await person('Mail Short Lived Engineer', 'ENGINEER');
    const assigned = await service.assignTask(leadId, input({ engineerId: shortLivedEngineerId }));
    await db.owner.query('UPDATE users SET is_active = false WHERE id = $1::uuid', [shortLivedEngineerId]);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 0, skipped: 1 });
    expect(await outboxRows()).toMatchObject([{ status: 'skipped', last_error: 'NO_RECIPIENT' }]);
    expect(await messagesFor(assigned.code)).toEqual([]);
  });
});

describe('AC-7: a reassign through the real reassignTask', () => {
  it('to another Engineer: a new row keyed with revision 2, To the new Engineer, Cc the person who made the change, with the task as it is now', async () => {
    const assigned = await service.assignTask(leadId, input());
    await service.reassignTask(by(otherLeadId, 'Invented Mail Other Lead'), assigned.id, { engineerId: meeraId, deadlineAt: '2026-11-13T18:00:00.000Z' });
    const rows = await outboxRows();
    expect(rows.map((row) => row.idempotency_key).sort()).toEqual([`task-assigned:${assigned.id}:1`, `task-assigned:${assigned.id}:2`]);
    const second = defined(rows.find((row) => row.idempotency_key.endsWith(':2')));
    expect(second).toMatchObject({ event: 'task-assigned', to_user_id: meeraId, cc_user_ids: [otherLeadId] });
    expect(second.body_text).toContain('Assigned by: Invented Mail Other Lead');
    expect(second.body_text).toContain('Title: Hopper cover');
    expect(second.body_text).toContain('13 Nov 2026, 23:30 IST');

    // The first Engineer's row was still unsent: it is withdrawn (DEF-055), so only the new Engineer is told.
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, skipped: 1 });
    const mails = await messagesFor(assigned.code);
    expect(mails).toHaveLength(1);
    const toMeera = defined(mails.find((mail) => mail.to.includes(defined(addressOf[meeraId]))));
    expect(toMeera.cc).toEqual([addressOf[otherLeadId]]);
  });

  it('a deadline-only change sends no assignment e-mail, and a change that changes nothing writes nothing', async () => {
    const assigned = await service.assignTask(leadId, input());
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { deadlineAt: '2026-11-14T06:30:00.000Z' });
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: arjunId });
    expect(await outboxRows()).toHaveLength(1);
  });

  it('with alerts OFF the reassign is made and no row is written', async () => {
    const assigned = await service.assignTask(leadId, input());
    await setAlerts(false);
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: meeraId });
    expect(await outboxRows()).toHaveLength(1);
  });
});

/** The `send_before` of each row, by key. */
async function sendBeforeOf(): Promise<Record<string, Date | null>> {
  const { rows } = await db.owner.query<{ idempotency_key: string; send_before: Date | null }>('SELECT idempotency_key, send_before FROM email_outbox');
  return Object.fromEntries(rows.map((row) => [row.idempotency_key, row.send_before]));
}

const hours = (count: number): Date => new Date(NOW.getTime() + count * 60 * 60 * 1000);

describe('DEF-055 (AQP-385): an assignment e-mail expires, is not queued where it cannot be sent, and is withdrawn when the task is reassigned', () => {
  it('every row carries send_before: 24 hours after it was written, by the controlled clock, and a withdrawn row has it set to the moment of the reassign', async () => {
    const assigned = await service.assignTask(leadId, input());
    expect((await sendBeforeOf())[`task-assigned:${assigned.id}:1`]).toEqual(hours(24));
    clock.set(hours(3));
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: meeraId });
    const found = await sendBeforeOf();
    // The first row was withdrawn at 03:00 (a reassign), the second is good for 24 hours from then.
    expect(found[`task-assigned:${assigned.id}:1`]).toEqual(hours(3));
    expect(found[`task-assigned:${assigned.id}:2`]).toEqual(hours(27));
  });

  it('a row that is 24 hours old or more when the worker claims it is skipped as EXPIRED, and nothing is sent (e-mail switched on, or the worker back, a day later)', async () => {
    const assigned = await service.assignTask(leadId, input());
    clock.set(hours(25));
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 0, sent: 0, skipped: 1 });
    expect(await outboxRows()).toMatchObject([{ status: 'skipped', last_error: 'EXPIRED' }]);
    expect(await messagesFor(assigned.code)).toEqual([]);
  });

  it('a row inside its window is sent as before', async () => {
    const assigned = await service.assignTask(leadId, input());
    clock.set(new Date(hours(24).getTime() - 60_000));
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, skipped: 0 });
    expect(await messagesFor(assigned.code)).toHaveLength(1);
  });

  it('after an outage of a day and a half, the old rows are skipped and a task assigned since is sent: the first send of a real mailbox does not flood it', async () => {
    const old = await Promise.all([input(), input({ title: 'Second task' }), input({ title: 'Third task' })].map((one) => service.assignTask(leadId, one)));
    clock.set(hours(36));
    const fresh = await service.assignTask(leadId, input({ title: 'Fresh task', deadline: '2026-11-14T17:00' }));
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, skipped: 3 });
    for (const task of old) expect(await messagesFor(task.code)).toEqual([]);
    expect(await messagesFor(fresh.code)).toHaveLength(1);
  });

  it('with FEATURE_EMAIL off and alerts ON no row is written, and switching e-mail on later finds nothing to send', async () => {
    emailOn = false;
    const assigned = await service.assignTask(leadId, input());
    expect(await outboxRows()).toEqual([]);
    expect(await taskCount()).toBe(1);
    emailOn = true;
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 0, sent: 0, skipped: 0 });
    expect(await messagesFor(assigned.code)).toEqual([]);
  });

  it('a reassign withdraws the unsent row of the old Engineer: it is skipped as EXPIRED, and only the new Engineer is mailed', async () => {
    const assigned = await service.assignTask(leadId, input());
    await service.reassignTask(by(otherLeadId, 'Invented Mail Other Lead'), assigned.id, { engineerId: meeraId });
    const found = await sendBeforeOf();
    expect(found[`task-assigned:${assigned.id}:1`]).toEqual(NOW);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, skipped: 1 });
    const rows = await outboxRows();
    expect(rows.find((row) => row.idempotency_key.endsWith(':1'))).toMatchObject({ status: 'skipped', last_error: 'EXPIRED' });
    const mails = await messagesFor(assigned.code);
    expect(mails.map((mail) => mail.to)).toEqual([[addressOf[meeraId]]]);
  });

  it('a task reassigned twice before the worker runs mails only the last Engineer', async () => {
    const assigned = await service.assignTask(leadId, input());
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: meeraId });
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: arjunId });
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, skipped: 2 });
    const mails = await messagesFor(assigned.code);
    expect(mails.map((mail) => mail.to)).toEqual([[addressOf[arjunId]]]);
  });

  it('SQR-02: a row the worker has claimed but not yet sent when the task is reassigned is stopped at beginSend, and the old Engineer is not mailed; the new Engineer still is', async () => {
    const assigned = await service.assignTask(leadId, input());
    const claim = await outbox.claimDue(NOW, 25, hours(1));
    const claimed = defined(claim.claimed[0]);
    await service.reassignTask(by(otherLeadId, 'Invented Mail Other Lead'), assigned.id, { engineerId: meeraId });
    expect(await outbox.beginSend({ id: claimed.id, attempts: claimed.attempts }, NOW, hours(1))).toBe('expired');
    expect(await messagesFor(assigned.code)).toEqual([]);
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1 });
    expect((await messagesFor(assigned.code)).map((mail) => mail.to)).toEqual([[addressOf[meeraId]]]);
  });

  it('SQR-02: a claimed row whose attempt fails and goes back to pending after a reassign is skipped as EXPIRED at the next claim, not mailed to the old Engineer', async () => {
    const assigned = await service.assignTask(leadId, input());
    const claimed = defined((await outbox.claimDue(NOW, 25, hours(1))).claimed[0]);
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: meeraId });
    expect(await outbox.markRetry({ id: claimed.id, attempts: claimed.attempts }, 'CONNECTION', new Date(NOW.getTime() + 60_000))).toBe(true);
    clock.set(new Date(NOW.getTime() + 120_000));
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1, skipped: 1 });
    expect((await outboxRows()).find((row) => row.idempotency_key.endsWith(':1'))).toMatchObject({ status: 'skipped', last_error: 'EXPIRED' });
    expect((await messagesFor(assigned.code)).map((mail) => mail.to)).toEqual([[addressOf[meeraId]]]);
  });

  it('a row that was already sent is not touched by a later reassign', async () => {
    const assigned = await service.assignTask(leadId, input());
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ sent: 1 });
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: meeraId });
    const rows = await outboxRows();
    expect(rows.find((row) => row.idempotency_key.endsWith(':1'))?.status).toBe('sent');
    expect((await sendBeforeOf())[`task-assigned:${assigned.id}:1`]).toEqual(hours(24));
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1 });
    expect(await messagesFor(assigned.code)).toHaveLength(2);
  });

  it('with FEATURE_EMAIL off a reassign still withdraws the unsent row written while it was on, and writes no new one', async () => {
    const assigned = await service.assignTask(leadId, input());
    emailOn = false;
    await service.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: meeraId });
    expect(await outboxRows()).toHaveLength(1);
    emailOn = true;
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 0, sent: 0, skipped: 1 });
    expect(await messagesFor(assigned.code)).toEqual([]);
  });

  it('a reassign that fails after the withdrawal puts the old row back: the withdrawal is in the reassign\'s own transaction', async () => {
    const assigned = await service.assignTask(leadId, input());
    const failing: TransactionRunner = {
      run: (work) =>
        transactions.run(async (tx) => {
          await work(tx);
          throw new Error('Invented late failure.');
        }),
    };
    const faulty = createTaskService({ tasks: createTaskRepository(db.prisma), transactions: failing, clock, audit: db.audit, mail: taskMail() });
    await expect(faulty.reassignTask(by(leadId, 'Invented Mail Lead'), assigned.id, { engineerId: meeraId })).rejects.toThrow('Invented late failure.');
    expect((await sendBeforeOf())[`task-assigned:${assigned.id}:1`]).toEqual(hours(24));
    expect(await runOutboxSend(sendDependencies)).toMatchObject({ claimed: 1, sent: 1 });
  });
});

describe('AC-3 (NFR-002): no cost, rate, formula or customer value in any message', () => {
  it('finds none of the forbidden canary strings of the masters, the rate names or the formula markers in any captured message', async () => {
    const codes: string[] = [];
    codes.push((await service.assignTask(leadId, input())).code);
    codes.push((await service.assignTask(adminId, input({ title: '', notes: '' }))).code);
    await runOutboxSend(sendDependencies);
    const forbidden = forbiddenStrings();
    expect(forbidden.length).toBeGreaterThan(0);
    for (const code of codes) {
      const [mail] = await messagesFor(code);
      expect(mail, code).toBeDefined();
      const everything = [mail?.subject, mail?.html, mail?.text].join('\n');
      for (const { text, reason } of forbidden) expect(everything, `${reason}: ${text}`).not.toContain(text);
    }
  });
});
