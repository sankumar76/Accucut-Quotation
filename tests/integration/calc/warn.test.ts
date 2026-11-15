import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

import { CalculateAckRequiredError, CalculateBlockedError, ConflictError } from '@/lib/errors';
import { CALCULATE_MESSAGE } from '@/lib/estimate/calculate-words';
import { findFieldById } from '@/lib/fields/registry';
import { AuditEntryRefusedError } from '@/server/services/audit-secrets';
import type { CalculateOptions } from '@/server/services/calculation-service';
import type { EstimateViewer } from '@/server/services/estimate-service';

import { entriesFor } from '../../support/audit-database';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs, fieldIdOf } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { SEED_PROCESS_ITEMS, seedConfig } from '../../support/seed-config';
import { QUANTITY_CASES, type QuantityCase } from '../../unit/quantity/quantity-cases';

/**
 * STORY-05.12 (AC-2 to AC-5, AC-8; FR-104; NFR-002; architecture sections 4.3 and 8; test strategy section 5.2 CE-9 "Integration") against real PostgreSQL in a throwaway database: a 0 in QTY per Assy earns a
 * first press the 409 `CALCULATE_ACK_REQUIRED` and **writes nothing**; the press that carries the revision calculates, stores the warnings on the calculation and writes one
 * `calculation.warning_acknowledged` audit entry in the same transaction; an acknowledgement for an older state of the estimate, including one that races an input save under the estimate's row lock, never
 * passes; an `acknowledge` with nothing to warn is ignored; and the seven CE-9 trees give their BL and BG with the warning acknowledged. Every name and number is invented.
 */

let db: CalculationDatabase;

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

const engineer = (): EstimateViewer => ({ id: db.engineerId, role: 'ENGINEER' });
const QTY = (): string => idOf('H');
const AUDIT = (): NonNullable<CalculateOptions['audit']> => ({ actorId: db.engineerId, actorLabel: 'Calculation Engineer', requestId: 'req-0badc0de' });
const acknowledge = (inputsRevision: number): CalculateOptions => ({ acknowledge: { inputsRevision }, audit: AUDIT() });

/** A DRAFT of the Engineer's with the customer chosen, an item (1) holding a count and a part (1.1) and sub-part (1.1.1) with a 0 in QTY per Assy. Returns the estimate, the part and the sub-part. */
async function addWarnedEstimate(): Promise<{ readonly estimateId: string; readonly part: string; readonly sub: string }> {
  const estimateId = await db.addEstimate({ engineer: true });
  const base = { ...completePartInputs(), [idOf('E')]: db.materialOneId };
  const item = await db.addPart(estimateId, { parentId: null, sortIndex: 0, inputs: base });
  const part = await db.addPart(estimateId, { parentId: item, sortIndex: 0, inputs: { ...base, [QTY()]: '0', [fieldIdOf('description')]: 'Invented top cover' } });
  const sub = await db.addPart(estimateId, { parentId: part, sortIndex: 0, inputs: { ...base, [QTY()]: '0.00', [fieldIdOf('description')]: 'Invented lid' } });
  return { estimateId, part, sub };
}

interface EstimateState {
  readonly status: string;
  readonly current_calculation_id: string | null;
  readonly inputs_revision: number;
}

async function stateOf(estimateId: string): Promise<EstimateState> {
  const { rows } = await db.owner.query<EstimateState>('SELECT status::text, current_calculation_id::text, inputs_revision FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(rows[0]);
}

async function calculationCount(estimateId: string): Promise<number> {
  const { rows } = await db.owner.query<{ count: string }>('SELECT count(*) FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
  return Number(defined(rows[0]).count);
}

async function askedToConfirm(promise: Promise<unknown>): Promise<CalculateAckRequiredError> {
  const failure = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  if (!(failure instanceof CalculateAckRequiredError)) throw new Error('Expected the 409 CALCULATE_ACK_REQUIRED.', { cause: failure });
  return failure;
}

/** Nothing was written for this estimate: no calculation, no audit entry, a draft, and the revision as given. */
async function expectNothingWritten(estimateId: string, revision: number): Promise<void> {
  expect(await calculationCount(estimateId)).toBe(0);
  expect(await entriesFor(db, estimateId)).toEqual([]);
  expect(await stateOf(estimateId)).toEqual({ status: 'DRAFT', current_calculation_id: null, inputs_revision: revision });
}

describe('AC-2: a first press with a warning due is the 409, and writes nothing', () => {
  it('lists each row with a 0, in reading order, with the revision, and leaves no calculation, no audit entry, the status and the revision as they were', async () => {
    const { estimateId, part, sub } = await addWarnedEstimate();
    const failure = await askedToConfirm(db.service.calculate(engineer(), estimateId));
    expect(failure).toMatchObject({ code: 'CALCULATE_ACK_REQUIRED', httpStatus: 409, inputsRevision: 3, quantityFieldId: QTY() });
    expect(failure.warnings).toEqual([
      { code: 'QTY_ZERO', nodeId: part, slNo: '1.1', label: 'Invented top cover' },
      { code: 'QTY_ZERO', nodeId: sub, slNo: '1.1.1', label: 'Invented lid' },
    ]);
    await expectNothingWritten(estimateId, 3);
  });

  it('is decided before any master is read: with the customer deleted from the masters, it is still the 409 about the quantity, and the first refusal that reads a master comes after the acknowledgement', async () => {
    const { estimateId } = await addWarnedEstimate();
    const customer = await db.owner.query<{ id: string }>("INSERT INTO customers (name, deleted_at) VALUES ('Invented deleted customer', now()) RETURNING id::text");
    await db.owner.query('UPDATE estimates SET customer_id = $2::uuid WHERE id = $1::uuid', [estimateId, defined(customer.rows[0]).id]);
    await askedToConfirm(db.service.calculate(engineer(), estimateId));
    const failure = await db.service.calculate(engineer(), estimateId, acknowledge(3)).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toMatchObject({ code: 'CUSTOMER_DELETED' });
    await expectNothingWritten(estimateId, 3);
  });

  it('a blank beside a 0 is the 422, so nobody acknowledges and is then refused for a blank', async () => {
    const estimateId = await db.addEstimate({ engineer: true });
    await db.addPart(estimateId, { inputs: { ...completePartInputs(), [idOf('E')]: db.materialOneId, [QTY()]: '0', [idOf('J')]: '' } });
    await expect(db.service.calculate(engineer(), estimateId, acknowledge(3))).rejects.toBeInstanceOf(CalculateBlockedError);
    await expectNothingWritten(estimateId, 3);
  });

  it('no customer chosen is the 409 CUSTOMER_NOT_CHOSEN and not the warning', async () => {
    const { estimateId } = await addWarnedEstimate();
    await db.owner.query('UPDATE estimates SET customer_id = NULL WHERE id = $1::uuid', [estimateId]);
    await expect(db.service.calculate(engineer(), estimateId)).rejects.toMatchObject({ code: 'CUSTOMER_NOT_CHOSEN' });
  });
});

describe('AC-3: the acknowledged press calculates, records the warnings and writes one audit entry in the same transaction', () => {
  it('stores each warning as text on the calculation as the person who pressed, links it, submits the estimate and answers exactly {status, message}', async () => {
    const { estimateId, part, sub } = await addWarnedEstimate();
    expect(await db.service.calculate(engineer(), estimateId, acknowledge(3))).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    const { rows } = await db.owner.query<{ id: string; created_by: string; inputs_revision: number; warnings: unknown }>(
      'SELECT id::text, created_by::text, inputs_revision, warnings FROM calculations WHERE estimate_id = $1::uuid',
      [estimateId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      created_by: db.engineerId,
      inputs_revision: 3,
      warnings: [
        { code: 'QTY_ZERO', nodeId: part, slNo: '1.1', label: 'Invented top cover' },
        { code: 'QTY_ZERO', nodeId: sub, slNo: '1.1.1', label: 'Invented lid' },
      ],
    });
    expect(await stateOf(estimateId)).toEqual({ status: 'SUBMITTED', current_calculation_id: defined(rows[0]).id, inputs_revision: 3 });
  });

  it('writes one `calculation.warning_acknowledged` entry that names the person, the request, the estimate by its task code and each row, and holds no figure', async () => {
    const { estimateId, part, sub } = await addWarnedEstimate();
    await db.service.calculate(engineer(), estimateId, acknowledge(3));
    const entries = await entriesFor(db, estimateId);
    expect(entries).toHaveLength(1);
    const entry = defined(entries[0]);
    const code = (await db.owner.query<{ code: string }>('SELECT t.code FROM tasks t JOIN estimates e ON e.task_id = t.id WHERE e.id = $1::uuid', [estimateId])).rows[0]?.code;
    expect(entry).toMatchObject({
      event: 'calculation.warning_acknowledged',
      actor_id: db.engineerId,
      actor_label: 'Calculation Engineer',
      object_type: 'estimate',
      object_id: estimateId,
      object_label: code,
      before: null,
      request_id: 'req-0badc0de',
    });
    expect(entry.after).toEqual({
      warnings: [
        { code: 'QTY_ZERO', nodeId: part, slNo: '1.1', label: 'Invented top cover' },
        { code: 'QTY_ZERO', nodeId: sub, slNo: '1.1.1', label: 'Invented lid' },
      ],
    });
  });

  it('an entry that is refused takes the calculation with it: no calculation, no entry, a draft (one transaction)', async () => {
    const { estimateId } = await addWarnedEstimate();
    const refusing = db.buildService({}, { audit: { record: () => Promise.reject(new AuditEntryRefusedError('shape', 'after')), list: db.audit.list } });
    await expect(refusing.calculate(engineer(), estimateId, acknowledge(3))).rejects.toBeInstanceOf(AuditEntryRefusedError);
    await expectNothingWritten(estimateId, 3);
  });

  it('a calculation that fails while it is being stored writes no entry either', async () => {
    const { estimateId } = await addWarnedEstimate();
    const failing = db.buildService({ estimates: { lockEstimate: (id, tx) => db.estimates.lockEstimate(id, tx), linkCalculation: () => Promise.reject(new Error('Invented late failure.')) } });
    await expect(failing.calculate(engineer(), estimateId, acknowledge(3))).rejects.toThrow('Invented late failure.');
    await expectNothingWritten(estimateId, 3);
  });
});

describe('AC-4: a stale acknowledgement never passes', () => {
  it('an input changed after the 409: the same acknowledgement is the 409 again with the new revision and the current list, and nothing is written', async () => {
    const { estimateId, part } = await addWarnedEstimate();
    expect((await askedToConfirm(db.service.calculate(engineer(), estimateId))).inputsRevision).toBe(3);
    // The Engineer corrects the sub-part's count: a save raises the revision, and the list is shorter.
    await db.owner.query("UPDATE estimate_nodes SET inputs = jsonb_set(inputs, ARRAY[$2::text], '\"3.00\"'::jsonb) WHERE estimate_id = $1::uuid AND parent_id = $3::uuid", [estimateId, QTY(), part]);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const again = await askedToConfirm(db.service.calculate(engineer(), estimateId, acknowledge(3)));
    expect(again.inputsRevision).toBe(4);
    expect(again.warnings.map((warning) => warning.slNo)).toEqual(['1.1']);
    await expectNothingWritten(estimateId, 4);
  });

  it.each([0, 2, 4])('an acknowledgement for revision %i, which is not the estimate\'s 3, is the 409', async (revision) => {
    const { estimateId } = await addWarnedEstimate();
    expect((await askedToConfirm(db.service.calculate(engineer(), estimateId, acknowledge(revision)))).inputsRevision).toBe(3);
    await expectNothingWritten(estimateId, 3);
  });

  describe('the race of an input save and an acknowledged Calculate, under the estimate\'s row lock', () => {
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

    it('a save that holds the estimate commits first: the Calculate waits, then finds the new revision and the new list, and never succeeds on the older one', async () => {
      const { estimateId, part } = await addWarnedEstimate();
      const saver = new Client({ connectionString: db.database.ownerUrl });
      await saver.connect();
      try {
        await saver.query('BEGIN');
        await saver.query('SELECT id FROM estimates WHERE id = $1::uuid FOR UPDATE', [estimateId]);
        const pending = askedToConfirm(db.service.calculate(engineer(), estimateId, acknowledge(3)));
        // The waiting statement is the runtime role's, and pg_stat_activity shows another role's sessions only to a member of it: look as the runtime role.
        await waitUntilAStatementWaitsOnALock(db.runtime);
        await saver.query("UPDATE estimate_nodes SET inputs = jsonb_set(inputs, ARRAY[$2::text], '\"3.00\"'::jsonb) WHERE estimate_id = $1::uuid AND parent_id = $3::uuid", [estimateId, QTY(), part]);
        await saver.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
        await saver.query('COMMIT');
        const failure = await pending;
        expect(failure.inputsRevision).toBe(4);
        expect(failure.warnings.map((warning) => warning.slNo)).toEqual(['1.1']);
      } finally {
        await saver.end();
      }
      await expectNothingWritten(estimateId, 4);
    });

    it('a Calculate that holds the estimate commits first: the save waits, and the record holds the list the person acknowledged', async () => {
      const { estimateId } = await addWarnedEstimate();
      const saver = new Client({ connectionString: db.database.ownerUrl });
      await saver.connect();
      try {
        const calculated = db.service.calculate(engineer(), estimateId, acknowledge(3));
        // The save is the owner's statement; it takes the same row lock, so it queues behind the Calculate or goes first: either way the outcomes below hold.
        const saved = (async () => {
          await saver.query('BEGIN');
          await saver.query('SELECT id FROM estimates WHERE id = $1::uuid FOR UPDATE', [estimateId]);
          await saver.query("UPDATE estimate_nodes SET inputs = jsonb_set(inputs, ARRAY[$2::text], '\"9.00\"'::jsonb) WHERE estimate_id = $1::uuid AND inputs ->> $2::text = '0'", [estimateId, QTY()]);
          await saver.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
          await saver.query('COMMIT');
        })();
        const [outcome] = await Promise.allSettled([calculated, saved]);
        const { rows } = await db.owner.query<{ inputs_revision: number; warnings: unknown[] }>('SELECT inputs_revision, warnings FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
        if (outcome.status === 'fulfilled') {
          // The Calculate went first, under the revision the person acknowledged, so it holds the list that was acknowledged and nothing the save wrote.
          expect(rows).toHaveLength(1);
          expect(defined(rows[0]).inputs_revision).toBe(3);
          expect(defined(rows[0]).warnings).toHaveLength(2);
        } else {
          // The save went first: the Calculate found the new revision and was asked again, and wrote nothing.
          expect(outcome.reason).toBeInstanceOf(CalculateAckRequiredError);
          expect(rows).toEqual([]);
        }
      } finally {
        await saver.end();
      }
    });
  });
});

describe('AC-5: an acknowledgement with nothing to warn is ignored', () => {
  it('calculates as a press with none: `warnings` is empty and no audit entry is written', async () => {
    const estimateId = await db.addCompleteEstimate();
    expect(await db.service.calculate(engineer(), estimateId, acknowledge(99))).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    const { rows } = await db.owner.query<{ warnings: unknown[] }>('SELECT warnings FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
    expect(rows).toEqual([{ warnings: [] }]);
    expect(await entriesFor(db, estimateId)).toEqual([]);
  });
});

describe('each press stands alone', () => {
  it('a second press on a submitted estimate is the 409 for that; once it is a draft again, the next press is asked again and a second calculation and a second entry follow', async () => {
    const { estimateId } = await addWarnedEstimate();
    await db.service.calculate(engineer(), estimateId, acknowledge(3));
    await expect(db.service.calculate(engineer(), estimateId, acknowledge(3))).rejects.toBeInstanceOf(ConflictError);
    await db.owner.query("UPDATE estimates SET status = 'DRAFT' WHERE id = $1::uuid", [estimateId]);
    await askedToConfirm(db.service.calculate(engineer(), estimateId));
    await db.service.calculate(engineer(), estimateId, acknowledge(3));
    expect(await calculationCount(estimateId)).toBe(2);
    expect(await entriesFor(db, estimateId)).toHaveLength(2);
  });
});

describe('AC-8 (CE-9): the seven trees, calculated with the acknowledgement, give their BL and a row with H 0 gets BG 0 while the rows below keep theirs', () => {
  let zeroRatesCustomerId: string;

  beforeAll(async () => {
    // A customer whose rates are all 0, as the constructed cases assume (`quantity-cases.test.ts`): BG is then the per-piece cost times the count, and nothing else.
    const { rows } = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Invented zero-rate customer') RETURNING id::text");
    zeroRatesCustomerId = defined(rows[0]).id;
    for (const item of SEED_PROCESS_ITEMS) {
      await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) VALUES ($1::uuid, $2::uuid, 0)', [zeroRatesCustomerId, item.id]);
    }
  });

  /** A part of a case as the form stores it: every number 0, then the count (H) and the per-piece cost (Machining Cost, AP) of the row. */
  const partInputs = (h: string, cost: string): Record<string, string> => {
    const zeroed = Object.fromEntries(Object.entries(completePartInputs()).map(([id, value]) => [id, findFieldById(seedConfig, id)?.dataType === 'number' ? '0.00' : value]));
    return { ...zeroed, [idOf('E')]: db.materialOneId, [QTY()]: h, [idOf('AP')]: cost };
  };

  /** Adds the rows of a case as parts: a row's parent is the row with its Sl. No without the last number. */
  async function addCase(quantityCase: QuantityCase): Promise<string> {
    const estimateId = await db.addEstimate({ engineer: true, customerId: zeroRatesCustomerId });
    const ids = new Map<string, string>();
    for (const row of quantityCase.rows) {
      const segments = row.sl.split('.');
      const parentId = segments.length === 1 ? null : defined(ids.get(segments.slice(0, -1).join('.')), `parent of ${row.sl}`);
      ids.set(row.sl, await db.addPart(estimateId, { parentId, sortIndex: Number(segments[segments.length - 1]) - 1, inputs: partInputs(row.h, row.cost) }));
    }
    return estimateId;
  }

  const CE9 = QUANTITY_CASES.filter((quantityCase) => quantityCase.id.startsWith('CE-9'));

  it('the seven cases of the table are all there', () => {
    expect(CE9.map((quantityCase) => quantityCase.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) => `CE-9 ${letter}`));
  });

  it.each(CE9.map((quantityCase) => [quantityCase.id, quantityCase.title, quantityCase] as const))('%s: %s', async (_id, _title, quantityCase) => {
    const estimateId = await addCase(quantityCase);
    const warned = quantityCase.rows.filter((row) => Number(row.h) === 0).map((row) => row.sl);
    expect((await askedToConfirm(db.service.calculate(engineer(), estimateId))).warnings.map((warning) => warning.slNo)).toEqual(warned);
    expect(await db.service.calculate(engineer(), estimateId, acknowledge(3))).toEqual({ status: 'SUBMITTED', message: CALCULATE_MESSAGE });
    const header = await db.owner.query<{ id: string; total: string | null; warnings: Array<{ slNo: string }> }>(
      "SELECT id::text, product_values ->> 'totalPrice' AS total, warnings FROM calculations WHERE estimate_id = $1::uuid",
      [estimateId],
    );
    expect(header.rows).toHaveLength(1);
    const record = defined(header.rows[0]);
    expect(record.total).toBe(quantityCase.bl);
    expect(record.warnings.map((warning) => warning.slNo)).toEqual(warned);
    const rows = await db.owner.query<{ sl_no: string; bg: string | null }>('SELECT sl_no, outputs ->> $2::text AS bg FROM calculation_rows WHERE calculation_id = $1::uuid', [record.id, idOf('BG')]);
    expect(Object.fromEntries(rows.rows.map((row) => [row.sl_no, row.bg]))).toEqual(Object.fromEntries(quantityCase.rows.map((row) => [row.sl, row.bg])));
  });
});
