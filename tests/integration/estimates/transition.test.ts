import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { EstimateEvent, EstimateStatus } from '@/lib/estimate/state-machine';
import { createEstimateRepository } from '@/server/repositories/estimate-repository';
import { createTransactionRunner } from '@/server/repositories/transaction';
import { createEstimateService, type EstimateService } from '@/server/services/estimate-service';

import { insertPersonAsOwner } from '../../support/audit-database';
import { openAuthDatabase, type AuthDatabase } from '../../support/auth-database';
import { defined } from '../../support/defined';

/**
 * STORY-06.01 T5 (AC-1 to AC-6) against real PostgreSQL in a throwaway database: the estimate service's `transition` over the real repository and the real row
 * lock. Each allowed pair moves the status by one step; a refused pair is a 409 (or a 403 or 404 by role) and leaves the row exactly as it was; two transitions
 * at once queue on the lock, so one wins and the other is told the status it found; an unlock changes nothing but the status. Every name, path and date is
 * invented.
 */

const PATH = '\\\\invented-server\\invented-share\\RFQ-123';

let db: AuthDatabase;
let service: EstimateService;
let leadId: string;
let adminId: string;
let arjunId: string;
let priyaId: string;
let estimateId: string;
let customerId: string;

beforeAll(async () => {
  db = await openAuthDatabase();
  service = createEstimateService({ estimates: createEstimateRepository(db.prisma), transactions: createTransactionRunner(db.prisma) });
  leadId = await insertPersonAsOwner(db, 'Transition Lead', 'LEAD');
  adminId = await insertPersonAsOwner(db, 'Transition Admin', 'ADMIN');
  arjunId = await insertPersonAsOwner(db, 'Transition Arjun', 'ENGINEER');
  priyaId = await insertPersonAsOwner(db, 'Transition Priya', 'ENGINEER');
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  await db.owner.query('DELETE FROM estimates');
  await db.owner.query('DELETE FROM tasks');
  await db.owner.query("DELETE FROM customers WHERE name LIKE 'Transition %'");
});

const arjun = () => ({ id: arjunId, role: 'ENGINEER' as const });
const priya = () => ({ id: priyaId, role: 'ENGINEER' as const });
const lead = () => ({ id: leadId, role: 'LEAD' as const });
const admin = () => ({ id: adminId, role: 'ADMIN' as const });

/** A task for Arjun with its estimate in the given status and a customer chosen, as it stands after some work (revision 4). */
async function setUpEstimate(status: EstimateStatus): Promise<void> {
  const task = await db.owner.query<{ id: string }>(
    `INSERT INTO tasks (code, engineer_id, assigned_by, folder_path, deadline_at)
     VALUES ('Q-2026-0888', $1::uuid, $2::uuid, $3, '2026-11-12T11:30:00Z') RETURNING id::text AS id`,
    [arjunId, leadId, PATH],
  );
  const customer = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Transition Brightwater Controls') RETURNING id::text AS id");
  customerId = defined(customer.rows[0]).id;
  const estimate = await db.owner.query<{ id: string }>(
    'INSERT INTO estimates (task_id, customer_id, status, inputs_revision) VALUES ($1::uuid, $2::uuid, $3::estimate_status, 4) RETURNING id::text AS id',
    [defined(task.rows[0]).id, customerId, status],
  );
  estimateId = defined(estimate.rows[0]).id;
}

interface Stored {
  status: string;
  revision: number;
  customerId: string | null;
  calculationId: string | null;
  updatedAt: string;
}

const stored = async (): Promise<Stored> => {
  const { rows } = await db.owner.query<{ status: string; inputs_revision: number; customer_id: string | null; current_calculation_id: string | null; updated_at: string }>(
    'SELECT status::text AS status, inputs_revision, customer_id::text AS customer_id, current_calculation_id::text AS current_calculation_id, updated_at::text AS updated_at FROM estimates WHERE id = $1::uuid',
    [estimateId],
  );
  const row = defined(rows[0]);
  return { status: row.status, revision: row.inputs_revision, customerId: row.customer_id, calculationId: row.current_calculation_id, updatedAt: row.updated_at };
};

describe('AC-1: the allowed pairs move the status by one step, in the database', () => {
  it.each<[EstimateStatus, EstimateEvent, 'ENGINEER' | 'LEAD' | 'ADMIN', EstimateStatus]>([
    ['DRAFT', 'CALCULATE', 'ENGINEER', 'SUBMITTED'],
    ['DRAFT', 'RECALCULATE', 'LEAD', 'SUBMITTED'],
    ['SUBMITTED', 'RECALCULATE', 'ADMIN', 'SUBMITTED'],
    ['SUBMITTED', 'EDIT', 'LEAD', 'SUBMITTED'],
    ['SUBMITTED', 'APPROVE', 'LEAD', 'APPROVED'],
    ['APPROVED', 'UNLOCK', 'LEAD', 'DRAFT'],
    ['APPROVED', 'CANCEL', 'ADMIN', 'DRAFT'],
    ['APPROVED', 'EXPORT', 'ADMIN', 'APPROVED'],
  ])('%s + %s by %s gives %s', async (status, event, role, to) => {
    await setUpEstimate(status);
    const viewer = { ENGINEER: arjun, LEAD: lead, ADMIN: admin }[role]();
    await expect(service.transition(viewer, estimateId, event)).resolves.toEqual({ id: estimateId, from: status, to });
    expect((await stored()).status).toBe(to);
  });
});

describe('AC-1, AC-5: a refused transition leaves the row exactly as it was', () => {
  it.each<[EstimateStatus, EstimateEvent, 'ENGINEER' | 'LEAD' | 'ADMIN', new (...args: never[]) => Error]>([
    ['DRAFT', 'APPROVE', 'LEAD', ConflictError],
    ['DRAFT', 'UNLOCK', 'ADMIN', ConflictError],
    ['SUBMITTED', 'CALCULATE', 'ENGINEER', ConflictError],
    ['APPROVED', 'RECALCULATE', 'LEAD', ConflictError],
    ['APPROVED', 'APPROVE', 'ADMIN', ConflictError],
    ['APPROVED', 'CANCEL', 'LEAD', ForbiddenError],
    ['SUBMITTED', 'APPROVE', 'ENGINEER', NotFoundError],
  ])('%s + %s by %s is refused', async (status, event, role, expected) => {
    await setUpEstimate(status);
    const before = await stored();
    const viewer = { ENGINEER: arjun, LEAD: lead, ADMIN: admin }[role]();
    await expect(service.transition(viewer, estimateId, event)).rejects.toBeInstanceOf(expected);
    expect(await stored()).toEqual(before);
  });

  it("another Engineer's estimate, an unknown ID and text that is no ID are all \"not found\", and nothing changes", async () => {
    await setUpEstimate('DRAFT');
    const before = await stored();
    await expect(service.transition(priya(), estimateId, 'CALCULATE')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.transition(arjun(), '00000000-0000-4000-8000-00000000dead', 'CALCULATE')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.transition(arjun(), 'not-an-id', 'CALCULATE')).rejects.toBeInstanceOf(NotFoundError);
    expect(await stored()).toEqual(before);
  });
});

describe('AC-4: two transitions at once are serialised by the estimate row lock', () => {
  it('two Calculates: one wins, the other is 409, and the status is SUBMITTED', async () => {
    await setUpEstimate('DRAFT');
    const results = await Promise.allSettled([service.transition(arjun(), estimateId, 'CALCULATE'), service.transition(arjun(), estimateId, 'CALCULATE')]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ConflictError);
    expect((await stored()).status).toBe('SUBMITTED');
  });

  it('two approvals: one wins, the other is 409', async () => {
    await setUpEstimate('SUBMITTED');
    const results = await Promise.allSettled([service.transition(lead(), estimateId, 'APPROVE'), service.transition(admin(), estimateId, 'APPROVE')]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((await stored()).status).toBe('APPROVED');
  });

  it('an unlock and a cancel at once: one wins, the other is 409 because the status is already DRAFT', async () => {
    await setUpEstimate('APPROVED');
    const results = await Promise.allSettled([service.transition(lead(), estimateId, 'UNLOCK'), service.transition(admin(), estimateId, 'CANCEL')]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((await stored()).status).toBe('DRAFT');
  });

  it('an approval and a customer change at once: the customer changes only if it came first, and then the revision counts it; the status ends APPROVED either way', async () => {
    await setUpEstimate('SUBMITTED');
    const other = await db.owner.query<{ id: string }>("INSERT INTO customers (name) VALUES ('Transition Marlow Agro Systems') RETURNING id::text AS id");
    const otherId = defined(other.rows[0]).id;
    const [approval, change] = await Promise.allSettled([service.transition(lead(), estimateId, 'APPROVE'), service.setCustomer(lead(), estimateId, otherId)]);
    expect(approval.status).toBe('fulfilled');
    const after = await stored();
    expect(after.status).toBe('APPROVED');
    if (change.status === 'fulfilled') expect(after).toMatchObject({ customerId: otherId, revision: 5 });
    else {
      expect(change.reason).toBeInstanceOf(ConflictError);
      expect(after).toMatchObject({ customerId, revision: 4 });
    }
  });

  it('a status never skips: from DRAFT, a Recalculate and an approval at once end SUBMITTED or APPROVED by a path through SUBMITTED, never APPROVED from DRAFT', async () => {
    await setUpEstimate('DRAFT');
    const [recalculate, approve] = await Promise.allSettled([service.transition(lead(), estimateId, 'RECALCULATE'), service.transition(lead(), estimateId, 'APPROVE')]);
    expect(recalculate.status).toBe('fulfilled');
    // The approval is either queued behind the Recalculate (and then approves a SUBMITTED estimate) or ahead of it (and is refused as a DRAFT).
    const after = await stored();
    expect(after.status).toBe(approve.status === 'fulfilled' ? 'APPROVED' : 'SUBMITTED');
    if (approve.status === 'rejected') expect(approve.reason).toBeInstanceOf(ConflictError);
  });
});

describe('AC-2: the inputs of a submitted or an approved estimate are read-only for the Engineer', () => {
  it.each<EstimateStatus>(['SUBMITTED', 'APPROVED'])('the Engineer cannot change the customer of a %s estimate: 409, nothing changes', async (status) => {
    await setUpEstimate(status);
    const before = await stored();
    await expect(service.setCustomer(arjun(), estimateId, customerId)).rejects.toBeInstanceOf(ConflictError);
    expect(await stored()).toEqual(before);
  });
});

describe('AC-6: an unlock changes the status and nothing else', () => {
  it('the revision, the customer and the calculation pointer stay, so figures that were current stay current', async () => {
    await setUpEstimate('APPROVED');
    const before = await stored();
    await service.transition(lead(), estimateId, 'UNLOCK');
    const after = await stored();
    expect(after).toMatchObject({ status: 'DRAFT', revision: before.revision, customerId: before.customerId, calculationId: before.calculationId });
  });
});
