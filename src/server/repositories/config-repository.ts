import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';

/**
 * Storage of the configuration versions (ADR-004, architecture section 5.1). A row is immutable: there
 * is no update or delete here, the database refuses them (STORY-03.01 AC-6), and the runtime role has
 * no grant for them.
 *
 * The repository stores and returns the snapshot as JSON and knows nothing of its shape. Validation is
 * the service's job (`config-service.ts`), so a document is checked before it is stored and after it is
 * read.
 */

/** Version numbers start at 1; the seed is version 1. */
export const SEED_VERSION_NUMBER = 1;

export interface ConfigVersionRecord {
  readonly id: string;
  readonly number: number;
  /** The stored document, unvalidated. */
  readonly snapshot: unknown;
  /** The user who made the change; null for the seed. */
  readonly createdBy: string | null;
  readonly reason: string;
  readonly createdAt: Date;
}

export interface ConfigRepository {
  /**
   * Inserts the seed as version 1 only if the table holds no version at all, in one statement. Returns
   * true if it inserted, false if a version already existed. Two runs at once cannot both insert: the
   * unique number settles it.
   */
  insertSeedVersionIfNone(input: { readonly snapshot: unknown; readonly reason: string }): Promise<boolean>;
  /** The version with the highest number, or null if there is none. */
  findLatest(): Promise<ConfigVersionRecord | null>;
}

export function createConfigRepository(db: PrismaClient): ConfigRepository {
  return {
    insertSeedVersionIfNone({ snapshot, reason }) {
      return withDatabaseErrors(async () => {
        // Parameterised; the casts give each parameter a type, which `INSERT ... SELECT` cannot infer.
        const inserted = await db.$executeRaw`
          INSERT INTO config_versions (number, snapshot, created_by, reason)
          SELECT ${SEED_VERSION_NUMBER}::integer, ${JSON.stringify(snapshot)}::jsonb, NULL, ${reason}::text
          WHERE NOT EXISTS (SELECT 1 FROM config_versions)
          ON CONFLICT (number) DO NOTHING`;
        return inserted === 1;
      });
    },

    findLatest() {
      return withDatabaseErrors(() =>
        db.configVersion.findFirst({
          orderBy: { number: 'desc' },
          select: { id: true, number: true, snapshot: true, createdBy: true, reason: true, createdAt: true },
        }),
      );
    },
  };
}
