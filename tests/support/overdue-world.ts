import { idempotencyKeys } from '@/lib/mail/events';
import { createFixedClock, MILLISECONDS_PER_MINUTE, type FixedClock } from '@/lib/time';
import { performOverdueScan, type OverdueScanDependencies, type OverdueScanStore } from '@/server/jobs/overdue-scan';
import { runOutboxSend, type OutboxSendDependencies } from '@/server/jobs/outbox-send';
import { createMailer } from '@/server/mail/send';
import { createEmailOutboxRepository, type EmailOutboxRepository } from '@/server/repositories/email-outbox-repository';
import { createOverdueScanStore } from '@/server/repositories/overdue-repository';

import { openAuthDatabase, type AuthDatabase } from './auth-database';
import { defined } from './defined';
import { openMailCapture, type CapturedMail, type MailCapture } from './mail-capture';

/**
 * The world of the `overdue-scan` integration tests (STORY-09.04): a throwaway migrated PostgreSQL, the runtime role's store and outbox, a capturing mail server (Mailpit when the run has one, an
 * in-process stub otherwise), a controlled clock, and four invented people. Two test files share it (`tests/integration/jobs/overdue-scan*.test.ts`), each with its own database: call `openWorld(n)` in
 * `beforeAll`, `closeWorld()` in `afterAll` and `resetWorld()` in `beforeEach`. State lives in this module, which a test file gets once (vitest isolates the module registry per file).
 * Every name, address, path and date is invented.
 */

export const NOW = new Date('2026-11-20T10:00:20.000Z');
export const ORIGIN = 'https://portal.example.com';
export const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

export let db: AuthDatabase;
export let capture: MailCapture;
export let clock: FixedClock;
export let outbox: EmailOutboxRepository;
export let store: OverdueScanStore;
export let scanDependencies: OverdueScanDependencies;
export let sendDependencies: OutboxSendDependencies;
export let engineerId = '';
export let otherEngineerId = '';
export let leadId = '';
export let adminId = '';
export const addressOf: Record<string, string> = {};

export async function plantUser(label: string, role: 'ENGINEER' | 'LEAD' | 'ADMIN', active = true): Promise<string> {
  const email = `${label}.overdue@example.com`;
  const { rows } = await db.owner.query<{ id: string }>("INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, 'invented-hash', $3::user_role, $4) RETURNING id::text", [
    `Invented ${label}`,
    email,
    role,
    active,
  ]);
  const id = defined(rows[0]).id;
  addressOf[id] = email;
  return id;
}

/**
 * `fileIndex` keeps the task codes of two test files apart. Both send through one Mailpit and find their messages by subject, which holds the task code, so a code must not repeat in another file
 * or in an earlier run on a Mailpit that keeps its messages. The world does not clear the capture server for the same reason: another file may be using it.
 */
export async function openWorld(fileIndex: number): Promise<void> {
  counter = (fileIndex + 1) * 1_000_000 + (Date.now() % 500_000);
  db = await openAuthDatabase();
  outbox = createEmailOutboxRepository(db.prisma);
  capture = openMailCapture();
  engineerId = await plantUser('arjun', 'ENGINEER');
  otherEngineerId = await plantUser('meera', 'ENGINEER');
  leadId = await plantUser('lead', 'LEAD');
  adminId = await plantUser('admin', 'ADMIN');
}

export async function closeWorld(): Promise<void> {
  await capture.close();
  await db.close();
}

/** A new worker process: a new store and a new job over the same database and the same clock. */
export function restartWorker(): void {
  store = createOverdueScanStore(db.prisma);
  scanDependencies = { store, clock, appOrigin: () => ORIGIN };
}

export async function resetWorld(): Promise<void> {
  clock = createFixedClock(NOW);
  restartWorker();
  sendDependencies = { store: outbox, mailer: createMailer(capture.transport), clock, log: () => undefined, jobRuns: { recordRun: () => Promise.resolve() } };
  await db.owner.query('DELETE FROM email_outbox');
  await db.owner.query('DELETE FROM job_runs');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  for (const id of [engineerId, otherEngineerId, leadId, adminId]) await setActive(id, true);
  await db.owner.query("UPDATE settings SET alerts_enabled = true, sender_name = 'Accucut Portal', sender_mailbox = 'portal@example.com' WHERE id = 1");
}

export const setActive = (id: string, active: boolean): Promise<unknown> => db.owner.query('UPDATE users SET is_active = $2 WHERE id = $1::uuid', [id, active]);
export const setAlerts = (on: boolean): Promise<unknown> => db.owner.query('UPDATE settings SET alerts_enabled = $1 WHERE id = 1', [on]);
export const setDeadline = (id: string, deadline: Date): Promise<unknown> => db.owner.query('UPDATE tasks SET deadline_at = $2 WHERE id = $1::uuid', [id, deadline]);
export const setStatus = (id: string, status: 'DRAFT' | 'SUBMITTED' | 'APPROVED'): Promise<unknown> =>
  db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE task_id = $1::uuid', [id, status]);

/** Task codes are unique to a call (the table's unique key, and a shared Mailpit is searched by subject). `reserveCodes(n)` takes `n` of them at once. Set by `openWorld`. */
let counter = 0;
export function reserveCodes(count: number): number {
  const first = counter;
  counter += count;
  return first;
}

export interface Seed {
  readonly deadline: Date;
  readonly engineer?: string;
  readonly assigner?: string;
  readonly status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  readonly title?: string | null;
}

/** A task and its estimate. */
export async function seed({ deadline, engineer = engineerId, assigner = leadId, status = 'DRAFT', title = 'Hopper cover' }: Seed): Promise<{ readonly id: string; readonly code: string }> {
  const code = `Q-2026-${reserveCodes(1)}`;
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject) VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, \'Invented subject\') RETURNING id::text', [
    code,
    engineer,
    assigner,
    PATH,
    deadline,
    title,
  ]);
  const id = defined(rows[0]).id;
  await db.owner.query('INSERT INTO estimates (task_id, status) VALUES ($1::uuid, $2::estimate_status)', [id, status]);
  return { id, code };
}

export interface OutboxRow {
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

export async function outboxRows(): Promise<OutboxRow[]> {
  const { rows } = await db.owner.query<OutboxRow>(
    'SELECT idempotency_key, event, to_user_id::text, cc_user_ids::text[] AS cc_user_ids, status, last_error, subject, body_html, body_text FROM email_outbox ORDER BY created_at, idempotency_key',
  );
  return rows;
}

export async function jobRuns(): Promise<Array<{ job: string; result: Record<string, unknown> }>> {
  const { rows } = await db.owner.query<{ job: string; result: Record<string, unknown> }>("SELECT job, result FROM job_runs WHERE job = 'overdue-scan' ORDER BY finished_at, id");
  return rows;
}

export const messagesFor = async (code: string): Promise<ReadonlyArray<CapturedMail>> => (await capture.list()).filter((mail) => mail.subject === `Task overdue: ${code}`);

/** One run of the scan, as the worker does it. */
export const scan = (): ReturnType<typeof performOverdueScan> => performOverdueScan(scanDependencies);
/** One run of `outbox-send`. */
export const send = (): ReturnType<typeof runOutboxSend> => runOutboxSend(sendDependencies);
/** Both, at the instant the clock is at. */
export async function minute(): Promise<void> {
  await scan();
  await send();
}
export const ago = (milliseconds: number): Date => new Date(NOW.getTime() - milliseconds);
export const keyOf = (taskId: string, deadline: Date): string => idempotencyKeys.taskOverdue(taskId, deadline);
export const minuteMarkAfter = (instant: Date): Date => new Date(Math.ceil(instant.getTime() / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE);
