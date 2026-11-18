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
 * approve column for every role (the migration). The unlock, cancel and remove columns are the later stories' (06.08, 06.12, 06.13).
 *
 * **Every write takes the caller's `Transaction`, as required**, so the approval, the estimate's new status and the audit entry are one commit or none, under the estimate's row lock
 * (`estimate-repository.ts` `lockEstimate`; architecture section 4.8).
 *
 * **BO is read here and nowhere else** (AC-9, SQR-07 of AQP-321): `findLatestApproval` reads the latest row of an estimate that has not been removed, and never asks the figure state, so clearing the calculated
 * figures cannot change the price.
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

/** What an approval is, as SCR-06 shows it: the price, who approved it and when. Not the calculation's figures. */
export interface ApprovalRecord {
  readonly id: string;
  readonly calculationId: string;
  /** The price as decimal text with two decimals. */
  readonly approvedPrice: string;
  readonly approvedAt: Date;
  /** The approver's name now (a later rename shows). */
  readonly approverName: string;
  /** The calculated total (BL) the price was set against, as rupees and paise: what SCR-06 says the price is lower or higher than (STORY-06.07 AC-3). */
  readonly calculatedTotal: string;
  readonly isOverride: boolean;
  /** The reason given with the override; `null` when none was given or the price is not an override. */
  readonly overrideReason: string | null;
  /** `null` while the approval stands; the unlock once one was stored (the price is then "approved earlier"). */
  readonly unlock: UnlockRecord | null;
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
  /** The latest approval of the estimate that has not been removed (BO), or null when there is none. A plain read, **not through the figure state** (AC-9). Pass `tx` to read in the caller's transaction. */
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

const LIVE_ROWS = z.array(z.strictObject({ id: z.string(), calculationId: z.string(), approvedPrice: z.string(), engineerName: z.string() }));
const UNLOCKED_ROWS = z.array(z.strictObject({ unlockedAt: z.date() }));

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

    findLatestApproval: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        const found = await clientFor(db, tx).approval.findFirst({
          where: { estimateId, removedAt: null },
          orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
          select: {
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
            estimate: { select: { task: { select: { engineer: { select: { name: true } } } } } },
          },
        });
        if (found === null) return null;
        return {
          id: found.id,
          calculationId: found.calculationId,
          approvedPrice: found.approvedPrice.toFixed(PRICE_DECIMALS),
          approvedAt: found.approvedAt,
          approverName: found.approver.name,
          calculatedTotal: found.calculatedBl.toFixed(PRICE_DECIMALS),
          isOverride: found.isOverride,
          overrideReason: found.overrideReason,
          // The three columns of the act are set together (CHECK `ck_approvals_unlock_by_and_at_together`), so the time is the one test.
          unlock:
            found.unlockedAt === null || found.unlocker === null
              ? null
              : { unlockedAt: found.unlockedAt, byName: found.unlocker.name, reason: found.unlockReason, engineerName: found.estimate.task.engineer.name },
        };
      }),
  };
}
