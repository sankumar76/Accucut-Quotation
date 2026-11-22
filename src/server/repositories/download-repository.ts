import { z } from 'zod';

import type { DownloadMarkerFacts } from '../../lib/export/download-marker';
import { QUEUE_MAX_LIMIT } from '../../lib/tasks/queue';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * The download log of the Excel export (STORY-CR01.7E, AQP-402; CR-01 item 7c; architecture section 4.12 d): one append-only row for every file the server handed over, and the facts the marker reads.
 * **Restricted** (NFR-002): no Engineer view imports it (`tests/security/engineer-import-rule.test.ts`), and the marker built from it is for a Lead and an Admin only. The runtime role holds SELECT and INSERT on
 * `estimate_downloads` and triggers refuse UPDATE, DELETE and TRUNCATE for every role (migration `estimate_downloads`), so this file only reads and inserts.
 *
 * **The approval of a file and the approval that stands** are the one notion on both sides: the ID of the estimate's latest approval **while it stands** (not cancelled and its price not removed), or `null`.
 * That is the approval whose price the file carries in BO2 (`approvedPriceOf`), so the marker compares like with like. The reads below take it from the same ordering as `findLatestApproval`
 * (`approved_at` then `id`, newest first).
 */

export interface NewDownload {
  readonly estimateId: string;
  /** The calculation the file was made from. */
  readonly calculationId: string;
  /** The approval whose price the file carries, or `null` when the file holds no price. */
  readonly approvalId: string | null;
  readonly downloadedById: string;
}

export interface TaskMarkerFacts {
  readonly taskId: string;
  readonly facts: DownloadMarkerFacts;
}

export interface DownloadRepository {
  /** Appends the record of one download, in the caller's transaction (required: the record and the decision to give the file are one). */
  insertDownload(download: NewDownload, tx: Transaction): Promise<void>;
  /** The count, the last download and the approval that stands, for one estimate; `null` for an estimate that does not exist (and for an ID that is not a UUID). Pass `tx` to read in the caller's snapshot. */
  findMarkerFacts(estimateId: string, tx?: Transaction): Promise<DownloadMarkerFacts | null>;
  /** The same for the estimates of these tasks, at most `QUEUE_MAX_LIMIT` (200) at a time (one page of the queue), in one statement; a task with no estimate and an ID that is not a UUID are left out. */
  findMarkerFactsOfTasks(taskIds: ReadonlyArray<string>): Promise<ReadonlyArray<TaskMarkerFacts>>;
}

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

const FACT_ROWS = z.array(
  z.strictObject({
    taskId: z.string(),
    count: z.number().int().nonnegative(),
    lastApprovalId: z.string().nullable(),
    lastByName: z.string().nullable(),
    lastAt: z.date().nullable(),
    standingApprovalId: z.string().nullable(),
  }),
);

type FactRow = z.infer<typeof FACT_ROWS>[number];

function factsOf(row: FactRow): DownloadMarkerFacts {
  return {
    count: row.count,
    last: row.lastByName === null || row.lastAt === null ? null : { approvalId: row.lastApprovalId, byName: row.lastByName, at: row.lastAt },
    latestApprovalId: row.standingApprovalId,
  };
}

export function createDownloadRepository(db: PrismaClient): DownloadRepository {
  /**
   * One statement for any number of estimates, chosen by their IDs or by their tasks' IDs (the other list is empty): a LATERAL subquery per row reads the approval that stands (`idx_approvals_estimate_id`) and the
   * count with the latest download (`idx_estimate_downloads_estimate_id`), so no row costs more than two index reads.
   */
  const factsOfRows = async (client: ReturnType<typeof clientFor>, estimateIds: ReadonlyArray<string>, taskIds: ReadonlyArray<string>) =>
    FACT_ROWS.parse(
      await client.$queryRaw`
        SELECT t.id::text AS "taskId", COALESCE(d."count", 0)::int AS "count", d."approvalId" AS "lastApprovalId", d."byName" AS "lastByName", d."at" AS "lastAt", a."id"::text AS "standingApprovalId"
        FROM estimates e
        JOIN tasks t ON t.id = e.task_id
        LEFT JOIN LATERAL (
          SELECT s."id" FROM (
            SELECT ap."id", ap."removed_at", ap."cancelled_at" FROM approvals ap WHERE ap."estimate_id" = e.id ORDER BY ap."approved_at" DESC, ap."id" DESC LIMIT 1
          ) s WHERE s."removed_at" IS NULL AND s."cancelled_at" IS NULL
        ) a ON true
        LEFT JOIN LATERAL (
          SELECT (SELECT count(*) FROM estimate_downloads c WHERE c."estimate_id" = e.id) AS "count", l."approval_id"::text AS "approvalId", u."name" AS "byName", l."downloaded_at" AS "at"
          FROM estimate_downloads l JOIN users u ON u.id = l."downloaded_by"
          WHERE l."estimate_id" = e.id ORDER BY l."downloaded_at" DESC, l."id" DESC LIMIT 1
        ) d ON true
        WHERE e.id = ANY(${[...estimateIds]}::uuid[]) OR t.id = ANY(${[...taskIds]}::uuid[])`,
    );

  return {
    insertDownload: (download, tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).estimateDownload.create({
          data: { estimateId: download.estimateId, calculationId: download.calculationId, approvalId: download.approvalId, downloadedById: download.downloadedById },
          select: { id: true },
        });
      }),

    findMarkerFacts: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        // PostgreSQL refuses a text that is not a UUID with an error; an estimate asked for by one is not found.
        if (!isUuid(estimateId)) return null;
        const row = (await factsOfRows(clientFor(db, tx), [estimateId], []))[0];
        return row === undefined ? null : factsOf(row);
      }),

    findMarkerFactsOfTasks: (taskIds) =>
      withDatabaseErrors(async () => {
        const ids = [...new Set(taskIds.filter(isUuid))].slice(0, QUEUE_MAX_LIMIT);
        if (ids.length === 0) return [];
        return (await factsOfRows(db, [], ids)).map((row) => ({ taskId: row.taskId, facts: factsOf(row) }));
      }),
  };
}
