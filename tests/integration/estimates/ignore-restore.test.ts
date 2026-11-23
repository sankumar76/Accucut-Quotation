import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError, StepUpFailed } from '@/lib/errors';
import { STEP_UP_FAILED_MESSAGE } from '@/lib/auth/step-up';
import { IGNORE_REMARKS_MAX_LENGTH } from '@/lib/estimate/ignore-words';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { createConfigRepository } from '@/server/repositories/config-repository';
import type { TransactionRunner } from '@/server/repositories/transaction';
import type { AuditService } from '@/server/services/audit-service';
import { createCancelApprovalService } from '@/server/services/cancel-approval-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateStatusService, type EstimateStatusService } from '@/server/services/estimate-status-service';
import { createRemovePriceService } from '@/server/services/remove-price-service';
import { createUnlockService, type UnlockService } from '@/server/services/unlock-service';
import type { StepUpService } from '@/server/services/step-up-service';

import {
  adminOf,
  auditOf,
  calculatedEstimate,
  currentCalculationOf,
  engineerOf,
  leadOf,
  refusalOf,
  requestFor,
  statusOf,
  storedOf,
  untilALockWaits,
} from '../../support/approval-helpers';
import { type CalculationDatabase, openCalculationDatabase } from '../../support/calculation-database';
import { defined } from '../../support/defined';
import { createHoldingRunner } from '../../support/hold-before-commit';

/**
 * CR-01 item 7D (AQP-401; AC-1, AC-2, AC-4, AC-5, AC-6, AC-9; FR-109; NFR-001, NFR-007; architecture section 4.12 a and c; ADR-019) against real PostgreSQL in a throwaway database, as the **runtime role**: Ignore and
 * Restore are written in one transaction under the estimate's real row lock, so the three columns and the audit entry exist together or not at all; Restore brings back **exactly** the status each of Draft, Prepared and
 * Approved had (the layer never touched it); a second Ignore, two at once, a Quoted estimate and a Restore of what is not ignored are refused and the row and the log are as they were; remarks the shared rule refuses are a
 * 422 before the row is read, and 500 code points (500 emoji) fit the column; an Engineer is refused before the row is read; the layer is read back by name for every role; and the routes that do not ask the state
 * machine (Remove price, Cancel approval, the Excel download's basis) refuse an ignored estimate by their own check, under the lock or the snapshot. The lock-wait tests hold the lock until `pg_locks` shows the call
 * waiting. Every promise is read before anything is asserted, and a held transaction is always let go in a `finally` (#443, DL-233). Every name, ID, number and password is invented.
 */

const REMARKS = 'Not taken forward.\nThe customer chose another supplier.';
const REASON = 'The customer asked for a new fixture. Start again.';
const RIGHT_PASSWORD = 'Invented-Right-Password-7!';
const INVENTED_FAILURE = 'Invented failure.';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';

let db: CalculationDatabase;
const lead = () => leadOf(db);
const admin = () => adminOf(db);
const engineer = () => engineerOf(db);
const request = (remarks: string = REMARKS) => ({ remarks, audit: auditOf(db) });
const restoreRequest = () => ({ audit: auditOf(db) });

const stepUp: Pick<StepUpService, 'verifyStepUp'> = {
  verifyStepUp: (_caller, password) => (password === RIGHT_PASSWORD ? Promise.resolve() : Promise.reject(new StepUpFailed(STEP_UP_FAILED_MESSAGE))),
};

beforeAll(async () => {
  db = await openCalculationDatabase();
}, 120_000);

afterAll(async () => {
  await db.close();
});

/** The status service over the real repositories, with the pieces a test of a failure part-way (or of a held transaction) replaces. */
function statusOver(replace: { transactions?: TransactionRunner; audit?: AuditService } = {}): EstimateStatusService {
  return createEstimateStatusService({
    estimates: db.estimates,
    transactions: replace.transactions ?? db.transactions,
    workflow: { transition: db.estimateService.transition, audit: replace.audit ?? db.audit },
  });
}
const status = (): EstimateStatusService => statusOver();

function unlocking(): UnlockService {
  const configurations = createConfigRepository(db.prisma);
  return createUnlockService({
    estimates: db.estimates,
    approvals: db.approvals,
    calculations: db.calculations,
    masters: db.masterRepository,
    configuration: { current: () => getCurrentVersion(configurations, createConfigVersionCache()), byId: (id) => getVersionById(configurations, id, createConfigVersionCache()) },
    transactions: db.transactions,
    workflow: { transition: db.estimateService.transition, audit: db.audit },
  });
}
const cancelling = () => createCancelApprovalService({ estimates: db.estimates, approvals: db.approvals, transactions: db.transactions, stepUp, workflow: { transition: db.estimateService.transition, audit: db.audit } });
const removingPrice = () => createRemovePriceService({ estimates: db.estimates, approvals: db.approvals, transactions: db.transactions, stepUp, audit: db.audit });

/** An estimate in this status, with a customer and no approval (enough for Ignore and Restore, which read no approval). */
const estimateIn = (state: 'DRAFT' | 'PREPARED' | 'APPROVED', options: { engineer?: boolean } = {}): Promise<string> => db.addEstimate({ status: state, ...options });

/** A calculated estimate that the Lead then approves: APPROVED with a live approval. */
async function approvedWithApproval(): Promise<string> {
  const calculated = await calculatedEstimate(db);
  const calculationId = await currentCalculationOf(db, calculated.estimateId);
  await db.approvalService.approve(lead(), calculated.estimateId, requestFor(db, calculationId, '1000.00'));
  return calculated.estimateId;
}

interface Stored {
  readonly status: string;
  readonly ignoredAt: Date | null;
  readonly ignoredBy: string | null;
  readonly remarks: string | null;
  readonly revision: number;
}

async function layerOf(estimateId: string): Promise<Stored> {
  const { rows } = await db.owner.query<{ status: string; ignored_at: Date | null; ignored_by: string | null; ignore_remarks: string | null; inputs_revision: number }>(
    'SELECT status::text AS status, ignored_at, ignored_by::text AS ignored_by, ignore_remarks, inputs_revision FROM estimates WHERE id = $1::uuid',
    [estimateId],
  );
  const row = defined(rows[0]);
  return { status: row.status, ignoredAt: row.ignored_at, ignoredBy: row.ignored_by, remarks: row.ignore_remarks, revision: row.inputs_revision };
}

/** The audit entries of one event about this estimate, oldest first. */
async function entriesOf(estimateId: string, event: string) {
  const { rows } = await db.owner.query<{ actor_id: string; actor_label: string; object_label: string; before: unknown; after: unknown; request_id: string }>(
    'SELECT actor_id::text, actor_label, object_label, before, after, request_id FROM audit_log WHERE event = $2 AND object_id = $1::uuid ORDER BY created_at, id',
    [estimateId, event],
  );
  return rows;
}

const taskCodeOf = async (estimateId: string): Promise<string> =>
  defined((await db.owner.query<{ code: string }>('SELECT t.code FROM tasks t JOIN estimates e ON e.task_id = t.id WHERE e.id = $1::uuid', [estimateId])).rows[0]).code;

describe('AC-1, AC-5: a good Ignore writes the three columns and one audit entry together', () => {
  it.each([
    ['a Lead', lead],
    ['an Admin', admin],
  ] as const)('%s ignores a PREPARED estimate: the status and the inputs revision stand, ignored_by names them, ignored_at is the database clock, and the answer holds the layer by name', async (_name, viewer) => {
    const estimateId = await estimateIn('PREPARED');
    const before = await layerOf(estimateId);
    const answer = await status().ignore(viewer(), estimateId, request());
    expect(answer).toEqual({ status: 'PREPARED', ignored: { at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/), byName: 'Invented Calculation Lead', remarks: REMARKS } });
    const after = await layerOf(estimateId);
    expect(after).toMatchObject({ status: 'PREPARED', ignoredBy: db.personId, remarks: REMARKS, revision: before.revision });
    // The time in the answer is the database's own, the one stored with the layer.
    expect(new Date(answer.ignored.at).getTime()).toBe(defined(after.ignoredAt).getTime());
  });

  it('writes exactly one entry estimate.ignored: the task code is the object, the actor is the person, the status before, the status and the remarks after, and no figure', async () => {
    const estimateId = await estimateIn('APPROVED');
    await status().ignore(lead(), estimateId, request());
    const entries = await entriesOf(estimateId, 'estimate.ignored');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actor_id: db.personId, actor_label: 'Calculation Lead', object_label: await taskCodeOf(estimateId), before: { status: 'APPROVED' }, after: { status: 'APPROVED', remarks: REMARKS }, request_id: auditOf(db).requestId });
    expect(Object.keys(defined(entries[0]).after as object).sort()).toEqual(['remarks', 'status']);
  });

  it('keeps the remarks trimmed and with their line breaks, and stores 500 code points (500 emoji), which fit the column\'s CHECK', async () => {
    const estimateId = await estimateIn('DRAFT');
    await status().ignore(lead(), estimateId, request('  First line.\r\nSecond line.  \n'));
    expect((await layerOf(estimateId)).remarks).toBe('First line.\nSecond line.');
    const long = await estimateIn('DRAFT');
    const emoji = '\u{1F600}'.repeat(IGNORE_REMARKS_MAX_LENGTH);
    await status().ignore(lead(), long, request(emoji));
    expect((await layerOf(long)).remarks).toBe(emoji);
  });

  it('an audit entry that cannot be written takes the layer back: nothing is half written', async () => {
    const estimateId = await estimateIn('PREPARED');
    const before = await storedOf(db, estimateId);
    const failing = statusOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: not used.')), list: db.audit.list } });
    await expect(failing.ignore(lead(), estimateId, request())).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await layerOf(estimateId)).toMatchObject({ ignoredAt: null, ignoredBy: null, remarks: null });
    expect(await entriesOf(estimateId, 'estimate.ignored')).toEqual([]);
  });

  it('waits for the estimate\'s row lock: nothing is ignored while another transaction holds it, and the Ignore goes through once it lets go', async () => {
    const estimateId = await estimateIn('PREPARED');
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      waiting.current = refusalOf(status().ignore(lead(), estimateId, request()));
      // The lock is held until the Ignore is seen waiting for it: a holder that returned at once could commit before the Ignore asked, and the test would pass with or without the lock.
      await untilALockWaits(db);
      expect((await layerOf(estimateId)).ignoredAt).toBeNull();
      expect(await entriesOf(estimateId, 'estimate.ignored')).toEqual([]);
    });
    expect(await waiting.current).toBeUndefined();
    expect((await layerOf(estimateId)).ignoredAt).not.toBeNull();
    expect(await entriesOf(estimateId, 'estimate.ignored')).toHaveLength(1);
  });
});

describe('AC-1, AC-4: the role is refused first, before the row is read', () => {
  it('an Engineer is a ForbiddenError for their own estimate and for an ID that does not exist, on both routes, and nothing changes', async () => {
    const estimateId = await estimateIn('PREPARED', { engineer: true });
    const before = await storedOf(db, estimateId);
    expect(await refusalOf(status().ignore(engineer(), estimateId, request()))).toBeInstanceOf(ForbiddenError);
    expect(await refusalOf(status().ignore(engineer(), UNKNOWN_ESTIMATE_ID, request()))).toBeInstanceOf(ForbiddenError);
    expect(await refusalOf(status().restore(engineer(), estimateId, restoreRequest()))).toBeInstanceOf(ForbiddenError);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await entriesOf(estimateId, 'estimate.ignored')).toEqual([]);
  });

  it('an estimate that does not exist, and an ID that is none, are a NotFoundError for a Lead, on both routes', async () => {
    for (const id of [UNKNOWN_ESTIMATE_ID, 'not-an-id']) {
      expect(await refusalOf(status().ignore(lead(), id, request()))).toBeInstanceOf(NotFoundError);
      expect(await refusalOf(status().restore(lead(), id, restoreRequest()))).toBeInstanceOf(NotFoundError);
    }
  });
});

describe('AC-2: remarks the shared rule refuses are a 422 under `remarks` before the row is read, and nothing is written', () => {
  it.each([
    ['empty', ''],
    ['501 code points', 'x'.repeat(IGNORE_REMARKS_MAX_LENGTH + 1)],
    ['a zero-width joiner', 'Not taken‍ forward'],
    ['a NUL', 'Not taken\u0000 forward'],
    ['a lone surrogate', 'Not taken\uD800 forward'],
  ])('%s', async (_name, remarks) => {
    const estimateId = await estimateIn('PREPARED');
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(status().ignore(lead(), estimateId, request(remarks)));
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect((refusal as FieldValidationError).fields.map((field) => field.field)).toEqual(['remarks']);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await entriesOf(estimateId, 'estimate.ignored')).toEqual([]);
  });
});

describe('AC-1: every refusal is a 409 with its own code, and the row and the log are as they were', () => {
  it('a Quoted estimate cannot be ignored: ESTIMATE_QUOTED_IS_FINAL, and the Closed tab is the quote\'s', async () => {
    const estimateId = await estimateIn('APPROVED');
    await status().markQuoted(lead(), estimateId, { audit: auditOf(db) });
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(status().ignore(lead(), estimateId, request()));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.QUOTED_IS_FINAL.code });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await entriesOf(estimateId, 'estimate.ignored')).toEqual([]);
  });

  it('a second Ignore is ESTIMATE_ALREADY_IGNORED: no second entry, and the first person\'s remarks and time stay', async () => {
    const estimateId = await estimateIn('PREPARED');
    await status().ignore(lead(), estimateId, request('First remarks.'));
    const first = await layerOf(estimateId);
    const again = await refusalOf(status().ignore(admin(), estimateId, request('Second remarks.')));
    expect(again).toBeInstanceOf(ConflictError);
    expect(again).toMatchObject({ code: TRANSITION_REFUSALS.ALREADY_IGNORED.code });
    expect(await layerOf(estimateId)).toEqual(first);
    expect(await entriesOf(estimateId, 'estimate.ignored')).toHaveLength(1);
  });

  it('two Ignores at once leave exactly one layer and one entry: the second waits for the first\'s lock, then finds the layer and is the 409', async () => {
    const estimateId = await estimateIn('PREPARED');
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached!: () => void;
    const holding = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const first = refusalOf(statusOver({ transactions: createHoldingRunner(db, hold, reached) }).ignore(lead(), estimateId, request('One.')));
    try {
      // The first has done its work (the columns and the entry written) and waits, uncommitted, holding the row lock.
      await holding;
      const second = refusalOf(status().ignore(admin(), estimateId, request('Two.')));
      await untilALockWaits(db);
      expect(await entriesOf(estimateId, 'estimate.ignored')).toEqual([]);
      release();
      expect(await first).toBeUndefined();
      expect(await second).toMatchObject({ code: TRANSITION_REFUSALS.ALREADY_IGNORED.code });
    } finally {
      release();
      await first;
    }
    expect(await layerOf(estimateId)).toMatchObject({ remarks: 'One.' });
    expect(await entriesOf(estimateId, 'estimate.ignored')).toHaveLength(1);
  });

  it('Restore of an estimate that is not ignored is ESTIMATE_NOT_IGNORED and writes nothing', async () => {
    const estimateId = await estimateIn('PREPARED');
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(status().restore(lead(), estimateId, restoreRequest()));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.NOT_IGNORED.code });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await entriesOf(estimateId, 'estimate.restored')).toEqual([]);
  });
});

describe('AC-4, AC-5: Restore clears the three columns under the lock and gives the status back exactly', () => {
  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('from %s: Ignore then Restore returns the same status, clears the columns, leaves the inputs revision, and the task returns to the tab that status fits', async (state) => {
    const estimateId = await estimateIn(state);
    const before = await layerOf(estimateId);
    await status().ignore(lead(), estimateId, request());
    expect(await status().restore(admin(), estimateId, restoreRequest())).toEqual({ status: state });
    expect(await layerOf(estimateId)).toEqual({ ...before, ignoredAt: null, ignoredBy: null, remarks: null });
  });

  it('writes one entry estimate.restored: the Ignore remarks before (they stay on record) and the status after, by the person who restored', async () => {
    const estimateId = await estimateIn('PREPARED');
    await status().ignore(lead(), estimateId, request());
    await status().restore(admin(), estimateId, restoreRequest());
    const entries = await entriesOf(estimateId, 'estimate.restored');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actor_id: db.personId, object_label: await taskCodeOf(estimateId), before: { status: 'PREPARED', remarks: REMARKS }, after: { status: 'PREPARED' } });
    expect(await entriesOf(estimateId, 'estimate.ignored')).toHaveLength(1);
  });

  it('an entry that cannot be written takes the clearing back: the estimate is still ignored with its remarks', async () => {
    const estimateId = await estimateIn('PREPARED');
    await status().ignore(lead(), estimateId, request());
    const failing = statusOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: not used.')), list: db.audit.list } });
    await expect(failing.restore(lead(), estimateId, restoreRequest())).rejects.toThrow(INVENTED_FAILURE);
    expect(await layerOf(estimateId)).toMatchObject({ remarks: REMARKS });
    expect((await layerOf(estimateId)).ignoredAt).not.toBeNull();
    expect(await entriesOf(estimateId, 'estimate.restored')).toEqual([]);
  });

  it('waits for the estimate\'s row lock, and a second Restore is the 409 with no second entry', async () => {
    const estimateId = await estimateIn('PREPARED');
    await status().ignore(lead(), estimateId, request());
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      waiting.current = refusalOf(status().restore(lead(), estimateId, restoreRequest()));
      await untilALockWaits(db);
      expect((await layerOf(estimateId)).ignoredAt).not.toBeNull();
    });
    expect(await waiting.current).toBeUndefined();
    expect(await refusalOf(status().restore(lead(), estimateId, restoreRequest()))).toMatchObject({ code: TRANSITION_REFUSALS.NOT_IGNORED.code });
    expect(await entriesOf(estimateId, 'estimate.restored')).toHaveLength(1);
  });
});

describe('AC-9: the layer is read back by name, the same for every role, and the repository holds no ID of it', () => {
  it('the workspace names who ignored it, when and the remarks for an Engineer, a Lead and an Admin, and keeps the status underneath', async () => {
    const estimateId = await estimateIn('APPROVED', { engineer: true });
    await status().ignore(lead(), estimateId, request());
    const code = await taskCodeOf(estimateId);
    for (const viewer of [engineer(), lead(), admin()]) {
      const workspace = defined(await db.estimateService.getWorkspace(viewer, code));
      expect(workspace.status).toBe('APPROVED');
      expect(workspace.ignored).toEqual({ at: expect.any(Date), byName: 'Invented Calculation Lead', remarks: REMARKS });
      expect(workspace.engineerName).toBe('Invented Calculation Engineer');
    }
  });

  it('is null for an estimate that is not ignored, and after Restore', async () => {
    const estimateId = await estimateIn('PREPARED', { engineer: true });
    const code = await taskCodeOf(estimateId);
    expect(defined(await db.estimateService.getWorkspace(lead(), code)).ignored).toBeNull();
    await status().ignore(lead(), estimateId, request());
    await status().restore(lead(), estimateId, restoreRequest());
    expect(defined(await db.estimateService.getWorkspace(lead(), code)).ignored).toBeNull();
  });

  it('the marker is read inside the transaction that wrote it, and not for an estimate that is not ignored', async () => {
    const ignored = await estimateIn('PREPARED');
    const open = await estimateIn('PREPARED');
    await db.transactions.run(async (tx) => {
      expect(await db.estimates.findIgnoreMarker(open, tx)).toBeNull();
      expect(await db.estimates.findIgnoreMarker('not-an-id', tx)).toBeNull();
      expect(await db.estimates.setIgnored(ignored, db.personId, 'Inside the transaction.', tx)).toBe(true);
      expect(await db.estimates.findIgnoreMarker(ignored, tx)).toEqual({ at: expect.any(Date), byName: 'Invented Calculation Lead', remarks: 'Inside the transaction.' });
      // A repeat writes nothing: the write is conditional on the layer being clear.
      expect(await db.estimates.setIgnored(ignored, db.personId, 'Again.', tx)).toBe(false);
    });
  });
});

describe('AC-6: the routes that do not ask the state machine refuse an ignored estimate by their own check, under the lock or the snapshot', () => {
  it('Cancel approval says "ignored" before it looks at the approval, the customer or the materials, and writes nothing', async () => {
    const estimateId = await approvedWithApproval();
    const approvalId = defined((await db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at DESC LIMIT 1', [estimateId])).rows[0]).id;
    await status().ignore(lead(), estimateId, request());
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(cancelling().cancel(admin(), estimateId, { approvalId, reason: REASON, password: RIGHT_PASSWORD, audit: auditOf(db) }));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code, message: TRANSITION_REFUSALS.IGNORED.message });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('APPROVED');
  });

  it('Cancel approval of an ignored estimate with no approval at all is "ignored" too, not "no approval to cancel"', async () => {
    const estimateId = await estimateIn('PREPARED');
    await status().ignore(lead(), estimateId, request());
    expect(await refusalOf(cancelling().cancel(admin(), estimateId, { approvalId: UNKNOWN_ESTIMATE_ID, reason: REASON, password: RIGHT_PASSWORD, audit: auditOf(db) }))).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
  });

  it('Remove price says "ignored" under the lock, before it looks at the approval', async () => {
    const estimateId = await approvedWithApproval();
    await status().ignore(lead(), estimateId, request());
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(removingPrice().removePrice(admin(), estimateId, { approvalId: UNKNOWN_ESTIMATE_ID, password: RIGHT_PASSWORD, audit: auditOf(db) }));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

  it('Unlock, Recalculate and Approve are the state machine\'s IGNORED, whatever the status underneath, and Unlock keeps the approval live', async () => {
    const estimateId = await approvedWithApproval();
    await status().ignore(lead(), estimateId, request());
    const before = await storedOf(db, estimateId);
    expect(await refusalOf(unlocking().unlock(lead(), estimateId, { reason: REASON, audit: auditOf(db) }))).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
    for (const event of ['RECALCULATE', 'APPROVE', 'EDIT'] as const) {
      expect(await refusalOf(db.estimateService.transition(lead(), estimateId, event))).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
    }
    expect(await storedOf(db, estimateId)).toEqual(before);
  });

  it('the basis of the Excel download carries the layer, so the export reads it in the same snapshot as the figures; an Engineer\'s Calculate on their own ignored estimate is the 409, after the 404 for another\'s', async () => {
    const estimateId = await estimateIn('DRAFT', { engineer: true });
    expect(defined(await db.calculations.findFigureBasis(estimateId)).ignoredAt).toBeNull();
    await status().ignore(lead(), estimateId, request());
    expect(defined(await db.calculations.findFigureBasis(estimateId)).ignoredAt).toBeInstanceOf(Date);
    expect(await refusalOf(db.estimateService.transition(engineer(), estimateId, 'CALCULATE'))).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
    const another = { id: db.otherEngineerId, role: 'ENGINEER' as const };
    expect(await refusalOf(db.estimateService.transition(another, estimateId, 'CALCULATE'))).toBeInstanceOf(NotFoundError);
  });

  it('the tree and the inputs are refused ESTIMATE_IGNORED for the Engineer whose task it is, and another Engineer is told it is not found', async () => {
    const estimateId = await estimateIn('DRAFT', { engineer: true });
    await status().ignore(lead(), estimateId, request());
    const another = { id: db.otherEngineerId, role: 'ENGINEER' as const };
    expect(await refusalOf(db.estimateService.addPart(engineer(), estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' }))).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
    expect(await refusalOf(db.estimateService.addPart(another, estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' }))).toBeInstanceOf(NotFoundError);
    expect(await refusalOf(db.estimateService.setCustomer(lead(), auditOf(db), estimateId, db.customerId))).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code });
  });
});
