import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { createAuditRepository } from '@/server/repositories/audit-repository';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createAuditService } from '@/server/services/audit-service';
import { createEstimateService, type EstimateService } from '@/server/services/estimate-service';

import { entriesFor, entryCount, insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { auditFor, changeContext } from '../../support/customer-change';
import { defined } from '../../support/defined';
import { inputsDependencies } from '../../support/estimate-inputs-deps';

/**
 * STORY-05.01 T3 (AC-1, AC-3, AC-4, AC-5), changed by CR-01 item 6 (AQP-390, AC-7, AC-8, AC-13, AC-17) against real PostgreSQL in a throwaway database: the estimate service over the real repository. The workspace
 * is read by the code of the task, with its subject and its customer's name and short name; changing the customer is a Lead's and an Admin's alone (an Engineer is refused before anything is read, for their own estimate,
 * another's and one that does not exist alike), takes the estimate's row lock, changes the customer, raises `inputs_revision` and writes one `estimate.customer_changed` entry in one transaction; the same customer again
 * writes neither; two changes at once are serialised. A deleted customer, an unknown one and an approved estimate are refused and leave the row as it was. Every name, path and date is invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let estimateId: string;
let brightwaterId: string;
let marlowId: string;

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createEstimateService({
    estimates: createEstimateRepository(db.prisma),
    audit: auditFor(db),
    nodes: createEstimateNodeRepository(db.prisma),
    images: createImageRepository(db.prisma),
    transactions: createTransactionRunner(db.prisma),
    ...inputsDependencies(),
  });
  leadId = await insertPersonAsOwner(db, 'Estimate Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Estimate Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Estimate Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Estimate Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

const insertCustomer = async (name: string, shortName: string): Promise<string> => {
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name, short_name) VALUES ($1, $2) RETURNING id::text AS id', [name, shortName]);
  return defined(rows[0]).id;
};

/** A task for Arjun with its draft estimate (with no customer: one made before CR-01, unless `withCustomer`), and two customers to choose between. */
async function setUpEstimate(withCustomer = false): Promise<void> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, subject, notes)
     VALUES ('Q-2026-0777', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z', 'Hopper cover', 'Feed hopper', 'Sheet-metal parts only.') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  brightwaterId = await insertCustomer('Estimate Brightwater Controls', 'EBWC');
  marlowId = await insertCustomer('Estimate Marlow Agro Systems', 'EMAS');
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id, customer_id) VALUES ($1::uuid, $2) RETURNING id::text AS id', [
    defined(task.rows[0]).id,
    withCustomer ? brightwaterId : null,
  ]);
  estimateId = defined(estimate.rows[0]).id;
}

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query("DELETE FROM customers WHERE name LIKE 'Estimate %'");
});

const stored = async (): Promise<{ customerId: string | null; revision: number; status: string }> => {
  const { rows } = await db.owner.query<{ customer_id: string | null; inputs_revision: number; status: string }>(
    'SELECT customer_id::text AS customer_id, inputs_revision, status::text AS status FROM estimates WHERE id = $1::uuid',
    [estimateId],
  );
  const row = defined(rows[0]);
  return { customerId: row.customer_id, revision: row.inputs_revision, status: row.status };
};

const arjun = () => ({ id: arjunId, role: 'ENGINEER' as const });
const lead = () => ({ id: leadId, role: 'LEAD' as const });
const admin = () => ({ id: adminId, role: 'ADMIN' as const });
const change = (viewer: { readonly id: string; readonly role: 'ENGINEER' | 'LEAD' | 'ADMIN' }, customerId: string, id: string = estimateId) =>
  service.setCustomer(viewer, changeContext(viewer), id, customerId);

describe('AC-1: the workspace is read by the code of the task', () => {
  it('gives the task as assigned, its subject, the name of who assigned it, the link built from the path, and no customer for an estimate made before CR-01', async () => {
    await setUpEstimate();
    const workspace = defined(await service.getWorkspace(arjun(), 'Q-2026-0777'));
    expect(workspace).toMatchObject({
      estimateId,
      code: 'Q-2026-0777',
      status: 'DRAFT',
      customer: null,
      folderPath: PATH,
      folderUrl: 'file:////invented-server/invented-share/RFQ-123',
      title: 'Hopper cover',
      subject: 'Feed hopper',
      notes: 'Sheet-metal parts only.',
      assignedByName: 'Invented Estimate Lead',
    });
    expect(workspace.deadlineAt.toISOString()).toBe('2026-11-12T11:30:00.000Z');
  });

  it('another Engineer and an unknown code get nothing, and a Lead and an Admin may open it', async () => {
    await setUpEstimate();
    expect(await service.getWorkspace({ id: priyaId, role: 'ENGINEER' }, 'Q-2026-0777')).toBeNull();
    expect(await service.getWorkspace(arjun(), 'Q-2026-0000')).toBeNull();
    expect(await service.getWorkspace(lead(), 'Q-2026-0777')).not.toBeNull();
    expect(await service.getWorkspace(admin(), 'Q-2026-0777')).not.toBeNull();
  });

  it('names the customer with its short name to the Engineer, read-only, and still names one that was deleted afterwards', async () => {
    await setUpEstimate(true);
    expect((await service.getWorkspace(arjun(), 'Q-2026-0777'))?.customer).toEqual({ id: brightwaterId, name: 'Estimate Brightwater Controls', shortName: 'EBWC' });
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [brightwaterId]);
    expect((await service.getWorkspace(arjun(), 'Q-2026-0777'))?.customer?.name).toBe('Estimate Brightwater Controls');
  });

  it('shows the short name the master has now: an edit of the short name reaches the next read (it is read through the join, never copied)', async () => {
    await setUpEstimate(true);
    await db.owner.query("UPDATE customers SET short_name = 'RENAMED' WHERE id = $1::uuid", [brightwaterId]);
    expect((await service.getWorkspace(arjun(), 'Q-2026-0777'))?.customer?.shortName).toBe('RENAMED');
  });
});

describe('AC-3, AC-4, AC-13: changing the customer', () => {
  it('a first customer on an estimate that has none is stored and raises the revision from 0 to 1 in the same transaction', async () => {
    await setUpEstimate();
    expect(await stored()).toEqual({ customerId: null, revision: 0, status: 'DRAFT' });
    expect(await change(lead(), brightwaterId)).toEqual({ id: estimateId, status: 'DRAFT', customer: { id: brightwaterId, name: 'Estimate Brightwater Controls', shortName: 'EBWC' } });
    expect(await stored()).toEqual({ customerId: brightwaterId, revision: 1, status: 'DRAFT' });
  });

  it('a different customer is a change (revision 2); the same one again, in any letter case, is not (revision stays 2)', async () => {
    await setUpEstimate();
    await change(lead(), brightwaterId);
    await change(admin(), marlowId);
    expect(await stored()).toMatchObject({ customerId: marlowId, revision: 2 });
    await change(lead(), marlowId);
    await change(lead(), marlowId.toUpperCase());
    expect(await stored()).toMatchObject({ customerId: marlowId, revision: 2 });
  });

  it('a Lead and an Admin may change it on a PREPARED estimate (their inputs, FR-064)', async () => {
    await setUpEstimate(true);
    await db.owner.query("UPDATE estimates SET status = 'PREPARED' WHERE id = $1::uuid", [estimateId]);
    await change(lead(), marlowId);
    expect(await stored()).toMatchObject({ customerId: marlowId, revision: 1, status: 'PREPARED' });
  });

  it('two changes at once are serialised by the estimate row lock: both are counted and the last one holds', async () => {
    await setUpEstimate();
    await Promise.all([change(admin(), brightwaterId), change(lead(), marlowId)]);
    const after = await stored();
    expect(after.revision).toBe(2);
    expect([brightwaterId, marlowId]).toContain(after.customerId);
    expect((await entriesFor(db, estimateId)).filter((entry) => entry.event === 'estimate.customer_changed')).toHaveLength(2);
  });

  it('does not touch the task, the calculation pointer or the other customer', async () => {
    await setUpEstimate();
    await change(lead(), brightwaterId);
    const { rows } = await db.owner.query<{ current_calculation_id: string | null; n: string }>(
      'SELECT current_calculation_id::text AS current_calculation_id, (SELECT count(*) FROM tasks) AS n FROM estimates WHERE id = $1::uuid',
      [estimateId],
    );
    expect(rows[0]).toEqual({ current_calculation_id: null, n: '1' });
  });
});

describe('AC-17: one estimate.customer_changed entry, written with the change and with it alone', () => {
  it('holds the company names before and after, the task code as the object and the person who changed it, and no figure', async () => {
    await setUpEstimate(true);
    await change(lead(), marlowId);
    const [entry, ...others] = await entriesFor(db, estimateId);
    expect(others).toEqual([]);
    expect(entry).toMatchObject({ event: 'estimate.customer_changed', actor_id: leadId, object_type: 'estimate', object_id: estimateId, object_label: 'Q-2026-0777' });
    expect(entry?.before).toEqual({ customer: { name: 'Estimate Brightwater Controls', shortName: 'EBWC' } });
    expect(entry?.after).toEqual({ customer: { name: 'Estimate Marlow Agro Systems', shortName: 'EMAS' } });
  });

  it('names no customer before for an estimate that had none', async () => {
    await setUpEstimate();
    await change(admin(), brightwaterId);
    const [entry] = await entriesFor(db, estimateId);
    expect(entry?.before).toEqual({ customer: null });
  });

  it('names the customer replaced even when the Admin has deleted it since', async () => {
    await setUpEstimate(true);
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [brightwaterId]);
    await change(lead(), marlowId);
    const [entry] = await entriesFor(db, estimateId);
    expect(entry?.before).toEqual({ customer: { name: 'Estimate Brightwater Controls', shortName: 'EBWC' } });
  });

  it('writes none for the same customer again, and none for a refused change', async () => {
    await setUpEstimate(true);
    const entries = await entryCount(db);
    await change(lead(), brightwaterId);
    await expect(change(lead(), '00000000-0000-4000-8000-00000000dead')).rejects.toBeInstanceOf(FieldValidationError);
    expect(await entryCount(db)).toBe(entries);
  });

  it('is the same transaction: an entry that cannot be written undoes the change (the customer and the revision stay as they were)', async () => {
    await setUpEstimate(true);
    const real = createAuditRepository(db.prisma);
    const failing = createEstimateService({
      estimates: createEstimateRepository(db.prisma),
      audit: createAuditService({ audit: { ...real, append: () => Promise.reject(new Error('invented late failure')) } }),
      nodes: createEstimateNodeRepository(db.prisma),
      images: createImageRepository(db.prisma),
      transactions: createTransactionRunner(db.prisma),
      ...inputsDependencies(),
    });
    await expect(failing.setCustomer(lead(), changeContext(lead()), estimateId, marlowId)).rejects.toThrow('invented late failure');
    expect(await stored()).toEqual({ customerId: brightwaterId, revision: 0, status: 'DRAFT' });
  });
});

describe('AC-7: the refusals leave the row as it was', () => {
  it('an Engineer is refused with the same 403 for their own estimate, another Engineer\'s, an unknown ID and text that is no ID, before the estimate is read, and nothing is written', async () => {
    await setUpEstimate();
    const entries = await entryCount(db);
    const refusals = [
      await change(arjun(), brightwaterId).catch((error: unknown) => error),
      await change({ id: priyaId, role: 'ENGINEER' }, brightwaterId).catch((error: unknown) => error),
      await change(arjun(), brightwaterId, '00000000-0000-4000-8000-00000000dead').catch((error: unknown) => error),
      await change(arjun(), brightwaterId, 'not-an-id').catch((error: unknown) => error),
    ];
    for (const refusal of refusals) expect(refusal).toBeInstanceOf(ForbiddenError);
    expect(new Set(refusals.map((refusal) => (refusal instanceof Error ? refusal.message : ''))).size).toBe(1);
    expect(await stored()).toEqual({ customerId: null, revision: 0, status: 'DRAFT' });
    expect(await entryCount(db)).toBe(entries);
  });

  it('an unknown ID and text that is no ID are "not found" for a Lead', async () => {
    await setUpEstimate();
    await expect(change(lead(), brightwaterId, '00000000-0000-4000-8000-00000000dead')).rejects.toBeInstanceOf(NotFoundError);
    await expect(change(lead(), brightwaterId, 'not-an-id')).rejects.toBeInstanceOf(NotFoundError);
    expect(await stored()).toEqual({ customerId: null, revision: 0, status: 'DRAFT' });
  });

  it('an approved estimate is a 409 for a Lead and an Admin: nobody changes an approved estimate (a prepared one is theirs to change, FR-064)', async () => {
    await setUpEstimate();
    await db.owner.query("UPDATE estimates SET status = 'APPROVED' WHERE id = $1::uuid", [estimateId]);
    await expect(change(lead(), brightwaterId)).rejects.toBeInstanceOf(ConflictError);
    await expect(change(admin(), brightwaterId)).rejects.toBeInstanceOf(ConflictError);
    expect(await stored()).toMatchObject({ customerId: null, revision: 0 });
  });

  it('a deleted customer, an unknown one and text that is no ID are a 422 under customerId', async () => {
    await setUpEstimate();
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [marlowId]);
    for (const customerId of [marlowId, '00000000-0000-4000-8000-00000000dead', 'Brightwater', '']) {
      const refusal = await change(lead(), customerId).catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(FieldValidationError);
      expect(refusal instanceof FieldValidationError ? refusal.fields : []).toEqual([{ field: 'customerId', message: 'Choose a customer from the list.' }]);
    }
    expect(await stored()).toMatchObject({ customerId: null, revision: 0 });
  });

  it('a service built without the audit service refuses to change a customer, rather than change it with no entry', async () => {
    await setUpEstimate();
    const unaudited = createEstimateService({
      estimates: createEstimateRepository(db.prisma),
      nodes: createEstimateNodeRepository(db.prisma),
      images: createImageRepository(db.prisma),
      transactions: createTransactionRunner(db.prisma),
      ...inputsDependencies(),
    });
    await expect(unaudited.setCustomer(lead(), changeContext(lead()), estimateId, brightwaterId)).rejects.toThrow('without the audit service');
    expect(await stored()).toMatchObject({ customerId: null, revision: 0 });
  });
});
