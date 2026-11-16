import type { AuditContext } from '../../src/server/services/audit-service';
import type { EstimateViewer } from '../../src/server/services/estimate-service';

import type { CalculationDatabase } from './calculation-database';
import { defined } from './defined';

/**
 * What the integration tests of the approval share (STORY-06.05 and STORY-06.06): the people, the request, a calculated estimate, and the helpers that read the database as the owner (so a refusal can be
 * shown to have changed nothing). The wait for a lock is the real one: it polls `pg_locks` until some session waits for a lock it was not granted. Every name, ID and number is invented.
 */

export const PRICE = '1000.00';
export const UNKNOWN_CALCULATION_ID = '00000000-0000-4000-8000-00000000ca1c';
export const UNKNOWN_ESTIMATE_ID = '00000000-0000-4000-8000-00000000dead';
export const REQUEST_ID = 'request-approve-0001';

export const leadOf = (db: CalculationDatabase): EstimateViewer => ({ id: db.personId, role: 'LEAD' });
export const adminOf = (db: CalculationDatabase): EstimateViewer => ({ id: db.personId, role: 'ADMIN' });
export const engineerOf = (db: CalculationDatabase): EstimateViewer => ({ id: db.engineerId, role: 'ENGINEER' });

/** Who approved and on which request, for the audit entry. The person is the Lead the database made. */
export const auditOf = (db: CalculationDatabase, label = 'Calculation Lead'): AuditContext => ({ actorId: db.personId, actorLabel: label, requestId: REQUEST_ID });

/** The body the route hands the service: the calculation the Lead saw and a price, with the audit context. */
export const requestFor = (db: CalculationDatabase, calculationId: string, price: string = PRICE) => ({ calculationId, price, audit: auditOf(db) });

/** A calculated estimate of the Engineer's with `parts` parts: SUBMITTED, the figures `current`. `top` is its first part. */
export async function calculatedEstimate(db: CalculationDatabase, parts = 2): Promise<{ readonly estimateId: string; readonly top: string }> {
  const estimateId = await db.addCompleteEstimate({ parts });
  await db.service.calculate(engineerOf(db), estimateId);
  const nodes = await db.nodes.listNodes(estimateId);
  return { estimateId, top: defined(nodes.find((node) => node.parentId === null)).id };
}

export async function revisionOf(db: CalculationDatabase, nodeId: string): Promise<number> {
  return defined((await db.owner.query<{ revision: number }>('SELECT revision FROM estimate_nodes WHERE id = $1::uuid', [nodeId])).rows[0]).revision;
}

export async function currentCalculationOf(db: CalculationDatabase, estimateId: string): Promise<string> {
  const { rows } = await db.owner.query<{ id: string | null }>('SELECT current_calculation_id::text AS id FROM estimates WHERE id = $1::uuid', [estimateId]);
  return defined(defined(rows[0]).id);
}

export async function statusOf(db: CalculationDatabase, estimateId: string): Promise<string> {
  return defined((await db.owner.query<{ status: string }>('SELECT status::text AS status FROM estimates WHERE id = $1::uuid', [estimateId])).rows[0]).status;
}

export async function approvalCount(db: CalculationDatabase, estimateId: string): Promise<number> {
  return defined((await db.owner.query<{ n: number }>('SELECT count(*)::int AS n FROM approvals WHERE estimate_id = $1::uuid', [estimateId])).rows[0]).n;
}

/** The audit entries of an approval of this estimate. */
export async function approvalEntries(db: CalculationDatabase, estimateId: string) {
  const { rows } = await db.owner.query<{ actor_id: string; actor_label: string; object_type: string; object_id: string; object_label: string; before: unknown; after: unknown; request_id: string }>(
    `SELECT actor_id::text, actor_label, object_type, object_id::text, object_label, before, after, request_id FROM audit_log WHERE event = 'approval.approved' AND object_id = $1::uuid`,
    [estimateId],
  );
  return rows;
}

/**
 * Everything a refusal must leave alone, read as the owner: the estimate's row (status, link, revision, time of change), the parts (revision and inputs), the records of calculation, the approvals and the
 * audit entries of the estimate.
 */
export async function storedOf(db: CalculationDatabase, estimateId: string): Promise<unknown> {
  const estimate = await db.owner.query(
    'SELECT status::text AS status, current_calculation_id::text AS link, inputs_revision AS revision, customer_id::text AS customer, updated_at::text AS "updatedAt" FROM estimates WHERE id = $1::uuid',
    [estimateId],
  );
  const nodes = await db.owner.query('SELECT id::text, revision, inputs, image_id::text AS image FROM estimate_nodes WHERE estimate_id = $1::uuid ORDER BY id', [estimateId]);
  const calculations = await db.owner.query('SELECT count(*)::int AS n FROM calculations WHERE estimate_id = $1::uuid', [estimateId]);
  const approvals = await db.owner.query('SELECT count(*)::int AS n FROM approvals WHERE estimate_id = $1::uuid', [estimateId]);
  const audit = await db.owner.query('SELECT count(*)::int AS n FROM audit_log');
  return { estimate: estimate.rows, nodes: nodes.rows, calculations: calculations.rows, approvals: approvals.rows, audit: audit.rows };
}

const LOCK_POLL_MILLISECONDS = 20;
const LOCK_WAIT_LIMIT_MILLISECONDS = 5_000;

/**
 * Resolves once some session waits for a lock it was not granted (read on the owner's connection, apart from the pool under test); throws when none does within the limit. A holder that returned at once could
 * commit before the call under test asked for the lock, and the test would then pass with or without the lock (SQR-02 of the reviews of AQP-321 and AQP-322).
 */
export async function untilALockWaits(db: CalculationDatabase): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_LIMIT_MILLISECONDS;
  while (Date.now() < deadline) {
    const { rows } = await db.owner.query<{ n: number }>('SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted');
    if (defined(rows[0]).n > 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, LOCK_POLL_MILLISECONDS);
    });
  }
  throw new Error("No session waited for a lock: the call did not wait for the estimate's row lock.");
}

/** The refusal a call ends in, read without leaving a rejection unhandled (#443); `undefined` when it did not refuse. */
export async function refusalOf(call: Promise<unknown>): Promise<unknown> {
  return call.then(
    () => undefined,
    (error: unknown) => error,
  );
}
