import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { APPROVAL_NOT_AVAILABLE_CODE, CALCULATION_CHANGED_CODE, NOT_CALCULATED_CODE, TOTALS_OUT_OF_DATE_CODE } from '@/lib/estimate/approval-words';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { createApprovalService, type ApprovalService } from '@/server/services/approval-service';
import type { EstimateViewer } from '@/server/services/estimate-service';

import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';

/**
 * STORY-06.05 AC-1 to AC-5, AC-7 and AC-8 (FR-101, D-20; NFR-007; architecture sections 4.8 and 6 "Approve") against real PostgreSQL in a throwaway database, as the **runtime role**: the guard of an approval
 * over the real estimate row lock and the real figure basis. A never-calculated estimate, one changed in each way an input can change (a typed number, Remarks, the customer, a part added) and one whose
 * `calculationId` is not the current one are each refused with the code that names the step, and **a refusal changes no row and adds no audit entry**; after Recalculate the guard passes and the approval
 * (STORY-06.06's) is the fixed 501, also with nothing written. An input saved while the approval waits for the lock lands first, so the approval is refused. Every name, ID and number is invented.
 */

let db: CalculationDatabase;
let approvals: ApprovalService;

const lead = (): EstimateViewer => ({ id: db.personId, role: 'LEAD' });
const admin = (): EstimateViewer => ({ id: db.personId, role: 'ADMIN' });
const engineer = (): EstimateViewer => ({ id: db.engineerId, role: 'ENGINEER' });
const PRICE = '1000.00';
const UNKNOWN_CALCULATION_ID = '00000000-0000-4000-8000-00000000ca1c';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';

beforeAll(async () => {
  db = await openCalculationDatabase();
  approvals = createApprovalService({ estimates: db.estimates, calculations: db.calculations, transactions: db.transactions });
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** A calculated estimate of the Engineer's with two parts: SUBMITTED, the figures `current`. */
async function calculatedEstimate(): Promise<{ readonly estimateId: string; readonly top: string }> {
  const estimateId = await db.addCompleteEstimate({ parts: 2 });
  await db.service.calculate(engineer(), estimateId);
  const parts = await db.nodes.listNodes(estimateId);
  return { estimateId, top: defined(parts.find((part) => part.parentId === null)).id };
}

async function revisionOf(nodeId: string): Promise<number> {
  return defined((await db.owner.query<{ revision: number }>('SELECT revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId])).rows[0]).revision;
}

async function currentCalculationOf(estimateId: string): Promise<string> {
  const { rows } = await db.owner.query<{ id: string | null }>('SELECT current_calculation_id::text AS id FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(defined(rows[0]).id);
}

/** Everything a refusal must leave alone: the estimate's row (status, link, revision, time of change), the records of calculation and the audit entries. */
async function stored(estimateId: string): Promise<unknown> {
  const estimate = await db.owner.query('SELECT status::text AS status, current_calculation_id::text AS link, inputs_revision AS revision, updated_at::text AS "updatedAt" FROM estimates WHERE id = $1::uuid', [estimateId]);
  const calculations = await db.owner.query('SELECT count(*)::int AS n FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
  const audit = await db.owner.query('SELECT count(*)::int AS n FROM audit_log');
  return { estimate: estimate.rows, calculations: calculations.rows, audit: audit.rows };
}

const request = (calculationId: string) => ({ calculationId, price: PRICE });

const LOCK_POLL_MILLISECONDS = 20;
const LOCK_WAIT_LIMIT_MILLISECONDS = 5_000;

/** Resolves once some session waits for a lock it was not granted (on the owner's connection, apart from the pool under test); throws when none does within the limit. */
async function untilALockWaits(): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_LIMIT_MILLISECONDS;
  while (Date.now() < deadline) {
    const { rows } = await db.owner.query<{ n: number }>('SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted');
    if (defined(rows[0]).n > 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, LOCK_POLL_MILLISECONDS);
    });
  }
  throw new Error('No session waited for a lock: the approval did not wait for the estimate\'s row lock.');
}

/** The refusal a call ends in, read without leaving a rejection unhandled; `undefined` when it did not refuse. */
async function refusalOf(call: Promise<unknown>): Promise<unknown> {
  return call.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('AC-1: a never-calculated estimate is the 409 NOT_CALCULATED', () => {
  it('a Submitted estimate with no calculation is refused, and nothing changes', async () => {
    const estimateId = await db.addEstimate({ status: 'SUBMITTED', engineer: true });
    const before = await stored(estimateId);
    await expect(approvals.approve(lead(), estimateId, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 409, code: NOT_CALCULATED_CODE });
    expect(await stored(estimateId)).toEqual(before);
  });
});

describe('AC-2: every way an input can change makes the approval a 409 TOTALS_OUT_OF_DATE, Remarks included', () => {
  it.each([
    ['a typed number', async (estimateId: string, top: string) => db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(top), values: { [idOf('J')]: '91' } })],
    ['Remarks', async (estimateId: string, top: string) => db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(top), values: { [idOf('AJ')]: 'Deburr the edge.' } })],
    ['a part added', async (estimateId: string, top: string) => db.estimateService.addPart(lead(), estimateId, { kind: 'beside', nodeId: top })],
  ])('%s', async (_name, change) => {
    const { estimateId, top } = await calculatedEstimate();
    const seen = await currentCalculationOf(estimateId);
    await change(estimateId, top);
    const before = await stored(estimateId);
    await expect(approvals.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ httpStatus: 409, code: TOTALS_OUT_OF_DATE_CODE });
    expect(await stored(estimateId)).toEqual(before);
  });

  it('the customer changed', async () => {
    const { estimateId } = await calculatedEstimate();
    const seen = await currentCalculationOf(estimateId);
    const { rows } = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Approval Guard Customer') RETURNING id::text AS id");
    await db.estimateService.setCustomer(lead(), estimateId, defined(rows[0]).id);
    await expect(approvals.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
  });
});

describe('AC-3: the calculationId must be the current calculation', () => {
  it('an ID the estimate does not have, and the ID of the calculation a Recalculate has since replaced', async () => {
    const { estimateId, top } = await calculatedEstimate();
    const seen = await currentCalculationOf(estimateId);
    await expect(approvals.approve(lead(), estimateId, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 409, code: CALCULATION_CHANGED_CODE });
    await db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(top), values: { [idOf('J')]: '92' } });
    await db.service.recalculate(lead(), estimateId);
    const before = await stored(estimateId);
    await expect(approvals.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ httpStatus: 409, code: CALCULATION_CHANGED_CODE });
    expect(await stored(estimateId)).toEqual(before);
  });

  it('the ID of another estimate\'s calculation is refused too', async () => {
    const first = await calculatedEstimate();
    const second = await calculatedEstimate();
    await expect(approvals.approve(lead(), first.estimateId, request(await currentCalculationOf(second.estimateId)))).rejects.toMatchObject({ code: CALCULATION_CHANGED_CODE });
  });
});

describe('AC-4: a status that is not SUBMITTED is the state machine\'s 409', () => {
  it.each([
    ['DRAFT', 'NOT_SUBMITTED'],
    ['APPROVED', 'ALREADY_APPROVED'],
  ] as const)('%s', async (status, reason) => {
    const { estimateId } = await calculatedEstimate();
    const seen = await currentCalculationOf(estimateId);
    await db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE id = $1::uuid', [estimateId, status]);
    const before = await stored(estimateId);
    await expect(approvals.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS[reason].code });
    expect(await stored(estimateId)).toEqual(before);
  });
});

describe('AC-5: the order of the checks, under the estimate\'s lock', () => {
  it('an Engineer is refused 403 whatever the estimate, and an estimate that does not exist (or an ID that is none) is 404 before the status is looked at', async () => {
    const { estimateId } = await calculatedEstimate();
    await expect(approvals.approve(engineer(), estimateId, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 403 });
    await expect(approvals.approve(engineer(), UNKNOWN_ESTIMATE_ID, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 403 });
    await expect(approvals.approve(lead(), UNKNOWN_ESTIMATE_ID, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 404 });
    await expect(approvals.approve(lead(), 'not-an-id', request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('an input saved while the approval waits for the lock lands first, so the approval is refused as out of date', async () => {
    const { estimateId } = await calculatedEstimate();
    const seen = await currentCalculationOf(estimateId);
    const waiting: { current?: Promise<unknown> } = {};
    // This transaction holds the estimate's lock, as a save does, and raises the revision as a save does; the approval is asked while it is held and must wait for it.
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      await db.estimates.bumpInputsRevision(estimateId, tx);
      waiting.current = refusalOf(approvals.approve(lead(), estimateId, request(seen)));
      // Hold the lock until the approval is seen waiting for it, so the test fails if the approval does not take the estimate's lock (SQR-02 of the review of AQP-322).
      await untilALockWaits();
    });
    expect(await waiting.current).toMatchObject({ httpStatus: 409, code: TOTALS_OUT_OF_DATE_CODE });
  });

  it('an approval and a save at once: the approval is refused or reaches the approval, never anything else, and the save always lands', async () => {
    const { estimateId, top } = await calculatedEstimate();
    const seen = await currentCalculationOf(estimateId);
    const before = await db.owner.query<{ revision: number }>('SELECT inputs_revision AS revision FROM estimates WHERE id = $1::uuid', [estimateId]);
    const topRevision = await revisionOf(top);
    const [outcome] = await Promise.all([
      refusalOf(approvals.approve(lead(), estimateId, request(seen))),
      db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: topRevision, values: { [idOf('J')]: '93' } }),
    ]);
    expect([TOTALS_OUT_OF_DATE_CODE, APPROVAL_NOT_AVAILABLE_CODE]).toContain((outcome as { code: string }).code);
    const after = await db.owner.query<{ revision: number; status: string }>('SELECT inputs_revision AS revision, status::text AS status FROM estimates WHERE id = $1::uuid', [estimateId]);
    expect(defined(after.rows[0]).revision).toBe(defined(before.rows[0]).revision + 1);
    expect(defined(after.rows[0]).status).toBe('SUBMITTED');
  });
});

describe('AC-7 and AC-8: after Recalculate the guard passes and the approval is reached, with nothing written', () => {
  it.each([
    ['a Lead', lead],
    ['an Admin', admin],
  ])('%s, with the figures current and the current calculation: the fixed 501, and the estimate, its records and the audit log are as they were', async (_name, viewer) => {
    const { estimateId, top } = await calculatedEstimate();
    await db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(top), values: { [idOf('J')]: '94' } });
    await expect(approvals.approve(viewer(), estimateId, request(await currentCalculationOf(estimateId)))).rejects.toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
    await db.service.recalculate(lead(), estimateId);
    const before = await stored(estimateId);
    await expect(approvals.approve(viewer(), estimateId, request(await currentCalculationOf(estimateId)))).rejects.toMatchObject({ httpStatus: 501, code: APPROVAL_NOT_AVAILABLE_CODE });
    expect(await stored(estimateId)).toEqual(before);
  });
});
