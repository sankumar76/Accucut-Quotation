import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CALCULATION_CHANGED_CODE, NOT_CALCULATED_CODE, TOTALS_OUT_OF_DATE_CODE } from '@/lib/estimate/approval-words';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { ESTIMATE_NOT_EDITABLE_CODE } from '@/server/services/estimate-service';

import {
  adminOf,
  calculatedEstimate,
  currentCalculationOf,
  engineerOf,
  leadOf,
  refusalOf,
  requestFor,
  revisionOf,
  storedOf,
  UNKNOWN_CALCULATION_ID,
  UNKNOWN_ESTIMATE_ID,
  untilALockWaits,
} from '../../support/approval-helpers';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';

/**
 * STORY-06.05 AC-1 to AC-5 and AC-8 (FR-101, D-20; NFR-007; architecture sections 4.8 and 6 "Approve") against real PostgreSQL in a throwaway database, as the **runtime role**: the guard of an approval over
 * the real estimate row lock and the real figure basis. A never-calculated estimate, one changed in each way an input can change (a typed number, Remarks, the customer, a part added) and one whose `calculationId`
 * is not the current one are each refused with the code that names the step, and **a refusal changes no row and adds no audit entry**. An input saved while the approval waits for the lock lands first, so the
 * approval is refused. The write that follows a passing guard (STORY-06.06) is `approve.test.ts`'s. Every name, ID and number is invented.
 */

let db: CalculationDatabase;
const lead = () => leadOf(db);
const request = (calculationId: string) => requestFor(db, calculationId);

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('AC-1: a never-calculated estimate is the 409 NOT_CALCULATED', () => {
  it('a Submitted estimate with no calculation is refused, and nothing changes', async () => {
    const estimateId = await db.addEstimate({ status: 'SUBMITTED', engineer: true });
    const before = await storedOf(db, estimateId);
    await expect(db.approvalService.approve(lead(), estimateId, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 409, code: NOT_CALCULATED_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });
});

describe('AC-2: every way an input can change makes the approval a 409 TOTALS_OUT_OF_DATE, Remarks included', () => {
  it.each([
    ['a typed number', async (estimateId: string, top: string) => db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(db, top), values: { [idOf('J')]: '91' } })],
    ['Remarks', async (estimateId: string, top: string) => db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(db, top), values: { [idOf('AJ')]: 'Deburr the edge.' } })],
    ['a part added', async (estimateId: string, top: string) => db.estimateService.addPart(lead(), estimateId, { kind: 'beside', nodeId: top })],
  ])('%s', async (_name, change) => {
    const { estimateId, top } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    await change(estimateId, top);
    const before = await storedOf(db, estimateId);
    await expect(db.approvalService.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ httpStatus: 409, code: TOTALS_OUT_OF_DATE_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

  it('the customer changed', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    const { rows } = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Approval Guard Customer') RETURNING id::text AS id");
    await db.estimateService.setCustomer(lead(), estimateId, defined(rows[0]).id);
    await expect(db.approvalService.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
  });
});

describe('AC-3: the calculationId must be the current calculation', () => {
  it('an ID the estimate does not have, and the ID of the calculation a Recalculate has since replaced', async () => {
    const { estimateId, top } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    await expect(db.approvalService.approve(lead(), estimateId, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 409, code: CALCULATION_CHANGED_CODE });
    await db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(db, top), values: { [idOf('J')]: '92' } });
    await db.service.recalculate(lead(), estimateId);
    const before = await storedOf(db, estimateId);
    await expect(db.approvalService.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ httpStatus: 409, code: CALCULATION_CHANGED_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

  it("the ID of another estimate's calculation is refused too", async () => {
    const first = await calculatedEstimate(db);
    const second = await calculatedEstimate(db);
    await expect(db.approvalService.approve(lead(), first.estimateId, request(await currentCalculationOf(db, second.estimateId)))).rejects.toMatchObject({ code: CALCULATION_CHANGED_CODE });
  });
});

describe("AC-4: a status that is not SUBMITTED is the state machine's 409", () => {
  it.each([
    ['DRAFT', 'NOT_SUBMITTED'],
    ['APPROVED', 'ALREADY_APPROVED'],
  ] as const)('%s', async (status, reason) => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    await db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE id = $1::uuid', [estimateId, status]);
    const before = await storedOf(db, estimateId);
    await expect(db.approvalService.approve(lead(), estimateId, request(seen))).rejects.toMatchObject({ httpStatus: 409, code: TRANSITION_REFUSALS[reason].code });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });
});

describe("AC-5: the order of the checks, under the estimate's lock", () => {
  it('an Engineer is refused 403 whatever the estimate, and an estimate that does not exist (or an ID that is none) is 404 before the status is looked at', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const engineer = engineerOf(db);
    await expect(db.approvalService.approve(engineer, estimateId, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 403 });
    await expect(db.approvalService.approve(engineer, UNKNOWN_ESTIMATE_ID, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 403 });
    await expect(db.approvalService.approve(lead(), UNKNOWN_ESTIMATE_ID, request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 404 });
    await expect(db.approvalService.approve(lead(), 'not-an-id', request(UNKNOWN_CALCULATION_ID))).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('an input saved while the approval waits for the lock lands first, so the approval is refused as out of date', async () => {
    const { estimateId } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    const waiting: { current?: Promise<unknown> } = {};
    // This transaction holds the estimate's lock, as a save does, and raises the revision as a save does; the approval is asked while it is held and must wait for it.
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      await db.estimates.bumpInputsRevision(estimateId, tx);
      waiting.current = refusalOf(db.approvalService.approve(lead(), estimateId, request(seen)));
      // Hold the lock until the approval is seen waiting for it, so the test fails if the approval does not take the estimate's lock (SQR-02 of the review of AQP-322).
      await untilALockWaits(db);
    });
    expect(await waiting.current).toMatchObject({ httpStatus: 409, code: TOTALS_OUT_OF_DATE_CODE });
  });

  it('an approval and a save at once: whichever takes the lock first wins, the other is refused cleanly, and nothing is half written', async () => {
    const { estimateId, top } = await calculatedEstimate(db);
    const seen = await currentCalculationOf(db, estimateId);
    const topRevision = await revisionOf(db, top);
    const before = defined((await db.owner.query<{ revision: number }>('SELECT inputs_revision AS revision FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]).revision;
    // Both calls are collected before anything is asserted, so a failing one cannot leave a rejection unhandled (#443).
    const [approvalRefusal, saveRefusal] = await Promise.all([
      refusalOf(db.approvalService.approve(lead(), estimateId, request(seen))),
      refusalOf(db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: topRevision, values: { [idOf('J')]: '93' } })),
    ]);
    const after = defined((await db.owner.query<{ revision: number; status: string }>('SELECT inputs_revision AS revision, status::text AS status FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]);
    if (approvalRefusal === undefined) {
      // The approval took the lock first: the estimate is approved and locked, and the save was refused for it.
      expect(saveRefusal).toMatchObject({ httpStatus: 409, code: ESTIMATE_NOT_EDITABLE_CODE });
      expect(after).toEqual({ revision: before, status: 'APPROVED' });
    } else {
      // The save took the lock first: it landed, the figures are out of date, and the approval was refused and wrote nothing.
      expect(saveRefusal).toBeUndefined();
      expect(approvalRefusal).toMatchObject({ httpStatus: 409, code: TOTALS_OUT_OF_DATE_CODE });
      expect(after).toEqual({ revision: before + 1, status: 'SUBMITTED' });
    }
  });
});

describe('AC-8: every refusal leaves the estimate, its records and the audit log as they were (an Admin included)', () => {
  it.each([
    ['a Lead', leadOf],
    ['an Admin', adminOf],
  ])('%s, with the figures cleared: refused, and the stored rows are unchanged', async (_name, viewer) => {
    const { estimateId, top } = await calculatedEstimate(db);
    await db.estimateService.saveInputs(lead(), estimateId, { nodeId: top, revision: await revisionOf(db, top), values: { [idOf('J')]: '94' } });
    const before = await storedOf(db, estimateId);
    await expect(db.approvalService.approve(viewer(db), estimateId, request(await currentCalculationOf(db, estimateId)))).rejects.toMatchObject({ code: TOTALS_OUT_OF_DATE_CODE });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });
});
