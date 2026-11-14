import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigReadService } from '@/server/services/config-read-service';
import { createConfigVersionCache } from '@/server/services/config-service';

import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-08.01 AC-1 and AC-6 against real PostgreSQL in a throwaway database, as the runtime role: the list is read from the stored version, and the version line says who made the
 * version and how many estimates use it. An estimate uses a version through its current stored calculation, so one that was never calculated counts for none, and one calculated with
 * version 1 still counts for version 1 after version 2 exists. Every name is invented.
 */

let db: CalculationDatabase;

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

const calculate = async (estimateId: string): Promise<void> => {
  await db.service.storeCalculation({ estimateId, createdById: db.personId, inputsRevision: 3, nodes: [db.node()] });
};

describe('AC-6: the version line, read as the runtime role', () => {
  it('says nobody saved the seed version, and counts no estimate while none was calculated', async () => {
    const repository = createConfigRepository(db.prisma);
    await db.addEstimate();
    expect(await repository.readVersionUse(db.configVersionId)).toEqual({ savedByName: null, estimatesInUse: 0 });
  });

  it('counts the estimates whose current calculation was made with the version, and no other', async () => {
    const repository = createConfigRepository(db.prisma);
    const before = (await repository.readVersionUse(db.configVersionId)).estimatesInUse;
    await calculate(await db.addEstimate());
    await calculate(await db.addEstimate());
    await db.addEstimate();
    expect((await repository.readVersionUse(db.configVersionId)).estimatesInUse).toBe(before + 2);
  });

  it('names the person who made a later version, and counts none for it while no estimate was calculated with it', async () => {
    const repository = createConfigRepository(db.prisma);
    const later = await db.owner.query<{ id: string }>(
      `INSERT INTO config_versions (number, snapshot, reason, created_by) VALUES (2, $1::jsonb, 'Invented change', $2::uuid) RETURNING id::text`,
      [JSON.stringify(seedConfig), db.personId],
    );
    expect(await repository.readVersionUse(defined(later.rows[0]).id)).toEqual({ savedByName: 'Calculation Lead', estimatesInUse: 0 });
    // The estimates calculated with version 1 are still version 1's.
    expect((await repository.readVersionUse(db.configVersionId)).estimatesInUse).toBeGreaterThanOrEqual(2);
  });

  it('is 0 and nobody for an ID no version has', async () => {
    const repository = createConfigRepository(db.prisma);
    expect(await repository.readVersionUse('00000000-0000-4000-8000-00000000dead')).toEqual({ savedByName: null, estimatesInUse: 0 });
  });
});

describe('AC-1 and AC-6: the service over the stored version and the real Process Master', () => {
  it('lists every field in column order with its formula in display form, from the database', async () => {
    const service = createConfigReadService({ configurations: createConfigRepository(db.prisma), masters: db.masterRepository, cache: createConfigVersionCache() });
    const { fields } = await service.getFields();
    expect(fields).toHaveLength(seedConfig.fields.length);
    expect(defined(fields.find((field) => field.letter === 'AL')).formula).toBe('P * Cutting-Rate-per-Sec');
    expect(defined(fields.find((field) => field.letter === 'BL')).formula).toBe('SUM(BG)');
  });

  it('answers with the latest version: its number, its time and who made it', async () => {
    const service = createConfigReadService({ configurations: createConfigRepository(db.prisma), masters: db.masterRepository, cache: createConfigVersionCache() });
    const current = await service.getCurrent();
    expect(current).toMatchObject({ number: 2, savedBy: 'Calculation Lead', estimatesInUse: 0 });
    expect(new Date(current.savedAt).toISOString()).toBe(current.savedAt);
  });
});
