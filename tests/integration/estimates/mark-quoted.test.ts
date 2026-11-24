import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { StepUpFailed, ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { STEP_UP_FAILED_MESSAGE } from '@/lib/auth/step-up';
import { TRANSITION_REFUSALS } from '@/lib/estimate/state-machine';
import { createConfigRepository } from '@/server/repositories/config-repository';
import type { TransactionRunner } from '@/server/repositories/transaction';
import type { AuditService } from '@/server/services/audit-service';
import { createCancelApprovalService } from '@/server/services/cancel-approval-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import { createEstimateStatusService, type EstimateStatusService } from '@/server/services/estimate-status-service';
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
 * CR-01 item 7C (AQP-400; AC-2, AC-3, AC-5 to AC-8; FR-110; NFR-001, NFR-007; architecture section 4.12 a, c; ADR-019) against real PostgreSQL in a throwaway database, as the **runtime role**: Mark as quoted is written in
 * one transaction under the estimate's real row lock, so the status, `quoted_at`, `quoted_by` and the audit entry exist together or not at all; a second press and two at once leave exactly one mark and one entry; a Draft,
 * a Prepared estimate and an ignored one (an ignored Draft or Prepared one is "ignored", not "not approved") are refused and the row and the log are as they were; an Engineer is refused before the row is read; the
 * marker is read back by name for a Lead and an Admin and is null for an Engineer's workspace; and the only way back from QUOTED is Unlock (a Lead or an Admin, with the reason) or Cancel approval (the Admin), each
 * of which returns the estimate to DRAFT with the marker cleared in the same UPDATE and writes its own existing entry. The lock-wait tests hold the lock until `pg_locks` shows the call waiting, so they fail if it
 * does not take the lock. Every promise is read before anything is asserted, and a held transaction is always let go in a `finally` (#443, DL-233). Every name, ID, number and password is invented.
 */

const REASON = 'The customer asked for a new fixture. Start again.';
const RIGHT_PASSWORD = 'Invented-Right-Password-7!';
const INVENTED_FAILURE = 'Invented failure.';
const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';

let db: CalculationDatabase;
const lead = () => leadOf(db);
const admin = () => adminOf(db);
const engineer = () => engineerOf(db);
const request = () => ({ audit: auditOf(db) });

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
const marking = (): EstimateStatusService => statusOver();

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

/** An estimate in this status, with a customer and no approval (enough for the mark itself, which reads no approval). */
const estimateIn = (status: 'DRAFT' | 'PREPARED' | 'APPROVED', options: { engineer?: boolean } = {}): Promise<string> => db.addEstimate({ status, ...options });

/** A calculated estimate that the Lead then approves: APPROVED with a live approval, for the unlock and the cancel. */
async function approvedWithApproval(): Promise<string> {
  const calculated = await calculatedEstimate(db);
  const calculationId = await currentCalculationOf(db, calculated.estimateId);
  await db.approvalService.approve(lead(), calculated.estimateId, requestFor(db, calculationId, '1000.00'));
  return calculated.estimateId;
}

/** The ignored layer, set as story 7D's Ignore will set it: the three columns, the status untouched. */
const ignore = (estimateId: string): Promise<unknown> =>
  db.owner.query("UPDATE estimates SET ignored_at = now(), ignored_by = $2::uuid, ignore_remarks = 'Invented remarks.' WHERE id = $1::uuid", [estimateId, db.personId]);

interface Stored {
  readonly status: string;
  readonly quotedBy: string | null;
  readonly quotedAt: Date | null;
  readonly ignoredAtSet: boolean;
  readonly revision: number;
  readonly updatedAt: string;
}

async function quoteOf(estimateId: string): Promise<Stored> {
  const { rows } = await db.owner.query<{ status: string; quoted_by: string | null; quoted_at: Date | null; ignored_at_set: boolean; inputs_revision: number; updated_at: string }>(
    `SELECT status::text AS status, quoted_by::text AS quoted_by, quoted_at, ignored_at IS NOT NULL AS ignored_at_set, inputs_revision, updated_at::text AS updated_at
     FROM estimates WHERE id = $1::uuid`,
    [estimateId],
  );
  const row = defined(rows[0]);
  return { status: row.status, quotedBy: row.quoted_by, quotedAt: row.quoted_at, ignoredAtSet: row.ignored_at_set, revision: row.inputs_revision, updatedAt: row.updated_at };
}

/** The audit entries of one event about this estimate, oldest first. */
async function entriesOf(estimateId: string, event: string) {
  const { rows } = await db.owner.query<{ actor_id: string; actor_label: string; object_label: string; before: unknown; after: unknown; request_id: string }>(
    `SELECT actor_id::text, actor_label, object_label, before, after, request_id FROM audit_log WHERE event = $2 AND object_id = $1::uuid ORDER BY created_at, id`,
    [estimateId, event],
  );
  return rows;
}

const taskCodeOf = async (estimateId: string): Promise<string> =>
  defined((await db.owner.query<{ code: string }>('SELECT t.code FROM tasks t JOIN estimates e ON e.task_id = t.id WHERE e.id = $1::uuid', [estimateId])).rows[0]).code;

describe('AC-2, AC-7: a good mark writes the status, the marker and one audit entry together', () => {
  it.each([
    ['a Lead', lead],
    ['an Admin', admin],
  ] as const)('%s takes an APPROVED estimate to QUOTED: quoted_by names them, quoted_at is the database clock, the inputs revision stays, and the answer names them and the time', async (_name, viewer) => {
    const estimateId = await estimateIn('APPROVED');
    const before = await quoteOf(estimateId);
    const answer = await marking().markQuoted(viewer(), estimateId, request());
    expect(answer).toEqual({ status: 'QUOTED', quoted: { at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/), byName: 'Invented Calculation Lead' } });
    const after = await quoteOf(estimateId);
    expect(after).toMatchObject({ status: 'QUOTED', quotedBy: db.personId, ignoredAtSet: false, revision: before.revision });
    // The time in the answer is the database's own, the one stored with the status.
    expect(new Date(answer.quoted.at).getTime()).toBe(defined(after.quotedAt).getTime());
  });

  it('writes exactly one entry estimate.quoted: the task code is the object, the actor is the person, the status is APPROVED before and QUOTED after, and nothing else is in it', async () => {
    const estimateId = await estimateIn('APPROVED');
    await marking().markQuoted(lead(), estimateId, request());
    const entries = await entriesOf(estimateId, 'estimate.quoted');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actor_id: db.personId, actor_label: 'Calculation Lead', object_label: await taskCodeOf(estimateId), before: { status: 'APPROVED' }, after: { status: 'QUOTED' }, request_id: auditOf(db).requestId });
    expect(Object.keys(defined(entries[0]).after as object)).toEqual(['status']);
  });

  it('an audit entry that cannot be written takes the status and the marker back: nothing is half written', async () => {
    const estimateId = await estimateIn('APPROVED');
    const before = await storedOf(db, estimateId);
    const failing = statusOver({ audit: { record: () => Promise.reject(new Error(INVENTED_FAILURE)), recordMany: () => Promise.reject(new Error('Invented: not used.')), list: db.audit.list } });
    await expect(failing.markQuoted(lead(), estimateId, request())).rejects.toThrow(INVENTED_FAILURE);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await quoteOf(estimateId)).toMatchObject({ status: 'APPROVED', quotedBy: null, quotedAt: null });
    expect(await entriesOf(estimateId, 'estimate.quoted')).toEqual([]);
  });

  it('waits for the estimate\'s row lock: nothing is marked while another transaction holds it, and the mark goes through once it lets go', async () => {
    const estimateId = await estimateIn('APPROVED');
    const waiting: { current?: Promise<unknown> } = {};
    await db.transactions.run(async (tx) => {
      await db.estimates.lockEstimate(estimateId, tx);
      waiting.current = refusalOf(marking().markQuoted(lead(), estimateId, request()));
      // The lock is held until the mark is seen waiting for it: a holder that returned at once could commit before the mark asked, and the test would pass with or without the lock.
      await untilALockWaits(db);
      expect(await statusOf(db, estimateId)).toBe('APPROVED');
      expect(await entriesOf(estimateId, 'estimate.quoted')).toEqual([]);
    });
    expect(await waiting.current).toBeUndefined();
    expect(await statusOf(db, estimateId)).toBe('QUOTED');
    expect(await entriesOf(estimateId, 'estimate.quoted')).toHaveLength(1);
  });
});

describe('AC-2: the role is refused first, before the row is read', () => {
  it('an Engineer is a ForbiddenError for their own estimate and for an ID that does not exist, and nothing changes', async () => {
    const estimateId = await estimateIn('APPROVED', { engineer: true });
    const before = await storedOf(db, estimateId);
    expect(await refusalOf(marking().markQuoted(engineer(), estimateId, request()))).toBeInstanceOf(ForbiddenError);
    expect(await refusalOf(marking().markQuoted(engineer(), UNKNOWN_ESTIMATE_ID, request()))).toBeInstanceOf(ForbiddenError);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await entriesOf(estimateId, 'estimate.quoted')).toEqual([]);
  });

  it('an estimate that does not exist, and an ID that is none, are a NotFoundError for a Lead', async () => {
    expect(await refusalOf(marking().markQuoted(lead(), UNKNOWN_ESTIMATE_ID, request()))).toBeInstanceOf(NotFoundError);
    expect(await refusalOf(marking().markQuoted(lead(), 'not-an-id', request()))).toBeInstanceOf(NotFoundError);
  });
});

describe('AC-3: every refusal is a 409 with its own code, and the row and the log are as they were', () => {
  it('a second press is ESTIMATE_ALREADY_QUOTED: no second entry, and the first marker and time stay', async () => {
    const estimateId = await estimateIn('APPROVED');
    await marking().markQuoted(lead(), estimateId, request());
    const quoted = await quoteOf(estimateId);
    const again = await refusalOf(marking().markQuoted(admin(), estimateId, request()));
    expect(again).toBeInstanceOf(ConflictError);
    expect(again).toMatchObject({ code: TRANSITION_REFUSALS.ALREADY_QUOTED.code });
    expect(await quoteOf(estimateId)).toEqual(quoted);
    expect(await entriesOf(estimateId, 'estimate.quoted')).toHaveLength(1);
  });

  it.each(['DRAFT', 'PREPARED'] as const)('a %s estimate is ESTIMATE_NOT_APPROVED', async (status) => {
    const estimateId = await estimateIn(status);
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(marking().markQuoted(lead(), estimateId, request()));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await entriesOf(estimateId, 'estimate.quoted')).toEqual([]);
  });

  it.each(['APPROVED', 'DRAFT', 'PREPARED'] as const)('an ignored %s estimate is ESTIMATE_IGNORED (the layer is refused first, so an ignored Draft or Prepared one is not "not approved"), and the row is as it was', async (status) => {
    const estimateId = await estimateIn(status);
    await ignore(estimateId);
    const before = await storedOf(db, estimateId);
    const refusal = await refusalOf(marking().markQuoted(lead(), estimateId, request()));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ code: TRANSITION_REFUSALS.IGNORED.code, message: TRANSITION_REFUSALS.IGNORED.message });
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await quoteOf(estimateId)).toMatchObject({ status, quotedBy: null, ignoredAtSet: true });
    expect(await entriesOf(estimateId, 'estimate.quoted')).toEqual([]);
  });

  it('two presses at once leave exactly one mark and one entry: the second waits for the first\'s lock, then finds QUOTED and is the 409', async () => {
    const estimateId = await estimateIn('APPROVED');
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached!: () => void;
    const holding = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const first = refusalOf(statusOver({ transactions: createHoldingRunner(db, hold, reached) }).markQuoted(lead(), estimateId, request()));
    try {
      // The first has done its work (status, marker and entry written) and waits, uncommitted, holding the row lock.
      await holding;
      const second = refusalOf(marking().markQuoted(admin(), estimateId, request()));
      await untilALockWaits(db);
      expect(await entriesOf(estimateId, 'estimate.quoted')).toEqual([]);
      release();
      expect(await first).toBeUndefined();
      expect(await second).toMatchObject({ code: TRANSITION_REFUSALS.ALREADY_QUOTED.code });
    } finally {
      release();
      await first;
    }
    expect(await quoteOf(estimateId)).toMatchObject({ status: 'QUOTED' });
    expect(await entriesOf(estimateId, 'estimate.quoted')).toHaveLength(1);
  });
});

describe('AC-6, AC-7: Unlock and Cancel approval are the only way back from QUOTED, and each returns it to DRAFT with the marker cleared in the same write', () => {
  it.each([
    ['a Lead', lead],
    ['an Admin', admin],
  ] as const)('%s unlocks a QUOTED estimate with a reason: DRAFT, quoted_at and quoted_by cleared, the unlock stored on the approval and the existing entry approval.unlocked written; the earlier estimate.quoted entry stays', async (_name, viewer) => {
    const estimateId = await approvedWithApproval();
    await marking().markQuoted(lead(), estimateId, request());
    expect(await quoteOf(estimateId)).toMatchObject({ status: 'QUOTED' });
    await expect(unlocking().preview(viewer(), estimateId)).resolves.toMatchObject({ engineerName: 'Invented Calculation Engineer' });
    await expect(unlocking().unlock(viewer(), estimateId, { reason: REASON, audit: auditOf(db) })).resolves.toMatchObject({ status: 'DRAFT' });
    expect(await quoteOf(estimateId)).toMatchObject({ status: 'DRAFT', quotedBy: null, quotedAt: null });
    const unlocked = await entriesOf(estimateId, 'approval.unlocked');
    expect(unlocked).toHaveLength(1);
    expect(defined(unlocked[0]).after).toMatchObject({ reason: REASON });
    // QLT-C-03 of the final review: the entry says the estimate left Quoted, as the cancel entry does, and keeps the price it stood at.
    expect(defined(unlocked[0]).before).toEqual({ approvedPrice: '1000.00', status: 'QUOTED' });
    expect(await entriesOf(estimateId, 'estimate.quoted')).toHaveLength(1);
  });

  it('the Admin cancels the approval of a QUOTED estimate: DRAFT, the marker cleared, and the existing entry approval.cancelled holds the stored status QUOTED before and DRAFT after', async () => {
    const estimateId = await approvedWithApproval();
    await marking().markQuoted(lead(), estimateId, request());
    const approvalId = defined((await db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at DESC LIMIT 1', [estimateId])).rows[0]).id;
    await expect(cancelling().cancel(admin(), estimateId, { approvalId, reason: REASON, password: RIGHT_PASSWORD, audit: auditOf(db) })).resolves.toMatchObject({ status: 'DRAFT' });
    expect(await quoteOf(estimateId)).toMatchObject({ status: 'DRAFT', quotedBy: null, quotedAt: null });
    const cancelled = await entriesOf(estimateId, 'approval.cancelled');
    expect(cancelled).toHaveLength(1);
    expect(defined(cancelled[0])).toMatchObject({ before: { status: 'QUOTED' }, after: { status: 'DRAFT', reason: REASON } });
  });

  it('a Lead cannot cancel an approval (Admin only), so a QUOTED estimate stays QUOTED and nothing is written', async () => {
    const estimateId = await approvedWithApproval();
    await marking().markQuoted(lead(), estimateId, request());
    const before = await storedOf(db, estimateId);
    const approvalId = defined((await db.owner.query<{ id: string }>('SELECT id::text FROM approvals WHERE estimate_id = $1::uuid ORDER BY approved_at DESC LIMIT 1', [estimateId])).rows[0]).id;
    expect(await refusalOf(cancelling().cancel(lead(), estimateId, { approvalId, reason: REASON, password: RIGHT_PASSWORD, audit: auditOf(db) }))).toBeInstanceOf(ForbiddenError);
    expect(await storedOf(db, estimateId)).toEqual(before);
    expect(await statusOf(db, estimateId)).toBe('QUOTED');
  });

  it('an unlocked estimate is a Draft again, so marking it as quoted is "not approved" until it is approved once more: a Quoted estimate never goes back to APPROVED', async () => {
    const estimateId = await approvedWithApproval();
    await marking().markQuoted(lead(), estimateId, request());
    await unlocking().unlock(lead(), estimateId, { reason: REASON, audit: auditOf(db) });
    expect(await refusalOf(marking().markQuoted(lead(), estimateId, request()))).toMatchObject({ code: TRANSITION_REFUSALS.NOT_APPROVED.code });
    expect(await statusOf(db, estimateId)).toBe('DRAFT');
  });

  it('a QUOTED estimate refuses Calculate, Recalculate and Approve as locked, with the words of an approved one', async () => {
    const estimateId = await approvedWithApproval();
    await marking().markQuoted(lead(), estimateId, request());
    for (const event of ['RECALCULATE', 'APPROVE', 'EDIT'] as const) {
      expect(await refusalOf(db.estimateService.transition(lead(), estimateId, event))).toMatchObject({ code: TRANSITION_REFUSALS.APPROVED_IS_LOCKED.code });
    }
    expect(await statusOf(db, estimateId)).toBe('QUOTED');
  });
});

describe('AC-8: the marker is the Lead\'s and the Admin\'s, by name, and an Engineer reads the status word and nothing of who marked it', () => {
  it('the workspace names who marked it and when for a Lead and an Admin, and the status word Quoted with no marker for the Engineer whose task it is', async () => {
    const estimateId = await estimateIn('APPROVED', { engineer: true });
    await marking().markQuoted(lead(), estimateId, request());
    const code = await taskCodeOf(estimateId);
    for (const viewer of [lead(), admin()]) {
      const workspace = defined(await db.estimateService.getWorkspace(viewer, code));
      expect(workspace.status).toBe('QUOTED');
      expect(workspace.quoted).toEqual({ at: expect.any(Date), byName: 'Invented Calculation Lead' });
      expect(workspace.ignored).toBeNull();
    }
    const owner = defined(await db.estimateService.getWorkspace(engineer(), code));
    expect(owner.status).toBe('QUOTED');
    expect(owner.quoted).toBeNull();
  });

  it('the marker is read back inside the transaction that wrote it, and not for an estimate that is not QUOTED', async () => {
    const approved = await estimateIn('APPROVED');
    const draft = await estimateIn('DRAFT');
    await db.transactions.run(async (tx) => {
      expect(await db.estimates.findQuoteMarker(approved, tx)).toBeNull();
      expect(await db.estimates.findQuoteMarker(draft, tx)).toBeNull();
      expect(await db.estimates.findQuoteMarker('not-an-id', tx)).toBeNull();
    });
  });
});
