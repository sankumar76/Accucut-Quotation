import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * What the export needs to name its file (STORY-07.01 AC-2; architecture section 4.6): the task code of the estimate and the name of its customer, read by the estimate's ID. Nothing else of the
 * estimate or the customer is selected (no contact detail, no rate: BR-003, NFR-002). The same read serves the summary and the file, and neither takes a lock.
 */

export interface ExportHeader {
  /** The task code, `Q-2026-0001`. */
  readonly code: string;
  /** The name of the customer chosen on the estimate, or `null` while none is. A customer deleted after it was chosen is still named. */
  readonly customerName: string | null;
}

export interface ExportRepository {
  /** The header of the estimate with this ID; `null` for an unknown ID, and for one that is not a UUID. */
  findHeader(estimateId: string): Promise<ExportHeader | null>;
}

const HEADER_ROWS = z.array(z.strictObject({ code: z.string(), customerName: z.string().nullable() }));

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

export function createExportRepository(db: PrismaClient): ExportRepository {
  return {
    findHeader: (estimateId) =>
      withDatabaseErrors(async () => {
        // PostgreSQL refuses a text that is not a UUID with an error; an estimate asked for by one is not found.
        if (!isUuid(estimateId)) return null;
        const rows = await db.$queryRaw`
          SELECT t.code AS "code", c.name AS "customerName"
          FROM estimates e
          JOIN tasks t ON t.id = e.task_id
          LEFT JOIN customers c ON c.id = e.customer_id
          WHERE e.id = ${estimateId}::uuid`;
        return HEADER_ROWS.parse(rows)[0] ?? null;
      }),
  };
}
