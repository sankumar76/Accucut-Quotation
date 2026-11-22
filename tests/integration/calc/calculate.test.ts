import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CalculateBlockedError, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import type { EstimateViewer } from '@/server/services/estimate-service';

import { completePartInputs } from '../../support/complete-part';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';

/**
 * STORY-05.09 (AC-1 to AC-7; FR-055, FR-056, FR-031; NFR-002; architecture sections 4.2 and 6 "Calculate") against real PostgreSQL in a throwaway database: the Engineer's Calculate runs in ONE
 * transaction under the estimate's row lock, with the masters and the configuration read inside it. It writes the record, the status and the link together or not at all; a blocked Calculate, a
 * refusal and a failure part-way write nothing; a second press and two at once are one calculation; and ten or more Calculates at once, on the ruled pool of 10 connections, all go through, which
 * is the regression test of GitHub issue 382 (AQP-293 SQR-01: a read on a second connection while holding the estimate's lock exhausted the pool). Every name and number is invented.
 */

let db: CalculationDatabase;

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

const engineer = (): EstimateViewer => ({ id: db.engineerId, role: 'ENGINEER' });

interface EstimateState {
  readonly status: string;
  readonly current_calculation_id: string | null;
  readonly inputs_revision: number;
}

async function stateOf(estimateId: string): Promise<EstimateState> {
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

/** Nothing was written: no record, no row, the status as it was and no link. */
async function expectNothingWritten(estimateId: string, status = 'DRAFT'): Promise<void> {
  expect(await countFor(estimateId)).toEqual({ calculations: 0, rows: 0 });
  expect(await stateOf(estimateId)).toMatchObject({ status, current_calculation_id: null, inputs_revision: 3 });
}

async function failure(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error('Expected an Error to be thrown.', { cause: error });
  }
  throw new Error('Expected the call to be refused, but it was not.');
}

describe('AC-2: a complete estimate is calculated, stored and submitted in one transaction', () => {
  it('answers {status, message}, stores a record with a row per part, submits the estimate, links it and leaves the input revision', async () => {
    const estimateId = await db.addCompleteEstimate({ parts: 2 });
    const answer = await db.service.calculate(engineer(), estimateId);
    expect(answer).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });

    const state = await stateOf(estimateId);
    expect(state).toMatchObject({ status: 'SUBMITTED', inputs_revision: 3 });
    expect(await countFor(estimateId)).toEqual({ calculations: 1, rows: 2 });
    const header = await db.owner.query('SELECT id::text, created_by::text, inputs_revision, config_version_id::text FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
    expect(header.rows).toEqual([{ id: state.current_calculation_id, created_by: db.engineerId, inputs_revision: 3, config_version_id: db.configVersionId }]);
    const rows = await db.owner.query('SELECT sl_no, parent_id IS NULL AS top FROM calculation_rows WHERE calculation_id = $1::uuid ORDER BY sl_no', [state.current_calculation_id]);
    expect(rows.rows).toEqual([
      { sl_no: '1', top: true },
      { sl_no: '1.1', top: false },
    ]);
  });

  it('keeps what the calculation used: the material\'s words, the default of Fasteners, and Fasteners Qty and Cost as 0 because they are hidden', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    await db.addPart(estimateId, { inputs: { ...completePartInputs(), [idOf('E')]: db.materialOneId, [idOf('T')]: '50.00', [idOf('U')]: '70.00' } });
    await db.service.calculate(engineer(), estimateId);
    const { rows } = await db.owner.query<{ inputs: Record<string, string> }>(
      'SELECT r.inputs FROM calculation_rows r JOIN calculations c ON c.id = r.calculation_id WHERE c.estimate_id = $1::uuid',
      [estimateId],
    );
    const inputs = defined(rows[0]).inputs;
    expect(inputs[idOf('E')]).toBe('Invented plate');
    expect(inputs[idOf('F')]).toBe('Invented steel');
    expect(inputs[idOf('S')]).toBe('None');
    expect(inputs[idOf('T')]).toBe('0.00');
    expect(inputs[idOf('U')]).toBe('0.00');
  });

  it('two sets of masters give the same answer, and each record holds its own figures', async () => {
    const first = await db.addCompleteEstimate();
    const one = await db.service.calculate(engineer(), first);
    await db.owner.query('UPDATE materials SET price_per_kg = price_per_kg * 7 WHERE id = $1::uuid', [db.materialOneId]);
    const second = await db.addCompleteEstimate();
    const two = await db.service.calculate(engineer(), second);
    await db.owner.query('UPDATE materials SET price_per_kg = price_per_kg / 7 WHERE id = $1::uuid', [db.materialOneId]);
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
    const totals = await db.owner.query<{ total: string }>(
      `SELECT product_values->>'totalPrice' AS total FROM calculations WHERE estimate_id = ANY($1::uuid[]) ORDER BY created_at`,
      [[first, second]],
    );
    expect(totals.rows[0]?.total).not.toBe(totals.rows[1]?.total);
  });
});

describe('AC-1 and AC-5: a blank input blocks, names the parts and fields, and writes nothing', () => {
  it('lists the part and the field, and the estimate stays a draft with no record', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    const inputs = Object.fromEntries(Object.entries({ ...completePartInputs(), [idOf('E')]: db.materialOneId }).filter(([fieldId]) => fieldId !== idOf('P')));
    const partId = await db.addPart(estimateId, { inputs });
    const error = await failure(db.service.calculate(engineer(), estimateId));
    expect(error).toBeInstanceOf(CalculateBlockedError);
    expect((error as CalculateBlockedError).parts).toEqual([{ nodeId: partId, slNo: '1', name: 'Invented text', fields: [{ fieldId: idOf('P'), label: 'Cutting Time' }] }]);
    await expectNothingWritten(estimateId);
  });

  it('a blank beside a 0 in QTY per Assy is the 422 and never anything about the quantity', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    const inputs = { ...completePartInputs(), [idOf('E')]: db.materialOneId, [idOf('H')]: '0', [idOf('J')]: '' };
    await db.addPart(estimateId, { inputs });
    expect(await failure(db.service.calculate(engineer(), estimateId))).toBeInstanceOf(CalculateBlockedError);
    await expectNothingWritten(estimateId);
  });
});

describe('AC-4: what cannot be calculated is a named 409 or a 404, and nothing is written', () => {
  it.each([
    ['no customer chosen', { withCustomer: false }, 'CUSTOMER_NOT_CHOSEN', 'DRAFT'],
    ['already submitted', { status: 'SUBMITTED' as const }, 'ESTIMATE_ALREADY_SUBMITTED', 'SUBMITTED'],
    ['approved', { status: 'APPROVED' as const }, 'ESTIMATE_APPROVED_IS_LOCKED', 'APPROVED'],
  ])('%s is a 409 with the code %s', async (_name, options, code, status) => {
    const estimateId = await db.addEstimate({ engineer: true, ...options });
    await db.addPart(estimateId, { inputs: { ...completePartInputs(), [idOf('E')]: db.materialOneId } });
    const error = await failure(db.service.calculate(engineer(), estimateId));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code, httpStatus: 409 });
    await expectNothingWritten(estimateId, status);
  });

  it('another Engineer\'s estimate and an ID that is none are a 404, and a Lead is refused 403', async () => {
    const estimateId = await db.addCompleteEstimate();
    expect(await failure(db.service.calculate({ id: db.otherEngineerId, role: 'ENGINEER' }, estimateId))).toBeInstanceOf(NotFoundError);
    expect(await failure(db.service.calculate(engineer(), '00000000-0000-4000-8000-00000000dead'))).toBeInstanceOf(NotFoundError);
    expect(await failure(db.service.calculate(engineer(), 'not-an-id'))).toBeInstanceOf(NotFoundError);
    expect(await failure(db.service.calculate({ id: db.personId, role: 'LEAD' }, estimateId))).toBeInstanceOf(ForbiddenError);
    await expectNothingWritten(estimateId);
  });

  it('an estimate with no part is the 409 NO_PARTS', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    expect(await failure(db.service.calculate(engineer(), estimateId))).toMatchObject({ code: 'NO_PARTS', httpStatus: 409 });
    await expectNothingWritten(estimateId);
  });

  it('a customer deleted after it was chosen is the 409 CUSTOMER_DELETED, not a 404 (STORY-02.07)', async () => {
    const { rows } = await db.owner.query<{ id: string }>("INSERT INTO customers (name, short_name, deleted_at) VALUES ('Invented deleted customer', left(md5('Invented deleted customer'), 10), now()) RETURNING id::text");
    const estimateId = await db.addCompleteEstimate();
    await db.owner.query('UPDATE estimates SET customer_id = $2::uuid WHERE id = $1::uuid', [estimateId, defined(rows[0]).id]);
    expect(await failure(db.service.calculate(engineer(), estimateId))).toMatchObject({ code: 'CUSTOMER_DELETED', httpStatus: 409 });
    await expectNothingWritten(estimateId);
  });

  it('a material deleted after a part chose it is the 409 MATERIAL_DELETED, not a 404', async () => {
    const { rows } = await db.owner.query<{ id: string }>(
      `INSERT INTO materials (material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate, deleted_at)
       VALUES ('Invented deleted plate', 'Invented gone', 1.37, 2.37, 3.37, now()) RETURNING id::text`,
    );
    const estimateId = await db.addEstimate({ engineer: true });
    await db.addPart(estimateId, { inputs: { ...completePartInputs(), [idOf('E')]: defined(rows[0]).id } });
    expect(await failure(db.service.calculate(engineer(), estimateId))).toMatchObject({ code: 'MATERIAL_DELETED', httpStatus: 409 });
    await expectNothingWritten(estimateId);
  });

  it('a failure after the record and its rows were written (the link) puts everything back, the status included: the estimate is still a draft', async () => {
    const estimateId = await db.addCompleteEstimate({ parts: 3 });
    const service = db.buildService({ estimates: { ...db.estimates, linkCalculation: () => Promise.reject(new Error('The link failed.')) } });
    await expect(service.calculate(engineer(), estimateId)).rejects.toThrow('The link failed.');
    await expectNothingWritten(estimateId);
  });
});

describe('AC-7: a second press is a 409 and makes no second calculation', () => {
  it('the second call is ESTIMATE_ALREADY_SUBMITTED, and there is one record', async () => {
    const estimateId = await db.addCompleteEstimate();
    await db.service.calculate(engineer(), estimateId);
    expect(await failure(db.service.calculate(engineer(), estimateId))).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED', httpStatus: 409 });
    expect((await countFor(estimateId)).calculations).toBe(1);
  });

  it('two presses at once: the row lock queues them, one goes through and the other is the 409, and there is one record', async () => {
    const estimateId = await db.addCompleteEstimate({ parts: 2 });
    const results = await Promise.allSettled([db.service.calculate(engineer(), estimateId), db.service.calculate(engineer(), estimateId)]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toMatchObject({ code: 'ESTIMATE_ALREADY_SUBMITTED' });
    expect(await countFor(estimateId)).toEqual({ calculations: 1, rows: 2 });
  });
});

describe('GitHub issue 382 (AQP-293 SQR-01): Calculate holds one connection, so many at once all go through on the ruled pool', () => {
  // The app pool holds 10 connections. A Calculate that read a master on a second connection while it held the estimate's lock needed two, so 10 or more at once each held one and waited
  // for another until all failed after 5 s with 503. In one transaction each needs one, so 12 at once queue and all succeed.
  it('twelve Calculates at once, on twelve estimates, all succeed and each stores one record', async () => {
    const estimates = await Promise.all(Array.from({ length: 12 }, () => db.addCompleteEstimate({ parts: 2 })));
    const results = await Promise.allSettled(estimates.map((estimateId) => db.service.calculate(engineer(), estimateId)));
    expect(results.map((result) => result.status)).toEqual(Array.from({ length: 12 }, () => 'fulfilled'));
    for (const estimateId of estimates) expect(await countFor(estimateId)).toEqual({ calculations: 1, rows: 2 });
  }, 60_000);
});
