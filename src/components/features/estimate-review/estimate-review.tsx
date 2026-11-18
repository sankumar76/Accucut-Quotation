import { APPROVED_NOTICE_ID } from '@/components/features/estimate-approve/approve-ids';
import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatIst } from '@/lib/time';
import type { CostsView } from '@/server/views/schemas/costs';

import { WorkspaceHeader, type WorkspaceHeaderView } from '../estimate-workspace/workspace-header';

import { BuildTable } from './build-table';
import { FigureTiles, type ApprovedTileView } from './figure-tiles';
import { warnedNodeIds } from './quantity-tag';
import { RatesChangedNotice } from './rates-changed-notice';
import { approveOffer, ReviewActions } from './review-actions';
import { ReviewTree } from './review-tree';
import { UnlockedNotice } from './unlocked-notice';
import { WarningNotice } from './warning-notice';
import {
  APPROVED_NOTICE_BODY,
  APPROVED_NOTICE_TITLE_PLAIN,
  approvedNoticeTitle,
  CLEARED_NOTICE_BODY,
  CLEARED_NOTICE_TITLE,
  NOT_CALCULATED_NOTICE,
  REVIEW_CUSTOMER_LABEL,
  REVIEW_NO_CUSTOMER,
} from './review-texts';

/**
 * SCR-06 "Estimate review" (STORY-06.02; UX spec SCR-06), what a Lead or an Admin sees at `/estimates/<code>`: the task's header and customer, the notice of the state, the BL, BN and BO tiles, the parts
 * tree with each row's own figure, "How the total is built" and the action bar. It is drawn from one `CostsView`, the strict answer of `GET /api/v1/estimates/{id}/costs`, so a figure reaches the
 * screen only as `figure-state` allowed it (architecture section 4.8): in the states `none` and `out-of-date` the view holds no figure at all, and this file has nowhere to read one from.
 *
 * **Restricted** (NFR-002): every file in this folder is for the Lead and the Admin. None is a client component, so none is ever sent to the browser as code, and none is imported by the Engineer's
 * page, which loads this folder with a dynamic `import()` only on the Lead's and the Admin's branch (`tests/unit/estimate-review-architecture.test.ts`).
 *
 * **The one script is the Calculate or Recalculate button** (STORY-06.04), in its own folder (`estimate-recalculate`) and as small as it can be (NFR-009, ADR-016). It holds no figure, and the root of the review is
 * the `group/review` that lets the tiles show a skeleton while that button is busy, by CSS alone.
 */

export interface EstimateReviewProps {
  readonly header: WorkspaceHeaderView;
  /** The estimate's ID, for the Recalculate button's request (STORY-06.04). */
  readonly estimateId: string;
  readonly customer: { readonly id: string; readonly name: string } | null;
  readonly costs: CostsView;
  /** The time of the calculation written in IST (`formatIst`), or `null` while there is no calculation. */
  readonly calculatedAt: string | null;
}

/** The approved notice of SCR-06 (STORY-06.06 AC-5): the approver and the time, and what approval means. It holds focus when an approval has just worked (`tabIndex` -1). */
function ApprovedNotice({ approval }: { readonly approval: ApprovedTileView | null }) {
  return (
    <div id={APPROVED_NOTICE_ID} tabIndex={-1} className="rounded-md">
      <Notice tone="success" title={approval === null ? APPROVED_NOTICE_TITLE_PLAIN : approvedNoticeTitle(approval.approvedAtLabel, approval.approverName)}>
        {APPROVED_NOTICE_BODY}
      </Notice>
    </div>
  );
}

export function EstimateReview({ header, estimateId, customer, costs, calculatedAt }: EstimateReviewProps) {
  const { state, letters, nodes, totals } = costs;
  // The rows of the calculation's quantity warning, which the costs view holds only while the figures are current (STORY-06.10 AC-3, AC-4).
  const warned = warnedNodeIds(state === 'current' ? costs.warning : null);
  // BO from the approvals row, in every state of the figures (AC-9); its time in IST.
  const approval: ApprovedTileView | null =
    costs.approval === null
      ? null
      : {
          price: costs.approval.price,
          approverName: costs.approval.approverName,
          approvedAtLabel: formatIst(new Date(costs.approval.approvedAt)),
          calculatedTotal: costs.approval.calculatedTotal,
          isOverride: costs.approval.isOverride,
          reason: costs.approval.reason,
          unlocked: costs.approval.unlock !== null,
        };
  return (
    <div className="group/review contents">
      <WorkspaceHeader view={header} />
      <Card>
        <CardContent>
          <p className={cn('text-body', BREAK_LONG_NAMES)}>
            <strong>{`${REVIEW_CUSTOMER_LABEL}: `}</strong>
            {customer === null ? REVIEW_NO_CUSTOMER : customer.name}
          </p>
        </CardContent>
      </Card>
      {state === 'none' ? (
        <Notice tone="info" role="status">
          {NOT_CALCULATED_NOTICE}
        </Notice>
      ) : null}
      {state === 'out-of-date' ? (
        <Notice tone="info" role="status" title={CLEARED_NOTICE_TITLE}>
          {CLEARED_NOTICE_BODY}
        </Notice>
      ) : null}
      {header.status === 'APPROVED' ? <ApprovedNotice approval={approval} /> : null}
      <UnlockedNotice state={state} unlock={costs.approval?.unlock ?? null} isDraft={header.status === 'DRAFT'} />
      <WarningNotice state={state} warning={costs.warning} at={calculatedAt} />
      <RatesChangedNotice state={state} ratesChanged={costs.ratesChanged} at={calculatedAt} />
      <FigureTiles state={state} letters={letters} totals={totals} approval={approval} />
      <ReviewTree code={header.code} state={state} letters={letters} nodes={nodes} warned={warned} />
      {state === 'current' ? <BuildTable letters={letters} nodes={nodes} totalPrice={totals === null ? null : totals.totalPrice} warned={warned} /> : null}
      <ReviewActions
        estimateId={estimateId}
        code={header.code}
        state={state}
        status={header.status}
        approve={approveOffer(header.status, costs)}
        ratesChanged={costs.ratesChanged !== null}
        calculated={calculatedAt === null || costs.configurationNumber === null ? null : { at: calculatedAt, configurationNumber: costs.configurationNumber }}
      />
    </div>
  );
}
