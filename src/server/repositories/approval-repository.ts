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
}

export interface ApprovalRepository {
  /** Adds the approval in the caller's transaction and returns its ID and time. */
  insertApproval(approval: NewApproval, tx: Transaction): Promise<{ readonly id: string; readonly approvedAt: Date }>;
  /** The latest approval of the estimate that has not been removed (BO), or null when there is none. A plain read, **not through the figure state** (AC-9). Pass `tx` to read in the caller's transaction. */
  findLatestApproval(estimateId: string, tx?: Transaction): Promise<ApprovalRecord | null>;
}

/** What the approval itself writes: the row (STORY-06.06). A named interface and not a `Pick`, so the audit-transaction check sees a repository type as the receiver of the insert the audit entry follows. */
export interface ApprovalWrites {
  readonly insertApproval: ApprovalRepository['insertApproval'];
}

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
          },
          select: { id: true, approvedAt: true },
        }),
      ),

    findLatestApproval: (estimateId, tx) =>
      withDatabaseErrors(async () => {
        const found = await clientFor(db, tx).approval.findFirst({
          where: { estimateId, removedAt: null },
          orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
          select: { id: true, calculationId: true, approvedPrice: true, approvedAt: true, approver: { select: { name: true } } },
        });
        if (found === null) return null;
        return { id: found.id, calculationId: found.calculationId, approvedPrice: found.approvedPrice.toFixed(PRICE_DECIMALS), approvedAt: found.approvedAt, approverName: found.approver.name };
      }),
  };
}
