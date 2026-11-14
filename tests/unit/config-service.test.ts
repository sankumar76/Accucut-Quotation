import { describe, expect, it } from 'vitest';

import { parseConfigDocument, ConfigDocumentError } from '@/lib/fields/schema';
import type { ConfigRepository, ConfigVersionRecord, ConfigVersionRef } from '@/server/repositories/config-repository';
import {
  ConfigVersionMissingError,
  createConfigVersionCache,
  ensureSeedVersion,
  getCurrentVersion,
  MAX_CACHED_VERSIONS,
} from '@/server/services/config-service';

import { defined } from '../support/defined';
import { cloneSeedConfig, seedConfig } from '../support/seed-config';

/**
 * Architecture ruling R5 (PRF-02): the parsed document is cached in process by version id. A version is
 * immutable, so the cache never needs invalidating; every call still asks which version is latest, so a new
 * version is seen at once. A fake repository counts what is read.
 */

function recordFor(number: number, snapshot: unknown = seedConfig): ConfigVersionRecord {
  return {
    id: `00000000-0000-4000-8000-0ccc${String(number).padStart(8, '0')}`,
    number,
    snapshot,
    createdBy: null,
    reason: `Version ${number}`,
    createdAt: new Date('2026-11-03T00:00:00Z'),
  };
}

interface FakeRepository extends ConfigRepository {
  readonly versions: ConfigVersionRecord[];
  readonly calls: { latestRef: number; byId: string[]; inserts: number };
}

function fakeRepository(initial: ReadonlyArray<ConfigVersionRecord>): FakeRepository {
  const versions = [...initial];
  const calls = { latestRef: 0, byId: [] as string[], inserts: 0 };
  return {
    versions,
    calls,
    async insertSeedVersionIfNone() {
      calls.inserts += 1;
      return versions.length === 0;
    },
    async findLatestRef(): Promise<ConfigVersionRef | null> {
      calls.latestRef += 1;
      const latest = versions.reduce<ConfigVersionRecord | undefined>((best, row) => (best === undefined || row.number > best.number ? row : best), undefined);
      return latest === undefined ? null : { id: latest.id, number: latest.number };
    },
    async findById(id) {
      calls.byId.push(id);
      return versions.find((row) => row.id === id) ?? null;
    },
    // The version line of SCR-17 is read by `config-read-service.ts`, whose own test fakes it; this file tests the cache only.
    readVersionUse: () => Promise.resolve({ savedByName: null, estimatesInUse: 0 }),
  };
}

describe('getCurrentVersion cache (R5, PRF-02)', () => {
  it('two calls with an unchanged latest id read the snapshot and parse it once', async () => {
    const repository = fakeRepository([recordFor(1)]);
    const cache = createConfigVersionCache();
    const first = await getCurrentVersion(repository, cache);
    const second = await getCurrentVersion(repository, cache);
    expect(second).toBe(first);
    expect(second.document).toBe(first.document);
    expect(repository.calls.byId).toHaveLength(1);
  });

  it('every call still asks which version is latest, and only that', async () => {
    const repository = fakeRepository([recordFor(1)]);
    const cache = createConfigVersionCache();
    await getCurrentVersion(repository, cache);
    await getCurrentVersion(repository, cache);
    await getCurrentVersion(repository, cache);
    expect(repository.calls.latestRef).toBe(3);
    expect(repository.calls.byId).toHaveLength(1);
  });

  it('a version inserted later is seen at once, with no invalidation', async () => {
    const repository = fakeRepository([recordFor(1)]);
    const cache = createConfigVersionCache();
    expect((await getCurrentVersion(repository, cache)).number).toBe(1);
    const changed = cloneSeedConfig();
    changed.fields[1] = { ...defined(changed.fields[1]), label: 'Renamed' };
    repository.versions.push(recordFor(2, changed));
    const current = await getCurrentVersion(repository, cache);
    expect(current.number).toBe(2);
    expect(current.document.fields[1]?.label).toBe('Renamed');
    expect(repository.calls.byId).toHaveLength(2);
    // And version 1 stays cached for anything that still needs it.
    expect(cache.get(recordFor(1).id)?.number).toBe(1);
  });

  it('the cached document is deep-frozen, because callers share it', async () => {
    const repository = fakeRepository([recordFor(1)]);
    const { document } = await getCurrentVersion(repository, createConfigVersionCache());
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(document.fields)).toBe(true);
    expect(Object.isFrozen(document.fields[0])).toBe(true);
    expect(() => {
      defined(document.fields[0]).label = 'changed';
    }).toThrow(TypeError);
  });

  it('keeps at most 16 versions and drops the oldest first', async () => {
    expect(MAX_CACHED_VERSIONS).toBe(16);
    const rows = Array.from({ length: MAX_CACHED_VERSIONS + 1 }, (_, index) => recordFor(index + 1));
    const repository = fakeRepository([]);
    const cache = createConfigVersionCache();
    for (const row of rows) {
      repository.versions.push(row);
      await getCurrentVersion(repository, cache);
    }
    expect(cache.size()).toBe(MAX_CACHED_VERSIONS);
    expect(cache.get(defined(rows[0]).id)).toBeUndefined();
    expect(cache.get(defined(rows[1]).id)).toBeDefined();
    expect(cache.get(defined(rows[MAX_CACHED_VERSIONS]).id)).toBeDefined();
  });

  it('a stored document that fails the schema is never cached', async () => {
    const repository = fakeRepository([recordFor(1, { sections: [], stages: [], fields: [] })]);
    const cache = createConfigVersionCache();
    await expect(getCurrentVersion(repository, cache)).rejects.toBeInstanceOf(ConfigDocumentError);
    await expect(getCurrentVersion(repository, cache)).rejects.toBeInstanceOf(ConfigDocumentError);
    expect(cache.size()).toBe(0);
    expect(repository.calls.byId).toHaveLength(2);
  });

  it('says so when no version exists, and when the version vanished between the two reads', async () => {
    await expect(getCurrentVersion(fakeRepository([]), createConfigVersionCache())).rejects.toBeInstanceOf(ConfigVersionMissingError);
    const repository = fakeRepository([recordFor(1)]);
    repository.findById = async () => null;
    await expect(getCurrentVersion(repository, createConfigVersionCache())).rejects.toBeInstanceOf(ConfigVersionMissingError);
  });

  it('STD-16: the time is held as text, so no caller can change it for the others', async () => {
    const repository = fakeRepository([recordFor(1)]);
    const cache = createConfigVersionCache();
    const first = await getCurrentVersion(repository, cache);
    expect(typeof first.createdAt).toBe('string');
    // Reflect.set reports a refused write by returning false, where an assignment would throw.
    expect(Reflect.set(first, 'createdAt', 'changed')).toBe(false);
    expect(first.createdAt).toBe('2026-11-03T00:00:00.000Z');
    expect((await getCurrentVersion(repository, cache)).createdAt).toBe('2026-11-03T00:00:00.000Z');
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('returns the version with its reason, author and time', async () => {
    const version = await getCurrentVersion(fakeRepository([recordFor(1)]), createConfigVersionCache());
    expect(version).toMatchObject({ number: 1, reason: 'Version 1', createdBy: null });
    expect(version.createdAt).toBe('2026-11-03T00:00:00.000Z');
    expect(version.document).toEqual(parseConfigDocument(seedConfig));
  });
});

describe('ensureSeedVersion', () => {
  it('validates before it writes: an invalid document never reaches the repository', async () => {
    const repository = fakeRepository([]);
    await expect(ensureSeedVersion(repository, { document: { nonsense: true }, reason: 'x' })).rejects.toBeInstanceOf(ConfigDocumentError);
    expect(repository.calls.inserts).toBe(0);
  });

  it('reports whether it created version 1', async () => {
    expect(await ensureSeedVersion(fakeRepository([]), { document: seedConfig, reason: 'x' })).toEqual({ created: true });
    expect(await ensureSeedVersion(fakeRepository([recordFor(1)]), { document: seedConfig, reason: 'x' })).toEqual({ created: false });
  });
});
