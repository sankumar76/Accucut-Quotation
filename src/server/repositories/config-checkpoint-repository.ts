import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the configuration checkpoints (STORY-08.06 AC-1 to AC-3; SPEC section 8.3, FR-078; architecture section 5.1 `config_checkpoints`). A checkpoint is a name for one configuration version. A row is
 * immutable, like a version: there is no update or delete here, the database refuses them (a trigger for every role, no grant for the runtime role), so a checkpoint is never renamed or removed.
 *
 * It lives beside `config-repository.ts`, not in it, because that file holds the one writer of `config_versions` and its guard test (`version-writer-architecture.test.ts`) reads it as exactly that. This file
 * writes a different table and never writes `config_versions`.
 *
 * No method reads a snapshot: a checkpoint's list and its answers hold a name, a number, a time and a person's name, never a formula (NFR-002).
 */

/** One checkpoint as the screen lists it. */
export interface CheckpointRecord {
  readonly id: string;
  readonly name: string;
  /** The version the checkpoint names. A revert is by this ID (architecture section 16.4 item 8). */
  readonly versionId: string;
  readonly versionNumber: number;
  readonly createdAt: Date;
  /** The name of the person who saved it; `null` for the seed checkpoint, which no person saved. */
  readonly createdByName: string | null;
}

export interface NewCheckpoint {
  /** The name to store: already trimmed and checked by `lib/config/checkpoint.ts`. */
  readonly name: string;
  readonly createdBy: string;
}

const INSERTED_ROW = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  versionId: z.uuid(),
  versionNumber: z.number().int(),
  createdAt: z.coerce.date(),
  createdByName: z.string().nullable(),
});

export interface ConfigCheckpointRepository {
  /**
   * Names the **latest** configuration version, in one statement: the version that is latest when the statement runs is the one named, so a save cannot name a version that was already replaced. Returns the new
   * row, or `null` when the name is taken by another checkpoint in any letter case (the unique index on `lower(name)` settles it, so two requests that race for one name cannot both be stored).
   */
  insertCheckpoint(checkpoint: NewCheckpoint): Promise<CheckpointRecord | null>;
  /** Every checkpoint, newest first, with no snapshot. */
  listCheckpoints(): Promise<ReadonlyArray<CheckpointRecord>>;
  /** The name of the newest checkpoint that names this version, or `null` when it has none (an undo has no checkpoint). Pass `tx` to read inside the caller's transaction. */
  findNameOfVersion(versionId: string, tx?: Transaction): Promise<string | null>;
}

/** Builds the repository over a Prisma client (the runtime role's). Every method turns a pool or statement timeout into `DatabaseBusyError` (architecture ruling R4). */
export function createConfigCheckpointRepository(db: PrismaClient): ConfigCheckpointRepository {
  return {
    insertCheckpoint({ name, createdBy }) {
      return withDatabaseErrors(async () => {
        // Parameterised; the casts give each parameter a type, which `INSERT ... SELECT` cannot infer. `ON CONFLICT DO NOTHING` covers the unique name in any letter case.
        const rows = await db.$queryRaw`
          WITH latest AS (SELECT id, number FROM config_versions ORDER BY number DESC LIMIT 1),
          inserted AS (
            INSERT INTO config_checkpoints (name, config_version_id, created_by)
            SELECT ${name}::text, latest.id, ${createdBy}::uuid FROM latest
            ON CONFLICT DO NOTHING
            RETURNING id, name, config_version_id, created_by, created_at
          )
          SELECT inserted.id::text AS "id", inserted.name AS "name", inserted.config_version_id::text AS "versionId", latest.number AS "versionNumber",
                 inserted.created_at AS "createdAt", people.name AS "createdByName"
          FROM inserted
          CROSS JOIN latest
          LEFT JOIN users people ON people.id = inserted.created_by`;
        const row = z.array(INSERTED_ROW).parse(rows)[0];
        return row ?? null;
      });
    },

    listCheckpoints() {
      return withDatabaseErrors(async () => {
        const rows = await db.configCheckpoint.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, name: true, configVersionId: true, createdAt: true, version: { select: { number: true } }, creator: { select: { name: true } } },
        });
        return rows.map((row) => ({ id: row.id, name: row.name, versionId: row.configVersionId, versionNumber: row.version.number, createdAt: row.createdAt, createdByName: row.creator?.name ?? null }));
      });
    },

    findNameOfVersion(versionId, tx) {
      return withDatabaseErrors(async () => {
        const row = await clientFor(db, tx).configCheckpoint.findFirst({ where: { configVersionId: versionId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { name: true } });
        return row?.name ?? null;
      });
    },
  };
}
