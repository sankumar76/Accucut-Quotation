import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FieldValidationError, MasterInUseError, NAME_TAKEN_CODE, NotFoundError, CUSTOMER_IN_USE_CODE } from '@/lib/errors';
import { createEstimateNodeRepository } from '@/server/repositories/estimate-node-repository';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createTransactionRunner, type TransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService } from '@/server/services/estimate-service';

import { contextOf, entriesFor, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { customerSide } from '../../support/customer-audit-side';
import { defined } from '../../support/defined';
import { createHoldingRunner, createServiceHoldingBeforeCommit } from '../../support/hold-before-commit';
import { createLateFailingRunner } from '../../support/late-failure-runner';

import { openCustomerDefaults, resetCustomerTables } from './customers-support';

/**
 * STORY-02.07 (AC-1, AC-2, AC-4, AC-5, AC-8) against real PostgreSQL in a throwaway database: the delete of a customer over the real repositories. It is soft
 * (`deleted_at`) and keeps the rate rows; it is refused with the estimates named while a Draft or Submitted estimate has the customer, and allowed when only
 * Approved ones do (they keep the customer's name); one `master.deleted` entry is written in the transaction of the delete and none when it is refused; a name of a
 * deleted customer stays taken (the unique indexes are not partial); and a delete and a request that is choosing the same customer serialise, in both orders,
 * so the two can never both succeed (AC-5). Every name, path and code is invented.
 *
 * The audit entry commits with its change or not at all: the late-failure test uses the shared runner of tech-debt #130 (`tests/support/late-failure-runner.ts`).
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';
const LATE_FAILURE = 'a failure after the entry was written';
const OPEN_ESTIMATES_NAMED = 10;

let db: AuditDatabase;
let adminId: string;
let leadId: string;
let engineerId: string;
let codes = 0;

const by = () => contextOf(adminId);

/** The estimate service over the real repositories and the transaction runner given (the real one, or one that holds before commit). */
const estimateServiceOver = (transactions: TransactionRunner) =>
  createEstimateService({ estimates: createEstimateRepository(db.prisma), nodes: createEstimateNodeRepository(db.prisma), transactions });

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  leadId = await insertPersonAsOwner(db, 'Lead', 'LEAD');
  engineerId = await insertPersonAsOwner(db, 'Engineer', 'ENGINEER');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  codes = 0;
  await openCustomerDefaults(db);
});

afterEach(async () => {
  // An estimate refers to its customer with no cascade, so the estimates go before the customers do.
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await resetCustomerTables(db);
});

const customerNamed = (name: string) => db.mastersService.createCustomer(by(), { name, phone: '+99 555 0142', email: null, address: null });

/** A task with its estimate, in this status, for this customer (or none). Returns the estimate's ID and the task's code. */
async function estimateFor(customerId: string | null, status: 'DRAFT' | 'SUBMITTED' | 'APPROVED'): Promise<{ readonly estimateId: string; readonly code: string }> {
  codes += 1;
  const code = `Q-2026-${String(9000 + codes).padStart(4, '0')}`;
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at, title, notes)
     VALUES ($1, $2::uuid, $3::uuid, $4, '2026-11-12T11:30:00Z', 'Invented hopper cover', NULL) RETURNING id::text AS id`,
    [code, engineerId, leadId, PATH],
  );
  const estimate = await db.owner.query<{ id: string }>(
    'INSERT INTO estimates (task_id, customer_id, status) VALUES ($1::uuid, $2::uuid, $3::estimate_status) RETURNING id::text AS id',
    [defined(task.rows[0]).id, customerId, status],
  );
  return { estimateId: defined(estimate.rows[0]).id, code };
}

interface StoredCustomer {
  readonly deleted: boolean;
  readonly rates: number;
}

async function stored(customerId: string): Promise<StoredCustomer> {
  const { rows } = await db.owner.query<{ deleted: boolean; rates: string }>(
    `SELECT deleted_at IS NOT NULL AS deleted, (SELECT count(*) FROM customer_rates WHERE customer_id = c.id) AS rates FROM customers c WHERE c.id = $1::uuid`,
    [customerId],
  );
  const row = defined(rows[0]);
  return { deleted: row.deleted, rates: Number(row.rates) };
}

const deletedEntries = async (customerId: string) => (await entriesFor(db, customerId)).filter((entry) => entry.event === 'master.deleted');

/** Is any session of this database waiting for a lock? `pg_locks` is readable by every role, and so are the process IDs of `pg_stat_activity`. */
async function someoneIsWaitingForALock(): Promise<boolean> {
  const { rows } = await db.owner.query<{ waiting: number }>(
    `SELECT count(*)::int AS waiting FROM pg_locks l
     WHERE NOT l.granted AND l.pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())`,
  );
  return defined(rows[0]).waiting > 0;
}

describe('AC-1: a customer used by no estimate is soft-deleted', () => {
  it('sets deleted_at and keeps the row and its 15 rate rows, and the customer leaves the list, the options and the lookup by ID', async () => {
    const alpha = await customerNamed('Alpha Works');
    const bravo = await customerNamed('Bravo Works');
    await db.mastersService.deleteCustomer(by(), alpha.id);
    expect(await stored(alpha.id)).toEqual({ deleted: true, rates: 15 });
    expect((await db.mastersService.listCustomers()).map((customer) => customer.name)).toEqual(['Bravo Works']);
    expect((await db.mastersService.listCustomerOptions()).map((option) => option.id)).toEqual([bravo.id]);
    await expect(db.mastersService.getCustomer(alpha.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await stored(bravo.id)).toEqual({ deleted: false, rates: 15 });
  });

  it('writes exactly one master.deleted entry, in the same transaction, naming the customer, its contact fields (not their values) and its rates', async () => {
    const alpha = await customerNamed('Alpha Works');
    const entries = await entryCount(db);
    await db.mastersService.deleteCustomer(by(), alpha.id);
    expect(await entryCount(db)).toBe(entries + 1);
    const [entry] = await deletedEntries(alpha.id);
    expect(entry).toMatchObject({ event: 'master.deleted', actor_id: adminId, object_type: 'customer', object_id: alpha.id, object_label: 'Alpha Works', after: null });
    const before = customerSide(defined(entry).before);
    expect(before.name).toBe('Alpha Works');
    expect(before.contact).toEqual(['phone']);
    expect(before.rates).toHaveLength(15);
    expect(`${defined(entry).before_text}`).not.toContain('555 0142');
  });

  it('a second delete of the same customer is a 404 and writes nothing more', async () => {
    const alpha = await customerNamed('Alpha Works');
    await db.mastersService.deleteCustomer(by(), alpha.id);
    const entries = await entryCount(db);
    await expect(db.mastersService.deleteCustomer(by(), alpha.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(db.mastersService.deleteCustomer(by(), '00000000-0000-4000-8000-00000000dead')).rejects.toBeInstanceOf(NotFoundError);
    await expect(db.mastersService.deleteCustomer(by(), 'not-an-id')).rejects.toBeInstanceOf(NotFoundError);
    expect(await entryCount(db)).toBe(entries);
  });

  it('leaves the entry and the change together or not at all: a failure after the entry was written leaves the customer listed and no entry', async () => {
    const alpha = await customerNamed('Alpha Works');
    const entries = await entryCount(db);
    const failing: TransactionRunner = createLateFailingRunner(createTransactionRunner(db.prisma), new Error(LATE_FAILURE));
    await expect(db.buildMastersService({ transactions: failing }).deleteCustomer(by(), alpha.id)).rejects.toThrow(LATE_FAILURE);
    expect(await stored(alpha.id)).toEqual({ deleted: false, rates: 15 });
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('AC-2: a customer on a Draft or Submitted estimate is refused, and nothing changes', () => {
  it.each(['DRAFT', 'SUBMITTED'] as const)('a %s estimate: 409 MasterInUseError naming its task code and status', async (status) => {
    const alpha = await customerNamed('Alpha Works');
    const { code } = await estimateFor(alpha.id, status);
    const entries = await entryCount(db);
    const refusal = await db.mastersService.deleteCustomer(by(), alpha.id).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(MasterInUseError);
    expect(refusal).toMatchObject({ code: CUSTOMER_IN_USE_CODE, httpStatus: 409, estimates: [{ code, status }], total: 1 });
    expect(await stored(alpha.id)).toEqual({ deleted: false, rates: 15 });
    expect(await entryCount(db)).toBe(entries);
    expect((await db.mastersService.listCustomerOptions()).map((option) => option.id)).toContain(alpha.id);
  });

  it('names the first ten by task code and counts all of them, and counts only this customer\'s open estimates', async () => {
    const alpha = await customerNamed('Alpha Works');
    const bravo = await customerNamed('Bravo Works');
    const made: string[] = [];
    for (let index = 0; index < 12; index += 1) made.push((await estimateFor(alpha.id, index % 2 === 0 ? 'DRAFT' : 'SUBMITTED')).code);
    await estimateFor(alpha.id, 'APPROVED');
    await estimateFor(bravo.id, 'DRAFT');
    const refusal = await db.mastersService.deleteCustomer(by(), alpha.id).catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(MasterInUseError);
    if (!(refusal instanceof MasterInUseError)) return;
    expect(refusal.total).toBe(12);
    expect(refusal.estimates.map((use) => use.code)).toEqual([...made].sort().slice(0, OPEN_ESTIMATES_NAMED));
  });

  it('is allowed once the estimate has moved to another customer', async () => {
    const alpha = await customerNamed('Alpha Works');
    const bravo = await customerNamed('Bravo Works');
    const { estimateId } = await estimateFor(alpha.id, 'DRAFT');
    await expect(db.mastersService.deleteCustomer(by(), alpha.id)).rejects.toBeInstanceOf(MasterInUseError);
    await db.owner.query('UPDATE estimates SET customer_id = $2::uuid WHERE id = $1::uuid', [estimateId, bravo.id]);
    await db.mastersService.deleteCustomer(by(), alpha.id);
    expect((await stored(alpha.id)).deleted).toBe(true);
  });
});

describe('AC-4: a customer used only by Approved estimates may be deleted, and they still name it', () => {
  it('deletes it, and the Approved estimates keep the customer and show its name (the estimate form reads it with no deleted filter)', async () => {
    const alpha = await customerNamed('Alpha Works');
    const { estimateId, code } = await estimateFor(alpha.id, 'APPROVED');
    await db.mastersService.deleteCustomer(by(), alpha.id);
    expect((await stored(alpha.id)).deleted).toBe(true);
    const kept = await db.owner.query<{ customer_id: string; status: string }>('SELECT customer_id::text, status::text FROM estimates WHERE id = $1::uuid', [estimateId]);
    expect(kept.rows).toEqual([{ customer_id: alpha.id, status: 'APPROVED' }]);
    const estimates = estimateServiceOver(createTransactionRunner(db.prisma));
    expect((await estimates.getWorkspace({ id: adminId, role: 'ADMIN' }, code))?.customer).toEqual({ id: alpha.id, name: 'Alpha Works' });
  });
});

describe('AC-8: the name of a deleted customer', () => {
  it('stays taken, because the unique indexes on the name are not partial: adding it again is 422 NAME_TAKEN, and a different name is fine', async () => {
    const alpha = await customerNamed('Alpha Works');
    await db.mastersService.deleteCustomer(by(), alpha.id);
    const refusal = await customerNamed('ALPHA WORKS').catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(FieldValidationError);
    expect(refusal).toMatchObject({ code: NAME_TAKEN_CODE });
    await expect(customerNamed('Alpha Works Two')).resolves.toMatchObject({ name: 'Alpha Works Two' });
  });
});

describe('AC-5: the delete and a request choosing the same customer serialise, in both orders', () => {
  const adminViewer = () => ({ id: adminId, role: 'ADMIN' as const });

  it('a choice that holds the customer first: the delete waits, then sees the estimate and is refused; the estimate keeps the customer', async () => {
    const alpha = await customerNamed('Alpha Works');
    const { estimateId } = await estimateFor(null, 'DRAFT');
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reachedHolding: () => void = () => undefined;
    const isHolding = new Promise<void>((resolve) => {
      reachedHolding = resolve;
    });
    const choosing = estimateServiceOver(createHoldingRunner(db, hold, reachedHolding));
    const choice = choosing.setCustomer(adminViewer(), estimateId, alpha.id);
    // If the choice fails before it holds, the race rejects with its error and the test says why.
    await Promise.race([isHolding, choice]);

    let deleteDone = false;
    const deletion = db.mastersService.deleteCustomer(by(), alpha.id).finally(() => {
      deleteDone = true;
    });
    // The delete has either finished (nothing made it wait) or is waiting for the lock the choice holds on the customer. Only then is the choice let go.
    await expect.poll(async () => deleteDone || (await someoneIsWaitingForALock()), { message: 'the delete waits for the customer\'s lock, or has finished' }).toBe(true);
    expect(deleteDone, 'the delete did not wait for the choice').toBe(false);
    release();
    await choice;
    await expect(deletion).rejects.toBeInstanceOf(MasterInUseError);

    expect(await stored(alpha.id)).toEqual({ deleted: false, rates: 15 });
    const { rows } = await db.owner.query<{ customer_id: string | null }>('SELECT customer_id::text FROM estimates WHERE id = $1::uuid', [estimateId]);
    expect(rows).toEqual([{ customer_id: alpha.id }]);
    expect(await deletedEntries(alpha.id)).toEqual([]);
  });

  it('a delete that holds the customer first: the choice waits, then finds no customer and is refused; the estimate keeps no customer', async () => {
    const alpha = await customerNamed('Alpha Works');
    const { estimateId } = await estimateFor(null, 'DRAFT');
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reachedHolding: () => void = () => undefined;
    const isHolding = new Promise<void>((resolve) => {
      reachedHolding = resolve;
    });
    const deletion = createServiceHoldingBeforeCommit(db, hold, reachedHolding).deleteCustomer(by(), alpha.id);
    await Promise.race([isHolding, deletion]);

    const estimates = estimateServiceOver(createTransactionRunner(db.prisma));
    let choiceDone = false;
    const choice = estimates.setCustomer(adminViewer(), estimateId, alpha.id).finally(() => {
      choiceDone = true;
    });
    await expect.poll(async () => choiceDone || (await someoneIsWaitingForALock()), { message: 'the choice waits for the customer\'s lock, or has finished' }).toBe(true);
    expect(choiceDone, 'the choice did not wait for the delete').toBe(false);
    release();
    await deletion;
    await expect(choice).rejects.toBeInstanceOf(FieldValidationError);

    expect((await stored(alpha.id)).deleted).toBe(true);
    const { rows } = await db.owner.query<{ customer_id: string | null }>('SELECT customer_id::text FROM estimates WHERE id = $1::uuid', [estimateId]);
    expect(rows).toEqual([{ customer_id: null }]);
    expect(await deletedEntries(alpha.id)).toHaveLength(1);
  });

  it('two deletes at once: one wins, the other is a 404, and one entry is written', async () => {
    const alpha = await customerNamed('Alpha Works');
    const results = await Promise.allSettled([db.mastersService.deleteCustomer(by(), alpha.id), db.mastersService.deleteCustomer(by(), alpha.id)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.flatMap((result) => (result.status === 'rejected' ? [result.reason as unknown] : []));
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toBeInstanceOf(NotFoundError);
    expect(await deletedEntries(alpha.id)).toHaveLength(1);
  });
});
