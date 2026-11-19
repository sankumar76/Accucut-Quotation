import { CANCELLED_NOTICE_ID } from '@/components/features/estimate-cancel/cancel-ids';
import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import { cn } from '@/lib/cn';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import { formatIst } from '@/lib/time';
import type { CostsView } from '@/server/views/schemas/costs';

import { CANCELLED_ONLY_ADMIN_REMOVES, CANCELLED_PRICE_STAYS, cancelledNoticeTitle, cancelledReasonLine, cancelledStatusLine } from './review-texts';

/**
 * The notice of a cancelled approval (STORY-06.12 AC-6; UX spec SCR-06 states "Approval cancelled (Admin)", "Approval cancelled (Lead)" and "Cancel approval on a Draft or Submitted estimate"): who cancelled and when (IST),
 * the reason the Admin gave, what became of the estimate (a sentence that is true **now**, see `cancelledStatusLine`), that the price stays on screen marked "Approval cancelled" and leaves the Excel file, and, for a Lead,
 * that only the Admin can remove it. It is drawn from the approval's own cancel, which the costs view carries whatever the state of the figures. It holds focus when a cancel has just worked (`tabIndex` -1). A Server
 * Component with no script. The reason is typed text, drawn as text: its line breaks are kept and a long word wraps.
 */

export interface CancelledNoticeProps {
  /** `null` while the approval stands (or there is none): nothing is drawn. */
  readonly cancel: NonNullable<CostsView['approval']>['cancel'];
  /** Whether the approval was unlocked before it was cancelled: then the cancel did not move the estimate (STORY-06.12 AC-10). */
  readonly wasUnlocked: boolean;
  readonly status: EstimateStatus;
  /** The Admin has the Remove price button (STORY-06.13, beside the BO tile); a Lead is told only the Admin can remove it. */
  readonly viewedByAdmin: boolean;
}

export function CancelledNotice({ cancel, wasUnlocked, status, viewedByAdmin }: CancelledNoticeProps) {
  if (cancel === null) return null;
  const statusLine = cancelledStatusLine(status, wasUnlocked, cancel.engineerName);
  return (
    <div id={CANCELLED_NOTICE_ID} tabIndex={-1} className="rounded-md">
      <Notice tone="info" role="status" title={cancelledNoticeTitle(formatIst(new Date(cancel.at)), cancel.byName)}>
        {cancel.reason === null ? null : <p className={cn('whitespace-pre-line', BREAK_LONG_NAMES)}>{cancelledReasonLine(cancel.reason)}</p>}
        {statusLine === null ? null : <p>{statusLine}</p>}
        <p>{CANCELLED_PRICE_STAYS}</p>
        {viewedByAdmin ? null : <p>{CANCELLED_ONLY_ADMIN_REMOVES}</p>}
      </Notice>
    </div>
  );
}
