import { isDeepStrictEqual } from 'node:util';

import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FieldValidationError, NAME_TAKEN_CODE, NotFoundError } from '@/lib/errors';
import { MasterConstraintError } from '@/server/repositories/master-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';
import { createLateFailingRunner } from '../../support/late-failure-runner';
import { loadCanaryMaterials } from '../../support/material-canary-loader';
import { MATERIAL_CANARIES } from '../../support/material-master-canary';
import { withoutUuids } from '../../support/random-members';
import { refusal } from '../../support/user-service-fixture';

/**
 * STORY-02.03 T1, T2 and T5 (AC-1 to AC-5) against real PostgreSQL in a throwaway database: the rules the table itself keeps (a name unique
 * ignoring letter case, a price and a Material-Scrap-Rate of 0 or more, a specific gravity above 0 unless the row is hidden, no DELETE and no
 * TRUNCATE for the runtime role), the default filter of architecture section 4.9, and the Material Master service over the real repositories:
 * each change in one transaction with its audit entry, a refused change writing none, and two requests at once. Names and numbers are
 * invented (`n.37`, ADR-014), except inputs that test the format (zero, a sign, the 14-digit limit, a trivial `1` in a constraint probe).
 */

const LATE_FAILURE = 'a failure after the entry was written';
const ADDED = {
  materialInDrawing: 'Invented-sheet-grade-A',
  materialConsidered: 'Invented steel',
  pricePerKg: '58.37',
  specificGravity: '7.37',
  scrapRate: '22.37',
} as const;

let db: AuditDatabase;
let adminId: string;

const by = () => contextOf(adminId);

interface MaterialDbRow {
  readonly id: string;
  readonly material_in_drawing: string;
  readonly material_considered: string | null;
  readonly price_per_kg: string;
  readonly specific_gravity: string;
  readonly scrap_rate: string;
  readonly is_hidden: boolean;
}

async function rows(): Promise<MaterialDbRow[]> {
  const { rows: found } = await db.owner.query<MaterialDbRow>(
    'SELECT id::text, material_in_drawing, material_considered, price_per_kg::text, specific_gravity::text, scrap_rate::text, is_hidden FROM materials ORDER BY created_at, id',
  );
  return found;
}

async function byName(name: string): Promise<MaterialDbRow | undefined> {
  return (await rows()).find((row) => row.material_in_drawing === name);
}

const insert =
  'INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate) VALUES ($1, $2, $3, $4, $5)';

/** Empties the table after a test, whether it passed or failed, so one failure is reported once and not again by every test after it (QLT-05). */
const emptyTable = async (): Promise<void> => {
  await db.owner.query('DELETE FROM materials');
};

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

describe('AC-1 (T1): the table starts empty, and the repository lists only what the default filter allows', () => {
  afterEach(emptyTable);

  it('holds no material after the migration: no price is committed (ADR-014)', async () => {
    expect(await rows()).toEqual([]);
    expect(await db.masterRepository.listMaterials()).toEqual([]);
    expect(await db.mastersService.listMaterialOptions()).toEqual([]);
  });

  it('never lists a hidden material, or one that is deleted, and never finds one by ID (architecture section 4.9)', async () => {
    const owner = db.owner;
    const hidden = await owner.query<{ id: string }>(
      "INSERT INTO materials (material_in_drawing, material_considered, is_hidden) VALUES ('Hidden-entry-for-test', NULL, true) RETURNING id::text",
    );
    const deleted = await owner.query<{ id: string }>(
      `INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate, deleted_at)
       VALUES ('Deleted-entry-for-test', 'Invented gone', 1.37, 2.37, 3.37, now()) RETURNING id::text`,
    );
    const shown = await owner.query<{ id: string }>(`${insert} RETURNING id::text`, ['Listed-entry-for-test', 'Invented listed', '1.37', '2.37', '3.37']);
    const hiddenId = defined(hidden.rows[0]).id;
    const deletedId = defined(deleted.rows[0]).id;
    const shownId = defined(shown.rows[0]).id;

    expect((await db.masterRepository.listMaterials()).map((material) => material.id)).toEqual([shownId]);
    expect((await db.masterRepository.listMaterialOptions()).map((option) => option.id)).toEqual([shownId]);
    expect(await db.transactions.run((tx) => db.masterRepository.findMaterialForUpdate(hiddenId, tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.findMaterialForUpdate(deletedId, tx))).toBeNull();
    expect(await db.transactions.run((tx) => db.masterRepository.updateMaterial(hiddenId, { scrapRate: '9.37' }, tx))).toBeNull();
    // The service answers a hidden ID exactly as it answers an unknown one.
    const entries = await entryCount(db);
    const hiddenAnswer = await refusal(db.mastersService.updateMaterial(by(), hiddenId, { scrapRate: '9.37' }));
    const unknownAnswer = await refusal(db.mastersService.updateMaterial(by(), '00000000-0000-4000-8000-0ccc00000009', { scrapRate: '9.37' }));
    expect(hiddenAnswer).toBeInstanceOf(NotFoundError);
    expect((hiddenAnswer as Error).message).toBe((unknownAnswer as Error).message);
    expect(await entryCount(db)).toBe(entries);
    expect((await byName('Hidden-entry-for-test'))?.scrap_rate).toBe('0.0000');
  });

  it('lists the materials in the order they were added, each number with at least two decimals', async () => {
    await db.owner.query(insert, ['Order-first', 'Invented first', '1.37', '7.3712', '0']);
    await db.owner.query(insert, ['Order-second', 'Invented second', '2.37', '2.37', '12345678901234.5678']);
    const listed = await db.masterRepository.listMaterials();
    expect(listed.map((material) => material.materialInDrawing)).toEqual(['Order-first', 'Order-second']);
    expect(listed[0]).toMatchObject({ pricePerKg: '1.37', specificGravity: '7.3712', scrapRate: '0.00' });
    expect(listed[1]).toMatchObject({ pricePerKg: '2.37', specificGravity: '2.37', scrapRate: '12345678901234.5678' });
  });

  it('reads no number for the options: they are the ID, the name and Material Considered, and nothing else', async () => {
    await db.owner.query(insert, ['Options-material', 'Invented options', '917.37', '737.37', '717.37']);
    const options = await db.mastersService.listMaterialOptions();
    expect(options).toEqual([{ id: expect.any(String), name: 'Options-material', materialConsidered: 'Invented options' }]);
    // `id` is made by gen_random_uuid() and can hold "717", "737" or "917" by chance (DEF-028); the well-formed UUID is the only thing left out.
    expect(withoutUuids(JSON.stringify(options))).not.toMatch(/917|737|717/);
  });
});

describe('AC-2: the rules of the database itself, whatever the code checked', () => {
  afterEach(emptyTable);

  it('refuses a name that differs only in letter case, for the owner and for the runtime role', async () => {
    await db.owner.query(insert, ['Case-material', 'Invented', '1.37', '2.37', '3.37']);
    await expect(db.owner.query(insert, ['CASE-MATERIAL', 'Invented', '1', '1', '1'])).rejects.toThrow('uq_materials_material_in_drawing_lower');
    await expect(db.runtime.query(insert, ['case-material', 'Invented', '1', '1', '1'])).rejects.toThrow('uq_materials_material_in_drawing_lower');
    await expect(db.runtime.query(insert, ['Case-material', 'Invented', '1', '1', '1'])).rejects.toThrow(/uq_materials_material_in_drawing/);
  });

  it('refuses a negative price, a negative scrap rate and a blank name or Material Considered', async () => {
    await expect(db.runtime.query(insert, ['Invented-negative-price', 'Invented', '-1', '1', '1'])).rejects.toThrow('ck_materials_price_per_kg_not_negative');
    await expect(db.runtime.query(insert, ['Invented-negative-scrap', 'Invented', '1', '1', '-0.01'])).rejects.toThrow('ck_materials_scrap_rate_not_negative');
    await expect(db.runtime.query(insert, ['   ', 'Invented', '1', '1', '1'])).rejects.toThrow('ck_materials_material_in_drawing_not_blank');
    await expect(db.runtime.query(insert, ['Invented-blank-considered', '  ', '1', '1', '1'])).rejects.toThrow('ck_materials_material_considered_not_blank');
    await expect(
      db.runtime.query('INSERT INTO materials (material_in_drawing, price_per_kg, specific_gravity) VALUES ($1, 1, 1)', ['Invented-null-considered']),
    ).rejects.toThrow('ck_materials_material_considered_not_blank');
  });

  it('refuses a specific gravity of 0 or below for a listed material, on an add and on a change (UX-37, FR-015), and exempts the hidden row', async () => {
    await db.owner.query(insert, ['Gravity-material', 'Invented', '1.37', '2.37', '3.37']);
    await expect(db.runtime.query(insert, ['Invented-zero-gravity', 'Invented', '1', '0', '1'])).rejects.toThrow('ck_materials_specific_gravity_above_zero');
    await expect(db.runtime.query(insert, ['Invented-negative-gravity', 'Invented', '1', '-1', '1'])).rejects.toThrow('ck_materials_specific_gravity_above_zero');
    await expect(db.runtime.query("UPDATE materials SET specific_gravity = 0 WHERE material_in_drawing = 'Gravity-material'")).rejects.toThrow('ck_materials_specific_gravity_above_zero');
    await db.owner.query("INSERT INTO materials (material_in_drawing, is_hidden) VALUES ('Hidden-zero-for-test', true)");
    expect((await byName('Hidden-zero-for-test'))?.specific_gravity).toBe('0.0000');
  });

  it('stores up to four decimals and refuses a value over 14 digits before the point (Decimal(18,4))', async () => {
    await db.owner.query(insert, ['Invented-decimal', 'Invented', '12345678901234.5678', '1', '1']);
    expect((await byName('Invented-decimal'))?.price_per_kg).toBe('12345678901234.5678');
    await expect(db.owner.query(insert, ['Invented-too-big', 'Invented', '123456789012345', '1', '1'])).rejects.toThrow();
  });

  it('lets the runtime role read, add and change rows, but not delete them (a material is removed softly, A-13) or truncate the table', async () => {
    await db.runtime.query(insert, ['Invented-grant-check', 'Invented', '1.37', '2.37', '3.37']);
    await db.runtime.query("UPDATE materials SET price_per_kg = 2.37 WHERE material_in_drawing = 'Invented-grant-check'");
    await db.runtime.query("UPDATE materials SET deleted_at = now() WHERE material_in_drawing = 'Invented-grant-check'");
    await expect(db.runtime.query("DELETE FROM materials WHERE material_in_drawing = 'Invented-grant-check'")).rejects.toThrow(/permission denied/);
    await expect(db.runtime.query('TRUNCATE materials')).rejects.toThrow(/permission denied/);
  });
});

describe('AC-2, AC-3, AC-5: adding a material', () => {
  it('stores the material and writes exactly one master.created entry, with who, when, the object, before and after', async () => {
    const entries = await entryCount(db);
    const created = await db.mastersService.createMaterial(by(), ADDED);
    expect(created).toMatchObject({ ...ADDED });
    const stored = defined(await byName(ADDED.materialInDrawing));
    expect([stored.price_per_kg, stored.specific_gravity, stored.scrap_rate]).toEqual(['58.3700', '7.3700', '22.3700']);
    expect(await entryCount(db)).toBe(entries + 1);
    const [entry] = await entriesFor(db, created.id);
    expect(entry).toMatchObject({
      event: 'master.created',
      actor_id: adminId,
      actor_label: 'Invented Admin',
      object_type: 'material',
      object_id: created.id,
      object_label: 'Invented-sheet-grade-A',
      before: null,
      after: { ...ADDED },
      request_id: 'req-0a0b0c0d',
    });
    expect(entry?.created_at).toBeInstanceOf(Date);
  });

  it('refuses a name differing only in letter case with the 422 of AC-2; nothing is stored or recorded', async () => {
    const entries = await entryCount(db);
    const stored = (await rows()).length;
    const taken = await refusal(db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: 'INVENTED-SHEET-GRADE-A' }));
    expect(taken).toBeInstanceOf(FieldValidationError);
    expect(taken).toMatchObject({ code: NAME_TAKEN_CODE, fields: [{ field: 'materialInDrawing', message: 'A material with this name already exists. Names must be unique.' }] });
    expect(await entryCount(db)).toBe(entries);
    expect((await rows()).length).toBe(stored);
  });

  it.each(['0', '0.00', '-3'])('refuses a specific gravity of %s before the transaction opens; nothing is stored or recorded (UX-37)', async (specificGravity) => {
    const entries = await entryCount(db);
    const stored = (await rows()).length;
    const error = await refusal(db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: 'Invented-zero-add', specificGravity }));
    expect(error).toMatchObject({ fields: [{ field: 'specificGravity', message: 'Enter a value above 0.' }] });
    expect(await entryCount(db)).toBe(entries);
    expect((await rows()).length).toBe(stored);
  });
});

describe('AC-2, AC-3, AC-5: changing a material', () => {
  it('changes the fields given (the ID stays) and writes one master.edited entry with the whole material before and after', async () => {
    const id = defined(await byName(ADDED.materialInDrawing)).id;
    const updated = await db.mastersService.updateMaterial(by(), id, { scrapRate: '23.37', specificGravity: '0.01' });
    expect(updated).toMatchObject({ id, scrapRate: '23.37', specificGravity: '0.01', pricePerKg: '58.37' });
    const entries = (await entriesFor(db, id)).filter((entry) => entry.event === 'master.edited');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      object_type: 'material',
      before: { ...ADDED },
      after: { ...ADDED, scrapRate: '23.37', specificGravity: '0.01' },
    });
  });

  it('keeps the entries under the name the material had at the time, and allows a change of its own letter case', async () => {
    const id = defined(await byName(ADDED.materialInDrawing)).id;
    await db.mastersService.updateMaterial(by(), id, { materialInDrawing: 'invented-sheet-grade-a' });
    // Compared as a set: the entries are milliseconds apart, and no test of this file orders anything by time (AQP-113 QLT-02).
    expect((await entriesFor(db, id)).map((entry) => entry.object_label).sort()).toEqual(['Invented-sheet-grade-A', 'Invented-sheet-grade-A', 'invented-sheet-grade-a'].sort());
  });

  it('writes nothing for a save that changes nothing, and refuses a rename to another material\'s name or a specific gravity of 0', async () => {
    const created = await db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: 'Invented-second-material' });
    const entries = await entryCount(db);
    await db.mastersService.updateMaterial(by(), created.id, { specificGravity: '07.37', pricePerKg: '058.37' });
    expect(await entryCount(db)).toBe(entries);
    expect(await refusal(db.mastersService.updateMaterial(by(), created.id, { materialInDrawing: 'INVENTED-SHEET-GRADE-A' }))).toMatchObject({ code: NAME_TAKEN_CODE });
    expect(await refusal(db.mastersService.updateMaterial(by(), created.id, { specificGravity: '0' }))).toMatchObject({ fields: [{ field: 'specificGravity' }] });
    expect(await entryCount(db)).toBe(entries);
    expect((await byName('Invented-second-material'))?.specific_gravity).toBe('7.3700');
  });

  it('says not found for a material that does not exist, and for text that is not an ID', async () => {
    expect(await refusal(db.mastersService.updateMaterial(by(), '00000000-0000-4000-8000-0ccc00000009', { scrapRate: '1.37' }))).toBeInstanceOf(NotFoundError);
    expect(await refusal(db.mastersService.updateMaterial(by(), 'not-an-id', { scrapRate: '1.37' }))).toBeInstanceOf(NotFoundError);
  });
});

describe('AC-5 (DEF-017): an entry commits with its change, or not at all', () => {
  /** The outermost transaction fails after its work; one opened inside it commits (tests/support/late-failure-runner.ts, #130). */
  function failingAfterTheLastStep(): TransactionRunner {
    return createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE));
  }

  it('create: no material is left and no entry is kept', async () => {
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.createMaterial(by(), { ...ADDED, materialInDrawing: 'Late-failure-create' })).rejects.toThrow(LATE_FAILURE);
    expect(await byName('Late-failure-create')).toBeUndefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('update: the material is as it was and no entry is kept', async () => {
    const before = defined(await byName('Invented-second-material'));
    const entries = await entryCount(db);
    const service = db.buildMastersService({ transactions: failingAfterTheLastStep() });
    await expect(service.updateMaterial(by(), before.id, { scrapRate: '99.37' })).rejects.toThrow(LATE_FAILURE);
    expect((await byName('Invented-second-material'))?.scrap_rate).toBe(before.scrap_rate);
    expect(await entryCount(db)).toBe(entries);
  });

  it('an entry the audit service refuses takes the change back (a material is never changed without its record)', async () => {
    const entries = await entryCount(db);
    await expect(db.mastersService.createMaterial({ ...by(), actorLabel: '' }, { ...ADDED, materialInDrawing: 'Refused-entry' })).rejects.toMatchObject({ reason: 'shape' });
    expect(await byName('Refused-entry')).toBeUndefined();
    expect(await entryCount(db)).toBe(entries);
  });

  it('update: an entry the audit service refuses takes the edit back (an edit is never saved without its record, NFR-007)', async () => {
    const created = await db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: 'Refused-edit' });
    const entries = await entryCount(db);
    // An empty actor label is refused by the audit service, inside the transaction of the edit.
    await expect(db.mastersService.updateMaterial({ ...by(), actorLabel: '' }, created.id, { scrapRate: '9.37' })).rejects.toMatchObject({ reason: 'shape' });
    expect((await byName('Refused-edit'))?.scrap_rate).toBe('22.3700');
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('two requests at once', () => {
  it('let exactly one of several simultaneous creations of one name (in different letter case) win; the others are told the name is taken', async () => {
    const attempts = await Promise.allSettled(
      ['Race-Material', 'RACE-MATERIAL', 'race-material', 'Race-material'].map((materialInDrawing) => db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing })),
    );
    const winners = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const losers = attempts.flatMap((attempt) => (attempt.status === 'rejected' ? [attempt.reason as unknown] : []));
    expect(winners).toHaveLength(1);
    for (const loser of losers) expect(loser).toMatchObject({ code: NAME_TAKEN_CODE });
    const { rows: found } = await db.owner.query("SELECT 1 FROM materials WHERE lower(material_in_drawing) = 'race-material'");
    expect(found).toHaveLength(1);
  });

  it('two changes to one material wait for each other, so the entry of the second one holds the state the first left', async () => {
    const created = await db.mastersService.createMaterial(by(), { ...ADDED, materialInDrawing: 'Race-edit' });
    await Promise.all([
      db.mastersService.updateMaterial(by(), created.id, { scrapRate: '31.37' }),
      db.mastersService.updateMaterial(by(), created.id, { pricePerKg: '41.37' }),
    ]);
    const edits = (await entriesFor(db, created.id)).filter((entry) => entry.event === 'master.edited');
    expect(edits).toHaveLength(2);
    // Whichever went first: the entry that starts from the state the material was created in is the first, and the other one starts from
    // where it ended, so no change was lost. Nothing here orders the entries by time (QLT-03).
    const original = { ...ADDED, materialInDrawing: 'Race-edit' };
    const first = edits.find((entry) => isDeepStrictEqual(entry.before, original));
    const second = edits.find((entry) => entry !== first);
    expect(defined(second).before).toEqual(defined(first).after);
    expect(await db.masterRepository.listMaterials().then((all) => all.find((material) => material.id === created.id))).toMatchObject({
      scrapRate: '31.37',
      pricePerKg: '41.37',
    });
  });
});

describe('the repository itself: the rule of the database for names, whatever the service checked first', () => {
  it('turns a repeated name, in any letter case, into MasterConstraintError on an add and on a rename, and rolls the transaction back', async () => {
    const added = db.transactions.run((tx) => db.masterRepository.createMaterial({ ...ADDED, materialInDrawing: 'INVENTED-SECOND-MATERIAL' }, tx));
    await expect(added).rejects.toBeInstanceOf(MasterConstraintError);
    await expect(added).rejects.toMatchObject({ constraint: 'material-name' });
    const second = defined(await byName('Invented-second-material'));
    const renamed = db.transactions.run((tx) => db.masterRepository.updateMaterial(second.id, { materialInDrawing: 'race-material' }, tx));
    await expect(renamed).rejects.toBeInstanceOf(MasterConstraintError);
    expect((await byName('Invented-second-material'))?.material_considered).toBe('Invented steel');
  });

  it('answers null for a change to a material that is not there', async () => {
    const gone = '00000000-0000-4000-8000-0ccc00000009';
    expect(await db.transactions.run((tx) => db.masterRepository.updateMaterial(gone, { scrapRate: '1.37' }, tx))).toBeNull();
  });
});

describe('the canary loader of the scan, started by several widths at once (QLT-01 of the G6 of AQP-122)', () => {
  const LOADERS = 3;
  const ROUNDS = 12;
  let connections: Client[] = [];

  afterEach(emptyTable);

  beforeAll(async () => {
    connections = Array.from({ length: LOADERS }, () => new Client({ connectionString: db.database.runtimeUrl }));
    await Promise.all(connections.map((connection) => connection.connect()));
  });

  afterAll(async () => {
    await Promise.all(connections.map((connection) => connection.end()));
  });

  it('three loaders on three connections, each round on an empty table: none is refused, and the table holds the canaries once, whatever the order', async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      await emptyTable();
      const settled = await Promise.allSettled(connections.map((connection) => loadCanaryMaterials(connection)));
      expect(settled.flatMap((outcome) => (outcome.status === 'rejected' ? [String(outcome.reason)] : [])), `round ${round}`).toEqual([]);
    }
    const stored = (await rows()).map((row) => [row.id, row.material_in_drawing, row.price_per_kg, row.specific_gravity, row.scrap_rate]);
    const expected = MATERIAL_CANARIES.map((m) => [m.id, m.materialInDrawing, `${m.pricePerKg}00`, `${m.specificGravity}00`, `${m.scrapRate}00`]);
    expect(stored.sort()).toEqual(expected.sort());
  });

  it('a second run on a full table changes nothing it should not: the canary values are put back after another test changed them', async () => {
    await loadCanaryMaterials(defined(connections[0]));
    const first = defined(MATERIAL_CANARIES[0]);
    await db.owner.query("UPDATE materials SET scrap_rate = 1.37, material_considered = 'Changed' WHERE id = $1::uuid", [first.id]);
    await Promise.all(connections.map((connection) => loadCanaryMaterials(connection)));
    const restored = defined((await rows()).find((row) => row.id === first.id));
    expect([restored.scrap_rate, restored.material_considered]).toEqual([`${first.scrapRate}00`, first.materialConsidered]);
  });
});
