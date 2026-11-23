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

/** A customer as a choice: the ID, the name and the short name (class Internal, CR-01 item 6). No contact detail and no rate. */
export interface CustomerChoice {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
}

/** What the workspace page needs of a task and its estimate. `engineerId` stays on the server: it decides who may open the page and is never sent on. */
export interface WorkspaceRecord {
  readonly estimateId: string;
  readonly status: EstimateStatus;
  /** Null only for an estimate made before CR-01 item 6. A customer that was deleted after it was chosen is still named here. */
  readonly customer: CustomerChoice | null;
  readonly code: string;
  readonly engineerId: string;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly title: string;
  /** The project name (CR-01 item 6). */
  readonly subject: string;
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
  /** The count of input changes so far (architecture section 4.8). A calculation is stored against the value read here, under this lock (STORY-03.05). */
  readonly inputsRevision: number;
  /** The task's code (`Q-2026-0501`), the name an audit entry gives the estimate (STORY-05.12). Read under the same lock; it never changes. */
  readonly taskCode: string;
}

/** A material one of the estimate's parts names, and whether the Admin deleted it (a soft delete: the row stays). */
export interface MaterialInUse {
  readonly id: string;
  readonly deleted: boolean;
}

/** What the parts tree needs to decide who may read it and whether it may change: the estimate's owner and state, read without a lock. */
export interface EstimateAccess {
  readonly id: string;
  readonly engineerId: string;
  readonly status: EstimateStatus;
}

/**
 * What decides which configuration version the part form is built from (STORY-08.05): the estimate's status and the version its **current calculation** was made with. The version's ID only, no figure of the
 * calculation is read; null while the estimate has no current calculation.
 */
export interface ConfigurationBasis {
  readonly status: EstimateStatus;
  readonly configVersionId: string | null;
}

export interface EstimateRepository {
  /** The task with this code and its estimate, or null when there is none. */
  findWorkspaceByCode(code: string): Promise<WorkspaceRecord | null>;
  /** The owner and state of the estimate with this ID, **without a lock** (a read of the tree); null for an unknown ID (or one that is not a UUID). */
  findEstimateAccess(id: string): Promise<EstimateAccess | null>;
  /**
   * The status of the estimate and the configuration version of its current calculation, in **one statement** (so the two are one moment), **without a lock** (a read of the form); null for an unknown ID (or one that is
   * not a UUID). It reads no figure: the calculation's `config_version_id` is the only column taken from it.
   */
  findConfigurationBasis(id: string): Promise<ConfigurationBasis | null>;
  /** The estimate with this ID, **locked for update until the transaction ends**; null for an unknown ID (or one that is not a UUID). */
  lockEstimate(id: string, tx: Transaction): Promise<EstimateLock | null>;
  /** The customer with this ID, locked for share; null for an unknown ID, a deleted customer or an ID that is not a UUID. */
  findActiveCustomer(id: string, tx: Transaction): Promise<CustomerChoice | null>;
  /** The customer with this ID **whether or not it was deleted** (an estimate keeps naming a customer deleted since), without a lock; null for an unknown ID. The audit entry of a change names the customer it replaced. */
  findCustomerChoice(id: string, tx: Transaction): Promise<CustomerChoice | null>;
  /**
   * The materials the estimate's parts name, **each locked for share in ascending ID order** until the transaction ends, with whether it was deleted (STORY-06.08 AC-10). The lock order is the estimate, then
   * the task, then the customer, then these, as the writers of a part's material take it (`lockMaterialForUse`), so there is no cycle with a material delete, which takes no estimate lock. A material is found by
   * its ID **anywhere** in a part's inputs, as the delete guard finds it (`findOpenEstimatesOfMaterial`): the shape of that value belongs to the part form, so this can only over-match, never miss. Call it under
   * the estimate's row lock.
   */
  lockMaterialsInUse(estimateId: string, tx: Transaction): Promise<ReadonlyArray<MaterialInUse>>;
  /** Sets the customer and raises `inputs_revision` by one, in the caller's transaction. The caller has already checked the state and that the customer differs. */
  setCustomer(estimateId: string, customerId: string, tx: Transaction): Promise<void>;
  /** Raises `inputs_revision` by one, in the caller's transaction: a part added, deleted, moved or reordered is an input change (architecture section 4.8). The caller holds the estimate's lock. */
  bumpInputsRevision(estimateId: string, tx: Transaction): Promise<void>;
  /**
   * Moves the estimate from one status to the next (STORY-06.01), in the caller's transaction, and answers whether it did. The write is conditional on the
   * status the caller read under the row lock, so a status can only ever change from the one that was checked: it answers `false` (and writes nothing) when
   * the estimate no longer has `from`, which the lock makes impossible unless a caller skipped it. Nothing else of the row changes, and not
   * `inputs_revision`: a status change is not an input change (architecture section 4.8).
   */
  setStatus(estimateId: string, from: EstimateStatus, to: EstimateStatus, tx: Transaction): Promise<boolean>;
  /**
   * Links the estimate to the calculation just stored for it and sets its status, in the caller's transaction (STORY-03.05; architecture sections 4.2 and 4.4).
   * It leaves `inputs_revision` alone: a calculation is not an input change. The statement links only a calculation that belongs to this very estimate, and
   * throws if it changed no row, so an estimate can never show another estimate's figures.
   */
  linkCalculation(estimateId: string, calculationId: string, status: EstimateStatus, tx: Transaction): Promise<void>;
}

/**
 * What a calculation needs of the estimate repository: the lock and the link (STORY-03.05, STORY-05.09). A named interface and not a `Pick`, so the audit-transaction check (architecture section 6,
 * "The two checks as built") sees a repository type, declared in this directory, as the receiver of the lock the quantity warning's audit entry follows (STORY-05.12).
 */
export interface EstimateCalculationStorage {
  readonly lockEstimate: EstimateRepository['lockEstimate'];
  readonly linkCalculation: EstimateRepository['linkCalculation'];
}

/**
 * What an approval needs of the estimate repository: the lock alone (STORY-06.06). A named interface and not a `Pick`, for the same reason as `EstimateCalculationStorage`: the audit-transaction check sees
 * a repository type, declared in this directory, as the receiver of the lock the approval's audit entry follows.
 */
export interface EstimateLocking {
  readonly lockEstimate: EstimateRepository['lockEstimate'];
}

/**
 * What an unlock needs of the estimate repository (STORY-06.08 AC-10): the estimate's lock, then its customer and the materials its parts name, each locked for share in that order. A named interface and not a
 * `Pick`, for the same reason as `EstimateLocking`.
 */
export interface EstimateUnlocking {
  readonly lockEstimate: EstimateRepository['lockEstimate'];
  /** The status of the estimate, read without a lock, for the preview (a read). */
  readonly findEstimateAccess: EstimateRepository['findEstimateAccess'];
  readonly findActiveCustomer: EstimateRepository['findActiveCustomer'];
  readonly lockMaterialsInUse: EstimateRepository['lockMaterialsInUse'];
}

const STATUS = z.enum(['DRAFT', 'PREPARED', 'APPROVED']);

const WORKSPACE_ROWS = z.array(
  z.strictObject({
    estimateId: z.string(),
    status: STATUS,
    customerId: z.string().nullable(),
    customerName: z.string().nullable(),
    customerShortName: z.string().nullable(),
    code: z.string(),
    engineerId: z.string(),
    folderPath: z.string(),
    deadlineAt: z.date(),
    title: z.string(),
    subject: z.string(),
    notes: z.string().nullable(),
    assignedByName: z.string(),
  }),
);
const LOCK_ROWS = z.array(z.strictObject({ id: z.string(), engineerId: z.string(), status: STATUS, customerId: z.string().nullable(), inputsRevision: z.number().int(), taskCode: z.string() }));
const BASIS_ROWS = z.array(z.strictObject({ status: STATUS, configVersionId: z.string().nullable() }));
const ACCESS_ROWS = z.array(z.strictObject({ id: z.string(), engineerId: z.string(), status: STATUS }));
const CUSTOMER_ROWS = z.array(z.strictObject({ id: z.string(), name: z.string(), shortName: z.string() }));
const MATERIAL_ROWS = z.array(z.strictObject({ id: z.string(), deleted: z.boolean() }));

const isUuid = (id: string): boolean => z.uuid().safeParse(id).success;

/** Builds the estimate methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createEstimateRepository(db: PrismaClient): EstimateRepository {
  return {
    findWorkspaceByCode: (code) =>
      withDatabaseErrors(async () => {
        const rows = await db.$queryRaw`
          SELECT e.id::text AS "estimateId", e.status::text AS "status", c.id::text AS "customerId", c.name AS "customerName", c.short_name AS "customerShortName",
                 t.code AS "code", t.engineer_id::text AS "engineerId", t.folder_path AS "folderPath", t.deadline_at AS "deadlineAt",
                 t.title AS "title", t.subject AS "subject", t.notes AS "notes", u.name AS "assignedByName"
          FROM tasks t
          JOIN estimates e ON e.task_id = t.id
          JOIN users u ON u.id = t.assigned_by
          LEFT JOIN customers c ON c.id = e.customer_id
          WHERE t.code = ${code}`;
        const [row] = WORKSPACE_ROWS.parse(rows);
        if (row === undefined) return null;
        const { customerId, customerName, customerShortName, ...rest } = row;
        const customer = customerId === null || customerName === null || customerShortName === null ? null : { id: customerId, name: customerName, shortName: customerShortName };
        return { ...rest, customer };
      }),

    findEstimateAccess: (id) =>
      withDatabaseErrors(async () => {
        if (!isUuid(id)) return null;
        const rows = await db.$queryRaw`
          SELECT e.id::text AS "id", t.engineer_id::text AS "engineerId", e.status::text AS "status"
          FROM estimates e JOIN tasks t ON t.id = e.task_id
          WHERE e.id = ${id}::uuid`;
        return ACCESS_ROWS.parse(rows)[0] ?? null;
      }),

    findConfigurationBasis: (id) =>
      withDatabaseErrors(async () => {
        if (!isUuid(id)) return null;
        const rows = await db.$queryRaw`
          SELECT e.status::text AS "status", c.config_version_id::text AS "configVersionId"
          FROM estimates e LEFT JOIN calculations c ON c.id = e.current_calculation_id
          WHERE e.id = ${id}::uuid`;
        return BASIS_ROWS.parse(rows)[0] ?? null;
      }),

    lockEstimate: (id, tx) =>
      withDatabaseErrors(async () => {
        // PostgreSQL would refuse a text that is not a UUID with an error; an estimate asked for by one is not found.
        if (!isUuid(id)) return null;
        // Prisma has no row lock, so the read is a raw statement: the ID is a bound parameter.
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT e.id::text AS "id", t.engineer_id::text AS "engineerId", e.status::text AS "status", e.customer_id::text AS "customerId",
                 e.inputs_revision::int AS "inputsRevision", t.code AS "taskCode"
          FROM estimates e JOIN tasks t ON t.id = e.task_id
          WHERE e.id = ${id}::uuid
          FOR UPDATE OF e FOR SHARE OF t`;
        return LOCK_ROWS.parse(rows)[0] ?? null;
      }),

    findActiveCustomer: (id, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(id)) return null;
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", name, short_name AS "shortName" FROM customers WHERE id = ${id}::uuid AND deleted_at IS NULL FOR SHARE`;
        return CUSTOMER_ROWS.parse(rows)[0] ?? null;
      }),

    findCustomerChoice: (id, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(id)) return null;
        const rows = await clientFor(db, tx).$queryRaw`SELECT id::text AS "id", name, short_name AS "shortName" FROM customers WHERE id = ${id}::uuid`;
        return CUSTOMER_ROWS.parse(rows)[0] ?? null;
      }),

    lockMaterialsInUse: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        // Fails closed as the delete guard does: an ID that is not a UUID is a programming fault, never "no material in use", which would let an unlock through.
        if (!isUuid(estimateId)) throw new Error('The material check needs an estimate ID.');
        // The IDs found in the parts' inputs (a UUID as a JSON string, in lower case), then the materials with those IDs, locked `FOR SHARE` in ascending ID order. The deleted ones are listed too: the caller refuses.
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT m.id::text AS "id", (m.deleted_at IS NOT NULL) AS "deleted"
          FROM materials m
          WHERE m.id::text IN (
            SELECT lower(found[1])
            FROM estimate_nodes n
            CROSS JOIN LATERAL regexp_matches(lower(n.inputs::text), '"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"', 'g') AS found
            WHERE n.estimate_id = ${estimateId}::uuid)
          ORDER BY m.id
          FOR SHARE OF m`;
        return MATERIAL_ROWS.parse(rows);
      }),

    setCustomer: (estimateId, customerId, tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).estimate.update({ where: { id: estimateId }, data: { customerId, inputsRevision: { increment: 1 } }, select: { id: true } });
      }),

    bumpInputsRevision: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        await clientFor(db, tx).estimate.update({ where: { id: estimateId }, data: { inputsRevision: { increment: 1 } }, select: { id: true } });
      }),

    setStatus: (estimateId, from, to, tx) =>
      withDatabaseErrors(async () => {
        const { count } = await clientFor(db, tx).estimate.updateMany({ where: { id: estimateId, status: from }, data: { status: to } });
        return count === 1;
      }),

    linkCalculation: (estimateId, calculationId, status, tx) =>
      withDatabaseErrors(async () => {
        if (!isUuid(estimateId) || !isUuid(calculationId)) throw new Error('The calculation could not be linked to the estimate.');
        // Raw, to make the ownership part of the write: the foreign key alone would accept another estimate's calculation. `updated_at` is set by hand.
        const changed = await clientFor(db, tx).$executeRaw`
          UPDATE estimates SET current_calculation_id = ${calculationId}::uuid, status = ${status}::estimate_status, updated_at = now()
          WHERE id = ${estimateId}::uuid
            AND EXISTS (SELECT 1 FROM calculations WHERE id = ${calculationId}::uuid AND estimate_id = ${estimateId}::uuid)`;
        if (changed !== 1) throw new Error('The calculation could not be linked to the estimate.');
      }),
  };
}
