import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * What the export needs to name its file (STORY-07.01 AC-2; architecture section 4.6): the task code and the subject of the estimate's task and the short name of its customer, read by the estimate's ID (CR-01 item 9, AQP-391). Nothing else of the
 * estimate or the customer is selected (no contact detail, no rate: BR-003, NFR-002). The same read serves the summary and the file, and neither takes a lock.
 */

export interface ExportHeader {
  /** The task code, `Q-2026-0001`. */
  readonly code: string;
  /** The short name of the customer chosen on the estimate, or `null` while none is. A customer deleted after it was chosen still has one. */
  readonly customerShortName: string | null;
  /** The task's subject (the project name). */
  readonly subject: string;
}

export interface ExportRepository {
  /** The header of the estimate with this ID; `null` for an unknown ID, and for one that is not a UUID. */
  findHeader(estimateId: string): Promise<ExportHeader | null>;
}

const HEADER_ROWS = z.array(z.strictObject({ code: z.string(), customerShortName: z.string().nullable(), subject: z.string() }));

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

export function createExportRepository(db: PrismaClient): ExportRepository {
  return {
    findHeader: (estimateId) =>
      withDatabaseErrors(async () => {
        // PostgreSQL refuses a text that is not a UUID with an error; an estimate asked for by one is not found.
        if (!isUuid(estimateId)) return null;
        const rows = await db.$queryRaw`
          SELECT t.code AS "code", c.short_name AS "customerShortName", t.subject AS "subject"
          FROM estimates e
          JOIN tasks t ON t.id = e.task_id
          LEFT JOIN customers c ON c.id = e.customer_id
          WHERE e.id = ${estimateId}::uuid`;
        return HEADER_ROWS.parse(rows)[0] ?? null;
      }),
  };
}
