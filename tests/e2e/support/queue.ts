import { Client, type QueryResultRow } from 'pg';

import { assertSafeDatabaseTarget } from '../../support/db-guard';

import { E2E_LEAD } from './auth';

/**
 * Tasks for the queue spec (STORY-04.02): a task and its estimate put into the database the servers use, in any state and with any deadline, which "Assign task"
 * cannot make (it refuses a deadline that is not later than now, and an estimate starts as a draft). The URL is judged by the same guard as every test run, so
 * this can never write to a live database. The rows stay in the throwaway database (the runtime role cannot delete them). Every name and path is invented; the
 * year `9998` is one no real task has.
 *
 * **A code cannot repeat (DEF-042).** The running number is not drawn at random: it is the next one after the highest `Q-9998-` code in the database, read and used
 * inside one transaction that first takes a database-wide advisory lock. Two workers, two specs, three projects or two runs against the same database therefore
 * queue up for the lock and each gets a number the other has already committed, so no two seeded tasks can meet on `uq_tasks_code`. This is the only place that makes a
 * `Q-9998-` code, the other seeds use other years (`Q-9999-` canary tasks, `Q-2098-` Lighthouse data) and the application uses the current year, so none of them can match.
 * Every code has six digits, so none is a part of another (the queue's search matches part of a code).
 */

export type SeededStatus = 'DRAFT' | 'PREPARED' | 'APPROVED';

export interface SeededQueueTask {
  /** The task's ID, for `GET /api/v1/tasks/{id}` (STORY-04.04). */
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

const FOLDER_PATH = '\\\\invented-server\\invented-share\\RFQ-queue';
const CODE_PREFIX = 'Q-9998-';
/** The running numbers have six digits, the first is `100000`. */
const RUNNING_NUMBER_MIN = 100_000;
const RUNNING_NUMBER_MAX = 999_999;
/** The one advisory lock every seeded task takes while it picks its code. Nothing else in the application or the tests takes an advisory lock. */
const CODE_LOCK_KEY = '9998000001';

/** A task code in a year no real task has: `Q-9998-` and a running number of six digits. */
export function queueTaskCode(runningNumber: number): string {
  if (!Number.isInteger(runningNumber) || runningNumber < RUNNING_NUMBER_MIN || runningNumber > RUNNING_NUMBER_MAX) {
    throw new Error(`The running number ${runningNumber} is outside ${RUNNING_NUMBER_MIN} to ${RUNNING_NUMBER_MAX}.`);
  }
  return `${CODE_PREFIX}${runningNumber}`;
}

/** The running number after the highest one in the database (`null`: none yet). Past `999999` there is no next one, and a seed says so instead of repeating a code. */
export function nextRunningNumber(highest: number | null): number {
  if (highest === null) return RUNNING_NUMBER_MIN;
  if (!Number.isInteger(highest) || highest < RUNNING_NUMBER_MIN - 1) throw new Error(`The highest running number ${highest} is not one this helper made.`);
  if (highest >= RUNNING_NUMBER_MAX) throw new Error('The running numbers of the test codes are used up.');
  return highest + 1;
}

/** What the helper needs of a database connection: `pg`'s `Client` has it, and a unit test passes a small stand-in. */
export interface QueueSeedClient {
  query<R extends QueryResultRow>(text: string, values?: readonly unknown[]): Promise<{ readonly rows: R[] }>;
}

async function connect(): Promise<Client> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_URL is not set. Start the test database and set it as the README says.');
  assertSafeDatabaseTarget({ ...process.env, DATABASE_URL: url });
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * Inserts the task under the next free code, in one transaction that holds the advisory lock from the read of the highest code to the commit of the new row (DEF-042:
 * see the header). A failure of any step rolls back and gives the lock back; the error is thrown as it is.
 */
export async function insertQueueTask(
  client: QueueSeedClient,
  engineerId: string,
  deadlineAt: string,
  title: string,
  assignedByEmail: string,
): Promise<{ readonly id: string; readonly code: string } | undefined> {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [CODE_LOCK_KEY]);
    // The cast is safe: the pattern keeps only codes made by this helper (six digits).
    const highest = await client.query<{ highest: number | null }>(`SELECT max(substr(code, ${CODE_PREFIX.length + 1})::int) AS highest FROM tasks WHERE code ~ '^${CODE_PREFIX}[0-9]{6}$'`);
    const code = queueTaskCode(nextRunningNumber(highest.rows[0]?.highest ?? null));
    const task = await client.query<{ id: string }>(
      `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject)
       SELECT $1, $2::uuid, id, $3, $4::timestamptz, $5, 'Invented subject' FROM users WHERE email = $6 RETURNING id::text`,
      [code, engineerId, FOLDER_PATH, deadlineAt, title, assignedByEmail],
    );
    const id = task.rows[0]?.id;
    await client.query(id === undefined ? 'ROLLBACK' : 'COMMIT');
    return id === undefined ? undefined : { id, code };
  } catch (error) {
    // A rollback that fails (the connection is gone) must not hide the error that came first.
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

/**
 * One task for the Engineer, assigned by the E2E Lead (or by the person with `assignedByEmail`: STORY-04.03 counts a Lead's bell by who assigned), with its estimate in
 * the given state. `deadlineAt` is an ISO 8601 instant in UTC.
 */
export async function seedQueueTask(
  engineerId: string,
  deadlineAt: string,
  status: SeededStatus,
  title: string,
  assignedByEmail: string = E2E_LEAD.email,
): Promise<SeededQueueTask> {
  const client = await connect();
  try {
    const task = await insertQueueTask(client, engineerId, deadlineAt, title, assignedByEmail);
    if (task === undefined) throw new Error('The person who assigns the task does not exist yet: the set-up project makes the E2E Lead, and a test makes its own.');
    await client.query('INSERT INTO estimates (task_id, status) VALUES ($1::uuid, $2::estimate_status)', [task.id, status]);
    return { id: task.id, code: task.code, title };
  } finally {
    await client.end();
  }
}

/**
 * Puts the estimate of a task into another status, as an approval or an unlock would (STORY-04.04: an approved task unlocked is DRAFT again). The runtime role may update
 * `estimates`, so this is the same write the application makes. Only the status changes.
 */
export async function setEstimateStatus(taskId: string, status: SeededStatus): Promise<void> {
  const client = await connect();
  try {
    await client.query('UPDATE estimates SET status = $2::estimate_status WHERE task_id = $1::uuid', [taskId, status]);
  } finally {
    await client.end();
  }
}
