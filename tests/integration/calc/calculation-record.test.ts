import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { storeRowOutputs } from '@/lib/estimate/row-outputs';

import { type CalculationDatabase, idOf, openCalculationDatabase, typedRow } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { TYPED_RATES } from '../../support/row-oracle';
import { SEED_PROCESS_ITEMS } from '../../support/seed-config';

/**
 * STORY-03.05 (AC-1, AC-2, AC-5, AC-6; FR-031, NFR-026; ADR-007) against real PostgreSQL in a throwaway database: `storeCalculation` writes one record and a row per
 * node, the estimate's status and its link, in one transaction that commits whole or not at all; the record keeps the values it used and the words of E, F and G, so
 * a later change to a master, an approval or a rename changes nothing in it; every press adds a record; the estimate's link has its foreign key. The refusals of the
 * triggers and the grants are `immutability.test.ts`. Every name and number is invented.
 */

let db: CalculationDatabase;

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

interface EstimateState {
  readonly status: string;
  readonly current_calculation_id: string | null;
  readonly inputs_revision: number;
}

async function estimateState(estimateId: string): Promise<EstimateState> {
  const { rows } = await db.owner.query<EstimateState>('SELECT status::text, current_calculation_id::text, inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(rows[0]);
}

async function countFor(estimateId: string): Promise<{ calculations: number; rows: number }> {
  const { rows } = await db.owner.query<{ calculations: string; rows: string }>(
    `SELECT (SELECT count(*) FROM calculations WHERE estimate_id = $1::uuid) AS calculations,
            (SELECT count(*) FROM calculation_rows r JOIN calculations c ON c.id = r.calculation_id WHERE c.estimate_id = $1::uuid) AS rows`,
    [estimateId],
  );
  const row = defined(rows[0]);
  return { calculations: Number(row.calculations), rows: Number(row.rows) };
}

const request = (estimateId: string, nodes = [db.node(), db.node({ parentId: null, sortIndex: 1, slNo: '2', materialId: db.materialTwoId })], inputsRevision = 3) => ({
  estimateId,
  createdById: db.personId,
  inputsRevision,
  nodes,
});

describe('AC-1: one record, a row per node, the status and the link, in one transaction', () => {
  it('writes the header and every row as stored, and links the estimate and submits it', async () => {
    const estimateId = await db.addEstimate();
    const first = db.node({ imageId: randomUUID() });
    const second = db.node({ parentId: first.nodeId, sortIndex: 0, slNo: '1.1', materialId: db.materialTwoId });
    const stored = await db.service.storeCalculation(request(estimateId, [first, second]));

    const header = await db.owner.query(
      `SELECT estimate_id::text, config_version_id::text, inputs_revision, created_by::text, warnings, product_values, master_snapshot FROM calculations WHERE id = $1::uuid`,
      [stored.id],
    );
    expect(header.rows).toHaveLength(1);
    expect(header.rows[0]).toMatchObject({ estimate_id: estimateId, config_version_id: db.configVersionId, inputs_revision: 3, created_by: db.personId, warnings: [] });
    expect(Object.keys(defined(header.rows[0]).product_values).sort()).toEqual(['pricePerToolCost', 'toolCostTotal', 'totalPrice']);

    const rows = await db.owner.query(
      'SELECT node_id::text, parent_id::text, sort_index, sl_no, image_id::text, inputs, outputs FROM calculation_rows WHERE calculation_id = $1::uuid ORDER BY sl_no',
      [stored.id],
    );
    expect(rows.rows.map((row) => [row.node_id, row.parent_id, row.sort_index, row.sl_no, row.image_id])).toEqual([
      [first.nodeId, null, 0, '1', first.imageId],
      [second.nodeId, first.nodeId, 0, '1.1', null],
    ]);
    expect(defined(rows.rows[0]).inputs).toMatchObject({
      [idOf('J')]: '200',
      [idOf('E')]: 'Invented plate',
      [idOf('F')]: 'Invented steel',
      [idOf('G')]: 'Invented powder coat, grey',
    });
    expect(defined(rows.rows[1]).inputs).toMatchObject({ [idOf('E')]: 'Invented bar', [idOf('F')]: 'Invented alloy' });
    const alone = storeRowOutputs(await db.service.calculateRow({ customerId: db.customerId, materialId: db.materialOneId, inputs: typedRow() }));
    expect(defined(rows.rows[0]).outputs).toEqual(alone);

    expect(await estimateState(estimateId)).toEqual({ status: 'SUBMITTED', current_calculation_id: stored.id, inputs_revision: 3 });
  });

  it('reads back through the repository exactly what was stored, with decimal text and no number anywhere', async () => {
    const estimateId = await db.addEstimate();
    const stored = await db.service.storeCalculation(request(estimateId));
    const record = defined(await db.calculations.findCalculation(stored.id));
    expect(record).toMatchObject({ id: stored.id, estimateId, configVersionId: db.configVersionId, inputsRevision: 3, createdById: db.personId, warnings: [] });
    expect(record.rows).toHaveLength(2);
    expect(typeof record.productValues.totalPrice).toBe('string');
    expect(record.masterSnapshot.exchangeRates).toEqual({ usd: '80.00', eur: '90.00' });
    expect(record.masterSnapshot.materials.map((material) => material.materialInDrawing)).toEqual(['Invented plate', 'Invented bar']);
  });

  it('keeps a Draft as Draft until the link is written, and a Submitted estimate Submitted', async () => {
    const estimateId = await db.addEstimate({ status: 'SUBMITTED' });
    const stored = await db.service.storeCalculation(request(estimateId));
    expect(await estimateState(estimateId)).toMatchObject({ status: 'SUBMITTED', current_calculation_id: stored.id });
  });

  it('stores a tree larger than one insert (1,001 nodes) and every row arrives', async () => {
    const estimateId = await db.addEstimate();
    const nodes = Array.from({ length: 1001 }, (_, index) => db.node({ sortIndex: index, slNo: String(index + 1) }));
    const stored = await db.service.storeCalculation(request(estimateId, nodes));
    expect(await countFor(estimateId)).toEqual({ calculations: 1, rows: 1001 });
    expect(stored.id).toBeTruthy();
  }, 60_000);

  it('all or nothing: a failure after the record and its rows were inserted (the link) leaves no record, no rows and the estimate as it was', async () => {
    const estimateId = await db.addEstimate();
    const service = db.buildService({
      estimates: {
        lockEstimate: (id, tx) => db.estimates.lockEstimate(id, tx),
        linkCalculation: () => Promise.reject(new Error('The link failed.')),
      },
    });
    await expect(service.storeCalculation(request(estimateId))).rejects.toThrow('The link failed.');
    expect(await countFor(estimateId)).toEqual({ calculations: 0, rows: 0 });
    expect(await estimateState(estimateId)).toEqual({ status: 'DRAFT', current_calculation_id: null, inputs_revision: 3 });
  });

  it('all or nothing: a person who does not exist is refused by the foreign key, and nothing is stored', async () => {
    const estimateId = await db.addEstimate();
    await expect(db.service.storeCalculation({ ...request(estimateId), createdById: randomUUID() })).rejects.toThrow();
    expect(await countFor(estimateId)).toEqual({ calculations: 0, rows: 0 });
    expect(await estimateState(estimateId)).toMatchObject({ status: 'DRAFT', current_calculation_id: null });
  });

  it.each([
    ['an unknown estimate', async () => randomUUID(), 'NOT_FOUND'],
    ['an approved estimate', async () => db.addEstimate({ status: 'APPROVED' }), 'ESTIMATE_APPROVED'],
    ['an estimate with no customer', async () => db.addEstimate({ withCustomer: false }), 'CUSTOMER_NOT_CHOSEN'],
    ['an estimate whose inputs changed since the nodes were read', async () => db.addEstimate({ revision: 9 }), 'INPUTS_CHANGED'],
  ])('%s is refused with its own code, before anything is written', async (_name, makeEstimate, code) => {
    const estimateId = await makeEstimate();
    const before = await db.owner.query('SELECT count(*) AS n FROM calculations');
    await expect(db.service.storeCalculation(request(estimateId))).rejects.toMatchObject({ code });
    expect((await db.owner.query('SELECT count(*) AS n FROM calculations')).rows).toEqual(before.rows);
  });
});

describe('AC-1: the estimate row lock orders a Calculate and an input change', () => {
  const POLL_MILLISECONDS = 25;
  const WAIT_LIMIT_MILLISECONDS = 10_000;

  /** Polls until some statement in this database waits on a lock, so the test never guesses with a sleep. */
  async function waitUntilAStatementWaitsOnALock(client: Client): Promise<void> {
    const deadline = Date.now() + WAIT_LIMIT_MILLISECONDS;
    while (Date.now() < deadline) {
      const { rows } = await client.query<{ waiting: string }>("SELECT count(*) AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'");
      if (Number(rows[0]?.waiting) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_MILLISECONDS));
    }
    throw new Error('No statement started waiting on a lock in time.');
  }

  it('an input change that holds the estimate commits first: the Calculate waits, sees the new revision and stores nothing', async () => {
    const estimateId = await db.addEstimate();
    const changer = new Client({ connectionString: db.database.ownerUrl });
    await changer.connect();
    try {
      await changer.query('BEGIN');
      await changer.query('SELECT id FROM estimates WHERE id = $1::uuid FOR UPDATE', [estimateId]);
      const pending = db.service.storeCalculation(request(estimateId));
      const outcome = pending.then(
        () => 'stored',
        (error: unknown) => (error instanceof Error && 'code' in error ? String(error.code) : 'failed'),
      );
      // The waiting statement is the runtime role's, and pg_stat_activity shows another role's sessions only to a member of it: look as the runtime role.
      await waitUntilAStatementWaitsOnALock(db.runtime);
      await changer.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
      await changer.query('COMMIT');
      expect(await outcome).toBe('INPUTS_CHANGED');
    } finally {
      await changer.end();
    }
    expect(await countFor(estimateId)).toEqual({ calculations: 0, rows: 0 });
    expect(await estimateState(estimateId)).toMatchObject({ status: 'DRAFT', current_calculation_id: null, inputs_revision: 4 });
  });

  it('two Calculates at once on one estimate both store, one after the other, and the estimate points at one of them', async () => {
    const estimateId = await db.addEstimate();
    const [one, two] = await Promise.all([db.service.storeCalculation(request(estimateId)), db.service.storeCalculation(request(estimateId))]);
    expect(await countFor(estimateId)).toEqual({ calculations: 2, rows: 4 });
    expect([one.id, two.id]).toContain((await estimateState(estimateId)).current_calculation_id);
    expect(one.id).not.toBe(two.id);
  });
});

describe('AC-2: a stored calculation does not follow the masters (NFR-026)', () => {
  it('a changed rate, material price, scrap rate and exchange rate, a renamed material and an approval change nothing that was stored', async () => {
    const estimateId = await db.addEstimate();
    const stored = await db.service.storeCalculation(request(estimateId));
    const before = defined(await db.calculations.findCalculation(stored.id));

    await db.owner.query("UPDATE customer_rates SET value = 99 WHERE customer_id = $1::uuid", [db.customerId]);
    await db.owner.query("UPDATE materials SET price_per_kg = 500, scrap_rate = 77, material_in_drawing = 'Invented plate, renamed', material_considered = 'Invented steel, renamed' WHERE id = $1::uuid", [
      db.materialOneId,
    ]);
    await db.owner.query("UPDATE exchange_rates SET inr_value = 1 WHERE currency = 'USD'");
    await db.owner.query("UPDATE estimates SET status = 'APPROVED' WHERE id = $1::uuid", [estimateId]);

    expect(await db.calculations.findCalculation(stored.id)).toEqual(before);
    expect(defined(before.rows[0]).inputs[idOf('E')]).toBe('Invented plate');
    expect(defined(before.rows[0]).inputs[idOf('F')]).toBe('Invented steel');

    // Put the masters back for the other tests of this file.
    for (const item of SEED_PROCESS_ITEMS) {
      await db.owner.query('UPDATE customer_rates SET value = $3 WHERE customer_id = $1::uuid AND process_item_id = $2::uuid', [db.customerId, item.id, defined(TYPED_RATES[item.name], item.name)]);
    }
    await db.owner.query("UPDATE materials SET price_per_kg = 60, scrap_rate = 25, material_in_drawing = 'Invented plate', material_considered = 'Invented steel' WHERE id = $1::uuid", [db.materialOneId]);
    await db.owner.query("UPDATE exchange_rates SET inr_value = 80 WHERE currency = 'USD'");
  });

  it('the next Calculate uses the current masters and leaves the earlier record as it was', async () => {
    const estimateId = await db.addEstimate();
    const first = await db.service.storeCalculation(request(estimateId));
    const firstRecord = defined(await db.calculations.findCalculation(first.id));
    await db.owner.query("UPDATE exchange_rates SET inr_value = 81 WHERE currency = 'USD'");
    const second = await db.service.storeCalculation(request(estimateId));
    await db.owner.query("UPDATE exchange_rates SET inr_value = 80 WHERE currency = 'USD'");
    expect(defined(await db.calculations.findCalculation(second.id)).masterSnapshot.exchangeRates.usd).toBe('81.00');
    expect(await db.calculations.findCalculation(first.id)).toEqual(firstRecord);
  });
});

describe('AC-5: every press writes a new record', () => {
  it('a repeated Calculate adds a second record with its own rows; both stay; the estimate points at the newest; warnings are empty', async () => {
    const estimateId = await db.addEstimate();
    const first = await db.service.storeCalculation(request(estimateId));
    const second = await db.service.storeCalculation(request(estimateId));
    expect(first.id).not.toBe(second.id);
    expect(await countFor(estimateId)).toEqual({ calculations: 2, rows: 4 });
    expect((await estimateState(estimateId)).current_calculation_id).toBe(second.id);
    const { rows } = await db.owner.query('SELECT warnings FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
    expect(rows).toEqual([{ warnings: [] }, { warnings: [] }]);
    expect(defined(await db.calculations.findCalculation(first.id)).productValues).toEqual(defined(await db.calculations.findCalculation(second.id)).productValues);
  });
});

describe('AC-6: the estimate\'s link to its calculation has a foreign key', () => {
  it('refuses a link to a calculation that does not exist', async () => {
    const estimateId = await db.addEstimate();
    await expect(db.owner.query('UPDATE estimates SET current_calculation_id = $2::uuid WHERE id = $1::uuid', [estimateId, randomUUID()])).rejects.toMatchObject({
      code: '23503',
      constraint: 'fk_estimates_current_calculation_id',
    });
  });

  it('the repository will not link an estimate to the calculation of another estimate, and changes nothing', async () => {
    const mine = await db.addEstimate();
    const theirs = await db.addEstimate();
    const foreign = await db.service.storeCalculation(request(theirs));
    await expect(db.transactions.run((tx) => db.estimates.linkCalculation(mine, foreign.id, 'SUBMITTED', tx))).rejects.toThrow('could not be linked');
    expect(await estimateState(mine)).toEqual({ status: 'DRAFT', current_calculation_id: null, inputs_revision: 3 });
  });
});

describe('what the tables keep whoever writes to them', () => {
  const HEADER = `INSERT INTO calculations (estimate_id, config_version_id, inputs_revision, master_snapshot, product_values, warnings, created_by)
                  VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::uuid) RETURNING id::text`;

  async function insertHeader(estimateId: string, overrides: { revision?: number; snapshot?: string; product?: string; warnings?: string } = {}): Promise<unknown> {
    return db.owner.query(HEADER, [estimateId, db.configVersionId, overrides.revision ?? 3, overrides.snapshot ?? '{}', overrides.product ?? '{}', overrides.warnings ?? '[]', db.personId]);
  }

  it('a header with a negative revision, a snapshot that is not an object, product figures that are not an object or warnings that are not a list is refused', async () => {
    const estimateId = await db.addEstimate();
    await expect(insertHeader(estimateId, { revision: -1 })).rejects.toMatchObject({ constraint: 'ck_calculations_inputs_revision_not_negative' });
    await expect(insertHeader(estimateId, { snapshot: '[]' })).rejects.toMatchObject({ constraint: 'ck_calculations_master_snapshot_is_object' });
    await expect(insertHeader(estimateId, { product: '"x"' })).rejects.toMatchObject({ constraint: 'ck_calculations_product_values_is_object' });
    await expect(insertHeader(estimateId, { warnings: '{}' })).rejects.toMatchObject({ constraint: 'ck_calculations_warnings_is_array' });
    expect(await countFor(estimateId)).toEqual({ calculations: 0, rows: 0 });
  });

  it('a header added without warnings has the default empty list', async () => {
    const estimateId = await db.addEstimate();
    await db.owner.query(
      `INSERT INTO calculations (estimate_id, config_version_id, inputs_revision, master_snapshot, product_values, created_by) VALUES ($1::uuid, $2::uuid, 0, '{}', '{}', $3::uuid)`,
      [estimateId, db.configVersionId, db.personId],
    );
    expect((await db.owner.query('SELECT warnings FROM calculations WHERE estimate_id = $1::uuid', [estimateId])).rows).toEqual([{ warnings: [] }]);
  });

  it('a row with a negative sort index, a blank Sl. No, inputs or outputs that are not an object, or a node twice in one record is refused', async () => {
    const estimateId = await db.addEstimate();
    const stored = await db.service.storeCalculation(request(estimateId));
    const insertRow = (nodeId: string, sortIndex: number, slNo: string, inputs: string, outputs: string) =>
      db.owner.query(`INSERT INTO calculation_rows (calculation_id, node_id, sort_index, sl_no, inputs, outputs) VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb)`, [
        stored.id,
        nodeId,
        sortIndex,
        slNo,
        inputs,
        outputs,
      ]);
    await expect(insertRow(randomUUID(), -1, '9', '{}', '{}')).rejects.toMatchObject({ constraint: 'ck_calculation_rows_sort_index_not_negative' });
    await expect(insertRow(randomUUID(), 0, '  ', '{}', '{}')).rejects.toMatchObject({ constraint: 'ck_calculation_rows_sl_no_not_blank' });
    await expect(insertRow(randomUUID(), 0, '9', '[]', '{}')).rejects.toMatchObject({ constraint: 'ck_calculation_rows_inputs_is_object' });
    await expect(insertRow(randomUUID(), 0, '9', '{}', '1')).rejects.toMatchObject({ constraint: 'ck_calculation_rows_outputs_is_object' });
    const existing = await db.owner.query<{ node_id: string }>('SELECT node_id::text FROM calculation_rows WHERE calculation_id = $1::uuid LIMIT 1', [stored.id]);
    await expect(insertRow(defined(existing.rows[0]).node_id, 0, '9', '{}', '{}')).rejects.toMatchObject({ constraint: 'uq_calculation_rows_calculation_id_node_id' });
    expect(await countFor(estimateId)).toEqual({ calculations: 1, rows: 2 });
  });

  it('a row keeps its node, parent and image as plain IDs: no foreign key refuses an ID that no table holds (assumption A-1)', async () => {
    const estimateId = await db.addEstimate();
    const stored = await db.service.storeCalculation(request(estimateId, [db.node({ parentId: randomUUID(), imageId: randomUUID() })]));
    expect(await countFor(estimateId)).toEqual({ calculations: 1, rows: 1 });
    expect(stored.id).toBeTruthy();
  });
});
