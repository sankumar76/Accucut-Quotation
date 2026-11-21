import type { CheckpointRecord, ConfigCheckpointRepository } from '../../src/server/repositories/config-checkpoint-repository';
import type { ConfigRepository } from '../../src/server/repositories/config-repository';

import { canonicalCheckpointName } from '../../src/lib/config/checkpoint';

/**
 * An in-memory `ConfigCheckpointRepository` for the tests that run the real service or the real routes without a database (STORY-08.06). It behaves as the table does: a checkpoint names the version that is the latest when
 * it is saved, a name is unique ignoring letter case, rows are only added, and the list is newest first. Every member is a plain function, so a security test can spy on each one. Every name is invented.
 */

export interface FakeCheckpointRepository extends ConfigCheckpointRepository {
  /** The rows as stored, oldest first. */
  readonly rows: CheckpointRecord[];
}

const SAVED_AT = new Date('2026-11-06T10:00:00.000Z');

/** `configurations` is the repository of the same fake world: the latest version it holds is the one a new checkpoint names. */
export function createFakeCheckpointRepository(configurations: Pick<ConfigRepository, 'findLatestRef'>, seed: ReadonlyArray<CheckpointRecord> = []): FakeCheckpointRepository {
  const rows: CheckpointRecord[] = [...seed];
  return {
    rows,
    async insertCheckpoint({ name, createdBy }) {
      const latest = await configurations.findLatestRef();
      if (latest === null) return null;
      if (rows.some((row) => canonicalCheckpointName(row.name).toLowerCase() === name.toLowerCase())) return null;
      const row: CheckpointRecord = {
        id: `00000000-0000-4000-8000-0ddd${String(rows.length + 1).padStart(8, '0')}`,
        name,
        versionId: latest.id,
        versionNumber: latest.number,
        createdAt: new Date(SAVED_AT.getTime() + rows.length * 60_000),
        createdByName: createdBy === '' ? null : 'Invented Admin',
      };
      rows.push(row);
      return row;
    },
    listCheckpoints: () => Promise.resolve([...rows].reverse()),
    findNameOfVersion: (versionId) => Promise.resolve([...rows].reverse().find((row) => row.versionId === versionId)?.name ?? null),
  };
}
