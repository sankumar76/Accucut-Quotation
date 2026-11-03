import { AppError } from '../../lib/errors';
import { parseConfigDocument, type ConfigDocument } from '../../lib/fields/schema';
import type { ConfigRepository } from '../repositories/config-repository';

/**
 * Use cases for the field registry versions (architecture sections 4.1 and 5.6; ADR-004). Release 1
 * seeds version 1 and reads the latest version; editing (a new version per change) is Release 2.
 */

/** No configuration version exists: the seed step has not run. */
export class ConfigVersionMissingError extends AppError {
  constructor() {
    super('CONFIG_VERSION_MISSING', 500, 'No configuration version exists. Run the ensure-seed-version step.');
  }
}

export interface ConfigVersion {
  readonly id: string;
  readonly number: number;
  readonly document: ConfigDocument;
  readonly reason: string;
  readonly createdBy: string | null;
  readonly createdAt: Date;
}

export interface SeedVersionInput {
  /** The seed document. Validated here, so an invalid one is refused and nothing is stored. */
  readonly document: unknown;
  readonly reason: string;
}

export interface SeedVersionResult {
  /** True if version 1 was inserted by this call; false if a version already existed and nothing changed. */
  readonly created: boolean;
}

/**
 * Stores the seed configuration as version 1, **only if no version exists** (architecture section 5.6).
 * A later change to the seed module therefore never touches a live install. Safe to run twice: the
 * second run changes nothing. Throws `ConfigDocumentError` before any write if the document is invalid.
 *
 * Run it with the owner role, right after `prisma migrate deploy` (`scripts/ensure-seed-version.ts`).
 */
export async function ensureSeedVersion(repository: ConfigRepository, input: SeedVersionInput): Promise<SeedVersionResult> {
  const document = parseConfigDocument(input.document);
  const created = await repository.insertSeedVersionIfNone({ snapshot: document, reason: input.reason });
  return { created };
}

/**
 * The latest configuration version, with its document validated. A stored document that no longer
 * passes the schema throws rather than being used.
 */
export async function getCurrentVersion(repository: ConfigRepository): Promise<ConfigVersion> {
  const record = await repository.findLatest();
  if (record === null) throw new ConfigVersionMissingError();
  return {
    id: record.id,
    number: record.number,
    document: parseConfigDocument(record.snapshot),
    reason: record.reason,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
  };
}
