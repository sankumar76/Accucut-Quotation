'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { CALCULATED_LINE_ID } from '@/components/features/estimate-recalculate/recalculate-ids';
import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import type { ApproveDialogProps } from './approve-dialog';
import { APPROVED_NOTICE_ID } from './approve-ids';

/**
 * The enabled Approve and lock button of SCR-06 (STORY-06.06 AC-1; UX spec SCR-06 and SCR-08): the second and last script the review draws, and as small as it can be (NFR-009, ADR-016: `/estimates/[code]` has
 * a budget, and this page is measured by CI stage 11b). It is drawn only while the server shows the figures `current` on a prepared estimate, so it is the convenience the guard of STORY-06.05 allows; the
 * server still decides. **The dialog is not in the first load**: its code is fetched by a bare `import()` on the first press, through the loader every overlay uses (`useFirstOpen`, architecture section 10),
 * and the type of its props is imported as a type only. A press before the page was interactive is kept (`data-early-intent`).
 *
 * Nothing calculated is decided here. The one figure it carries is the calculated total the dialog's field starts as, which the Lead's page shows on its first tile anyway. After a good approval, and after an
 * answer that was lost, the page is drawn again by the server (`router.refresh()`), so the approved price and the locked state reach the screen the way they always do. When the button leaves the page with
 * the approval, focus goes to the notice of the approved estimate, so it is not lost.
 */

/** Fetched on the first press only (NFR-009). A fetch that fails is shown as the first-open failure line, and the next press tries again. */
const loadDialog = () => import('./approve-dialog').then((module) => module.ApproveDialog);

const FAILURE_ID = 'review-approve-first-open-failure';

export interface ApproveButtonProps {
  readonly id: string;
  readonly label: string;
  /** What the failure line says when the dialog's code did not come. */
  readonly failedLine: string;
  readonly estimateId: string;
  /** The calculation the page shows (the server approves only while it is the current one). */
  readonly calculationId: string;
  /** The calculated total (BL), the field's starting value. */
  readonly calculatedTotal: string;
  /** The Excel letter of BO, drawn beside the field's label. */
  readonly approvedLetter: string;
  /** The rows of the calculation's quantity warning, for the dialog's one line (STORY-06.10 AC-5); empty when there is none. */
  readonly warningRows: ApproveDialogProps['warningRows'];
  /** The one line about rates that changed since the calculation (STORY-06.11 AC-2); `null` when none. */
  readonly ratesLine: ApproveDialogProps['ratesLine'];
  /** Aria description: the id of the line that explains the button, when there is one. */
  readonly describedBy?: string;
}

export function ApproveButton({ id, label, failedLine, estimateId, calculationId, calculatedTotal, approvedLetter, warningRows, ratesLine, describedBy }: ApproveButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startRefresh] = useTransition();
  const first = useFirstOpen<ApproveDialogProps>({ id, load: loadDialog, onOpen: () => setOpen(true) });
  // Where focus goes when the dialog is gone: the notice of the approved estimate after an approval, the "Calculated ..." line after "Show the new figures", the button otherwise.
  const focusAfter = useRef<string>(id);

  // The button can leave the page with the page being drawn again (an approval, or figures now cleared), taking the dialog and focus with it: hand focus to the place the person is going to.
  useEffect(
    () => () => {
      if (focusAfter.current !== id) document.getElementById(focusAfter.current)?.focus();
    },
    [id],
  );

  const refresh = (): void => startRefresh(() => router.refresh());
  const Dialog = first.Overlay;
  return (
    <div className="relative flex flex-col gap-s-1">
      <Button
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={first.pending || undefined}
        aria-describedby={first.failed ? FAILURE_ID : describedBy}
        {...{ [EARLY_INTENT_ATTRIBUTE]: id }}
        onClick={(event) => first.activate(event.detail === 0)}
        className="w-full md:w-auto"
      >
        {label}
      </Button>
      {first.failed ? <FirstOpenFailure id={FAILURE_ID} message={failedLine} align="left" /> : null}
      {Dialog === null ? null : (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          estimateId={estimateId}
          calculationId={calculationId}
          calculatedTotal={calculatedTotal}
          approvedLetter={approvedLetter}
          warningRows={warningRows}
          ratesLine={ratesLine}
          onApproved={() => {
            focusAfter.current = APPROVED_NOTICE_ID;
            setOpen(false);
            refresh();
          }}
          onShowFigures={() => {
            // The "Calculated ..." line is the target a good Recalculate already uses (STORY-06.04); once the page has been drawn again it holds the new time.
            focusAfter.current = CALCULATED_LINE_ID;
            setOpen(false);
            refresh();
          }}
          onUnconfirmed={() => {
            // The approval may have gone through: the page is drawn again, and if it did the button goes and focus goes to the notice. The dialog stays open with its sentence until then.
            focusAfter.current = APPROVED_NOTICE_ID;
            refresh();
          }}
          onCloseAutoFocus={(event) => {
            // Radix has no trigger to return focus to, so it is placed here: where the person is going, or back on the button.
            event.preventDefault();
            (document.getElementById(focusAfter.current) ?? document.getElementById(id))?.focus();
          }}
        />
      )}
    </div>
  );
}
