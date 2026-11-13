import { describe, expect, it } from 'vitest';

import { FieldValidationError, NotFoundError } from '@/lib/errors';
import { displayStoredValue, storeRowOutputs, type StoredRowOutputs } from '@/lib/estimate/row-outputs';
import { compilePlan, createPlanCache } from '@/lib/formula';
import { createCalculationService, type CalculationService, type RowCalculationRequest } from '@/server/services/calculation-service';

import { defined } from '../support/defined';
import { createFakeMasterRepository, seedRecords, type FakeMasterRepository } from '../support/fake-masters';
import { fakeCustomer } from '../support/fake-customers';
import { MATERIAL, NOT_APPLICABLE, ROW, TYPED_RATES, WORKED_2DP } from '../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * STORY-03.03 (FR-024, FR-028; architecture section 4.2): the calculation service reads the customer's rates, the material and the exchange
 * rates, and returns one row's outputs. Over the in-memory master repository, so the reading is the real code and the storage is a fake; the
 * same row is calculated against PostgreSQL in `tests/integration/calc/row-outputs.test.ts`. Invented numbers only (ADR-014).
 */

const VERSION = { id: '00000000-0000-4000-8000-0aaa00000001', document: seedConfig };
const idOf = (letter: string): string => seedFieldAt(letter).id;

/** The typed values of the invented row, by field ID, as the request carries them. */
function typed(row: Readonly<Record<string, string>> = ROW): Record<string, string> {
  return Object.fromEntries(Object.entries(row).map(([letter, text]) => [idOf(letter), text]));
}

interface Fixture {
  readonly masters: FakeMasterRepository;
  readonly service: CalculationService;
  readonly customerId: string;
  readonly materialId: string;
  readonly request: RowCalculationRequest;
}

/** A customer whose rates are the invented ones (the Process Master defaults stay 0.00, so a default read instead of a rate shows), a material and exchange rates. */
function fixture(options: { exchange?: boolean; material?: typeof MATERIAL | typeof NOT_APPLICABLE } = {}): Fixture {
  const masters = createFakeMasterRepository(seedRecords());
  const rates = Object.fromEntries(SEED_PROCESS_ITEMS.map((item) => [item.id, defined(TYPED_RATES[item.name], item.name)]));
  const customer = fakeCustomer(masters.records, 'Invented customer', rates);
  masters.customers.push(customer);
  const material = { id: '00000000-0000-4000-8000-0ccc00000001', materialInDrawing: 'Invented plate', materialConsidered: 'Invented steel', ...(options.material ?? MATERIAL) };
  masters.materials.push(material);
  if (options.exchange !== false) {
    masters.exchange.usd = '80.00';
    masters.exchange.eur = '90.00';
  }
  const service = createCalculationService({ masters, currentConfiguration: () => Promise.resolve(VERSION) });
  return { masters, service, customerId: customer.id, materialId: material.id, request: { customerId: customer.id, materialId: material.id, inputs: typed() } };
}

const storedAt = (outputs: StoredRowOutputs, letter: string): string | null => {
  const value = outputs[idOf(letter)];
  if (value === undefined) throw new Error(`The row has no output for ${letter}.`);
  return value;
};

describe('calculateRow reads the masters and works out the row (AC-1, AC-2)', () => {
  it.each(WORKED_2DP)('%s is %s, from the customer\'s rates, the material and the exchange rates', async (letter, expected) => {
    const { service, request } = fixture();
    const outputs = storeRowOutputs(await service.calculateRow(request));
    expect(displayStoredValue(storedAt(outputs, letter))).toBe(expected);
  });

  it('uses the customer\'s rate, not the Process Master default, and takes a percent rate as a fraction', async () => {
    const { service, request, masters } = fixture();
    expect(masters.records.every((record) => record.defaultValue === '0.00')).toBe(true);
    const outputs = storeRowOutputs(await service.calculateRow(request));
    // BD = BB x 12 / 100
    expect(displayStoredValue(storedAt(outputs, 'BD'))).toBe('45.33');
  });

  it('a second customer with other rates gets other figures from the same row (the rates are the customer\'s)', async () => {
    const { service, request, masters } = fixture();
    const ids = SEED_PROCESS_ITEMS.map((item) => item.id);
    const cheaper = fakeCustomer(masters.records, 'Invented cheaper customer', Object.fromEntries(ids.map((id) => [id, '1'])));
    masters.customers.push(cheaper);
    const first = storeRowOutputs(await service.calculateRow(request));
    const second = storeRowOutputs(await service.calculateRow({ ...request, customerId: cheaper.id }));
    expect(storedAt(second, 'AL')).toBe('10');
    expect(storedAt(second, 'AL')).not.toBe(storedAt(first, 'AL'));
  });

  it('calculates a row of the hidden "Not applicable" material: O and AK are 0 (AC-5)', async () => {
    const { service, request } = fixture({ material: NOT_APPLICABLE });
    const outputs = storeRowOutputs(await service.calculateRow(request));
    expect(storedAt(outputs, 'O')).toBe('0');
    expect(storedAt(outputs, 'AK')).toBe('0');
  });

  it('leaves BJ and BK without a figure while the Admin has never saved an exchange rate (AC-3), and works out the rest', async () => {
    const { service, request } = fixture({ exchange: false });
    const outputs = storeRowOutputs(await service.calculateRow(request));
    expect(outputs[idOf('BJ')]).toBeNull();
    expect(outputs[idOf('BK')]).toBeNull();
    expect(displayStoredValue(storedAt(outputs, 'BG'))).toBe('451.40');
  });
});

describe('calculateRow refuses what it cannot calculate', () => {
  it('an unknown customer, an unknown material and an ID that is not a UUID are each not found, in the same words', async () => {
    const { service, request } = fixture();
    const unknownCustomer = await thrownRejection(service.calculateRow({ ...request, customerId: '00000000-0000-4000-8000-0ddd00000009' }));
    const unknownMaterial = await thrownRejection(service.calculateRow({ ...request, materialId: '00000000-0000-4000-8000-0ddd00000009' }));
    const notAnId = await thrownRejection(service.calculateRow({ ...request, materialId: 'not-an-id' }));
    expect(unknownCustomer).toBeInstanceOf(NotFoundError);
    expect(unknownMaterial).toBeInstanceOf(NotFoundError);
    expect(notAnId).toBeInstanceOf(NotFoundError);
    expect(unknownCustomer.message).not.toBe('');
    expect(unknownMaterial.message).toBe(notAnId.message);
  });

  it.each([['1e3'], ['-1'], ['+1'], ['1,000'], ['abc'], [''], [' 1'], ['1.'], ['.5'], ['0x10']])('a typed value of %j is refused', async (text) => {
    const { service, request } = fixture();
    const failure = await thrownRejection(service.calculateRow({ ...request, inputs: { ...request.inputs, [idOf('J')]: text } }));
    expect(failure).toBeInstanceOf(FieldValidationError);
    expect(failure).toMatchObject({ fields: [{ field: idOf('J'), message: expect.any(String) }] });
  });

  it('a value for a field that is not a number or flag input (an output, the material rate, text, an unknown ID) is refused', async () => {
    const { service, request } = fixture();
    for (const fieldId of [idOf('BG'), idOf('I'), idOf('B'), idOf('F'), '00000000-0000-4000-8000-0eee00000001', '__proto__']) {
      const failure = await thrownRejection(service.calculateRow({ ...request, inputs: { [fieldId]: '1' } }));
      expect(failure, fieldId).toBeInstanceOf(FieldValidationError);
    }
  });

  it('accepts a plain decimal of any length, and a row with no typed value at all (every value counts as 0)', async () => {
    const { service, request } = fixture();
    const long = storeRowOutputs(await service.calculateRow({ ...request, inputs: { [idOf('J')]: '200.123456789', [idOf('K')]: '100' } }));
    expect(storedAt(long, 'AH')).not.toBe('0');
    const empty = storeRowOutputs(await service.calculateRow({ ...request, inputs: {} }));
    expect(storedAt(empty, 'BG')).toBe('0');
  });
});

describe('the compiled plan is built once per configuration version (architecture section 4.2)', () => {
  it('compiles on the first row and reuses the plan for the next, and reads the configuration for each', async () => {
    const { masters, request } = fixture();
    let compiles = 0;
    const plans = createPlanCache((fields) => {
      compiles += 1;
      return compilePlan(fields);
    });
    let reads = 0;
    const service = createCalculationService({
      masters,
      plans,
      currentConfiguration: () => {
        reads += 1;
        return Promise.resolve(VERSION);
      },
    });
    await service.calculateRow(request);
    await service.calculateRow(request);
    expect(compiles).toBe(1);
    expect(reads).toBe(2);
  });
});

describe('calculateEstimate: every row, then the product totals (STORY-03.04; architecture section 4.2)', () => {
  const rowsOf = (request: RowCalculationRequest, count: number) => Array.from({ length: count }, () => ({ materialId: request.materialId, inputs: request.inputs }));

  it('works out each row as calculateRow does, and BL as the plain sum of BG over the rows', async () => {
    const { service, request } = fixture();
    const single = storeRowOutputs(await service.calculateRow(request));
    const estimate = await service.calculateEstimate({ customerId: request.customerId, rows: rowsOf(request, 3) });
    expect(estimate.rows).toHaveLength(3);
    for (const row of estimate.rows) expect(storeRowOutputs(row)).toEqual(single);
    // BG = 451.398096..., so three rows total 1354.194288 and 1354.19 at 2 decimals
    expect(estimate.totals.totalPrice?.toFixed(2)).toBe('1354.19');
    expect(estimate.totals.approvedPrice).toBeNull();
  });

  it('reads the Tool Cost (BM) typed on the rows: the total is as typed and BN is BL over it', async () => {
    const { service, request } = fixture();
    const withTool = (text: string) => ({ materialId: request.materialId, inputs: { ...request.inputs, [idOf('BM')]: text } });
    const estimate = await service.calculateEstimate({ customerId: request.customerId, rows: [withTool('2'), withTool('3')] });
    expect(estimate.totals.toolCostTotal?.toString()).toBe('5');
    // BL = 2 x 451.398096 = 902.796192, and BN = BL / 5 = 180.5592384
    expect(estimate.totals.pricePerToolCost?.toFixed(2)).toBe('180.56');
  });

  it('an estimate with no rows totals 0 and has no BN', async () => {
    const { service, request } = fixture();
    const estimate = await service.calculateEstimate({ customerId: request.customerId, rows: [] });
    expect(estimate.rows).toEqual([]);
    expect(estimate.totals.totalPrice?.toString()).toBe('0');
    expect(estimate.totals.pricePerToolCost).toBeNull();
  });

  it('a row of the hidden "Not applicable" material and a row of a real material can sit in one estimate', async () => {
    const { service, request, masters } = fixture();
    masters.materials.push({ id: '00000000-0000-4000-8000-0ccc00000002', materialInDrawing: 'Invented n/a', materialConsidered: 'Invented', ...NOT_APPLICABLE });
    const estimate = await service.calculateEstimate({
      customerId: request.customerId,
      rows: [
        { materialId: request.materialId, inputs: request.inputs },
        { materialId: '00000000-0000-4000-8000-0ccc00000002', inputs: request.inputs },
      ],
    });
    const [first, second] = estimate.rows.map((row) => storeRowOutputs(row));
    expect(storedAt(defined(first), 'AK')).toBe('15.99');
    expect(storedAt(defined(second), 'AK')).toBe('0');
  });

  it('refuses an unknown customer or material, and a typed value that is not a number, naming the row', async () => {
    const { service, request } = fixture();
    const good = { materialId: request.materialId, inputs: request.inputs };
    expect(await thrownRejection(service.calculateEstimate({ customerId: '00000000-0000-4000-8000-0ddd00000009', rows: [good] }))).toBeInstanceOf(NotFoundError);
    expect(await thrownRejection(service.calculateEstimate({ customerId: request.customerId, rows: [good, { ...good, materialId: 'not-an-id' }] }))).toBeInstanceOf(NotFoundError);
    const failure = await thrownRejection(service.calculateEstimate({ customerId: request.customerId, rows: [good, { ...good, inputs: { [idOf('J')]: 'x' } }] }));
    expect(failure).toMatchObject({ fields: [{ field: `rows[1].${idOf('J')}`, message: expect.any(String) }] });
  });
});

async function thrownRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('Expected an Error to be thrown.', { cause: error });
  }
  throw new Error('Expected the call to be refused, but it was not.');
}
