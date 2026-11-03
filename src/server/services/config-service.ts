import { deepFreeze } from '../../lib/deep-freeze';
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
  /** ISO 8601 UTC text, not a `Date`: the version is shared and frozen, and a frozen `Date` can still be changed. */
  readonly createdAt: string;
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

/** Versions kept in memory. Release 1 has one; the bound only matters once edits create more (ruling R5). */
export const MAX_CACHED_VERSIONS = 16;

/** Parsed versions by ID. A version never changes, so an entry is never stale and nothing invalidates it. */
export interface ConfigVersionCache {
  get(id: string): ConfigVersion | undefined;
  set(version: ConfigVersion): void;
  size(): number;
}

/** A bounded cache that drops the oldest entry first (insertion order). One per process is enough. */
export function createConfigVersionCache(maxEntries: number = MAX_CACHED_VERSIONS): ConfigVersionCache {
  const entries = new Map<string, ConfigVersion>();
  return {
    get: (id) => entries.get(id),
    set(version) {
      entries.set(version.id, version);
      for (const oldest of entries.keys()) {
        if (entries.size <= maxEntries) break;
        entries.delete(oldest);
      }
    },
    size: () => entries.size,
  };
}

const processCache = createConfigVersionCache();

/**
 * The latest configuration version, with its document validated and deep-frozen. Safe to call per request:
 * each call reads only the latest version's ID and number, so a version written by another process is seen
 * at once, and the snapshot is read and parsed once per version per process (ruling R5, PRF-02). A stored
 * document that no longer passes the schema throws and is not cached.
 *
 * Returns the unprojected document, formulas and `engineerVisible` flags included. Never return it, or any
 * part of it, from a route an Engineer can call; build the Engineer's response from `engineerVisibleFields`
 * (ADR-008). `cache` is for tests.
 */
export async function getCurrentVersion(repository: ConfigRepository, cache: ConfigVersionCache = processCache): Promise<ConfigVersion> {
  const latest = await repository.findLatestRef();
  if (latest === null) throw new ConfigVersionMissingError();
  const cached = cache.get(latest.id);
  if (cached !== undefined) return cached;

  const record = await repository.findById(latest.id);
  if (record === null) throw new ConfigVersionMissingError();
  const version = deepFreeze({
    id: record.id,
    number: record.number,
    document: parseConfigDocument(record.snapshot),
    reason: record.reason,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  });
  cache.set(version);
  return version;
}
