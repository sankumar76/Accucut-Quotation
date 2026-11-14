import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError } from '@/lib/errors';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';

/**
 * STORY-05.01 T3 (AC-1, AC-3, AC-4, AC-5) against real PostgreSQL in a throwaway database: the estimate service over the real repository. The workspace is read
 * by the code of the task; choosing the customer takes the estimate's row lock, changes the customer and raises `inputs_revision` in one transaction, the same
 * customer again writes nothing, and two choices at once are serialised (the revision counts both). A deleted customer, an unknown one, another Engineer's
 * estimate and a submitted estimate are refused and leave the row as it was. Every name, path and date is invented.
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
  service = createEstimateService({ estimates: createEstimateRepository(db.prisma), transactions: createTransactionRunner(db.prisma) });
  leadId = await insertPersonAsOwner(db, 'Estimate Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Estimate Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Estimate Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Estimate Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

const insertCustomer = async (name: string): Promise<string> => {
  const { rows } = await db.owner.query<{ id: string }>('INSERT INTO customers (name) VALUES ($1) RETURNING id::text AS id', [name]);
  return defined(rows[0]).id;
};

/** A task for Arjun with its draft estimate, and two customers to choose between. */
async function setUpEstimate(): Promise<void> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, notes)
     VALUES ('Q-2026-0777', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z', 'Hopper cover', 'Sheet-metal parts only.') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>('INSERT INTO estimates (task_id) VALUES ($1::uuid) RETURNING id::text AS id', [defined(task.rows[0]).id]);
  estimateId = defined(estimate.rows[0]).id;
  brightwaterId = await insertCustomer('Estimate Brightwater Controls');
  marlowId = await insertCustomer('Estimate Marlow Agro Systems');
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

describe('AC-1: the workspace is read by the code of the task', () => {
  it('gives the task as assigned, the name of who assigned it, the link built from the path, and no customer yet', async () => {
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
      notes: 'Sheet-metal parts only.',
      assignedByName: 'Estimate Lead',
    });
    expect(workspace.deadlineAt.toISOString()).toBe('2026-11-12T11:30:00.000Z');
  });

  it('another Engineer and an unknown code get nothing, and a Lead and an Admin may open it', async () => {
    await setUpEstimate();
    expect(await service.getWorkspace({ id: priyaId, role: 'ENGINEER' }, 'Q-2026-0777')).toBeNull();
    expect(await service.getWorkspace(arjun(), 'Q-2026-0000')).toBeNull();
    expect(await service.getWorkspace({ id: leadId, role: 'LEAD' }, 'Q-2026-0777')).not.toBeNull();
    expect(await service.getWorkspace({ id: adminId, role: 'ADMIN' }, 'Q-2026-0777')).not.toBeNull();
  });

  it('names the customer chosen, and still names one that was deleted afterwards', async () => {
    await setUpEstimate();
    await service.setCustomer(arjun(), estimateId, brightwaterId);
    expect((await service.getWorkspace(arjun(), 'Q-2026-0777'))?.customer).toEqual({ id: brightwaterId, name: 'Estimate Brightwater Controls' });
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [brightwaterId]);
    expect((await service.getWorkspace(arjun(), 'Q-2026-0777'))?.customer?.name).toBe('Estimate Brightwater Controls');
  });
});

describe('AC-3 and AC-4: choosing and changing the customer', () => {
  it('a first choice stores the customer and raises the revision from 0 to 1 in the same transaction', async () => {
    await setUpEstimate();
    expect(await stored()).toEqual({ customerId: null, revision: 0, status: 'DRAFT' });
    expect(await service.setCustomer(arjun(), estimateId, brightwaterId)).toEqual({ id: estimateId, status: 'DRAFT', customer: { id: brightwaterId, name: 'Estimate Brightwater Controls' } });
    expect(await stored()).toEqual({ customerId: brightwaterId, revision: 1, status: 'DRAFT' });
  });

  it('a different customer is a change (revision 2); the same one again is not (revision stays 2)', async () => {
    await setUpEstimate();
    await service.setCustomer(arjun(), estimateId, brightwaterId);
    await service.setCustomer(arjun(), estimateId, marlowId);
    expect(await stored()).toMatchObject({ customerId: marlowId, revision: 2 });
    await service.setCustomer(arjun(), estimateId, marlowId);
    await service.setCustomer(arjun(), estimateId, marlowId.toUpperCase());
    expect(await stored()).toMatchObject({ customerId: marlowId, revision: 2 });
  });

  it('a Lead may choose it on any draft', async () => {
    await setUpEstimate();
    await service.setCustomer({ id: leadId, role: 'LEAD' }, estimateId, marlowId);
    expect(await stored()).toMatchObject({ customerId: marlowId, revision: 1 });
  });

  it('two choices at once are serialised by the estimate row lock: both are counted and the last one holds', async () => {
    await setUpEstimate();
    await Promise.all([service.setCustomer(arjun(), estimateId, brightwaterId), service.setCustomer({ id: leadId, role: 'LEAD' }, estimateId, marlowId)]);
    const after = await stored();
    expect(after.revision).toBe(2);
    expect([brightwaterId, marlowId]).toContain(after.customerId);
  });

  it('does not touch the task, the calculation pointer or the other customer', async () => {
    await setUpEstimate();
    await service.setCustomer(arjun(), estimateId, brightwaterId);
    const { rows } = await db.owner.query<{ current_calculation_id: string | null; n: string }>(
      'SELECT current_calculation_id::text AS current_calculation_id, (SELECT count(*) FROM tasks) AS n FROM estimates WHERE id = $1::uuid',
      [estimateId],
    );
    expect(rows[0]).toEqual({ current_calculation_id: null, n: '1' });
  });
});

describe('AC-5: the refusals leave the row as it was', () => {
  it('another Engineer, an unknown ID and text that is no ID are all "not found"', async () => {
    await setUpEstimate();
    await expect(service.setCustomer({ id: priyaId, role: 'ENGINEER' }, estimateId, brightwaterId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.setCustomer(arjun(), '00000000-0000-4000-8000-00000000dead', brightwaterId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.setCustomer(arjun(), 'not-an-id', brightwaterId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await stored()).toEqual({ customerId: null, revision: 0, status: 'DRAFT' });
  });

  it.each(['SUBMITTED', 'APPROVED'])('a %s estimate is a 409, even for a Lead', async (status) => {
    await setUpEstimate();
    await db.owner.query('UPDATE estimates SET status = $2::estimate_status WHERE id = $1::uuid', [estimateId, status]);
    await expect(service.setCustomer(arjun(), estimateId, brightwaterId)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.setCustomer({ id: leadId, role: 'LEAD' }, estimateId, brightwaterId)).rejects.toBeInstanceOf(ConflictError);
    expect(await stored()).toMatchObject({ customerId: null, revision: 0 });
  });

  it('a deleted customer, an unknown one and text that is no ID are a 422 under customerId', async () => {
    await setUpEstimate();
    await db.owner.query('UPDATE customers SET deleted_at = now() WHERE id = $1::uuid', [marlowId]);
    for (const customerId of [marlowId, '00000000-0000-4000-8000-00000000dead', 'Brightwater', '']) {
      const refusal = await service.setCustomer(arjun(), estimateId, customerId).catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(FieldValidationError);
      expect(refusal instanceof FieldValidationError ? refusal.fields : []).toEqual([{ field: 'customerId', message: 'Choose a customer from the list.' }]);
    }
    expect(await stored()).toMatchObject({ customerId: null, revision: 0 });
  });
});
