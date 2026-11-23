import { APPROVED_NOTICE_ID } from '@/components/features/estimate-approve/approve-ids';
import { ChangeCustomerButton } from '@/components/features/estimate-customer/change-customer-button';
import { QUOTED_NOTICE_ID } from '@/components/features/estimate-quote/mark-quoted-ids';
import { DownloadChip } from '@/components/shared/download-chip';
import { Notice } from '@/components/shared/notice';
import { warnedNodeIds } from '@/components/shared/quantity-tag';
import { WarningNotice } from '@/components/shared/warning-notice';
import type { RoleName } from '@/lib/auth/roles';
import { isLocked } from '@/lib/estimate/state-machine';
import type { DownloadChipData } from '@/lib/export/download-marker-view';
import { formatIst } from '@/lib/time';
import type { CostsView } from '@/server/views/schemas/costs';

import { WorkspaceHeader, type WorkspaceHeaderView } from '../estimate-workspace/workspace-header';

import { BuildTable } from './build-table';
import { CancelledNotice } from './cancelled-notice';
import { FigureTiles, type ApprovedTileView } from './figure-tiles';
import { PriceRemovedNotice } from './price-removed-notice';
import { RatesChangedNotice } from './rates-changed-notice';
import { approveOffer, cancelOffer, quoteOffer, removeOffer, ReviewActions } from './review-actions';
import { ReviewTree } from './review-tree';
import { UnlockedNotice } from './unlocked-notice';
import {
  APPROVED_NOTICE_BODY,
  APPROVED_NOTICE_TITLE_PLAIN,
  approvedNoticeTitle,
  CLEARED_NOTICE_BODY,
  CLEARED_NOTICE_TITLE,
  NOT_CALCULATED_NOTICE,
  quotedNoticeBody,
  QUOTED_NOTICE_TITLE_PLAIN,
  quotedNoticeTitle,
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
  /** The estimate's customer with its short name (CR-01 item 6), or null for one made before that. */
  readonly customer: { readonly id: string; readonly name: string; readonly shortName: string } | null;
  readonly costs: CostsView;
  /** The time of the calculation written in IST (`formatIst`), or `null` while there is no calculation. */
  readonly calculatedAt: string | null;
  /** Who is looking: the Admin alone has the Cancel approval button (STORY-06.12 AC-1). A Lead sees the state and the line that says who can. */
  readonly viewerRole: RoleName;
  /** The marker of the estimate's Excel downloads (STORY-CR01.7E AC-5), in the header beside the status: the review is the Lead's and the Admin's, so it is never drawn for an Engineer. */
  readonly download: DownloadChipData | 'unavailable';
  /** Who marked the estimate as quoted and when (CR-01 item 7C), as the server read it: for the Quoted notice. `null` while the estimate is not QUOTED. The review is the Lead's and the Admin's, so this is never drawn for an Engineer. */
  readonly quoted: { readonly at: string; readonly byName: string } | null;
  /** Whether the Ignored layer is set over the status (ADR-019): an ignored estimate is not offered Mark as quoted (the server refuses it all the same). */
  readonly ignored: boolean;
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

/**
 * The Quoted notice of SCR-06 (CR-01 item 7C; UX spec SCR-06 "Quoted"): who marked the estimate and when (IST), to whom the quote was sent, and that this is the last status. It takes the place of the Approved notice
 * and holds focus when a mark has just worked (`tabIndex` -1), so focus is not lost with the button that was pressed.
 */
function QuotedNotice({ quoted, customerName }: { readonly quoted: EstimateReviewProps['quoted']; readonly customerName: string | null }) {
  return (
    <div id={QUOTED_NOTICE_ID} tabIndex={-1} className="rounded-md">
      <Notice tone="success" role="status" title={quoted === null ? QUOTED_NOTICE_TITLE_PLAIN : quotedNoticeTitle(formatIst(new Date(quoted.at)), quoted.byName)}>
        {quotedNoticeBody(customerName)}
      </Notice>
    </div>
  );
}

export function EstimateReview({ header, estimateId, customer, costs, calculatedAt, viewerRole, download, quoted, ignored }: EstimateReviewProps) {
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
          cancelled: costs.approval.cancel !== null,
        };
  return (
    <div className="is-compact group/review contents">
      <WorkspaceHeader
        view={header}
        noCustomerText={REVIEW_NO_CUSTOMER}
        downloadMarker={<DownloadChip marker={download} />}
        // Change customer (CR-01 item 6, AC-12): on an estimate that is not approved only; the review is the Lead's and the Admin's, and the server refuses anyone else all the same.
        customerAction={isLocked(header.status) ? null : <ChangeCustomerButton estimateId={estimateId} current={customer} />}
      />
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
      {header.status === 'QUOTED' ? <QuotedNotice quoted={quoted} customerName={customer?.name ?? null} /> : null}
      {/* A locked estimate says why: the Approved notice, or the Quoted one once the quote has gone (the last status; the figures stay locked as approved). */}
      {isLocked(header.status) && header.status !== 'QUOTED' ? <ApprovedNotice approval={approval} /> : null}
      <UnlockedNotice state={state} unlock={costs.approval === null || costs.approval.cancel !== null ? null : costs.approval.unlock} isDraft={header.status === 'DRAFT'} />
      <CancelledNotice cancel={costs.approval?.cancel ?? null} wasUnlocked={costs.approval !== null && costs.approval.unlock !== null} status={header.status} viewedByAdmin={viewerRole === 'ADMIN'} />
      <PriceRemovedNotice removed={costs.priceRemoved} />
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
        cancel={cancelOffer(viewerRole, costs.approval)}
        remove={removeOffer(viewerRole, costs.approval)}
        quote={quoteOffer(viewerRole, header.status, ignored, customer?.name ?? null, download)}
        ratesChanged={costs.ratesChanged !== null}
        calculated={calculatedAt === null || costs.configurationNumber === null ? null : { at: calculatedAt, configurationNumber: costs.configurationNumber }}
      />
    </div>
  );
}
