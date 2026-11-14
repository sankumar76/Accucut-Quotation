import { describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { storeRowOutputs } from '@/lib/estimate/row-outputs';
import { createCalculationService, type CalculationNodeRequest, type CalculationService, type StoreCalculationRequest } from '@/server/services/calculation-service';

import { defined } from '../support/defined';
import { createFakeCalculationWorld, type FakeCalculationWorld } from '../support/fake-calculations';
import { createFakeEstimateWorld, type FakeEstimate, type FakeEstimateWorld } from '../support/fake-estimates';
import { createFakeMasterRepository, seedRecords, type FakeMasterRepository } from '../support/fake-masters';
import { fakeCustomer } from '../support/fake-customers';
import { MATERIAL, ROW, TYPED_RATES } from '../support/row-oracle';
import { SEED_PROCESS_ITEMS, cloneSeedConfig, seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * STORY-03.05 (FR-031, NFR-026; ADR-007; architecture sections 4.2 and 4.8): `storeCalculation` works the estimate out and stores one immutable record with a row
 * per node, the status and the link to the record, all or nothing. Over in-memory storage; the same code is run against PostgreSQL, with the triggers and the
 * grants, in `tests/integration/calc`. Every name, number and ID here is invented.
 */

const CONFIG_VERSION_ID = '00000000-0000-4000-8000-0aaa00000001';
const ESTIMATE_ID = '00000000-0000-4000-8000-0e5700000001';
const OTHER_ESTIMATE_ID = '00000000-0000-4000-8000-0e5700000002';
const PERSON_ID = '00000000-0000-4000-8000-0b0b00000001';
const NODE_ONE = '00000000-0000-4000-8000-0d0d00000001';
const NODE_TWO = '00000000-0000-4000-8000-0d0d00000002';
const NODE_THREE = '00000000-0000-4000-8000-0d0d00000003';
const IMAGE_ID = '00000000-0000-4000-8000-0f0f00000001';
const MATERIAL_ONE_ID = '00000000-0000-4000-8000-0ccc00000001';
const MATERIAL_TWO_ID = '00000000-0000-4000-8000-0ccc00000002';
const MATERIAL_UNUSED_ID = '00000000-0000-4000-8000-0ccc00000003';

const idOf = (letter: string): string => seedFieldAt(letter).id;
const typed = (): Record<string, string> => Object.fromEntries(Object.entries(ROW).map(([letter, text]) => [idOf(letter), text]));
const GOODS_TEXT = 'Invented powder coat, grey';
const REMARK_TEXT = 'Invented remark for the part';

interface Fixture {
  readonly masters: FakeMasterRepository;
  readonly estimates: FakeEstimateWorld;
  readonly world: FakeCalculationWorld;
  readonly service: CalculationService;
  readonly customerId: string;
  /** The estimate as the test reads it back. */
  readonly estimate: () => FakeEstimate;
  request(overrides?: Partial<StoreCalculationRequest>): StoreCalculationRequest;
}

const node = (overrides: Partial<CalculationNodeRequest> & Pick<CalculationNodeRequest, 'nodeId'>): CalculationNodeRequest => ({
  parentId: null,
  sortIndex: 0,
  slNo: '1',
  imageId: null,
  materialId: MATERIAL_ONE_ID,
  inputs: typed(),
  texts: { [idOf('G')]: GOODS_TEXT, [idOf('AJ')]: REMARK_TEXT },
  ...overrides,
});

function fixture(options: { status?: FakeEstimate['status']; customer?: boolean; revision?: number; document?: ReturnType<typeof cloneSeedConfig> } = {}): Fixture {
  const masters = createFakeMasterRepository(seedRecords());
  const rates = Object.fromEntries(SEED_PROCESS_ITEMS.map((item) => [item.id, defined(TYPED_RATES[item.name], item.name)]));
  const customer = fakeCustomer(masters.records, 'Invented customer', rates);
  masters.customers.push(customer);
  masters.materials.push(
    { id: MATERIAL_ONE_ID, materialInDrawing: 'Invented plate', materialConsidered: 'Invented steel', ...MATERIAL },
    { id: MATERIAL_TWO_ID, materialInDrawing: 'Invented bar', materialConsidered: 'Invented alloy', pricePerKg: '90.50', specificGravity: '2.70', scrapRate: '40' },
    { id: MATERIAL_UNUSED_ID, materialInDrawing: 'Invented unused', materialConsidered: 'Invented spare', ...MATERIAL },
  );
  masters.exchange.usd = '80.00';
  masters.exchange.eur = '90.00';

  const estimates = createFakeEstimateWorld(() => [], [
    {
      id: ESTIMATE_ID,
      code: 'Q-2026-0401',
      engineerId: PERSON_ID,
      assignedByName: 'Invented Lead',
      folderPath: '\\\\invented-server\\invented-share\\RFQ-1',
      deadlineAt: new Date('2026-11-20T11:30:00.000Z'),
      title: null,
      notes: null,
      status: options.status ?? 'DRAFT',
      customerId: options.customer === false ? null : customer.id,
      inputsRevision: options.revision ?? 4,
    },
  ]);
  const world = createFakeCalculationWorld(estimates);
  const document = options.document ?? seedConfig;
  const service = createCalculationService({
    masters,
    currentConfiguration: () => Promise.resolve({ id: CONFIG_VERSION_ID, document }),
    storage: { calculations: world.repository, estimates: world.estimates, transactions: world.transactions },
  });
  return {
    masters,
    estimates,
    world,
    service,
    customerId: customer.id,
    estimate: () => defined(estimates.estimates[0]),
    request: (overrides = {}) => ({
      estimateId: ESTIMATE_ID,
      createdById: PERSON_ID,
      inputsRevision: options.revision ?? 4,
      nodes: [node({ nodeId: NODE_ONE, imageId: IMAGE_ID }), node({ nodeId: NODE_TWO, parentId: NODE_ONE, sortIndex: 0, slNo: '1.1', materialId: MATERIAL_TWO_ID })],
      ...overrides,
    }),
  };
}

async function thrownRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('Expected an Error to be thrown.', { cause: error });
  }
  throw new Error('Expected the call to be refused, but it was not.');
}

describe('AC-1: a stored calculation is one record and one row per node', () => {
  it('writes the header: estimate, version, revision, product figures, an empty warnings list and who pressed the button', async () => {
    const { service, world, request } = fixture();
    const stored = await service.storeCalculation(request());
    const record = defined(world.calculations[0]);
    expect(world.calculations).toHaveLength(1);
    expect(record.id).toBe(stored.id);
    expect(record).toMatchObject({ estimateId: ESTIMATE_ID, configVersionId: CONFIG_VERSION_ID, inputsRevision: 4, createdById: PERSON_ID, warnings: [] });
    expect(Object.keys(record.productValues).sort()).toEqual(['pricePerToolCost', 'toolCostTotal', 'totalPrice']);
  });

  it('BL, BN and the Tool Cost total equal the totals of the same estimate calculated on its own', async () => {
    const { service, world, request, customerId } = fixture();
    await service.storeCalculation(request());
    const record = defined(world.calculations[0]);
    const expected = await service.calculateEstimate({ customerId, rows: request().nodes.map((row) => ({ materialId: row.materialId, inputs: row.inputs })) });
    expect(record.productValues.totalPrice).toBe(expected.totals.totalPrice?.toString());
    expect(record.productValues.toolCostTotal).toBe(expected.totals.toolCostTotal?.toString());
    expect(record.productValues.pricePerToolCost).toBe(expected.totals.pricePerToolCost?.toString() ?? null);
    expect(record.productValues.totalPrice).not.toBeNull();
  });

  it('copies every node: Sl. No, position, parent, image and the outputs the row calculation gives', async () => {
    const { service, world, request, masters, customerId } = fixture();
    await service.storeCalculation(request());
    const rows = defined(world.calculations[0]).rows;
    expect(rows.map((row) => [row.nodeId, row.parentId, row.sortIndex, row.slNo, row.imageId])).toEqual([
      [NODE_ONE, null, 0, '1', IMAGE_ID],
      [NODE_TWO, NODE_ONE, 0, '1.1', null],
    ]);
    const expected = storeRowOutputs(await service.calculateRow({ customerId, materialId: MATERIAL_ONE_ID, inputs: typed() }));
    expect(defined(rows[0]).outputs).toEqual(expected);
    // The second row has another material, so its figures differ: each row used its own.
    expect(defined(rows[1]).outputs[idOf('AK')]).not.toBe(expected[idOf('AK')]);
    expect(masters.materials).toHaveLength(3);
  });

  it('keeps the typed values as typed and the RESOLVED words of E, F and G, so a rename later changes nothing (NFR-026)', async () => {
    const { service, world, request } = fixture();
    await service.storeCalculation(request());
    const [first, second] = defined(world.calculations[0]).rows;
    expect(defined(first).inputs).toMatchObject({
      [idOf('J')]: ROW['J'],
      [idOf('H')]: ROW['H'],
      [idOf('E')]: 'Invented plate',
      [idOf('F')]: 'Invented steel',
      [idOf('G')]: GOODS_TEXT,
      [idOf('AJ')]: REMARK_TEXT,
    });
    expect(defined(second).inputs).toMatchObject({ [idOf('E')]: 'Invented bar', [idOf('F')]: 'Invented alloy' });
  });

  it('writes null for F on the hidden "Not applicable" material, which has no Material Considered', async () => {
    const { world, request, masters } = fixture();
    // The in-memory master list holds listed materials only (Material Considered is text there); the hidden row is the one real case of null, so it is served here.
    const hiddenId = '00000000-0000-4000-8000-0ccc00000009';
    const hidden = { id: hiddenId, materialInDrawing: 'Not applicable', materialConsidered: null, pricePerKg: '0', specificGravity: '0', scrapRate: '0' };
    const service = createCalculationService({
      masters: { ...masters, findMaterialForCalculation: (id) => (id === hiddenId ? Promise.resolve(hidden) : masters.findMaterialForCalculation(id)) },
      currentConfiguration: () => Promise.resolve({ id: CONFIG_VERSION_ID, document: seedConfig }),
      storage: { calculations: world.repository, estimates: world.estimates, transactions: world.transactions },
    });
    await service.storeCalculation(request({ nodes: [node({ nodeId: NODE_ONE, materialId: hiddenId })] }));
    const inputs = defined(world.calculations[0]).rows[0]?.inputs;
    expect(inputs?.[idOf('E')]).toBe('Not applicable');
    expect(inputs?.[idOf('F')]).toBeNull();
  });

  it('does not write E or F when the registry has no such field', async () => {
    const document = cloneSeedConfig();
    document.fields = document.fields.filter((field) => field.id !== idOf('E') && field.id !== idOf('F'));
    const { service, world, request } = fixture({ document });
    await service.storeCalculation(request({ nodes: [node({ nodeId: NODE_ONE, texts: {} })] }));
    const inputs = defined(world.calculations[0]?.rows[0]).inputs;
    expect(Object.keys(inputs)).not.toContain(idOf('E'));
    expect(Object.keys(inputs)).not.toContain(idOf('F'));
  });

  it('a first Calculate submits the estimate and links it to the record, under the estimate lock; the revision is untouched', async () => {
    const { service, world, estimate, request } = fixture();
    const stored = await service.storeCalculation(request());
    expect(world.lockCount()).toBe(1);
    expect(estimate()).toMatchObject({ status: 'SUBMITTED', currentCalculationId: stored.id, inputsRevision: 4 });
  });

  it('a later Calculate leaves a submitted estimate submitted', async () => {
    const { service, estimate, request } = fixture({ status: 'SUBMITTED' });
    const stored = await service.storeCalculation(request());
    expect(estimate()).toMatchObject({ status: 'SUBMITTED', currentCalculationId: stored.id });
  });

  it('answers with the record\'s ID and time and no figure at all', async () => {
    const { service, request } = fixture();
    const stored = await service.storeCalculation(request());
    expect(Object.keys(stored).sort()).toEqual(['createdAt', 'id']);
  });

  it('runs in the caller\'s transaction when one is given, and opens none of its own', async () => {
    const { service, world, request } = fixture();
    let opened = 0;
    await world.transactions.run(async (tx) => {
      opened += 1;
      await service.storeCalculation(request(), tx);
    });
    expect(opened).toBe(1);
    expect(world.calculations).toHaveLength(1);
  });

  it('a store inside a caller\'s transaction that later fails leaves nothing behind', async () => {
    const { service, world, estimate, request } = fixture();
    await expect(
      world.transactions.run(async (tx) => {
        await service.storeCalculation(request(), tx);
        throw new Error('A later step failed.');
      }),
    ).rejects.toThrow('A later step failed.');
    expect(world.calculations).toHaveLength(0);
    expect(estimate().status).toBe('DRAFT');
    expect(estimate().currentCalculationId ?? null).toBeNull();
  });
});

describe('AC-1: all or nothing', () => {
  it('a failure after the record and its rows were written (the link to the estimate) leaves no record, no rows and the estimate as it was', async () => {
    const { service, world, estimate, request } = fixture();
    world.failNextLinkWith(new Error('The link failed.'));
    await expect(service.storeCalculation(request())).rejects.toThrow('The link failed.');
    expect(world.calculations).toHaveLength(0);
    expect(estimate()).toMatchObject({ status: 'DRAFT', inputsRevision: 4 });
    expect(estimate().currentCalculationId ?? null).toBeNull();
  });

  const refusals: ReadonlyArray<[string, () => Fixture, (f: Fixture) => StoreCalculationRequest, (error: Error) => void]> = [
    ['an unknown estimate', () => fixture(), (f) => f.request({ estimateId: OTHER_ESTIMATE_ID }), (error) => expect(error).toBeInstanceOf(NotFoundError)],
    ['an approved estimate', () => fixture({ status: 'APPROVED' }), (f) => f.request(), (error) => expect(error).toMatchObject({ code: 'ESTIMATE_APPROVED', httpStatus: 409 })],
    ['an estimate with no customer', () => fixture({ customer: false }), (f) => f.request(), (error) => expect(error).toMatchObject({ code: 'CUSTOMER_NOT_CHOSEN', httpStatus: 409 })],
    ['an estimate that changed since its nodes were read', () => fixture({ revision: 5 }), (f) => f.request({ inputsRevision: 4 }), (error) => expect(error).toMatchObject({ code: 'INPUTS_CHANGED', httpStatus: 409 })],
    [
      'a node whose material is unknown',
      () => fixture(),
      (f) => f.request({ nodes: [node({ nodeId: NODE_ONE }), node({ nodeId: NODE_TWO, materialId: '00000000-0000-4000-8000-0ccc00000099' })] }),
      (error) => expect(error).toBeInstanceOf(NotFoundError),
    ],
    [
      'a typed value that is not a number, named with its node',
      () => fixture(),
      (f) => f.request({ nodes: [node({ nodeId: NODE_ONE }), node({ nodeId: NODE_TWO, inputs: { ...typed(), [idOf('J')]: 'abc' } })] }),
      (error) => expect(error).toMatchObject({ fields: [{ field: `nodes[1].inputs.${idOf('J')}` }] }),
    ],
  ];

  it.each(refusals)('%s is refused before anything is written, and the estimate is as it was', async (_name, build, requestOf, check) => {
    const fixtureUnderTest = build();
    const before = { ...fixtureUnderTest.estimate() };
    const failure = await thrownRejection(fixtureUnderTest.service.storeCalculation(requestOf(fixtureUnderTest)));
    check(failure);
    expect(fixtureUnderTest.world.calculations).toHaveLength(0);
    expect(fixtureUnderTest.estimate()).toEqual(before);
  });

  it('the 409 words name no figure, no rate and no price', async () => {
    const { service, request } = fixture({ status: 'APPROVED' });
    const failure = await thrownRejection(service.storeCalculation(request()));
    expect(failure).toBeInstanceOf(ConflictError);
    expect(failure.message).not.toMatch(/\d/);
  });
});

describe('the request is checked before anything is read or written (a record can never be changed afterwards)', () => {
  const invalid: ReadonlyArray<[string, (f: Fixture) => StoreCalculationRequest, string]> = [
    ['an estimate ID that is not a UUID', (f) => f.request({ estimateId: 'not-an-id' }), 'estimateId'],
    ['a person ID that is not a UUID', (f) => f.request({ createdById: 'not-an-id' }), 'createdById'],
    ['a negative revision', (f) => f.request({ inputsRevision: -1 }), 'inputsRevision'],
    ['a node ID that is not a UUID', (f) => f.request({ nodes: [node({ nodeId: 'not-an-id' })] }), 'nodes[0].nodeId'],
    ['a parent ID that is not a UUID', (f) => f.request({ nodes: [node({ nodeId: NODE_ONE, parentId: 'x' })] }), 'nodes[0].parentId'],
    ['a negative sort index', (f) => f.request({ nodes: [node({ nodeId: NODE_ONE, sortIndex: -1 })] }), 'nodes[0].sortIndex'],
    ['a blank Sl. No', (f) => f.request({ nodes: [node({ nodeId: NODE_ONE, slNo: '  ' })] }), 'nodes[0].slNo'],
    ['an over-long Sl. No', (f) => f.request({ nodes: [node({ nodeId: NODE_ONE, slNo: '1'.repeat(101) })] }), 'nodes[0].slNo'],
    ['two nodes with one ID', (f) => f.request({ nodes: [node({ nodeId: NODE_ONE }), node({ nodeId: NODE_THREE }), node({ nodeId: NODE_ONE })] }), 'nodes[2].nodeId'],
    ['a text that is too long', (f) => f.request({ nodes: [node({ nodeId: NODE_ONE, texts: { [idOf('AJ')]: 'x'.repeat(5001) } })] }), `nodes[0].texts.${idOf('AJ')}`],
  ];

  it.each(invalid)('%s is a 422 under its field, and nothing is stored', async (_name, requestOf, field) => {
    const f = fixture();
    const failure = await thrownRejection(f.service.storeCalculation(requestOf(f)));
    expect(failure).toBeInstanceOf(FieldValidationError);
    expect(failure).toMatchObject({ fields: expect.arrayContaining([expect.objectContaining({ field })]) });
    expect(f.world.calculations).toHaveLength(0);
    expect(f.world.lockCount()).toBe(0);
  });

  it('a key that is not part of the request is refused, not stored', async () => {
    const f = fixture();
    const extra = { ...f.request(), nodes: [{ ...node({ nodeId: NODE_ONE }), approved: true }] };
    expect(await thrownRejection(f.service.storeCalculation(extra))).toBeInstanceOf(FieldValidationError);
    expect(f.world.calculations).toHaveLength(0);
  });

  it.each([
    ['a number field', 'J'],
    ['a flag', 'Z'],
    ['an output', 'BG'],
    ['Material Considered (the service writes it)', 'F'],
    ['Material in Drawing (the service writes it)', 'E'],
    ['the picture', 'C'],
  ])('words given for %s are refused under that field', async (_name, letter) => {
    const f = fixture();
    const failure = await thrownRejection(f.service.storeCalculation(f.request({ nodes: [node({ nodeId: NODE_ONE, texts: { [idOf(letter)]: 'x' } })] })));
    expect(failure).toMatchObject({ fields: [{ field: `nodes[0].texts.${idOf(letter)}` }] });
    expect(f.world.calculations).toHaveLength(0);
  });

  it('words for a field the registry does not have are refused', async () => {
    const f = fixture();
    const failure = await thrownRejection(f.service.storeCalculation(f.request({ nodes: [node({ nodeId: NODE_ONE, texts: { '00000000-0000-4000-8000-0eee00000001': 'x' } })] })));
    expect(failure).toBeInstanceOf(FieldValidationError);
  });
});

describe('the master snapshot holds what the calculation used, with the names then', () => {
  it('has the customer, every rate of that customer, only the materials used (once each, in order of use) and both exchange rates', async () => {
    const { service, world, request, customerId } = fixture();
    await service.storeCalculation(
      request({ nodes: [node({ nodeId: NODE_ONE }), node({ nodeId: NODE_TWO, materialId: MATERIAL_TWO_ID }), node({ nodeId: NODE_THREE, materialId: MATERIAL_ONE_ID })] }),
    );
    const snapshot = defined(world.calculations[0]).masterSnapshot;
    expect(snapshot.customer).toEqual({ id: customerId, name: 'Invented customer' });
    expect(snapshot.rates).toHaveLength(SEED_PROCESS_ITEMS.length);
    const cutting = defined(SEED_PROCESS_ITEMS.find((item) => item.name === 'Cutting-Rate-per-Sec'));
    expect(snapshot.rates.find((rate) => rate.id === cutting.id)).toEqual({ id: cutting.id, name: cutting.name, value: TYPED_RATES['Cutting-Rate-per-Sec'] });
    expect(snapshot.materials.map((material) => material.id)).toEqual([MATERIAL_ONE_ID, MATERIAL_TWO_ID]);
    expect(snapshot.materials[1]).toEqual({
      id: MATERIAL_TWO_ID,
      materialInDrawing: 'Invented bar',
      materialConsidered: 'Invented alloy',
      pricePerKg: '90.50',
      specificGravity: '2.70',
      scrapRate: '40',
    });
    expect(snapshot.exchangeRates).toEqual({ usd: '80.00', eur: '90.00' });
  });

  it('records a rate that was never set as null, not as 0', async () => {
    const { service, world, request, masters } = fixture();
    masters.exchange.eur = null;
    await service.storeCalculation(request());
    expect(defined(world.calculations[0]).masterSnapshot.exchangeRates).toEqual({ usd: '80.00', eur: null });
  });
});

describe('AC-2: a stored calculation does not follow the masters', () => {
  it('a changed rate, price, scrap rate, exchange rate and a renamed material change nothing that was stored', async () => {
    const { service, world, request, masters } = fixture();
    const stored = await service.storeCalculation(request());
    const before = structuredClone(await world.repository.findCalculation(stored.id));

    const customer = defined(masters.customers[0]);
    for (const key of customer.values.keys()) customer.values.set(key, '99');
    const material = defined(masters.materials.find((candidate) => candidate.id === MATERIAL_ONE_ID));
    material.pricePerKg = '500';
    material.scrapRate = '77';
    material.materialInDrawing = 'Invented plate, renamed';
    masters.exchange.usd = '1.00';

    expect(await world.repository.findCalculation(stored.id)).toEqual(before);
    // The next Calculate uses the new values and the old record stays: history.
    await service.storeCalculation(request());
    expect(await world.repository.findCalculation(stored.id)).toEqual(before);
    const [first, second] = world.calculations;
    expect(defined(second).masterSnapshot.exchangeRates.usd).toBe('1.00');
    expect(defined(first).masterSnapshot.exchangeRates.usd).toBe('80.00');
    expect(defined(second).rows[0]?.inputs[idOf('E')]).toBe('Invented plate, renamed');
    expect(defined(first).rows[0]?.inputs[idOf('E')]).toBe('Invented plate');
  });
});

describe('AC-5: every press writes a new record', () => {
  it('a repeated Calculate with nothing changed adds a second record, the estimate points at the newest, and warnings stay empty', async () => {
    const { service, world, estimate, request } = fixture();
    const first = await service.storeCalculation(request());
    const second = await service.storeCalculation(request());
    expect(first.id).not.toBe(second.id);
    expect(world.calculations.map((record) => record.id)).toEqual([first.id, second.id]);
    expect(world.calculations.map((record) => record.warnings)).toEqual([[], []]);
    expect(estimate().currentCalculationId).toBe(second.id);
    expect(defined(world.calculations[0]).productValues).toEqual(defined(world.calculations[1]).productValues);
  });
});

describe('a service built without storage', () => {
  it('still calculates, and refuses to store with a plain Error (a programming fault, never a 4xx)', async () => {
    const { masters, request } = fixture();
    const service = createCalculationService({ masters, currentConfiguration: () => Promise.resolve({ id: CONFIG_VERSION_ID, document: seedConfig }) });
    const failure = await thrownRejection(service.storeCalculation(request()));
    expect(failure).not.toBeInstanceOf(ConflictError);
    expect(failure.message).toBe('This calculation service was built without storage.');
  });
});
