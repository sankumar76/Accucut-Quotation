import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError } from '@/lib/errors';
import { decideTransition, stateOf, type EstimateEvent, type EstimateStatus } from '@/lib/estimate/state-machine';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository, type EstimateRepository } from '@/server/repositories/estimate-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { auditFor, changeContext, withAuditContext } from '../../support/customer-change';
import { defined } from '../../support/defined';
import { inputsDependencies } from '../../support/estimate-inputs-deps';

/**
 * CR-01 item 7B (AQP-399; architecture section 4.12 a; ADR-019) against real PostgreSQL in a throwaway database: QUOTED and the Ignored layer through the real repository, the real row lock and the
 * real CHECKs. Marking as quoted records the person with the status in one UPDATE; Unlock and Cancel from QUOTED clear the quote columns in the same UPDATE (the CHECK would refuse anything else); a locked
 * estimate, quoted or approved, is refused every input write; an ignored estimate is refused every event with its own code; the repository reads the layer and the quote marker; and Restore, which 7D
 * writes, would return the status underneath exactly, for each of Draft, Prepared and Approved (ADR-019, Verification). The Ignore and Restore writes are set directly here: their service is story 7D.
 * Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: EstimateService;
let estimates: EstimateRepository;
let runner: TransactionRunner;
let leadId: string;
let adminId: string;
let arjunId: string;
let estimateId: string;
let customerId: string;
let taskCode: string;
let taskNumber = 0;

beforeAll(async () => {
  db = await openAuthDatabase();
  estimates = createEstimateRepository(db.prisma);
  runner = createTransactionRunner(db.prisma);
  service = withAuditContext(createEstimateService({ estimates, audit: auditFor(db), nodes: createEstimateNodeRepository(db.prisma), images: createImageRepository(db.prisma), transactions: runner, ...inputsDependencies() }));
  leadId = await insertPersonAsOwner(db, 'Quoted Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Quoted Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Quoted Arjun', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimate_nodes');
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query("DELETE FROM customers c WHERE c.name LIKE 'Quoted %'");
});

const lead = () => ({ id: leadId, role: 'LEAD' as const });
const admin = () => ({ id: adminId, role: 'ADMIN' as const });
const arjun = () => ({ id: arjunId, role: 'ENGINEER' as const });

/** Arjun's task and its estimate in the given status, with a customer chosen. A QUOTED row carries the quote columns, as `ck_estimates_quoted` demands. */
async function setUpEstimate(status: EstimateStatus): Promise<void> {
  taskNumber += 1;
  taskCode = `Q-2026-${String(6000 + taskNumber)}`;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject)
     VALUES ($4, $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z', 'Invented task', 'Invented subject') RETURNING id::text AS id`,
    [arjunId, leadId, PATH, taskCode],
  );
  const customer = await db.owner.query<{ id: string }>('INSERT INTO customers (name, short_name) VALUES ($1, left(md5($1), 10)) RETURNING id::text AS id', [`Quoted Brightwater Controls ${String(taskNumber)}`]);
  customerId = defined(customer.rows[0]).id;
  const estimate = await db.owner.query<{ id: string }>(
    `INSERT INTO estimates (task_id, customer_id, status, inputs_revision, quoted_at, quoted_by)
     VALUES ($1::uuid, $2::uuid, $3::estimate_status, 4, CASE WHEN $3 = 'QUOTED' THEN now() END, CASE WHEN $3 = 'QUOTED' THEN $4::uuid END) RETURNING id::text AS id`,
    [defined(task.rows[0]).id, customerId, status, leadId],
  );
  estimateId = defined(estimate.rows[0]).id;
}

/** What 7D's Ignore writes: the three columns of the layer, the status untouched. */
const ignore = (): Promise<unknown> =>
  db.owner.query("UPDATE estimates SET ignored_at = now(), ignored_by = $2::uuid, ignore_remarks = 'Invented remarks.' WHERE id = $1::uuid", [estimateId, leadId]);
/** What 7D's Restore writes: the three columns cleared, the status untouched. */
const restore = (): Promise<unknown> => db.owner.query('UPDATE estimates SET ignored_at = NULL, ignored_by = NULL, ignore_remarks = NULL WHERE id = $1::uuid', [estimateId]);

interface Stored {
  readonly status: string;
  readonly quotedBy: string | null;
  readonly quotedAtSet: boolean;
  readonly ignoredAtSet: boolean;
  readonly revision: number;
  readonly updatedAt: string;
}

const stored = async (): Promise<Stored> => {
  const { rows } = await db.owner.query<{ status: string; quoted_by: string | null; quoted_at_set: boolean; ignored_at_set: boolean; inputs_revision: number; updated_at: string }>(
    `SELECT status::text AS status, quoted_by::text AS quoted_by, quoted_at IS NOT NULL AS quoted_at_set, ignored_at IS NOT NULL AS ignored_at_set, inputs_revision, updated_at::text AS updated_at
     FROM estimates WHERE id = $1::uuid`,
    [estimateId],
  );
  const row = defined(rows[0]);
  return { status: row.status, quotedBy: row.quoted_by, quotedAtSet: row.quoted_at_set, ignoredAtSet: row.ignored_at_set, revision: row.inputs_revision, updatedAt: row.updated_at };
};

const caught = (work: Promise<unknown>): Promise<unknown> => work.catch((error: unknown) => error);

describe('Mark as quoted: the status and the person move in one UPDATE', () => {
  it.each([
    ['a Lead', lead, () => leadId],
    ['an Admin', admin, () => adminId],
  ] as const)('%s takes an APPROVED estimate to QUOTED, and quoted_by names them, quoted_at is the database clock, and the inputs revision stays', async (_name, viewer, personId) => {
    await setUpEstimate('APPROVED');
    const before = await stored();
    await expect(service.transition(viewer(), estimateId, 'MARK_QUOTED')).resolves.toEqual({ id: estimateId, from: 'APPROVED', to: 'QUOTED' });
    expect(await stored()).toMatchObject({ status: 'QUOTED', quotedBy: personId(), quotedAtSet: true, ignoredAtSet: false, revision: before.revision });
  });

  it('a second press is the 409 ESTIMATE_ALREADY_QUOTED and changes nothing; a Draft or a Prepared estimate is ESTIMATE_NOT_APPROVED', async () => {
    await setUpEstimate('APPROVED');
    await service.transition(lead(), estimateId, 'MARK_QUOTED');
    const quoted = await stored();
    const again = await caught(service.transition(admin(), estimateId, 'MARK_QUOTED'));
    expect(again).toBeInstanceOf(ConflictError);
    expect(again).toMatchObject({ code: 'ESTIMATE_ALREADY_QUOTED' });
    expect(await stored()).toEqual(quoted);
    for (const status of ['DRAFT', 'PREPARED'] as const) {
      await setUpEstimate(status);
      expect(await caught(service.transition(lead(), estimateId, 'MARK_QUOTED'))).toMatchObject({ code: 'ESTIMATE_NOT_APPROVED' });
    }
  });

  it('is refused to an Engineer as a 404 on their own estimate, whatever the status, and nothing changes', async () => {
    await setUpEstimate('APPROVED');
    const before = await stored();
    expect(await caught(service.transition(arjun(), estimateId, 'MARK_QUOTED'))).toMatchObject({ httpStatus: 404 });
    expect(await stored()).toEqual(before);
  });
});

describe('AC-5 (A-CR01-1): Unlock and Cancel from QUOTED go to DRAFT and clear the quote columns in the same UPDATE', () => {
  it.each([
    ['UNLOCK', lead],
    ['UNLOCK', admin],
    ['CANCEL', admin],
  ] as const)('%s by %o: the row is DRAFT, quoted_at and quoted_by are null, and the revision is as it was', async (event, viewer) => {
    await setUpEstimate('QUOTED');
    const before = await stored();
    expect(before).toMatchObject({ status: 'QUOTED', quotedBy: leadId, quotedAtSet: true });
    await expect(service.transition(viewer(), estimateId, event)).resolves.toEqual({ id: estimateId, from: 'QUOTED', to: 'DRAFT' });
    expect(await stored()).toMatchObject({ status: 'DRAFT', quotedBy: null, quotedAtSet: false, revision: before.revision });
  });

  it('the repository itself refuses to leave QUOTED half way: moving the status and the markers in one call is what keeps ck_estimates_quoted true', async () => {
    await setUpEstimate('QUOTED');
    await expect(runner.run((tx) => estimates.setStatus(estimateId, 'QUOTED', 'DRAFT', tx))).resolves.toBe(true);
    expect(await stored()).toMatchObject({ status: 'DRAFT', quotedBy: null, quotedAtSet: false });
    // The way in needs the person, and fails before the database does when it is missing.
    await expect(runner.run((tx) => estimates.setStatus(estimateId, 'DRAFT', 'QUOTED', tx))).rejects.toThrow('Marking an estimate as quoted needs the person who quoted it.');
    expect(await stored()).toMatchObject({ status: 'DRAFT' });
  });

  it('a stale move writes nothing: the conditional UPDATE finds another status and answers false', async () => {
    await setUpEstimate('QUOTED');
    await expect(runner.run((tx) => estimates.setStatus(estimateId, 'APPROVED', 'DRAFT', tx))).resolves.toBe(false);
    expect(await stored()).toMatchObject({ status: 'QUOTED', quotedBy: leadId });
  });
});

describe('AC-4: a QUOTED estimate is locked like an APPROVED one', () => {
  it.each([
    ['CALCULATE', arjun],
    ['RECALCULATE', lead],
    ['EDIT', lead],
    ['APPROVE', lead],
  ] as const)('%s is the 409 ESTIMATE_APPROVED_IS_LOCKED with the same words, and the row is as it was', async (event, viewer) => {
    await setUpEstimate('QUOTED');
    const before = await stored();
    const refusal = await caught(service.transition(viewer(), estimateId, event));
    expect(refusal).toBeInstanceOf(ConflictError);
    expect(refusal).toMatchObject({ httpStatus: 409, code: 'ESTIMATE_APPROVED_IS_LOCKED', message: 'This estimate is approved and locked. Unlock it first.' });
    expect(await stored()).toEqual(before);
  });

  it('Export is allowed and leaves it QUOTED, quote columns and all', async () => {
    await setUpEstimate('QUOTED');
    const before = await stored();
    await expect(service.transition(lead(), estimateId, 'EXPORT')).resolves.toEqual({ id: estimateId, from: 'QUOTED', to: 'QUOTED' });
    expect(await stored()).toEqual(before);
  });

  it('no input is written: choosing a customer is refused as the 409 of the form, for a Lead and an Admin', async () => {
    await setUpEstimate('QUOTED');
    const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name, short_name) VALUES ($1, left(md5($1), 10)) RETURNING id::text AS id', [`Quoted Marlow Agro Systems ${String(taskNumber)}`]);
    const other = defined(rows[0]).id;
    const before = await stored();
    for (const viewer of [lead(), admin()]) {
      expect(await caught(service.setCustomer(viewer, changeContext(viewer), estimateId, other))).toMatchObject({ httpStatus: 409, code: 'ESTIMATE_NOT_EDITABLE' });
    }
    expect(await stored()).toEqual(before);
  });
});

describe('AQP-399 AC-6: an ignored estimate is read-only, and says why', () => {
  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('an ignored %s estimate refuses every event with the 409 ESTIMATE_IGNORED, and the row is as it was', async (status) => {
    await setUpEstimate(status);
    await ignore();
    const before = await stored();
    for (const [event, viewer] of [['CALCULATE', arjun], ['RECALCULATE', lead], ['EDIT', lead], ['APPROVE', lead], ['UNLOCK', lead], ['CANCEL', admin], ['EXPORT', lead], ['MARK_QUOTED', lead]] as const) {
      const refusal = await caught(service.transition(viewer(), estimateId, event));
      expect(refusal, `${status} ${event}`).toBeInstanceOf(ConflictError);
      expect(refusal).toMatchObject({ code: 'ESTIMATE_IGNORED', message: 'This estimate is ignored. Restore it first.' });
    }
    expect(await stored()).toEqual(before);
  });

  it('no input is written while it is ignored: choosing a customer is the 409 ESTIMATE_IGNORED, even on a Draft', async () => {
    await setUpEstimate('DRAFT');
    await ignore();
    const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name, short_name) VALUES ($1, left(md5($1), 10)) RETURNING id::text AS id', [`Quoted Marlow Agro Systems ${String(taskNumber)}`]);
    const before = await stored();
    expect(await caught(service.setCustomer(lead(), changeContext(lead()), estimateId, defined(rows[0]).id))).toMatchObject({ httpStatus: 409, code: 'ESTIMATE_IGNORED' });
    expect(await stored()).toEqual(before);
  });

  it('Ignore and Restore are decided by the machine but not written by the status transition, so it refuses to call them done', async () => {
    await setUpEstimate('PREPARED');
    const refusal = await caught(service.transition(lead(), estimateId, 'IGNORE'));
    expect(refusal).not.toBeInstanceOf(ConflictError);
    expect((refusal as Error).message).toBe('Ignore and Restore are not written by the status transition.');
    expect((await stored()).ignoredAtSet).toBe(false);
  });
});

describe('QLT-B1 (review of #624): the tree actions of 3A reach assertEditable with the full state', () => {
  const MISSING_PART = '00000000-0000-4000-8000-0000000000fd';
  const nodeCount = async (): Promise<number> => Number((await db.owner.query<{ n: string }>('SELECT count(*)::text AS n FROM estimate_nodes WHERE estimate_id = $1::uuid', [estimateId])).rows[0]?.n);

  /** Add, reorder and delete, as a Lead: each is asked under the estimate's lock, before any part is looked up, so a part that does not exist makes no difference to the refusal. */
  const treeActions = (): Array<[string, () => Promise<unknown>]> => [
    ['add', () => service.addPart(lead(), estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' })],
    ['move', () => service.moveNode(lead(), estimateId, { nodeId: MISSING_PART, revision: 1, parentId: null, index: 0 })],
    ['delete', () => service.deleteNode(lead(), estimateId, { nodeId: MISSING_PART, revision: 1, parts: 1, subtree: 'none' })],
  ];

  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('an ignored %s estimate refuses add, move and delete with the 409 ESTIMATE_IGNORED, and stores no part (DL-300 (1))', async (status) => {
    await setUpEstimate(status);
    await ignore();
    for (const [name, act] of treeActions()) {
      const refusal = await caught(act());
      expect(refusal, `${status} ${name}`).toBeInstanceOf(ConflictError);
      expect(refusal).toMatchObject({ httpStatus: 409, code: 'ESTIMATE_IGNORED' });
    }
    expect(await nodeCount()).toBe(0);
  });

  it('the same estimate once restored takes an add again, so the refusal was the layer and nothing else', async () => {
    await setUpEstimate('DRAFT');
    await ignore();
    expect(await caught(service.addPart(lead(), estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' }))).toMatchObject({ code: 'ESTIMATE_IGNORED' });
    await restore();
    await expect(service.addPart(lead(), estimateId, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' })).resolves.toMatchObject({ nodeId: expect.any(String) });
    expect(await nodeCount()).toBe(1);
  });

  it('a QUOTED estimate refuses add, move and delete with the 409 ESTIMATE_NOT_EDITABLE, like an approved one', async () => {
    await setUpEstimate('QUOTED');
    for (const [name, act] of treeActions()) {
      expect(await caught(act()), name).toMatchObject({ httpStatus: 409, code: 'ESTIMATE_NOT_EDITABLE' });
    }
    expect(await nodeCount()).toBe(0);
  });
});

describe('AC-8: the repository reads the new columns', () => {
  it('reads the layer and the quote marker of the workspace, the lock and the access check, and null for an estimate that has neither', async () => {
    await setUpEstimate('QUOTED');
    const quoted = defined(await estimates.findWorkspaceByCode(taskCode));
    expect(quoted).toMatchObject({ status: 'QUOTED', quoted: { byId: leadId }, ignored: null });
    expect(quoted.quoted?.at).toBeInstanceOf(Date);
    expect(defined(await estimates.findEstimateAccess(estimateId))).toMatchObject({ status: 'QUOTED', ignoredAt: null });

    await setUpEstimate('PREPARED');
    await ignore();
    const ignored = defined(await estimates.findWorkspaceByCode(taskCode));
    expect(ignored).toMatchObject({ status: 'PREPARED', quoted: null, ignored: { byId: leadId, remarks: 'Invented remarks.' } });
    expect(ignored.ignored?.at).toBeInstanceOf(Date);
    expect(defined(await estimates.findEstimateAccess(estimateId)).ignoredAt).toBeInstanceOf(Date);
    const locked = await runner.run((tx) => estimates.lockEstimate(estimateId, tx));
    expect(defined(locked)).toMatchObject({ id: estimateId, status: 'PREPARED' });
    expect(defined(locked).ignoredAt).toBeInstanceOf(Date);

    await setUpEstimate('DRAFT');
    expect(defined(await estimates.findWorkspaceByCode(taskCode))).toMatchObject({ quoted: null, ignored: null });
    expect(defined(await runner.run((tx) => estimates.lockEstimate(estimateId, tx))).ignoredAt).toBeNull();
  });
});

describe('ADR-019 Verification: Restore returns each of DRAFT, PREPARED and APPROVED exactly', () => {
  it.each(['DRAFT', 'PREPARED', 'APPROVED'] as const)('Ignore leaves a %s estimate\'s status untouched, the machine\'s Restore leads back to it, and clearing the layer gives the row it had', async (status) => {
    await setUpEstimate(status);
    const before = await stored();
    await ignore();
    expect(await stored()).toMatchObject({ status, ignoredAtSet: true });
    const locked = defined(await runner.run((tx) => estimates.lockEstimate(estimateId, tx)));
    const decision = decideTransition(stateOf(locked), 'RESTORE' satisfies EstimateEvent, 'LEAD');
    expect(decision).toEqual({ allowed: true, from: status, to: status, ignored: false });
    await restore();
    expect({ ...(await stored()), updatedAt: '' }).toEqual({ ...before, updatedAt: '' });
  });
});
