import { describe, expect, it } from 'vitest';

import { storeRowOutputs } from '@/lib/estimate/row-outputs';
import { Decimal } from '@/lib/decimal';
import { compilePlan } from '@/lib/formula';
import { masterSnapshotSchema } from '@/server/repositories/calculation-repository';
import { readMasters } from '@/server/services/calculation-masters';
import { createCalculationService } from '@/server/services/calculation-service';

import { defined } from '../support/defined';
import { createFakeCalculationWorld } from '../support/fake-calculations';
import { createFakeEstimateWorld } from '../support/fake-estimates';
import { fakeCustomer } from '../support/fake-customers';
import { createFakeMasterRepository, seedRecords } from '../support/fake-masters';
import { reevaluateRecord } from '../support/reevaluate-record';
import { EXCHANGE, MATERIAL, ROW, TYPED_RATES } from '../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * GitHub #432, DL-225 (architecture section 4.2, "The master snapshot keeps only the rates the plan references"; the developer's tests 2, 3, 4 and 5): `readMasters` keeps exactly the customer's rates that
 * the plan references, in the order of the plan's set, and the evaluator and the stored snapshot get the same list. A record made before the change, with every rate of the customer, still parses and
 * re-evaluates to the same figures. Over the in-memory masters; the same record is read back from PostgreSQL in `tests/integration/calc/calculation-record.test.ts`. Invented names and numbers.
 */

const CONFIG_VERSION_ID = '00000000-0000-4000-8000-0aaa00000432';
const ESTIMATE_ID = '00000000-0000-4000-8000-0e5700000432';
const PERSON_ID = '00000000-0000-4000-8000-0b0b00000432';
const NODE_ONE = '00000000-0000-4000-8000-0d0d00000432';
const NODE_TWO = '00000000-0000-4000-8000-0d0d00000433';
const MATERIAL_ONE_ID = '00000000-0000-4000-8000-0ccc00000432';
const MATERIAL_TWO_ID = '00000000-0000-4000-8000-0ccc00000433';
const MISSING_RATE_ID = '00000000-0000-4000-8000-0bbb00000432';

const idOf = (letter: string): string => seedFieldAt(letter).id;
const typedRow = (): Record<string, string> => Object.fromEntries(Object.entries(ROW).map(([letter, text]) => [idOf(letter), text]));
const itemNamed = (name: string) => defined(SEED_PROCESS_ITEMS.find((item) => item.name === name), name);
const CUTTING = itemNamed('Cutting-Rate-per-Sec');
const OH_PROFIT = itemNamed('OH Profit %');
const TRANSPORT = itemNamed('Transport %');
const PLATING = itemNamed('Plating-rate-per-sqin');
const FOAM = itemNamed('Foam Cost');

function world() {
  const masters = createFakeMasterRepository(seedRecords());
  const customer = fakeCustomer(masters.records, 'Invented customer', Object.fromEntries(SEED_PROCESS_ITEMS.map((item) => [item.id, defined(TYPED_RATES[item.name], item.name)])));
  masters.customers.push(customer);
  masters.materials.push(
    { id: MATERIAL_ONE_ID, materialInDrawing: 'Invented plate', materialConsidered: 'Invented steel', ...MATERIAL },
    { id: MATERIAL_TWO_ID, materialInDrawing: 'Invented bar', materialConsidered: 'Invented alloy', pricePerKg: '90.50', specificGravity: '2.70', scrapRate: '40' },
  );
  masters.exchange.usd = EXCHANGE.usd;
  masters.exchange.eur = EXCHANGE.eur;
  return { masters, customer };
}

describe('readMasters keeps the referenced rates, in the order of the set (#432, architecture 4.2 test 2)', () => {
  it('a customer with 15 rates and a set of three stores exactly those three, in the order of the set, with the name and the value then', async () => {
    const { masters, customer } = world();
    const set = [OH_PROFIT.id, CUTTING.id, TRANSPORT.id];
    const values = await readMasters(masters, customer.id, [MATERIAL_ONE_ID], set);
    expect(values.snapshot.rates).toEqual([
      { id: OH_PROFIT.id, name: OH_PROFIT.name, value: TYPED_RATES['OH Profit %'] },
      { id: CUTTING.id, name: CUTTING.name, value: TYPED_RATES['Cutting-Rate-per-Sec'] },
      { id: TRANSPORT.id, name: TRANSPORT.name, value: TYPED_RATES['Transport %'] },
    ]);
  });

  it('the evaluator gets the same list as the snapshot: the same IDs, names and values, in the same order', async () => {
    const { masters, customer } = world();
    const values = await readMasters(masters, customer.id, [MATERIAL_ONE_ID], [FOAM.id, CUTTING.id]);
    expect(values.rates.map((rate) => [rate.id, rate.name, rate.value?.toFixed()])).toEqual(values.snapshot.rates.map((rate) => [rate.id, rate.name, new Decimal(rate.value).toFixed()]));
    expect(values.rates).toHaveLength(2);
  });

  it('a rate that no formula reads is not kept, and a rate that the customer has no row for is left out without an error', async () => {
    const { masters, customer } = world();
    const values = await readMasters(masters, customer.id, [MATERIAL_ONE_ID], [CUTTING.id, MISSING_RATE_ID]);
    expect(values.snapshot.rates.map((rate) => rate.id)).toEqual([CUTTING.id]);
    expect(values.rates.map((rate) => rate.id)).toEqual([CUTTING.id]);
    expect(values.snapshot.rates.map((rate) => rate.id)).not.toContain(PLATING.id);
  });

  it('an empty set stores no rate', async () => {
    const { masters, customer } = world();
    const values = await readMasters(masters, customer.id, [MATERIAL_ONE_ID], []);
    expect(values.snapshot.rates).toEqual([]);
    expect(values.rates).toEqual([]);
  });

  it('the materials (each once, in order of first use), the exchange rates and the customer are what they were', async () => {
    const { masters, customer } = world();
    const values = await readMasters(masters, customer.id, [MATERIAL_TWO_ID, MATERIAL_ONE_ID], [CUTTING.id]);
    expect(values.snapshot.customer).toEqual({ id: customer.id, name: 'Invented customer' });
    expect(values.snapshot.materials.map((material) => material.id)).toEqual([MATERIAL_TWO_ID, MATERIAL_ONE_ID]);
    expect(values.snapshot.exchangeRates).toEqual({ usd: EXCHANGE.usd, eur: EXCHANGE.eur });
    expect([...values.materials.keys()]).toEqual([MATERIAL_TWO_ID, MATERIAL_ONE_ID]);
  });
});

function storedWorld() {
  const { masters, customer } = world();
  const estimates = createFakeEstimateWorld(() => [], [
    {
      id: ESTIMATE_ID,
      code: 'Q-2026-0432',
      engineerId: PERSON_ID,
      assignedByName: 'Invented Lead',
      folderPath: '\\\\invented-server\\invented-share\\RFQ-432',
      deadlineAt: new Date('2026-11-20T11:30:00.000Z'),
      title: null,
      notes: null,
      status: 'DRAFT',
      customerId: customer.id,
      inputsRevision: 1,
    },
  ]);
  const calculations = createFakeCalculationWorld(estimates);
  const service = createCalculationService({
    masters,
    currentConfiguration: () => Promise.resolve({ id: CONFIG_VERSION_ID, document: seedConfig }),
    storage: { calculations: calculations.repository, estimates: calculations.estimates, transactions: calculations.transactions },
  });
  const node = (nodeId: string, materialId: string, sortIndex: number) => ({
    nodeId,
    parentId: null,
    sortIndex,
    slNo: String(sortIndex + 1),
    imageId: null,
    materialId,
    inputs: typedRow(),
    texts: {},
  });
  const request = { estimateId: ESTIMATE_ID, createdById: PERSON_ID, inputsRevision: 1, nodes: [node(NODE_ONE, MATERIAL_ONE_ID, 0), node(NODE_TWO, MATERIAL_TWO_ID, 1)] };
  return { masters, customer, calculations, service, request };
}

const SEED_PLAN = compilePlan(seedConfig.fields);

describe('a stored calculation keeps the plan\'s referenced rates and nothing else (#432)', () => {
  it('the stored rates are exactly the customer\'s rates in the plan\'s set, in the set\'s order, and Plating (no seed formula reads it) is not among them', async () => {
    const { service, calculations, request } = storedWorld();
    await service.storeCalculation(request);
    const { rates } = defined(calculations.calculations[0]).masterSnapshot;
    expect(rates.map((rate) => rate.id)).toEqual(SEED_PLAN.referencedRateIds);
    expect(rates.length).toBeLessThan(SEED_PROCESS_ITEMS.length);
    expect(rates.map((rate) => rate.id)).not.toContain(PLATING.id);
    for (const rate of rates) expect(rate.value).toBe(defined(TYPED_RATES[rate.name], rate.name));
  });

  it('re-evaluating every row from the stored record alone gives the stored outputs exactly (architecture 4.2 test 3, in memory)', async () => {
    const { service, calculations, request } = storedWorld();
    await service.storeCalculation(request);
    const record = defined(calculations.calculations[0]);
    expect(record.rows).toHaveLength(2);
    const again = reevaluateRecord(record, seedConfig, SEED_PLAN, idOf('E'));
    expect(again.rows).toEqual(record.rows.map((row) => row.outputs));
    expect(again.productValues).toEqual(record.productValues);
  });

  it('the figures are those of the same estimate calculated on its own, with every rate (architecture 4.2 test 4)', async () => {
    const { service, calculations, request, customer } = storedWorld();
    await service.storeCalculation(request);
    const record = defined(calculations.calculations[0]);
    const alone = await service.calculateEstimate({ customerId: customer.id, rows: request.nodes.map((row) => ({ materialId: row.materialId, inputs: row.inputs })) });
    expect(record.rows.map((row) => row.outputs)).toEqual(alone.rows.map((row) => storeRowOutputs(row)));
    expect(record.productValues.totalPrice).toBe(alone.totals.totalPrice?.toString());
  });
});

describe('a record stored before the change, with every rate of the customer, still reads (architecture 4.2 test 5)', () => {
  it('parses through masterSnapshotSchema, and re-evaluates to the same figures as the record with only the referenced rates', async () => {
    const { service, calculations, request } = storedWorld();
    await service.storeCalculation(request);
    const record = defined(calculations.calculations[0]);
    const shape1 = masterSnapshotSchema.parse({
      ...record.masterSnapshot,
      rates: SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, value: defined(TYPED_RATES[item.name], item.name) })),
    });
    expect(shape1.rates).toHaveLength(SEED_PROCESS_ITEMS.length);
    expect(shape1.rates.map((rate) => rate.id)).toContain(PLATING.id);
    expect(masterSnapshotSchema.parse(record.masterSnapshot)).toEqual(record.masterSnapshot);
    const again = reevaluateRecord({ masterSnapshot: shape1, rows: record.rows }, seedConfig, SEED_PLAN, idOf('E'));
    expect(again.rows).toEqual(record.rows.map((row) => row.outputs));
    expect(again.productValues).toEqual(record.productValues);
  });
});
