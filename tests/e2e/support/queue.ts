import { randomInt } from 'node:crypto';

import { Client } from 'pg';

import { assertSafeDatabaseTarget } from '../../support/db-guard';

import { E2E_LEAD } from './auth';

/**
 * Tasks for the queue spec (STORY-04.02): a task and its estimate put into the database the servers use, in any state and with any deadline, which "Assign task"
 * cannot make (it refuses a deadline that is not later than now, and an estimate starts as a draft). The URL is judged by the same guard as every test run, so
 * this can never write to a live database. The rows stay in the throwaway database (the runtime role cannot delete them). Every name and path is invented; the
 * year `9998` is one no real task has, and the running number is random, so no two runs meet on a code.
 */

export type SeededStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

export interface SeededQueueTask {
  readonly code: string;
  readonly title: string;
}

const FOLDER_PATH = '\\\\invented-server\\invented-share\\RFQ-queue';
const RUNNING_NUMBER_MIN = 100_000;
const RUNNING_NUMBER_MAX = 999_999;

/** A task code in a year no real task has, with a random running number. */
export function queueTaskCode(): string {
  return `Q-9998-${randomInt(RUNNING_NUMBER_MIN, RUNNING_NUMBER_MAX)}`;
}

async function connect(): Promise<Client> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_URL is not set. Start the test database and set it as the README says.');
  assertSafeDatabaseTarget({ ...process.env, DATABASE_URL: url });
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/** One task for the Engineer, assigned by the E2E Lead, with its estimate in the given state. `deadlineAt` is an ISO 8601 instant in UTC. */
export async function seedQueueTask(engineerId: string, deadlineAt: string, status: SeededStatus, title: string): Promise<SeededQueueTask> {
  const client = await connect();
  try {
    const code = queueTaskCode();
    const task = await client.query<{ id: string }>(
      `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title)
       SELECT $1, $2::uuid, id, $3, $4::timestamptz, $5 FROM users WHERE email = $6 RETURNING id::text`,
      [code, engineerId, FOLDER_PATH, deadlineAt, title, E2E_LEAD.email],
    );
    const id = task.rows[0]?.id;
    if (id === undefined) throw new Error('The E2E Lead does not exist yet: the set-up project makes it.');
    await client.query('INSERT INTO estimates (task_id, status) VALUES ($1::uuid, $2::estimate_status)', [id, status]);
    return { code, title };
  } finally {
    await client.end();
  }
}
