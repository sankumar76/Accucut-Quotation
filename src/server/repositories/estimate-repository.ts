import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import type { EstimateStatus } from './task-repository';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the estimate workspace's header and its customer (STORY-05.01; architecture sections 4.1, 4.8 and 6, "Set customer"). The task's own writes are
 * in `task-repository.ts`; this file reads one task with its estimate by the code in the page address, and changes the one thing this story changes: which
 * customer the estimate is for.
 *
 * **One lock, one revision.** Choosing the customer takes the estimate's row with `FOR UPDATE` and changes it in the same transaction, raising
 * `inputs_revision` with it (architecture section 4.8: a changed customer is an input change). The lock is the same one that serialises Calculate and every
 * other input change, so two requests at once cannot both pass the "is it still a draft" check. The task's row is held `FOR SHARE`, so a reassign (STORY-04.07)
 * waits for the change instead of racing it. The customer is read `FOR SHARE` in the same transaction: one that is being deleted waits, and one that is
 * already deleted is not found.
 *
 * **What leaves.** A customer is an ID and a name here, and nothing else: no contact detail and no rate is ever selected (BR-003, NFR-002).
 */

/** A customer as a choice: the ID and the name. */
export interface CustomerChoice {
  readonly id: string;
  readonly name: string;
}

/** What the workspace page needs of a task and its estimate. `engineerId` stays on the server: it decides who may open the page and is never sent on. */
export interface WorkspaceRecord {
  readonly estimateId: string;
  readonly status: EstimateStatus;
  /** Null until the Engineer chooses. A customer that was deleted after it was chosen is still named here. */
  readonly customer: CustomerChoice | null;
  readonly code: string;
  readonly engineerId: string;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly title: string | null;
  readonly notes: string | null;
  /** The name of the Lead or Admin who assigned the task ("Notes from Kiran Bose: ...", UX-15). */
  readonly assignedByName: string;
}

/** The estimate row as it is held for a change. */
export interface EstimateLock {
  readonly id: string;
  readonly engineerId: string;
  readonly status: EstimateStatus;
  readonly customerId: string | null;
}

export interface EstimateRepository {
  /** The task with this code and its estimate, or null when there is none. */
  findWorkspaceByCode(code: string): Promise<WorkspaceRecord | null>;
  /** The estimate with this ID, **locked for update until the transaction ends**; null for an unknown ID (or one that is not a UUID). */
  lockEstimate(id: string, tx: Transaction): Promise<EstimateLock | null>;
  /** The customer with this ID, locked for share; null for an unknown ID, a deleted customer or an ID that is not a UUID. */
  findActiveCustomer(id: string, tx: Transaction): Promise<CustomerChoice | null>;
  /** Sets the customer and raises `inputs_revision` by one, in the caller's transaction. The caller has already checked the state and that the customer differs. */
  setCustomer(estimateId: string, customerId: string, tx: Transaction): Promise<void>;
  /**
   * Moves the estimate from one status to the next (STORY-06.01), in the caller's transaction, and answers whether it did. The write is conditional on the
   * status the caller read under the row lock, so a status can only ever change from the one that was checked: it answers `false` (and writes nothing) when
   * the estimate no longer has `from`, which the lock makes impossible unless a caller skipped it. Nothing else of the row changes, and not
   * `inputs_revision`: a status change is not an input change (architecture section 4.8).
   */
  setStatus(estimateId: string, from: EstimateStatus, to: EstimateStatus, tx: Transaction): Promise<boolean>;
}

const STATUS = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED']);

const WORKSPACE_ROWS = z.array(
  z.strictObject({
    estimateId: z.string(),
    status: STATUS,
    customerId: z.string().nullable(),
    customerName: z.string().nullable(),
    code: z.string(),
    engineerId: z.string(),
    folderPath: z.string(),
    deadlineAt: z.date(),
    title: z.string().nullable(),
    notes: z.string().nullable(),
    assignedByName: z.string(),
  }),
);
const LOCK_ROWS = z.array(z.strictObject({ id: z.string(), engineerId: z.string(), status: STATUS, customerId: z.string().nullable() }));
const CUSTOMER_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string() }));

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** Builds the estimate methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createEstimateRepository(db: PrismaClient): EstimateRepository {
  return {
    findWorkspaceByCode: (code) =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          SELECT e.id::text AS "estimateId", e.status::text AS "status", c.id::text AS "customerId", c.name AS "customerName",
                 t.code AS "code", t.engineer_id::text AS "engineerId", t.folder_path AS "folderPath", t.deadline_at AS "deadlineAt",
                 t.title AS "title", t.notes AS "notes", u.name AS "assignedByName"
          FROM tasks t
          JOIN estimates e ON e.task_id = t.id
          JOIN users u ON u.id = t.assigned_by
          LEFT JOIN customers c ON c.id = e.customer_id
          WHERE t.code = ${code}`;
        const [row] = WORKSPACE_ROWS.parse(rows);
        if (row === undefined) return null;
        const { customerId, customerName, ...rest } = row;
        return { ...rest, customer: customerId === null || customerName === null ? null : { id: customerId, name: customerName } };
      }),

    lockEstimate: (id, tx) =>
      withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; an estimate asked for by one is not found.
        if (!isUuid(id)) return null;
        // Prisma has no row lock, so the read is a raw statement: the ID is a bound parameter.
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT e.id::text AS "id", t.engineer_id::text AS "engineerId", e.status::text AS "status", e.customer_id::text AS "customerId"
          FROM estimates e JOIN tasks t ON t.id = e.task_id
          WHERE e.id = ${id}::uuid
          FOR UPDATE OF e FOR SHARE OF t`;
        return LOCK_ROWS.parse(rows)[0] ?? null;
      }),

    findActiveCustomer: (id, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(id)) return null;
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", name FROM customers WHERE id = ${id}::uuid AND deleted_at IS NULL FOR SHARE`;
        return CUSTOMER_ROWS.parse(rows)[0] ?? null;
      }),

    setCustomer: (estimateId, customerId, tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).estimate.update({ where: { id: estimateId }, data: { customerId, inputsRevision: { increment: 1 } }, select: { id: true } });
      }),

    setStatus: (estimateId, from, to, tx) =>
      withDatabaseErrors(async () => {
        const { count } = await clientFor(db, tx).estimate.updateMany({ where: { id: estimateId, status: from }, data: { status: to } });
        return count === 1;
      }),
  };
}
