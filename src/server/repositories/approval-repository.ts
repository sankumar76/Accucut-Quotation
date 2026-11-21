import { z } from 'zod';

import { withDatabaseErrors } from './database-errors';
import type { PrismaClient } from './prisma-client';
import { clientFor, type Transaction } from './transaction';

/**
 * Storage of the approvals (STORY-06.06; FR-062, FR-064, NFR-007; ADR-008; architecture sections 4.8, 4.10 and 5.1): the table `approvals`, where the Approved Quote Price (BO) lives.
 *
 * **Restricted** (ADR-008, NFR-002): the price is cost data, so nothing an Engineer's code path can reach may import this file. It is in neither list of the Engineer allow-list in `eslint.config.mjs`,
 * so it is refused, and `tests/security/engineer-import-rule.test.ts` lints a planted import of it from every Engineer view.
 *
 * **The approved values are written once.** There is no update of the price here and none can be added by mistake: the runtime role holds no table-wide UPDATE and a trigger refuses a change of any
 * approve column for every role (the migration). The unlock, cancel and remove columns are written by 06.08, 06.12 and 06.13 (`markUnlocked`, `markCancelled`, `markRemoved`).
 *
 * **Every write takes the caller's `Transaction`, as required**, so the approval, the estimate's new status and the audit entry are one commit or none, under the estimate's row lock
 * (`estimate-repository.ts` `lockEstimate`; architecture section 4.8).
 *
 * **BO is read here and nowhere else** (AC-9, SQR-07 of AQP-321): `findLatestApproval` reads the estimate's **latest** row and never asks the figure state, so clearing the calculated figures cannot change the price.
 * **A latest row whose price was removed is no BO** (STORY-06.13 AC-3, AC-6): BO is then "Not set yet", and an earlier row of an earlier cycle does not come back in its place (a later approval replaced its price, and it is
 * shown nowhere). **No read that serves a screen selects the price of a removed row**: `findLatestApproval` returns `null` for it, and `findLatestRemoval` selects who and when only.
 */

/** The decimals the price column stores: rupees and paise. The calculated total column stores the same: the service hands it over already rounded by `toTwoPlaces`, the rule the dialog pre-fills with. */
const PRICE_DECIMALS = 2;

export interface NewApproval {
  readonly estimateId: string;
  readonly calculationId: string;
  /** The price in rupees as decimal text with two decimals ("12600.00"). */
  readonly approvedPrice: string;
  /** The calculated total (BL) the price was set against, as rupees and paise ("12629.99"): BL rounded by the rule the dialog pre-fills its price with. */
  readonly calculatedTotal: string;
  readonly approvedById: string;
  /** The price differs from the calculated total at rupees and paise (STORY-06.07, FR-103). Decided by the service from the total it read itself; written once, with the row. */
  readonly isOverride: boolean;
  /** The Lead's reason, trimmed, at most 500 characters. `null` unless `isOverride` (the table's CHECK holds the same rule): a reason is optional, and one given with the calculated total is dropped. */
  readonly overrideReason: string | null;
}

/**
 * The unlock of an approval, as SCR-06 shows it after the estimate was unlocked (STORY-06.08 AC-3): who, when, why, and whose Open queue the task is back in. The reason is the Lead's own text, kept as it was
 * stored (never a figure). Present only on a row whose unlock was stored; the price of that row is then the one "approved earlier".
 */
export interface UnlockRecord {
  readonly unlockedAt: Date;
  /** The name of the person who unlocked, now (a later rename shows). */
  readonly byName: string;
  readonly reason: string | null;
  /** The name of the Engineer whose task it is, now: the notice says the task is back in their Open queue. */
  readonly engineerName: string;
}

/**
 * The cancel of an approval, as SCR-06 shows it after the Admin cancelled it (STORY-06.12 AC-6): who, when, why, and whose Open queue the task is back in (the sentence is true only when the cancel moved an approved estimate to
 * Draft: the screen knows that from the approval having no unlock). The reason is the Admin's own text, kept as it was stored. Present only on a row whose cancel was stored; the price of that row is then marked "Approval cancelled".
 */
export interface CancelRecord {
  readonly cancelledAt: Date;
  /** The name of the person who cancelled, now (a later rename shows). */
  readonly byName: string;
  readonly reason: string | null;
  /** The name of the Engineer whose task it is, now. */
  readonly engineerName: string;
}

/** What an approval is, as SCR-06 shows it: the price, who approved it and when. Not the calculation's figures. */
export interface ApprovalRecord {
  readonly id: string;
  readonly calculationId: string;
  /** The price as decimal text with two decimals. */
  readonly approvedPrice: string;
  readonly approvedAt: Date;
  /** The approver's name now (a later rename shows). */
  readonly approverName: string;
  /** The name now of the Engineer whose task it is: the Admin's Cancel approval dialog says the task returns to their Open queue (STORY-06.12). */
  readonly engineerName: string;
  /** The calculated total (BL) the price was set against, as rupees and paise: what SCR-06 says the price is lower or higher than (STORY-06.07 AC-3). */
  readonly calculatedTotal: string;
  readonly isOverride: boolean;
  /** The reason given with the override; `null` when none was given or the price is not an override. */
  readonly overrideReason: string | null;
  /** `null` while the approval stands; the unlock once one was stored (the price is then "approved earlier"). */
  readonly unlock: UnlockRecord | null;
  /** `null` while the approval stands or was only unlocked; the cancel once one was stored (STORY-06.12). The price is then "Approval cancelled" until the Admin removes it (STORY-06.13) or a new approval replaces it. */
  readonly cancel: CancelRecord | null;
}

/** The approval a Lead or an Admin may still unlock: the one that is not yet unlocked, cancelled or removed. Only what the unlock needs: no figure but the price that is written to the audit entry. */
export interface LiveApproval {
  readonly id: string;
  readonly calculationId: string;
  /** The price as decimal text with two decimals. */
  readonly approvedPrice: string;
  /** The name now of the Engineer whose task it is: the unlock dialog says the task is reopened in their Open queue. */
  readonly engineerName: string;
}

export interface NewUnlock {
  readonly approvalId: string;
  readonly unlockedById: string;
  /** Already trimmed and checked (1 to 500 characters) by the service; the column has no length rule of its own. */
  readonly reason: string;
}

/** The latest approval of an estimate that has not been removed, as the cancel needs it (STORY-06.12 AC-3, AC-5, AC-10): which row it is, its price for the audit entry, and whether it was cancelled already. */
export interface CancellableApproval {
  readonly id: string;
  /** The price as decimal text with two decimals. */
  readonly approvedPrice: string;
  /** `null` while the approval has not been cancelled. */
  readonly cancelledAt: Date | null;
}

/**
 * The estimate's latest approval of any kind, as the removal of its price needs it (STORY-06.13 AC-3, AC-5): which row it is, its price for the audit entry (the entry keeps it; nothing else reads it), and whether it
 * was cancelled and whether its price was removed already. Read only under the estimate's row lock, by the one service that writes the removal; **it is never part of an answer** (AC-6).
 */
export interface RemovableApproval {
  readonly id: string;
  /** The price as decimal text with two decimals. */
  readonly approvedPrice: string;
  /** `null` while the approval has not been cancelled. */
  readonly cancelledAt: Date | null;
  /** `null` while the price has not been removed. */
  readonly removedAt: Date | null;
}

export interface NewRemoval {
  readonly approvalId: string;
  readonly removedById: string;
}

/**
 * The removal of the latest approval's price, as SCR-06 shows it after the Admin removed it (STORY-06.13 AC-3): who and when. **No price**: the row of a removed price is read for these two facts alone, so no route
 * can serve the price (AC-6).
 */
export interface RemovalRecord {
  readonly removedAt: Date;
  /** The name of the person who removed the price, now (a later rename shows). */
  readonly byName: string;
}

export interface NewCancel {
  readonly approvalId: string;
  readonly cancelledById: string;
  /** Already trimmed and checked (1 to 500 characters) by the service; the column has no length rule of its own. */
  readonly reason: string;
}

export interface ApprovalRepository {
  /** Adds the approval in the caller's transaction and returns its ID and time. */
  insertApproval(approval: NewApproval, tx: Transaction): Promise<{ readonly id: string; readonly approvedAt: Date }>;
  /**
   * The estimate's live approval (not unlocked, cancelled or removed), or `null`. Call it under the estimate's row lock, in the transaction that is about to unlock it (pass `tx`); the one-live-approval index means there is
   * at most one. Without `tx` it is a plain read (the unlock preview).
   */
  findLiveApproval(estimateId: string, tx?: Transaction): Promise<LiveApproval | null>;
  /**
   * Stores the unlock of a live approval, whole and once: who, when (the database's clock) and why, in the caller's transaction. Returns the time, or `null` when the row is not live any more (already unlocked,
   * cancelled or removed), which the caller treats as a fault because it holds the estimate's lock. **It never touches an approve column**: the runtime role has no grant on one (migration `approvals`).
   */
  markUnlocked(unlock: NewUnlock, tx: Transaction): Promise<Date | null>;
  /**
   * The estimate's latest approval that has not been removed, cancelled or not (STORY-06.12): the row an Admin may cancel while it is not cancelled, whatever the status of the estimate (an approval kept through an unlock is the
   * latest one too). Ordered as `findLatestApproval` orders (BO is this row). Call it under the estimate's row lock, in the transaction that is about to cancel it (pass `tx`).
   */
  findLatestForCancel(estimateId: string, tx: Transaction): Promise<CancellableApproval | null>;
  /**
   * Stores the cancel of an approval, whole and once: who, when (the database's clock) and why, in the caller's transaction. Returns the time, or `null` when the row was already cancelled or removed, which the caller treats as
   * a fault because it holds the estimate's lock. **It never touches an approve column**: the runtime role has no grant on one (migration `approvals`).
   */
  markCancelled(cancel: NewCancel, tx: Transaction): Promise<Date | null>;
  /**
   * The estimate's latest approval of any kind, cancelled or removed or not (STORY-06.13): the row an Admin may remove the price of, once it is cancelled and while it is not removed. Ordered as `findLatestApproval`
   * orders (BO is this row). It selects the price, which only the audit entry of the removal takes. Call it under the estimate's row lock, in the transaction that is about to remove it (pass `tx`).
   */
  findLatestForRemoval(estimateId: string, tx: Transaction): Promise<RemovableApproval | null>;
  /**
   * Stores the removal of a cancelled approval's price, whole and once: who and when (the database's clock), in the caller's transaction. Returns the time, or `null` when the row is not cancelled or was removed already,
   * which the caller treats as a fault because it holds the estimate's lock. **It never touches an approve column** (the runtime role has no grant on one), so the price stays in its row and in the audit entry.
   */
  markRemoved(removal: NewRemoval, tx: Transaction): Promise<Date | null>;
  /** The removal of the estimate's latest approval when that row's price was removed: who and when, never the price. `null` when the latest row stands or there is none. A plain read (the page's notice). */
  findLatestRemoval(estimateId: string): Promise<RemovalRecord | null>;
  /**
   * The estimate's **latest** approval, or `null` when there is none **or when its price was removed** (BO reads "Not set yet": an earlier row does not come back in its place). A plain read, **not through the figure
   * state** (AC-9). Pass `tx` to read in the caller's transaction.
   */
  findLatestApproval(estimateId: string, tx?: Transaction): Promise<ApprovalRecord | null>;
}

/** What the approval itself writes: the row (STORY-06.06). A named interface and not a `Pick`, so the audit-transaction check sees a repository type as the receiver of the insert the audit entry follows. */
export interface ApprovalWrites {
  readonly insertApproval: ApprovalRepository['insertApproval'];
}

/** What the unlock reads and writes of the approvals (STORY-06.08), a named interface for the same reason as `ApprovalWrites`. */
export interface ApprovalUnlocking {
  readonly findLiveApproval: ApprovalRepository['findLiveApproval'];
  readonly markUnlocked: ApprovalRepository['markUnlocked'];
}

/** What the cancel needs of the approvals (STORY-06.12), a named interface for the same reason as `ApprovalWrites`. */
export interface ApprovalCancelling {
  readonly findLatestForCancel: ApprovalRepository['findLatestForCancel'];
  readonly markCancelled: ApprovalRepository['markCancelled'];
}

/** What the removal of a price needs of the approvals (STORY-06.13), a named interface for the same reason as `ApprovalWrites`. */
export interface ApprovalRemoving {
  readonly findLatestForRemoval: ApprovalRepository['findLatestForRemoval'];
  readonly markRemoved: ApprovalRepository['markRemoved'];
}

const LIVE_ROWS = z.array(z.strictObject({ id: z.string(), calculationId: z.string(), approvedPrice: z.string(), engineerName: z.string() }));
const UNLOCKED_ROWS = z.array(z.strictObject({ unlockedAt: z.date() }));
const CANCELLABLE_ROWS = z.array(z.strictObject({ id: z.string(), approvedPrice: z.string(), cancelledAt: z.date().nullable() }));
const CANCELLED_ROWS = z.array(z.strictObject({ cancelledAt: z.date() }));
const REMOVABLE_ROWS = z.array(z.strictObject({ id: z.string(), approvedPrice: z.string(), cancelledAt: z.date().nullable(), removedAt: z.date().nullable() }));
const REMOVED_ROWS = z.array(z.strictObject({ removedAt: z.date() }));
const REMOVAL_ROWS = z.array(z.strictObject({ removedAt: z.date().nullable(), byName: z.string().nullable() }));

/** Builds the approval methods over a Prisma client. Every method turns a pool or statement timeout into `DatabaseBusyError`. */
export function createApprovalRepository(db: PrismaClient): ApprovalRepository {
  return {
    insertApproval: (approval, tx) =>
      withDatabaseErrors(() =>
        clientFor(db, tx).approval.create({
          data: {
            estimateId: approval.estimateId,
            calculationId: approval.calculationId,
            approvedPrice: approval.approvedPrice,
            calculatedBl: approval.calculatedTotal,
            approvedById: approval.approvedById,
            isOverride: approval.isOverride,
            overrideReason: approval.overrideReason,
          },
          select: { id: true, approvedAt: true },
        }),
      ),

    findLiveApproval: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        if (!z.uuid().safeParse(estimateId).success) return null;
        // Raw, so the estimate's ID is a bound parameter and the three "not yet" tests are the ones of the one-live-approval index.
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT a.id::text AS "id", a.calculation_id::text AS "calculationId", a.approved_price::text AS "approvedPrice", u.name AS "engineerName"
          FROM approvals a
          JOIN estimates e ON e.id = a.estimate_id
          JOIN tasks t ON t.id = e.task_id
          JOIN users u ON u.id = t.engineer_id
          WHERE a.estimate_id = ${estimateId}::uuid AND a.unlocked_at IS NULL AND a.cancelled_at IS NULL AND a.removed_at IS NULL`;
        return LIVE_ROWS.parse(rows)[0] ?? null;
      }),

    markUnlocked: (unlock, tx) =>
      withDatabaseErrors(async () => {
        // Raw, for the database's own clock and a single statement. The WHERE is the row's own "still live" test, so a second unlock of the same row changes nothing and returns no row.
        const rows = await clientFor(db, tx).$queryRaw`
          UPDATE approvals SET unlocked_by = ${unlock.unlockedById}::uuid, unlocked_at = now(), unlock_reason = ${unlock.reason}
          WHERE id = ${unlock.approvalId}::uuid AND unlocked_at IS NULL AND cancelled_at IS NULL AND removed_at IS NULL
          RETURNING unlocked_at AS "unlockedAt"`;
        return UNLOCKED_ROWS.parse(rows)[0]?.unlockedAt ?? null;
      }),

    findLatestForCancel: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        if (!z.uuid().safeParse(estimateId).success) return null;
        // The latest row of any kind, and then the removed test: a latest row whose price was removed leaves the estimate with no approval to cancel, and an earlier row must not stand in for it (STORY-06.13).
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", approved_price::text AS "approvedPrice", cancelled_at AS "cancelledAt"
          FROM (
            SELECT id, approved_price, cancelled_at, removed_at FROM approvals
            WHERE estimate_id = ${estimateId}::uuid
            ORDER BY approved_at DESC, id DESC
            LIMIT 1
          ) latest
          WHERE removed_at IS NULL`;
        return CANCELLABLE_ROWS.parse(rows)[0] ?? null;
      }),

    markCancelled: (cancel, tx) =>
      withDatabaseErrors(async () => {
        // Raw, for the database's own clock and a single statement. The WHERE is the row's own "not yet" test, so a second cancel of the same row changes nothing and returns no row.
        const rows = await clientFor(db, tx).$queryRaw`
          UPDATE approvals SET cancelled_by = ${cancel.cancelledById}::uuid, cancelled_at = now(), cancel_reason = ${cancel.reason}
          WHERE id = ${cancel.approvalId}::uuid AND cancelled_at IS NULL AND removed_at IS NULL
          RETURNING cancelled_at AS "cancelledAt"`;
        return CANCELLED_ROWS.parse(rows)[0]?.cancelledAt ?? null;
      }),

    findLatestForRemoval: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        if (!z.uuid().safeParse(estimateId).success) return null;
        const rows = await clientFor(db, tx).$queryRaw`
          SELECT id::text AS "id", approved_price::text AS "approvedPrice", cancelled_at AS "cancelledAt", removed_at AS "removedAt"
          FROM approvals
          WHERE estimate_id = ${estimateId}::uuid
          ORDER BY approved_at DESC, id DESC
          LIMIT 1`;
        return REMOVABLE_ROWS.parse(rows)[0] ?? null;
      }),

    markRemoved: (removal, tx) =>
      withDatabaseErrors(async () => {
        // Raw, for the database's own clock and a single statement. The WHERE is the row's own "cancelled and not yet removed" test, so a second removal, and the removal of an approval that was never cancelled, change nothing and return no row.
        const rows = await clientFor(db, tx).$queryRaw`
          UPDATE approvals SET removed_by = ${removal.removedById}::uuid, removed_at = now()
          WHERE id = ${removal.approvalId}::uuid AND cancelled_at IS NOT NULL AND removed_at IS NULL
          RETURNING removed_at AS "removedAt"`;
        return REMOVED_ROWS.parse(rows)[0]?.removedAt ?? null;
      }),

    findLatestRemoval: (estimateId) =>
      withDatabaseErrors(async () => {
        if (!z.uuid().safeParse(estimateId).success) return null;
        // Who and when only: no statement that serves a screen selects the price of a removed row (AC-6).
        const rows = await db.$queryRaw`
          SELECT latest.removed_at AS "removedAt", u.name AS "byName"
          FROM (
            SELECT removed_at, removed_by FROM approvals
            WHERE estimate_id = ${estimateId}::uuid
            ORDER BY approved_at DESC, id DESC
            LIMIT 1
          ) latest
          LEFT JOIN users u ON u.id = latest.removed_by
          WHERE latest.removed_at IS NOT NULL`;
        const found = REMOVAL_ROWS.parse(rows)[0];
        // The two columns are set together (CHECK `ck_approvals_remove_by_and_at_together`) and the person cannot be deleted (no cascade), so a row with a time has a name.
        return found === undefined || found.removedAt === null || found.byName === null ? null : { removedAt: found.removedAt, byName: found.byName };
      }),

    findLatestApproval: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        const found = await clientFor(db, tx).approval.findFirst({
          where: { estimateId },
          orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
          select: {
            removedAt: true,
            id: true,
            calculationId: true,
            approvedPrice: true,
            calculatedBl: true,
            isOverride: true,
            overrideReason: true,
            approvedAt: true,
            approver: { select: { name: true } },
            unlockedAt: true,
            unlockReason: true,
            unlocker: { select: { name: true } },
            cancelledAt: true,
            cancelReason: true,
            canceller: { select: { name: true } },
            estimate: { select: { task: { select: { engineer: { select: { name: true } } } } } },
          },
        });
        // A latest row whose price was removed is no BO: "Not set yet", and no earlier row comes back (STORY-06.13). The price of that row is not put in any answer.
        if (found === null || found.removedAt !== null) return null;
        return {
          id: found.id,
          calculationId: found.calculationId,
          approvedPrice: found.approvedPrice.toFixed(PRICE_DECIMALS),
          approvedAt: found.approvedAt,
          approverName: found.approver.name,
          engineerName: found.estimate.task.engineer.name,
          calculatedTotal: found.calculatedBl.toFixed(PRICE_DECIMALS),
          isOverride: found.isOverride,
          overrideReason: found.overrideReason,
          // The three columns of the act are set together (CHECK `ck_approvals_unlock_by_and_at_together`), so the time is the one test.
          unlock:
            found.unlockedAt === null || found.unlocker === null
              ? null
              : { unlockedAt: found.unlockedAt, byName: found.unlocker.name, reason: found.unlockReason, engineerName: found.estimate.task.engineer.name },
          // The same for the cancel: its three columns are set together (CHECK `ck_approvals_cancel_by_and_at_together`).
          cancel:
            found.cancelledAt === null || found.canceller === null
              ? null
              : { cancelledAt: found.cancelledAt, byName: found.canceller.name, reason: found.cancelReason, engineerName: found.estimate.task.engineer.name },
        };
      }),
  };
}
