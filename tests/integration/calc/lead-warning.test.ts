import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CalculateAckRequiredError } from '@/lib/estimate/calculate-ack-required-error';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import type { CalculateOptions } from '@/server/services/calculation-service';
import { createEstimateReviewService, type EstimateReviewService } from '@/server/services/estimate-review-service';

import { adminOf, currentCalculationOf, engineerOf, leadOf, refusalOf, requestFor, statusOf } from '../../support/approval-helpers';
import { entriesFor } from '../../support/audit-database';
import { type CalculationDatabase, idOf, openCalculationDatabase } from '../../support/calculation-database';
import { completePartInputs, fieldIdOf } from '../../support/complete-part';
import { defined } from '../../support/defined';

/**
 * STORY-06.10 AC-1 to AC-4 and the Approved case of AC-3 (FR-104, FR-061; NFR-002; architecture sections 4.3 "Each press stands alone" and "What the Lead sees"; test strategy section 5.2 CE-9 "each press" and
 * "Lead data") against real PostgreSQL in a throwaway database, as the runtime role: a Lead's or an Admin's Recalculate is asked about a 0 in QTY per Assy **even when the Engineer already went ahead**, the
 * acknowledgement is compared with the estimate's revision under its row lock, the Lead's calculation keeps the Lead's name and its own list while the Engineer's is untouched, one audit entry is written for each
 * acknowledged press, the costs view names whoever went ahead on the calculation in view and holds nothing once the figures are cleared, and an approval is not stopped by a warning. Every promise is awaited
 * or asserted with `rejects` (#443). Every name, ID and number is invented.
 */

let db: CalculationDatabase;
let review: EstimateReviewService;

beforeAll(async () => {
  db = await openCalculationDatabase();
  const configurations = createConfigRepository(db.prisma);
  const cache = createConfigVersionCache();
  review = createEstimateReviewService({
    calculations: db.calculations,
    approvals: db.approvals,
    nodes: db.nodes,
    configuration: { current: () => getCurrentVersion(configurations, cache), byId: (id) => getVersionById(configurations, id, cache) },
  });
}, 120_000);

afterAll(async () => {
  await db.close();
});

const QTY = (): string => idOf('H');
/** The revision a new estimate of the test database starts at (`addEstimate`). */
const FIRST_REVISION = 3;
const ENGINEER_NAME = 'Calculation Engineer';
const LEAD_NAME = 'Calculation Lead';
/** The names the test database stores for the two people (`insertPersonAsOwner` adds "Invented"): what the costs view names, because it reads a person's name now. The labels above are what the audit entry was given. */
const ENGINEER_STORED_NAME = `Invented ${ENGINEER_NAME}`;
const LEAD_STORED_NAME = `Invented ${LEAD_NAME}`;
const ENGINEER_REQUEST = 'req-engineer-0001';
const LEAD_REQUEST = 'req-lead-0001';

const engineerAcknowledges = (inputsRevision: number): CalculateOptions => ({ acknowledge: { inputsRevision }, audit: { actorId: db.engineerId, actorLabel: ENGINEER_NAME, requestId: ENGINEER_REQUEST } });
const leadAcknowledges = (inputsRevision: number): CalculateOptions => ({ acknowledge: { inputsRevision }, audit: { actorId: db.personId, actorLabel: LEAD_NAME, requestId: LEAD_REQUEST } });
const leadPresses = (): CalculateOptions => ({ audit: { actorId: db.personId, actorLabel: LEAD_NAME, requestId: LEAD_REQUEST } });

/** A DRAFT of the Engineer's with the customer chosen: an item (1) and a part (1.1) with a 0 in QTY per Assy, and a sub-part (1.1.1) with 0.00. Returns the estimate and the two warned parts. */
async function addWarnedEstimate(): Promise<{ readonly estimateId: string; readonly part: string; readonly sub: string }> {
  const estimateId = await db.addEstimate({ engineer: true });
  const base = { ...completePartInputs(), [idOf('E')]: db.materialOneId };
  const item = await db.addPart(estimateId, { parentId: null, sortIndex: 0, inputs: base });
  const part = await db.addPart(estimateId, { parentId: item, sortIndex: 0, inputs: { ...base, [QTY()]: '0', [fieldIdOf('description')]: 'Invented support arm' } });
  const sub = await db.addPart(estimateId, { parentId: part, sortIndex: 0, inputs: { ...base, [QTY()]: '0.00', [fieldIdOf('description')]: 'Invented spacer' } });
  return { estimateId, part, sub };
}

/** The same, which the Engineer has calculated by going ahead past the warning: SUBMITTED, one calculation, one audit entry. */
async function engineerWentAhead() {
  const warned = await addWarnedEstimate();
  await db.service.calculate(engineerOf(db), warned.estimateId, engineerAcknowledges(FIRST_REVISION));
  return warned;
}

interface CalculationRow {
  readonly id: string;
  readonly created_by: string;
  readonly created_at: Date;
  readonly inputs_revision: number;
  readonly warnings: ReadonlyArray<{ readonly code: string; readonly nodeId: string; readonly slNo: string; readonly label: string }>;
  readonly product_values: unknown;
}

/** Every calculation of the estimate, oldest first, as the owner sees it. */
async function calculationsOf(estimateId: string): Promise<CalculationRow[]> {
  const { rows } = await db.owner.query<CalculationRow>(
    'SELECT id::text, created_by::text, created_at, inputs_revision, warnings, product_values FROM calculations WHERE estimate_id = $1::uuid ORDER BY created_at, id',
    [estimateId],
  );
  return rows;
}

async function askedToConfirm(promise: Promise<unknown>): Promise<CalculateAckRequiredError> {
  const failure = await refusalOf(promise);
  if (!(failure instanceof CalculateAckRequiredError)) throw new Error('Expected the 409 CALCULATE_ACK_REQUIRED.', { cause: failure });
  return failure;
}

const slNosOf = (failure: CalculateAckRequiredError): string[] => failure.warnings.map((warning) => warning.slNo);

describe('AC-1: a Lead or an Admin is asked about a 0 on every press, even if the Engineer already went ahead', () => {
  it.each([
    ['a Lead', () => leadOf(db)],
    ['an Admin', () => adminOf(db)],
  ])('%s: Recalculate on a submitted estimate the Engineer calculated by going ahead is the 409 with the current revision and the rows, and writes nothing', async (_name, viewer) => {
    const { estimateId, part, sub } = await engineerWentAhead();
    const before = await calculationsOf(estimateId);
    const entriesBefore = await entriesFor(db, estimateId);
    expect(before).toHaveLength(1);

    const failure = await askedToConfirm(db.service.recalculate(viewer(), estimateId, leadPresses()));
    expect(failure).toMatchObject({ code: 'CALCULATE_ACK_REQUIRED', httpStatus: 409, inputsRevision: FIRST_REVISION, quantityFieldId: QTY() });
    expect(failure.warnings).toEqual([
      { code: 'QTY_ZERO', nodeId: part, slNo: '1.1', label: 'Invented support arm' },
      { code: 'QTY_ZERO', nodeId: sub, slNo: '1.1.1', label: 'Invented spacer' },
    ]);
    // Nothing was written: the Engineer's calculation is the only one and still the one in view, and no audit entry was added.
    expect(await calculationsOf(estimateId)).toEqual(before);
    expect(await currentCalculationOf(db, estimateId)).toBe(defined(before[0]).id);
    expect(await entriesFor(db, estimateId)).toEqual(entriesBefore);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
  });

  it('a Lead\'s first press on a Draft that holds a 0 (Calculate on a Draft) is the same 409, and the acknowledged press submits it in the Lead\'s name', async () => {
    const { estimateId } = await addWarnedEstimate();
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
    const failure = await askedToConfirm(db.service.recalculate(leadOf(db), estimateId, leadPresses()));
    expect(slNosOf(failure)).toEqual(['1.1', '1.1.1']);
    expect(await calculationsOf(estimateId)).toEqual([]);
    expect(await statusOf(db, estimateId)).toBe('DRAFT');

    await db.service.recalculate(leadOf(db), estimateId, leadAcknowledges(failure.inputsRevision));
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');
    expect((await calculationsOf(estimateId)).map((calculation) => calculation.created_by)).toEqual([db.personId]);
  });

  it('an acknowledgement for an older state of the estimate never passes: after an input changed, the same acknowledgement is the 409 again with the new revision, and nothing is written', async () => {
    const { estimateId, part } = await engineerWentAhead();
    const asked = await askedToConfirm(db.service.recalculate(leadOf(db), estimateId, leadPresses()));
    expect(asked.inputsRevision).toBe(FIRST_REVISION);
    // The Engineer's sub-part count is corrected from another tab: the revision goes up, and the list is shorter.
    await db.owner.query("UPDATE estimate_nodes SET inputs = jsonb_set(inputs, ARRAY[$2::text], '\"3.00\"'::jsonb) WHERE estimate_id = $1::uuid AND parent_id = $3::uuid", [estimateId, QTY(), part]);
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const again = await askedToConfirm(db.service.recalculate(leadOf(db), estimateId, leadAcknowledges(asked.inputsRevision)));
    expect(again.inputsRevision).toBe(FIRST_REVISION + 1);
    expect(slNosOf(again)).toEqual(['1.1']);
    expect(await calculationsOf(estimateId)).toHaveLength(1);
  });
});

describe('AC-2: the acknowledged press makes the Lead\'s own calculation and leaves the Engineer\'s alone', () => {
  it('stores a second calculation made by the Lead with its own warnings, leaves the Engineer\'s record as it was, and writes exactly one `calculation.warning_acknowledged` entry naming the Lead', async () => {
    const { estimateId, part, sub } = await engineerWentAhead();
    const [engineersBefore] = await calculationsOf(estimateId);
    const entriesBefore = await entriesFor(db, estimateId);
    expect(entriesBefore).toHaveLength(1);

    await db.service.recalculate(leadOf(db), estimateId, leadAcknowledges(FIRST_REVISION));

    const after = await calculationsOf(estimateId);
    expect(after).toHaveLength(2);
    // The Engineer's calculation is unchanged to the last field: its name, its time and its own list.
    expect(after[0]).toEqual(engineersBefore);
    expect(defined(after[0]).created_by).toBe(db.engineerId);
    // The Lead's keeps the Lead's name as `created_by`, the revision it was made at, and its own copy of the list.
    const leads = defined(after[1]);
    expect(leads.created_by).toBe(db.personId);
    expect(leads.inputs_revision).toBe(FIRST_REVISION);
    expect(leads.warnings).toEqual([
      { code: 'QTY_ZERO', nodeId: part, slNo: '1.1', label: 'Invented support arm' },
      { code: 'QTY_ZERO', nodeId: sub, slNo: '1.1.1', label: 'Invented spacer' },
    ]);
    expect(await currentCalculationOf(db, estimateId)).toBe(leads.id);
    expect(await statusOf(db, estimateId)).toBe('SUBMITTED');

    // One new entry, and it is the Lead's: the person, the request, the estimate and each row, and no figure.
    const entries = await entriesFor(db, estimateId);
    expect(entries).toHaveLength(2);
    expect(entries.filter((entry) => entry.event === 'calculation.warning_acknowledged')).toHaveLength(2);
    const added = defined(entries.find((entry) => entry.actor_id === db.personId));
    expect(added).toMatchObject({ event: 'calculation.warning_acknowledged', actor_label: LEAD_NAME, object_type: 'estimate', object_id: estimateId, before: null, request_id: LEAD_REQUEST });
    expect(added.after).toEqual({
      warnings: [
        { code: 'QTY_ZERO', nodeId: part, slNo: '1.1', label: 'Invented support arm' },
        { code: 'QTY_ZERO', nodeId: sub, slNo: '1.1.1', label: 'Invented spacer' },
      ],
    });
  });

  it('each press stands alone: a second acknowledged Recalculate by the Lead is asked again, and makes a third calculation and a third entry', async () => {
    const { estimateId } = await engineerWentAhead();
    await db.service.recalculate(leadOf(db), estimateId, leadAcknowledges(FIRST_REVISION));
    const failure = await askedToConfirm(db.service.recalculate(leadOf(db), estimateId, leadPresses()));
    await db.service.recalculate(leadOf(db), estimateId, leadAcknowledges(failure.inputsRevision));
    expect(await calculationsOf(estimateId)).toHaveLength(3);
    expect(await entriesFor(db, estimateId)).toHaveLength(3);
  });
});

describe('AC-3, AC-4: the costs view names whoever went ahead on the calculation in view, and only while the figures are current', () => {
  it('after the Engineer went ahead: the notice\'s data is the Engineer\'s name, the calculation\'s own time and each warned row', async () => {
    const { estimateId, part, sub } = await engineerWentAhead();
    const [calculation] = await calculationsOf(estimateId);
    const costs = await review.getCosts(leadOf(db), estimateId);
    expect(costs.state).toBe('current');
    expect(costs.warning).toEqual({
      madeBy: ENGINEER_STORED_NAME,
      rows: [
        { nodeId: part, slNo: '1.1', label: 'Invented support arm' },
        { nodeId: sub, slNo: '1.1.1', label: 'Invented spacer' },
      ],
    });
    expect(costs.calculatedAt).toBe(defined(calculation).created_at.toISOString());
  });

  it('after a Lead recalculated: the notice names the Lead and that calculation\'s time, not the Engineer\'s', async () => {
    const { estimateId } = await engineerWentAhead();
    await db.service.recalculate(leadOf(db), estimateId, leadAcknowledges(FIRST_REVISION));
    const [engineers, leads] = await calculationsOf(estimateId);
    const costs = await review.getCosts(adminOf(db), estimateId);
    expect(costs.warning?.madeBy).toBe(LEAD_STORED_NAME);
    expect(costs.calculatedAt).toBe(defined(leads).created_at.toISOString());
    expect(costs.calculatedAt).not.toBe(defined(engineers).created_at.toISOString());
  });

  it('AC-4: once an input changed (out-of-date) the view holds no warning at all, and a Recalculate with the zeros corrected leaves none on the new calculation', async () => {
    const { estimateId, part, sub } = await engineerWentAhead();
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    const cleared = await review.getCosts(leadOf(db), estimateId);
    expect(cleared.state).toBe('out-of-date');
    expect(cleared.warning).toBeNull();

    // Both zeros are corrected, which is an input change too; the Lead's Recalculate then needs no acknowledgement, and the new calculation has a list of its own: none.
    for (const nodeId of [part, sub]) {
      await db.owner.query("UPDATE estimate_nodes SET inputs = jsonb_set(inputs, ARRAY[$2::text], '\"4.00\"'::jsonb) WHERE id = $1::uuid", [nodeId, QTY()]);
    }
    await db.owner.query('UPDATE estimates SET inputs_revision = inputs_revision + 1 WHERE id = $1::uuid', [estimateId]);
    await db.service.recalculate(leadOf(db), estimateId, leadPresses());
    const current = await review.getCosts(leadOf(db), estimateId);
    expect(current.state).toBe('current');
    expect(current.warning).toBeNull();
    expect(defined((await calculationsOf(estimateId)).at(-1)).warnings).toEqual([]);
  });

  it('a calculation made with no zero has no warning', async () => {
    const estimateId = await db.addCompleteEstimate();
    await db.service.calculate(engineerOf(db), estimateId);
    expect((await review.getCosts(leadOf(db), estimateId)).warning).toBeNull();
  });
});

describe('AC-3 (Approved), AC-5: a warning never stops an approval, and stays with what was approved', () => {
  it('the Lead approves a calculation that carries a warning, and the approved estimate\'s view still names who went ahead', async () => {
    const { estimateId } = await engineerWentAhead();
    const calculationId = await currentCalculationOf(db, estimateId);
    const answer = await db.approvalService.approve(leadOf(db), estimateId, requestFor(db, calculationId));
    expect(answer).toMatchObject({ status: 'APPROVED' });
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
    const costs = await review.getCosts(leadOf(db), estimateId);
    expect(costs.approval).not.toBeNull();
    expect(costs.warning?.madeBy).toBe(ENGINEER_STORED_NAME);
    expect(costs.warning?.rows.map((row) => row.slNo)).toEqual(['1.1', '1.1.1']);
  });
});
