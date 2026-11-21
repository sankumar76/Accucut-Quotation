'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import type { CancelDialogProps } from './cancel-dialog';
import { CANCELLED_NOTICE_ID } from './cancel-ids';

/**
 * The Cancel approval button of SCR-06 (STORY-06.12 AC-1; UX spec SCR-06 "Approved (Admin)"): a danger button for the Admin, beside Unlock, on an approval that has not been cancelled. A script as small as it can be (NFR-009,
 * ADR-016: `/estimates/[code]` has a budget, and this page is measured by CI stage 11b). **The dialog is not in the first load**: its code is fetched by a bare `import()` on the first press, through the loader every overlay
 * uses (`useFirstOpen`, architecture section 10), and the type of its props is imported as a type only. A press before the page was interactive is kept (`data-early-intent`).
 *
 * Nothing is decided here. After a good cancel, and after an answer that left the page out of date or was lost, the page is drawn again by the server (`router.refresh()`), so the cancelled state reaches the screen the
 * way it always does. When the button leaves the page with the cancel, focus goes to the notice of the cancelled approval, so it is not lost.
 */

/** Fetched on the first press only (NFR-009). A fetch that fails is shown as the first-open failure line, and the next press tries again. */
const loadDialog = () => import('./cancel-dialog').then((module) => module.CancelDialog);

const FAILURE_ID = 'review-cancel-first-open-failure';

export interface CancelButtonProps {
  readonly id: string;
  readonly label: string;
  /** What the failure line says when the dialog's code did not come. */
  readonly failedLine: string;
  readonly estimateId: string;
  /** The task's code, for the dialog's title. */
  readonly code: string;
  /** The approval shown as BO, which the request names. */
  readonly approvalId: string;
  readonly status: CancelDialogProps['status'];
  readonly engineerName: string;
}

export function CancelButton({ id, label, failedLine, estimateId, code, approvalId, status, engineerName }: CancelButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startRefresh] = useTransition();
  const first = useFirstOpen<CancelDialogProps>({ id, load: loadDialog, onOpen: () => setOpen(true) });
  // Where focus goes when the dialog is gone: the notice of the cancelled approval after a cancel, the button otherwise.
  const focusAfter = useRef<string>(id);

  // The button leaves the page with the page being drawn again (a cancel), taking the dialog and focus with it: hand focus to the place the person is going to.
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
        variant="danger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={first.pending || undefined}
        aria-describedby={first.failed ? FAILURE_ID : undefined}
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
          code={code}
          approvalId={approvalId}
          status={status}
          engineerName={engineerName}
          onCancelled={() => {
            focusAfter.current = CANCELLED_NOTICE_ID;
            setOpen(false);
            refresh();
          }}
          onStale={() => {
            // The page is out of date, or no answer came and the cancel may have gone through: it is drawn again, and if it did the button goes and focus goes to the notice. The dialog stays open with its sentence until then.
            focusAfter.current = CANCELLED_NOTICE_ID;
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
