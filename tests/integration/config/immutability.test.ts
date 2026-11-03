import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConfigDocumentError, parseConfigDocument } from '../../../src/lib/fields/schema';
import { createConfigRepository, type ConfigRepository } from '../../../src/server/repositories/config-repository';
import { createPrismaClient, type PrismaClient } from '../../../src/server/repositories/prisma-client';
import {
  ConfigVersionMissingError,
  ensureSeedVersion,
  getCurrentVersion,
} from '../../../src/server/services/config-service';
import { createMigratedScratchDatabase, type ScratchDatabase } from '../../support/scratch-database';
import { cloneSeedConfig, SEED_VERSION_REASON, seedConfig } from '../../support/seed-config';
import { defined } from '../../support/defined';

/**
 * AC-6 (NFR-026, negative): `config_versions` cannot be changed or removed, by the runtime role (no grant)
 * or the owner (trigger); version 1 is created once by `ensureSeedVersion`; an invalid document is refused
 * and nothing is stored. Runs against real PostgreSQL, in a throwaway database per block (see
 * `tests/support/scratch-database.ts`), because an immutable table cannot be cleaned up afterwards.
 */

const INSERT_VERSION = `INSERT INTO config_versions (number, snapshot, reason) VALUES ($1, $2::jsonb, $3)`;

interface Session {
  readonly database: ScratchDatabase;
  readonly owner: Client;
  readonly runtime: Client;
  readonly ownerPrisma: PrismaClient;
  readonly runtimePrisma: PrismaClient;
  readonly ownerRepository: ConfigRepository;
  readonly runtimeRepository: ConfigRepository;
}

async function openSession(): Promise<Session> {
  const database = await createMigratedScratchDatabase();
  const owner = new Client({ connectionString: database.ownerUrl });
  const runtime = new Client({ connectionString: database.runtimeUrl });
  await Promise.all([owner.connect(), runtime.connect()]);
  const ownerPrisma = createPrismaClient('script', database.ownerUrl);
  const runtimePrisma = createPrismaClient('app', database.runtimeUrl);
  return {
    database,
    owner,
    runtime,
    ownerPrisma,
    runtimePrisma,
    ownerRepository: createConfigRepository(ownerPrisma),
    runtimeRepository: createConfigRepository(runtimePrisma),
  };
}

async function closeSession(session: Session | undefined): Promise<void> {
  if (session === undefined) return;
  await Promise.all([session.ownerPrisma.$disconnect(), session.runtimePrisma.$disconnect()]);
  await Promise.all([session.owner.end(), session.runtime.end()]);
  await session.database.drop();
}

async function versionCount(client: Client): Promise<number> {
  const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM config_versions');
  return Number(rows[0]?.count);
}

describe('version 1: ensureSeedVersion (AC-6)', { timeout: 60_000 }, () => {
  let session: Session;

  beforeAll(async () => {
    session = await openSession();
  });
  afterAll(() => closeSession(session));

  it('AC-6: before the step has run there is no version and getCurrentVersion says so', async () => {
    expect(await versionCount(session.owner)).toBe(0);
    await expect(getCurrentVersion(session.ownerRepository)).rejects.toBeInstanceOf(ConfigVersionMissingError);
  });

  it('AC-6: the step creates version 1 from the seed module, with no author', async () => {
    const result = await ensureSeedVersion(session.ownerRepository, { document: seedConfig, reason: SEED_VERSION_REASON });
    expect(result).toEqual({ created: true });

    const { rows } = await session.owner.query('SELECT number, snapshot, created_by, reason, created_at FROM config_versions');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ number: 1, created_by: null, reason: SEED_VERSION_REASON });
    expect(rows[0].created_at).toBeInstanceOf(Date);
    expect(parseConfigDocument(rows[0].snapshot)).toEqual(seedConfig);
  });

  it('AC-6: running it twice leaves exactly one version 1', async () => {
    const again = await ensureSeedVersion(session.ownerRepository, { document: seedConfig, reason: SEED_VERSION_REASON });
    expect(again).toEqual({ created: false });
    const { rows } = await session.owner.query('SELECT number FROM config_versions WHERE number = 1');
    expect(rows).toHaveLength(1);
    expect(await versionCount(session.owner)).toBe(1);
  });

  it('AC-6: a changed seed module never touches a database that already has a version', async () => {
    const changed = cloneSeedConfig();
    defined(changed.fields[1]).label = 'Renamed in a later release';
    const result = await ensureSeedVersion(session.ownerRepository, { document: changed, reason: 'A later seed' });
    expect(result).toEqual({ created: false });

    const current = await getCurrentVersion(session.runtimeRepository);
    expect(current.number).toBe(1);
    expect(current.reason).toBe(SEED_VERSION_REASON);
    expect(current.document).toEqual(seedConfig);
    expect(current.createdBy).toBeNull();
  });

  it('AC-6: two steps started at once create one version between them', async () => {
    // A second empty database, so both really start from nothing.
    const other = await openSession();
    try {
      const results = await Promise.all([
        ensureSeedVersion(other.ownerRepository, { document: seedConfig, reason: SEED_VERSION_REASON }),
        ensureSeedVersion(createConfigRepository(other.runtimePrisma), { document: seedConfig, reason: SEED_VERSION_REASON }),
      ]);
      expect(results.filter((result) => result.created)).toHaveLength(1);
      expect(await versionCount(other.owner)).toBe(1);
    } finally {
      await closeSession(other);
    }
  });
});

describe('an invalid document is refused and nothing is stored (AC-6)', { timeout: 60_000 }, () => {
  let session: Session;

  beforeAll(async () => {
    session = await openSession();
  });
  afterAll(() => closeSession(session));

  it.each([
    [
      'an unknown kind',
      (document: ReturnType<typeof cloneSeedConfig>) => {
        Object.assign(defined(document.fields[1]), { kind: 'formula' });
      },
    ],
    [
      'a duplicate key',
      (document: ReturnType<typeof cloneSeedConfig>) => {
        defined(document.fields[2]).key = defined(document.fields[1]).key;
      },
    ],
    [
      'engineerVisible on an output',
      (document: ReturnType<typeof cloneSeedConfig>) => {
        const output = defined(document.fields.find((field) => field.kind === 'output'));
        output.engineerVisible = true;
      },
    ],
    [
      'a letter property',
      (document: ReturnType<typeof cloneSeedConfig>) => {
        Object.assign(defined(document.fields[0]), { letter: 'A' });
      },
    ],
  ])('AC-6: refuses %s', async (_name, plant) => {
    const document = cloneSeedConfig();
    plant(document);
    await expect(
      ensureSeedVersion(session.ownerRepository, { document, reason: SEED_VERSION_REASON }),
    ).rejects.toBeInstanceOf(ConfigDocumentError);
    expect(await versionCount(session.owner)).toBe(0);
  });

  it('AC-6: a document that is not an object is refused and nothing is stored', async () => {
    await expect(ensureSeedVersion(session.ownerRepository, { document: 'seed', reason: 'x' })).rejects.toBeInstanceOf(ConfigDocumentError);
    expect(await versionCount(session.owner)).toBe(0);
  });

  it('a stored document that no longer passes the schema is never used', async () => {
    await session.owner.query(INSERT_VERSION, [1, JSON.stringify({ sections: [], stages: [], fields: [] }), 'Corrupt']);
    await expect(getCurrentVersion(session.runtimeRepository)).rejects.toBeInstanceOf(ConfigDocumentError);
  });
});

describe('config_versions cannot be changed or removed (AC-6, NFR-026)', { timeout: 60_000 }, () => {
  let session: Session;

  beforeAll(async () => {
    session = await openSession();
    await ensureSeedVersion(session.ownerRepository, { document: seedConfig, reason: SEED_VERSION_REASON });
  });
  afterAll(() => closeSession(session));

  async function expectUnchanged(): Promise<void> {
    const { rows } = await session.owner.query('SELECT number, reason FROM config_versions');
    expect(rows).toEqual([{ number: 1, reason: SEED_VERSION_REASON }]);
    expect(parseConfigDocument((await session.owner.query('SELECT snapshot FROM config_versions')).rows[0].snapshot)).toEqual(seedConfig);
  }

  it('AC-6: the runtime role holds SELECT and INSERT and no UPDATE, DELETE or TRUNCATE grant', async () => {
    const { rows } = await session.owner.query(
      `SELECT privilege, has_table_privilege('accucut_app', 'config_versions', privilege) AS granted
       FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) AS privilege`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.privilege, row.granted]))).toEqual({
      SELECT: true,
      INSERT: true,
      UPDATE: false,
      DELETE: false,
      TRUNCATE: false,
    });
  });

  it.each([
    ['UPDATE', `UPDATE config_versions SET reason = 'changed'`],
    ['DELETE', 'DELETE FROM config_versions'],
    ['TRUNCATE', 'TRUNCATE config_versions'],
  ])('AC-6: a direct %s as the runtime role is refused by the missing grant', async (_name, statement) => {
    await expect(session.runtime.query(statement)).rejects.toMatchObject({ code: '42501' });
    await expectUnchanged();
  });

  it.each([
    ['UPDATE of the reason', `UPDATE config_versions SET reason = 'changed'`],
    ['UPDATE of the snapshot', `UPDATE config_versions SET snapshot = '{}'::jsonb`],
    ['UPDATE of the number', 'UPDATE config_versions SET number = 2'],
    ['DELETE', 'DELETE FROM config_versions'],
    ['TRUNCATE', 'TRUNCATE config_versions'],
  ])('AC-6: a direct %s as the owner is refused by the trigger', async (_name, statement) => {
    await expect(session.owner.query(statement)).rejects.toMatchObject({
      code: '23000',
      message: expect.stringContaining('config_versions" is immutable'),
    });
    await expectUnchanged();
  });

  it('AC-6: the refusal does not echo the stored row', async () => {
    await expect(session.owner.query(`UPDATE config_versions SET reason = 'changed'`)).rejects.toThrow(
      /^Table "config_versions" is immutable: UPDATE is not allowed\.$/,
    );
  });

  it('AC-6: a second row with the same number is refused (the number is unique)', async () => {
    await expect(session.runtime.query(INSERT_VERSION, [1, JSON.stringify(seedConfig), 'Again'])).rejects.toMatchObject({
      code: '23505',
      constraint: 'uq_config_versions_number',
    });
    await expectUnchanged();
  });

  it('the runtime role can still add a new version, which is how a later release stores a change', async () => {
    await session.runtime.query(INSERT_VERSION, [2, JSON.stringify(seedConfig), 'A change']);
    const current = await getCurrentVersion(session.runtimeRepository);
    expect(current.number).toBe(2);
    expect(current.reason).toBe('A change');
    // Version 1 is still there, unchanged.
    const { rows } = await session.owner.query('SELECT number FROM config_versions ORDER BY number');
    expect(rows).toEqual([{ number: 1 }, { number: 2 }]);
  });
});
