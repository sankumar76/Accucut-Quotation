import { APPROVED_NOTICE_ID } from '@/components/features/estimate-approve/approve-ids';
import { ChangeCustomerButton } from '@/components/features/estimate-customer/change-customer-button';
import { IgnoredNotice } from '@/components/features/estimate-ignore/ignored-notice';
import { QUOTED_NOTICE_ID } from '@/components/features/estimate-quote/mark-quoted-ids';
import { DownloadChip } from '@/components/shared/download-chip';
import { Notice } from '@/components/shared/notice';
import { warnedNodeIds } from '@/components/shared/quantity-tag';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { rowNameOf } from '@/lib/estimates/row-name';
import { WarningNotice } from '@/components/shared/warning-notice';
import type { RoleName } from '@/lib/auth/roles';
import { canEditInputs } from '@/lib/estimate/can-edit-inputs';
import { treeActionsOffered } from '@/lib/estimates/tree-actions';
import { isLocked, type EstimateStatus } from '@/lib/estimate/state-machine';
import type { DownloadChipData } from '@/lib/export/download-marker-view';
import { formatIst } from '@/lib/time';
import type { CostsView } from '@/server/views/schemas/costs';

import { ReviewEditShell } from '../estimate-review-edit/review-edit-shell';
import { PartHead } from '../estimate-workspace/part-head';
import { PartForm } from '../estimate-workspace/part-form';
import { WorkspaceHeader, type WorkspaceHeaderView } from '../estimate-workspace/workspace-header';

import { BuildTable } from './build-table';
import { CancelledNotice } from './cancelled-notice';
import { FigureTiles, type ApprovedTileView } from './figure-tiles';
import { PriceRemovedNotice } from './price-removed-notice';
import { RatesChangedNotice } from './rates-changed-notice';
import { approveOffer, cancelOffer, ignoreOffer, quoteOffer, removeOffer, ReviewActions } from './review-actions';
import { REVIEW_RESTORE_ID } from './review-ids';
import { ReviewRowLine } from './review-row-line';
import { ReviewTree } from './review-tree';
import { selectedRow } from './selected-row';
import { UnlockedNotice } from './unlocked-notice';
import {
  APPROVED_NOTICE_BODY,
  APPROVED_NOTICE_TITLE_PLAIN,
  approvedNoticeTitle,
  inputsNotice,
  showingInputs,
  CLEARED_NOTICE_BODY,
  CLEARED_NOTICE_TITLE,
  NOT_CALCULATED_NOTICE,
  quotedNoticeBody,
  QUOTED_NOTICE_TITLE_PLAIN,
  quotedNoticeTitle,
  RESTORE_FIRST_OPEN_FAILED,
  RESTORE_LABEL,
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
  /**
   * The Ignored layer over the status (ADR-019; CR-01 item 7D): who set it, when (UTC text) and the remarks, or `null`. An ignored estimate is read-only for everyone: the page draws the notice with **Restore RFQ** and
   * no action bar, no Change customer and no download chip, and the figures and the tree stay for reading. The server refuses every other action all the same.
   */
  readonly ignored: { readonly at: string; readonly byName: string; readonly remarks: string } | null;
  /** The name of the Engineer the task is assigned to, for the Restore dialog (it returns to their Open queue). */
  readonly engineerName: string;
  /** The deadline has passed at the moment the page was drawn, for the Restore dialog's Overdue sentence. */
  readonly deadlinePassed: boolean;
  /** The Sl. No of the row whose inputs are shown, from the address (`?row=`): absent or not in the tree, the first row (AQP-488, DEF-131 Stage 1). */
  readonly row?: string | undefined;
  /** The revision of the selected part as the server reads it now, for a save that a Lead or an Admin makes (DEF-131 stage 2): the form sends it with each change. Absent while the block is read-only. */
  readonly selectedRevision?: number | undefined;
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

/** The status under the Ignored layer, which Restore gives back. A Quoted estimate cannot be ignored (the database refuses it), so Approved, which is closed too, stands for the impossible case and the page still draws. */
const underlyingOf = (status: EstimateStatus): 'DRAFT' | 'PREPARED' | 'APPROVED' => (status === 'QUOTED' ? 'APPROVED' : status);

export function EstimateReview({ header, estimateId, customer, costs, calculatedAt, viewerRole, download, quoted, ignored, engineerName, deadlinePassed, row, selectedRevision }: EstimateReviewProps) {
  const { state, letters, nodes, totals } = costs;
  const selected = selectedRow(nodes, row);
  // The rows as the part form's head knows them: where each sits, its number, its kind and its name, and **no figure** (the tree's rows reach the browser only so).
  const partItems = nodes.map(({ id, parentId, slNo, nodeKind, name }) => ({ id, parentId, slNo, nodeKind, label: name, completeness: 'EMPTY' as const, revision: 0 }));
  const isIgnored = ignored !== null;
  // A Lead or an Admin corrects the inputs of a Draft or a Prepared estimate that is not ignored: the one rule the server asks again under the row lock (`canEditInputs`, DEF-131 stage 2), asked with the viewer's real role.
  const editable = canEditInputs({ status: header.status, ignored: isIgnored }, viewerRole);
  // The parts tree is editable by the same people in the same states, asked of the one rule for the tree's actions (DEF-131 stage 2T, ED-18, ED-19): then the tree and the inputs block are one client island that holds the
  // selected row. Approved, Quoted and ignored estimates keep the read-only tree below, with no toolbar and no "Add main assembly" in the page.
  const editTree = treeActionsOffered({ status: header.status, ignored: isIgnored }, viewerRole);
  // The rows of the calculation's quantity warning, which the costs view holds only while the figures are current (STORY-06.10 AC-3, AC-4).
  const warned = warnedNodeIds(state === 'current' ? costs.warning : null);
  const rowLine = selected === null ? null : <ReviewRowLine code={header.code} node={selected} state={state} letters={letters} warned={warned.has(selected.id)} />;
  // The two columns of the review as the server draws them: the parts tree (read-only, with the mark of an editable one) and the open row's inputs. For an editable estimate the island takes their place once it is up.
  const columns = (
    <>
      <ReviewTree code={header.code} state={state} letters={letters} nodes={nodes} warned={warned} selectedSlNo={selected === null ? null : selected.slNo} edit={editTree} />
      {selected === null ? null : (
        // The Engineer's own form, read-only (never editable here: the editable form is the island's), in the same place as the island's.
        <div id="row-inputs" className="min-w-0 scroll-mt-[var(--sticky-top,var(--topbar-h))]">
          {/* The row's eyebrow, title and figure line are drawn here, on the server, so they are in the first paint whatever the form is doing; the form under them is labelled by the title (UX ruling 3.6, 3.7). */}
          <PartHead partId={selected.id} slNo={selected.slNo} nodes={partItems} titleId="part-form-title" titleRef={null} />
          {rowLine}
          <PartForm
            estimateId={estimateId}
            part={{ id: selected.id, slNo: selected.slNo, revision: selectedRevision ?? 0 }}
            editable={false}
            nodes={partItems}
            review={{
              notice: inputsNotice(header.status, isIgnored, state),
              showing: showingInputs(selected.slNo, rowNameOf(selected.name, nodeKindLabel(selected, nodes)), editable),
              figuresCurrent: state === 'current',
            }}
          />
        </div>
      )}
    </>
  );
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
        view={{ ...header, ignored: isIgnored }}
        noCustomerText={REVIEW_NO_CUSTOMER}
        // While the estimate is ignored there is no download chip and no Change customer: it is read-only until it is restored (CR-01 item 7D, A-CR01-8), and the notice below says so.
        downloadMarker={isIgnored ? null : <DownloadChip marker={download} />}
        // Change customer (CR-01 item 6, AC-12): on an estimate that is not approved and not ignored only; the review is the Lead's and the Admin's, and the server refuses anyone else all the same.
        customerAction={isLocked(header.status) || isIgnored ? null : <ChangeCustomerButton estimateId={estimateId} current={customer} />}
        notice={
          ignored === null ? null : (
            <IgnoredNotice
              ignored={ignored}
              estimateId={estimateId}
              code={header.code}
              restoreButtonId={REVIEW_RESTORE_ID}
              restoreLabel={RESTORE_LABEL}
              restoreFailedLine={RESTORE_FIRST_OPEN_FAILED}
              status={underlyingOf(header.status)}
              engineerName={engineerName}
              deadlineLabel={header.deadlineLabel}
              deadlinePassed={deadlinePassed}
            />
          )
        }
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
      {/* The notice invites a Recalculate, which an ignored estimate cannot have (the action bar is not drawn and the server refuses it), so it is not drawn while the estimate is ignored (CR-01 item 7D). */}
      {isIgnored ? null : <RatesChangedNotice state={state} ratesChanged={costs.ratesChanged} at={calculatedAt} />}
      <FigureTiles state={state} letters={letters} totals={totals} approval={approval} />
      {/* From 1024 px the tree is a column of the SCR-05 tree's width beside "How the total is built" (AQP-465, DEF-108; ux-expert ruling 2026-11-28; the right-hand column holds the row detail of the design, which
          is waived, DL-306); below it the two are stacked. The tiles stay above both at full width. The gap is the page's own (`main`: s-4, s-5 from 768 px), so the rows keep the spacing they had when they were two items of
          the page: a different gap moved the page by a few pixels and with it the axe target-size reading of the header's Change customer button at 768 px. */}
      {/* "How the total is built" is above the two columns at every width (UX ruling 2026-11-27 section 3.8; AQP-488): the tree and the row's inputs are the two columns below it. */}
      {state === 'current' ? <BuildTable letters={letters} nodes={nodes} totalPrice={totals === null ? null : totals.totalPrice} warned={warned} /> : null}
      <div data-review-columns="" className="flex flex-col gap-s-4 md:gap-s-5 min-[1024px]:grid min-[1024px]:grid-cols-[var(--tree-w)_minmax(0,1fr)] min-[1024px]:items-start">
        {editTree ? (
          // A Draft or a Prepared estimate that can be corrected: the read-only columns below are what the first paint shows, and the thin shell swaps the editing island in once its code has arrived (a bare import(), so
          // none of it is in the first load). The first paint says what the island says, with no control, so nothing typed is lost to a form that cannot save.
          <ReviewEditShell
            estimateId={estimateId}
            code={header.code}
            status={header.status}
            state={state}
            letters={letters}
            nodes={nodes}
            warned={[...warned]}
            selectedSlNo={selected === null ? null : selected.slNo}
            selectedRevision={selectedRevision ?? 0}
          >
            {columns}
          </ReviewEditShell>
        ) : (
          columns
        )}
      </div>
      {/* The action bar is not drawn while the estimate is ignored: Restore RFQ, in the notice, is the one action left (CR-01 item 7D). */}
      {isIgnored ? null : (
        <ReviewActions
          estimateId={estimateId}
          code={header.code}
          state={state}
          status={header.status}
          approve={approveOffer(header.status, costs)}
          cancel={cancelOffer(viewerRole, costs.approval)}
          remove={removeOffer(viewerRole, costs.approval)}
          quote={quoteOffer(viewerRole, header.status, isIgnored, customer?.name ?? null, download)}
          ignore={ignoreOffer(viewerRole, header.status, isIgnored)}
          ratesChanged={costs.ratesChanged !== null}
          calculated={calculatedAt === null || costs.configurationNumber === null ? null : { at: calculatedAt, configurationNumber: costs.configurationNumber }}
        />
      )}
    </div>
  );
}
