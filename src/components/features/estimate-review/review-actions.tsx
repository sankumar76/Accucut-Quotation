import { RecalculateButton } from '@/components/features/estimate-recalculate/recalculate-button';
import { CALCULATED_LINE_ID } from '@/components/features/estimate-recalculate/recalculate-ids';
import { Button } from '@/components/ui/button';
import type { CostsView } from '@/server/views/schemas/costs';

import {
  ACTIONS_LABEL,
  APPROVE_CLEARED_REASON,
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
} from './review-texts';

/**
 * The action bar of SCR-06 (STORY-06.02 AC-6, STORY-06.04 AC-3, AC-5; UX spec SCR-06 "States"): the line "Calculated <time> · configuration version <n>" (FR-031), the primary **Calculate** (for an estimate that was
 * never calculated) or **Recalculate** (while the figures are cleared), which works from STORY-06.04 and is the one control that is a script (`RecalculateButton`, which loads its request code on the first press),
 * and Approve and lock and Download .xlsx, which are **off with a reason**: each disabled button names its reason in visible text and is described by it (`aria-describedby`), so a screen reader hears why.
 * Approving is STORY-06.06's and the file is STORY-07.03's, so each is off here and says so. In flow, not sticky.
 */

export const REVIEW_CALCULATE_ID = 'review-calculate';
export const REVIEW_APPROVE_ID = 'review-approve';
export const REVIEW_DOWNLOAD_ID = 'review-download';
const APPROVE_REASON_ID = 'review-approve-reason';
const DOWNLOAD_REASON_ID = 'review-download-reason';

export interface ReviewActionsProps {
  /** The estimate's ID, for the request of Calculate or Recalculate. */
  readonly estimateId: string;
  readonly state: CostsView['state'];
  /** The time of the calculation written in IST, and the configuration version it used; `null` while there is no calculation. */
  readonly calculated: { readonly at: string; readonly configurationNumber: number } | null;
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

export function ReviewActions({ estimateId, state, calculated }: ReviewActionsProps) {
  const approveReason = state === 'none' ? APPROVE_NOT_CALCULATED_REASON : state === 'out-of-date' ? APPROVE_CLEARED_REASON : APPROVE_NOT_YET_REASON;
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
          <Button id={REVIEW_APPROVE_ID} variant="secondary" disabled aria-describedby={APPROVE_REASON_ID} className="w-full md:w-auto">
            {APPROVE_LABEL}
          </Button>
          <Reason id={APPROVE_REASON_ID} text={approveReason} />
        </div>
      </div>
    </div>
  );
}
