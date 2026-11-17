import { ApproveButton } from '@/components/features/estimate-approve/approve-button';
import { RecalculateButton } from '@/components/features/estimate-recalculate/recalculate-button';
import { CALCULATED_LINE_ID } from '@/components/features/estimate-recalculate/recalculate-ids';
import { Button } from '@/components/ui/button';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { CostsView } from '@/server/views/schemas/costs';

import { REVIEW_APPROVE_ID, REVIEW_CALCULATE_ID, REVIEW_DOWNLOAD_ID, REVIEW_UNLOCK_ID } from './review-ids';
import {
  ACTIONS_LABEL,
  APPROVE_CLEARED_REASON,
  APPROVE_FIRST_OPEN_FAILED,
  APPROVE_LABEL,
  APPROVE_NOT_CALCULATED_REASON,
  APPROVE_NOT_YET_REASON,
  CALCULATE_FAILED,
  CALCULATE_LABEL,
  calculatedLine,
  CALCULATING_LINE,
  DOWNLOAD_LABEL,
  DOWNLOAD_NOT_CALCULATED_REASON,
  DOWNLOAD_NOT_YET_REASON,
  RECALCULATE_LABEL,
  UNLOCK_LABEL,
  UNLOCK_NOT_YET_REASON,
} from './review-texts';

/**
 * The action bar of SCR-06 (STORY-06.02 AC-6, STORY-06.04 AC-3, AC-5, STORY-06.06 AC-1, AC-5; UX spec SCR-06 "States"): the line "Calculated <time> · configuration version <n>" (FR-031), the primary **Calculate**
 * (for an estimate that was never calculated) or **Recalculate** (while the figures are cleared), which works from STORY-06.04, **Approve and lock**, and Download .xlsx.
 *
 * **Approve and lock** is on only while the guard of STORY-06.05 would let the press through (the estimate is SUBMITTED, its figures are `current` and the page holds the calculation they come from): it is then the
 * button of the one small script `ApproveButton`, which opens the dialog of SCR-08 (fetched on the first press, not in the first load). In every other state it is **off with a reason**: each disabled button names its
 * reason in visible text and is described by it (`aria-describedby`), so a screen reader hears why. The server decides all the same; the button is a convenience. For an **approved** estimate Approve and lock is gone and
 * **Unlock** takes its place (AC-5); what Unlock does is STORY-06.08's, so it is off with a reason until then. The Excel file is STORY-07.03's, so Download is off here and says so. In flow, not sticky.
 */

const APPROVE_REASON_ID = 'review-approve-reason';
const UNLOCK_REASON_ID = 'review-unlock-reason';
const DOWNLOAD_REASON_ID = 'review-download-reason';

/** What the Approve button needs to open its dialog, or `null` while approving cannot be offered. All of it comes from the server's costs view of this one render. */
export interface ApproveOffer {
  readonly calculationId: string;
  readonly calculatedTotal: string;
  readonly approvedLetter: string;
  /** The rows of the calculation's quantity warning, for the one line of the approval dialog (STORY-06.10 AC-5); empty when it has none. Approving is not stopped either way. */
  readonly warningRows: ReadonlyArray<{ readonly slNo: string; readonly label: string }>;
}

export interface ReviewActionsProps {
  /** The estimate's ID, for the request of Calculate or Recalculate and of the approval. */
  readonly estimateId: string;
  readonly state: CostsView['state'];
  readonly status: EstimateStatus;
  /** The time of the calculation written in IST, and the configuration version it used; `null` while there is no calculation. */
  readonly calculated: { readonly at: string; readonly configurationNumber: number } | null;
  /** Present only for a SUBMITTED estimate whose figures are current (see `approveOffer`): the Approve button is then on. */
  readonly approve: ApproveOffer | null;
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

function ApproveControl({ estimateId, state, approve }: Pick<ReviewActionsProps, 'estimateId' | 'state' | 'approve'>) {
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
  const reason = state === 'none' ? APPROVE_NOT_CALCULATED_REASON : state === 'out-of-date' ? APPROVE_CLEARED_REASON : APPROVE_NOT_YET_REASON;
  return (
    <>
      <Button id={REVIEW_APPROVE_ID} variant="secondary" disabled aria-describedby={APPROVE_REASON_ID} className="w-full md:w-auto">
        {APPROVE_LABEL}
      </Button>
      <Reason id={APPROVE_REASON_ID} text={reason} />
    </>
  );
}

export function ReviewActions({ estimateId, state, status, calculated, approve }: ReviewActionsProps) {
  const downloadReason = state === 'current' ? DOWNLOAD_NOT_YET_REASON : DOWNLOAD_NOT_CALCULATED_REASON;
  return (
    <div role="group" aria-label={ACTIONS_LABEL} className="flex flex-col gap-s-3 rounded-md border border-border bg-surface px-s-4 py-s-3">
      {calculated === null ? null : (
        <p id={CALCULATED_LINE_ID} tabIndex={-1} className="text-label text-ink-2">
          {calculatedLine(calculated.at, calculated.configurationNumber)}
        </p>
      )}
      <div className="flex flex-col gap-s-3 md:flex-row md:flex-wrap md:items-start">
        {state === 'current' ? null : (
          <div className="flex flex-col gap-s-1">
            <RecalculateButton
              id={REVIEW_CALCULATE_ID}
              estimateId={estimateId}
              label={state === 'none' ? CALCULATE_LABEL : RECALCULATE_LABEL}
              busyLine={CALCULATING_LINE}
              failedLine={CALCULATE_FAILED}
            />
          </div>
        )}
        <div className="flex flex-col gap-s-1">
          <Button id={REVIEW_DOWNLOAD_ID} variant="secondary" disabled aria-describedby={DOWNLOAD_REASON_ID} className="w-full md:w-auto">
            {DOWNLOAD_LABEL}
          </Button>
          <Reason id={DOWNLOAD_REASON_ID} text={downloadReason} />
        </div>
        <div className="flex flex-col gap-s-1">
          {status === 'APPROVED' ? (
            <>
              <Button id={REVIEW_UNLOCK_ID} variant="secondary" disabled aria-describedby={UNLOCK_REASON_ID} className="w-full md:w-auto">
                {UNLOCK_LABEL}
              </Button>
              <Reason id={UNLOCK_REASON_ID} text={UNLOCK_NOT_YET_REASON} />
            </>
          ) : (
            <ApproveControl estimateId={estimateId} state={state} approve={approve} />
          )}
        </div>
      </div>
    </div>
  );
}
