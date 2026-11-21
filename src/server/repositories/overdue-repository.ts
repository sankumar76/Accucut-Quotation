import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import { createEmailOutboxRepository, type OutboxMessage } from './email-outbox-repository';
import { createJobRunWriter, type JobRunWriter } from './job-run-repository';
import type { PrismaClient } from './prisma-client';
import { createTransactionRunner } from './transaction';

/**
 * What the worker's `overdue-scan` job reads and writes (STORY-09.04; FR-082; NFR-010, NFR-028; architecture sections 4.7 and 5.1). Raw SQL lives only here, as tagged templates, and every
 * row that comes back is parsed (coding standards section 10, "SQL").
 *
 *   `findCandidates(now, since)`  ONE read: the open tasks of active Engineers whose deadline is in `[since, now)` and that have no outbox row for that deadline yet.
 *       - "Open" is "the estimate is not APPROVED" and "overdue" is "the deadline is strictly before `now`": the two conditions of the queue's Overdue tab (`tabFilter` in `task-repository.ts`),
 *         written in SQL here and held together by `tests/integration/jobs/overdue-scan.test.ts`. The deadline range is served by `idx_tasks_deadline_at`; the estimate by its unique task
 *         index and the people by their primary key.
 *       - The last condition builds the idempotency key the job will use (`task-overdue:<taskId>:<deadlineAtUtc>`, `idempotencyKeys.taskOverdue`) and looks it up in the outbox's unique index, so
 *         a task that has been reported is not read again each minute for the whole 24 hours (a steady state is one read and no write). It is an optimisation only: the outbox's unique key
 *         is what makes a message happen once, so a key that did not match here would still be queued once.
 *       - It returns the Engineer's and the assigner's IDs and the assigner's name and whether they are active now, never an address: recipients are user IDs (NFR-028, ruling DL-262) and
 *         `outbox-send` reads `users.email` again when it sends. An inactive Engineer is not a candidate; an inactive assigner is, and is simply left off the Cc.
 *   `createOverdueScanStore(db)`  what the job takes as its store: the switch, the read above, the writes of a batch in ONE transaction, and its `job_runs` rows.
 */

/** The rows of a run's candidates, as the job takes them (`OverdueCandidate` in `src/server/jobs/overdue-scan.ts`, which a repository does not import). */
export interface OverdueCandidateRow {
  readonly taskId: string;
  readonly code: string;
  readonly title: string | null;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly engineerId: string;
  readonly assigner: { readonly id: string; readonly name: string; readonly isActive: boolean };
}

export interface OverdueRepository {
  findCandidates(now: Date, since: Date): Promise<ReadonlyArray<OverdueCandidateRow>>;
}

const CANDIDATE_ROWS = z.array(
  z.strictObject({
    taskId: z.string(),
    code: z.string(),
    title: z.string().nullable(),
    folderPath: z.string(),
    deadlineAt: z.date(),
    engineerId: z.string(),
    assignerId: z.string(),
    assignerName: z.string(),
    assignerIsActive: z.boolean(),
  }),
);

/** What `createOverdueScanStore` makes: structurally the job's `OverdueScanStore`, which `src/worker/main.ts` passes in. */
export interface OverdueScanStoreRepository {
  /** `settings.alerts_enabled`. */
  alertsEnabled(): Promise<boolean>;
  findCandidates: OverdueRepository['findCandidates'];
  /** Queues the messages in one transaction and says how many were new (a key already queued is not queued again). */
  enqueueAll(messages: ReadonlyArray<OutboxMessage>, now: Date): Promise<{ readonly queued: number }>;
  recordRun: JobRunWriter['recordRun'];
}

export function createOverdueRepository(db: PrismaClient): OverdueRepository {
  return {
    findCandidates: (now, since) =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          SELECT t.id::text AS "taskId", t.code AS "code", t.title AS "title", t.folder_path AS "folderPath", t.deadline_at AS "deadlineAt",
                 t.engineer_id::text AS "engineerId", a.id::text AS "assignerId", a.name AS "assignerName", a.is_active AS "assignerIsActive"
          FROM tasks t
          JOIN estimates e ON e.task_id = t.id
          JOIN users eng ON eng.id = t.engineer_id AND eng.is_active
          JOIN users a ON a.id = t.assigned_by
          WHERE t.deadline_at < ${now}::timestamptz
            AND t.deadline_at >= ${since}::timestamptz
            AND e.status::text <> 'APPROVED'
            AND NOT EXISTS (
              SELECT 1 FROM email_outbox o
              WHERE o.idempotency_key = 'task-overdue:' || t.id::text || ':' || to_char(t.deadline_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            )
          ORDER BY t.deadline_at, t.code`;
        return CANDIDATE_ROWS.parse(rows).map((row) => ({
          taskId: row.taskId,
          code: row.code,
          title: row.title,
          folderPath: row.folderPath,
          deadlineAt: row.deadlineAt,
          engineerId: row.engineerId,
          assigner: { id: row.assignerId, name: row.assignerName, isActive: row.assignerIsActive },
        }));
      }),
  };
}

/**
 * The store `overdue-scan` is given (`OverdueScanStore` in `src/server/jobs/overdue-scan.ts`). `enqueueAll` writes every row of a scan in one transaction: all of them or none, so a scan that
 * fails half way leaves nothing to be half-reported, and a scan that runs at the same time as this one is held up by the unique key and then finds the rows already queued.
 */
export function createOverdueScanStore(db: PrismaClient): OverdueScanStoreRepository {
  const outbox = createEmailOutboxRepository(db);
  const transactions = createTransactionRunner(db);
  const overdue = createOverdueRepository(db);
  const jobRuns = createJobRunWriter(db);
  return {
    alertsEnabled: async () => (await outbox.readMailSettings()).alertsEnabled,
    findCandidates: overdue.findCandidates,
    enqueueAll: (messages, now) =>
      transactions.run(async (tx) => {
        let queued = 0;
        for (const message of messages) {
          // One statement per row, in order, on the transaction's one connection.
          if ((await outbox.enqueue(tx, message, now)) === 'queued') queued += 1;
        }
        return { queued };
      }),
    recordRun: jobRuns.recordRun,
  };
}
