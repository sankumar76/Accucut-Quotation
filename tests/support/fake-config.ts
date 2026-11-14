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
  return {
    insertSeedVersionIfNone: () => Promise.resolve(false),
    findLatestRef: () => Promise.resolve({ id: record.id, number: record.number }),
    findById: (id) => Promise.resolve(id === record.id ? record : null),
    readVersionUse: () => Promise.resolve(use),
  };
}
