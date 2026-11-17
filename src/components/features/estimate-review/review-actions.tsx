import { ApproveButton } from '@/components/features/estimate-approve/approve-button';
import { CancelButton } from '@/components/features/estimate-cancel/cancel-button';
import { RecalculateButton } from '@/components/features/estimate-recalculate/recalculate-button';
import { CALCULATED_LINE_ID } from '@/components/features/estimate-recalculate/recalculate-ids';
import { UnlockButton } from '@/components/features/estimate-unlock/unlock-button';
import { Button } from '@/components/ui/button';
import type { RoleName } from '@/lib/auth/roles';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { CostsView } from '@/server/views/schemas/costs';

import { REVIEW_APPROVE_ID, REVIEW_CALCULATE_ID, REVIEW_CANCEL_ID, REVIEW_DOWNLOAD_ID, REVIEW_UNLOCK_ID } from './review-ids';
import {
  ACTIONS_LABEL,
  APPROVE_CLEARED_REASON,
  APPROVE_DRAFT_REASON,
  APPROVE_FIRST_OPEN_FAILED,
  APPROVE_LABEL,
  APPROVE_NOT_CALCULATED_REASON,
  CALCULATE_FAILED,
  CALCULATE_LABEL,
  CANCEL_APPROVAL_LABEL,
  CANCEL_FIRST_OPEN_FAILED,
  calculatedLine,
  CALCULATING_LINE,
  DOWNLOAD_LABEL,
  DOWNLOAD_NOT_CALCULATED_REASON,
  DOWNLOAD_NOT_YET_REASON,
  ONLY_ADMIN_CANCELS,
  RECALCULATE_LABEL,
  UNLOCK_FIRST_OPEN_FAILED,
  UNLOCK_LABEL,
} from './review-texts';

/**
 * The action bar of SCR-06 (STORY-06.02 AC-6, STORY-06.04 AC-3, AC-5, STORY-06.06 AC-1, AC-5; UX spec SCR-06 "States"): the line "Calculated <time> · configuration version <n>" (FR-031), the primary **Calculate**
 * (for an estimate that was never calculated) or **Recalculate** (while the figures are cleared, and **on a Draft whatever the state of the figures**, STORY-06.08 AC-11), which works from STORY-06.04, **Approve and lock**, and Download .xlsx.
 *
 * **Approve and lock** is on only while the guard of STORY-06.05 would let the press through (the estimate is SUBMITTED, its figures are `current` and the page holds the calculation they come from): it is then the
 * button of the one small script `ApproveButton`, which opens the dialog of SCR-08 (fetched on the first press, not in the first load). In every other state it is **off with a reason**: each disabled button names its
 * reason in visible text and is described by it (`aria-describedby`), so a screen reader hears why. The server decides all the same; the button is a convenience. For an **approved** estimate Approve and lock is gone and
 * **Unlock** takes its place (STORY-06.06 AC-5), which opens the dialog of SCR-09 (STORY-06.08; fetched on the first press, not in the first load). The Excel file is STORY-07.03's, so Download is off here and says so. In flow, not sticky.
 */

const APPROVE_REASON_ID = 'review-approve-reason';
const DOWNLOAD_REASON_ID = 'review-download-reason';
const CANCEL_REASON_ID = 'review-cancel-reason';

/** What the Approve button needs to open its dialog, or `null` while approving cannot be offered. All of it comes from the server's costs view of this one render. */
export interface ApproveOffer {
  readonly calculationId: string;
  readonly calculatedTotal: string;
  readonly approvedLetter: string;
  /** The rows of the calculation's quantity warning, for the one line of the approval dialog (STORY-06.10 AC-5); empty when it has none. Approving is not stopped either way. */
  readonly warningRows: ReadonlyArray<{ readonly slNo: string; readonly label: string }>;
}

/**
 * What the action bar offers of Cancel approval (STORY-06.12 AC-1, AC-10), or `null` while there is no approval to cancel (never approved, or already cancelled). The Admin gets the button, with the approval it names; a Lead
 * gets none, and the line that says who can.
 */
export type CancelOffer = { readonly kind: 'admin'; readonly approvalId: string; readonly engineerName: string } | { readonly kind: 'lead' };

export interface ReviewActionsProps {
  /** The estimate's ID, for the request of Calculate or Recalculate and of the approval and the unlock. */
  readonly estimateId: string;
  /** The task's code, the title of the unlock dialog ("Unlock Q-2026-0318"). */
  readonly code: string;
  readonly state: CostsView['state'];
  readonly status: EstimateStatus;
  /** The time of the calculation written in IST, and the configuration version it used; `null` while there is no calculation. */
  readonly calculated: { readonly at: string; readonly configurationNumber: number } | null;
  /** Present only for a SUBMITTED estimate whose figures are current (see `approveOffer`): the Approve button is then on. */
  readonly approve: ApproveOffer | null;
  /** The Cancel approval button for the Admin, or the line for a Lead, while the latest approval has not been cancelled (see `cancelOffer`). */
  readonly cancel: CancelOffer | null;
}

interface ReasonProps {
  readonly id: string;
  readonly text: string;
}

const Reason = ({ id, text }: ReasonProps) => (
  <p id={id} className="text-label text-ink-2">
    {text}
  </p>
);

/**
 * Whether Approve and lock is on, and with what: a SUBMITTED estimate whose figures are `current`, with the calculation they come from and its total. This is the button's own convenience and mirrors the
 * server's guard (`assertApprovable`), which stays the authority: a button that is on for an estimate the server would refuse only earns the refusal's sentence.
 */
export function approveOffer(status: EstimateStatus, costs: Pick<CostsView, 'state' | 'calculationId' | 'totals' | 'letters' | 'warning'>): ApproveOffer | null {
  const total = costs.totals?.totalPrice ?? null;
  if (status !== 'SUBMITTED' || costs.state !== 'current' || costs.calculationId === null || total === null) return null;
  return { calculationId: costs.calculationId, calculatedTotal: total, approvedLetter: costs.letters.approvedPrice, warningRows: costs.warning?.rows ?? [] };
}

/**
 * Whether Cancel approval is offered, and to whom (STORY-06.12 AC-1, AC-10): the latest approval has not been cancelled, whatever the status of the estimate (an approval kept through an unlock is the latest one too). Only the
 * Admin gets the button (the server decides all the same); a Lead is told who can. An Engineer never reaches this page.
 */
export function cancelOffer(role: RoleName, approval: NonNullable<CostsView['approval']> | null): CancelOffer | null {
  if (approval === null || approval.cancel !== null) return null;
  return role === 'ADMIN' ? { kind: 'admin', approvalId: approval.id, engineerName: approval.engineerName } : { kind: 'lead' };
}

/**
 * Why Approve and lock is off, by what the Lead can do about it (UX spec v0.31 SCR-06): never calculated, the figures cleared, or a Draft whose figures are current (an unlocked estimate: the way on is Recalculate).
 * Any other state with the button off is a page the server could not offer a total on; the way on is the same, so it says the same as the cleared state.
 */
function approveReason(state: CostsView['state'], status: EstimateStatus): string {
  if (state === 'none') return APPROVE_NOT_CALCULATED_REASON;
  if (state === 'current' && status === 'DRAFT') return APPROVE_DRAFT_REASON;
  return APPROVE_CLEARED_REASON;
}

function ApproveControl({ estimateId, state, status, approve }: Pick<ReviewActionsProps, 'estimateId' | 'state' | 'status' | 'approve'>) {
  if (approve !== null) {
    return (
      <ApproveButton
        id={REVIEW_APPROVE_ID}
        label={APPROVE_LABEL}
        failedLine={APPROVE_FIRST_OPEN_FAILED}
        estimateId={estimateId}
        calculationId={approve.calculationId}
        calculatedTotal={approve.calculatedTotal}
        approvedLetter={approve.approvedLetter}
        warningRows={approve.warningRows}
      />
    );
  }
  const reason = approveReason(state, status);
  return (
    <>
      <Button id={REVIEW_APPROVE_ID} variant="secondary" disabled aria-describedby={APPROVE_REASON_ID} className="w-full md:w-auto">
        {APPROVE_LABEL}
      </Button>
      <Reason id={APPROVE_REASON_ID} text={reason} />
    </>
  );
}

export function ReviewActions({ estimateId, code, state, status, calculated, approve, cancel }: ReviewActionsProps) {
  // Recalculate is the way on whenever the figures are not current, and **on a Draft whatever the state of the figures**: an unlocked estimate keeps its current figures, and it can be calculated again, submitted
  // and approved without anyone editing an input (AC-11). A Submitted estimate with current figures shows no button: its way on is Approve and lock.
  const showRecalculate = state !== 'current' || status === 'DRAFT';
  const downloadReason = state === 'current' ? DOWNLOAD_NOT_YET_REASON : DOWNLOAD_NOT_CALCULATED_REASON;
  return (
    <div role="group" aria-label={ACTIONS_LABEL} className="flex flex-col gap-s-3 rounded-md border border-border bg-surface px-s-4 py-s-3">
      {calculated === null ? null : (
        <p id={CALCULATED_LINE_ID} tabIndex={-1} className="text-label text-ink-2">
          {calculatedLine(calculated.at, calculated.configurationNumber)}
        </p>
      )}
      <div className="flex flex-col gap-s-3 md:flex-row md:flex-wrap md:items-start">
        {showRecalculate ? (
          <div className="flex flex-col gap-s-1">
            <RecalculateButton
              id={REVIEW_CALCULATE_ID}
              estimateId={estimateId}
              label={state === 'none' ? CALCULATE_LABEL : RECALCULATE_LABEL}
              busyLine={CALCULATING_LINE}
              failedLine={CALCULATE_FAILED}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-s-1">
          <Button id={REVIEW_DOWNLOAD_ID} variant="secondary" disabled aria-describedby={DOWNLOAD_REASON_ID} className="w-full md:w-auto">
            {DOWNLOAD_LABEL}
          </Button>
          <Reason id={DOWNLOAD_REASON_ID} text={downloadReason} />
        </div>
        <div className="flex flex-col gap-s-1">
          {status === 'APPROVED' ? (
            <UnlockButton id={REVIEW_UNLOCK_ID} label={UNLOCK_LABEL} failedLine={UNLOCK_FIRST_OPEN_FAILED} estimateId={estimateId} code={code} />
          ) : (
            <ApproveControl estimateId={estimateId} state={state} status={status} approve={approve} />
          )}
        </div>
        {cancel === null ? null : cancel.kind === 'admin' ? (
          <div className="flex flex-col gap-s-1">
            <CancelButton
              id={REVIEW_CANCEL_ID}
              label={CANCEL_APPROVAL_LABEL}
              failedLine={CANCEL_FIRST_OPEN_FAILED}
              estimateId={estimateId}
              code={code}
              approvalId={cancel.approvalId}
              status={status}
              engineerName={cancel.engineerName}
            />
          </div>
        ) : status === 'APPROVED' ? null : (
          // An approved estimate says it in its notice ("Locked. ... Only the Admin can cancel an approval."); a Draft or Submitted one whose approval was kept through an unlock says it here.
          <Reason id={CANCEL_REASON_ID} text={ONLY_ADMIN_CANCELS} />
        )}
      </div>
    </div>
  );
}
