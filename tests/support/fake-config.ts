import type { ConfigDocument } from '../../src/lib/fields/schema';
import type { ConfigRepository, ConfigVersionRecord, ConfigVersionUse } from '../../src/server/repositories/config-repository';

import { seedConfig } from './seed-config';

/**
 * An in-memory `ConfigRepository` for the tests that run the real routes and pages without a database (`session-harness.ts`, STORY-08.01): one stored version, which holds
 * the seed registry unless a test gives another, and a version line that says who saved it and how many estimates use it. Every member is a plain function, so a security
 * test can spy on each one and prove that a refused role made no lookup. Every name is invented.
 */

export const FAKE_CONFIG_VERSION_ID = '00000000-0000-4000-8000-0ccc0000f001';
export const FAKE_CONFIG_SAVED_AT = new Date('2026-11-05T09:00:00.000Z');
export const FAKE_CONFIG_USE: ConfigVersionUse = { savedByName: 'Invented Admin', estimatesInUse: 2 };

export function createFakeConfigRepository(document: ConfigDocument = seedConfig, use: ConfigVersionUse = FAKE_CONFIG_USE): ConfigRepository {
  const record: ConfigVersionRecord = {
    id: FAKE_CONFIG_VERSION_ID,
    number: 1,
    snapshot: document,
    createdBy: null,
    reason: 'Invented seed reason',
    createdAt: FAKE_CONFIG_SAVED_AT,
  };
  // The versions a test saved after the first, as the table keeps them: appended, never changed.
  const versions: ConfigVersionRecord[] = [record];
  const latest = (): ConfigVersionRecord => versions.reduce((best, each) => (each.number > best.number ? each : best));
  return {
    insertSeedVersionIfNone: () => Promise.resolve(false),
    // As the real statement does (STORY-08.02): the next number is stored only if the base is still the highest.
    insertVersionAfter(version) {
      if (latest().number !== version.baseNumber) return Promise.resolve(null);
      const stored: ConfigVersionRecord = {
        id: `${FAKE_CONFIG_VERSION_ID.slice(0, -2)}${String(version.baseNumber + 1).padStart(2, '0')}`,
        number: version.baseNumber + 1,
        snapshot: version.snapshot,
        createdBy: version.createdBy,
        reason: version.reason,
        createdAt: FAKE_CONFIG_SAVED_AT,
      };
      versions.push(stored);
      return Promise.resolve({ id: stored.id, number: stored.number });
    },
    findLatestRef: () => Promise.resolve({ id: latest().id, number: latest().number }),
    findById: (id) => Promise.resolve(versions.find((each) => each.id === id) ?? null),
    readVersionUse: () => Promise.resolve(use),
  };
}
