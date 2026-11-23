'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';
import type { DownloadChipData } from '@/lib/export/download-marker-view';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import type { MarkQuotedDialogProps } from './mark-quoted-dialog';
import { QUOTED_NOTICE_ID } from './mark-quoted-ids';

/**
 * The Mark as quoted button of an approved estimate on SCR-06 (CR-01 item 7C, AQP-400; AC-1, AC-4; UX spec SCR-06): a script as small as it can be (NFR-009, ADR-016: `/estimates/[code]` has a budget, and this page is
 * measured by CI stage 11b). **The dialog is not in the first load**: its code is fetched by a bare `import()` on the first press, through the loader every overlay uses (`useFirstOpen`, architecture section 10), and the type
 * of its props is imported as a type only. A press before the page was interactive is kept (`data-early-intent`). The review draws this button only for a Lead or an Admin on an APPROVED estimate that is not ignored
 * (`quoteOffer`); the server decides all the same.
 *
 * Nothing is decided here. After a good mark, a second press (which is done) and an answer that left the page out of date or was lost, the page is drawn again by the server (`router.refresh()`), so the Quoted state
 * reaches the screen the way it always does. When the button leaves the page with the mark, focus goes to the Quoted notice, so it is not lost.
 */

/** Fetched on the first press only (NFR-009). A fetch that fails is shown as the first-open failure line, and the next press tries again. */
const loadDialog = () => import('./mark-quoted-dialog').then((module) => module.MarkQuotedDialog);

const FAILURE_ID = 'review-mark-quoted-first-open-failure';

export interface MarkQuotedButtonProps {
  readonly id: string;
  readonly label: string;
  /** What the failure line says when the dialog's code did not come. */
  readonly failedLine: string;
  readonly estimateId: string;
  /** The task's code, for the dialog's title. */
  readonly code: string;
  /** The customer's name for the dialog's sentence, or `null` for an estimate that has none. */
  readonly customerName: string | null;
  /** The download marker the page drew, for the chip in the dialog. */
  readonly download: DownloadChipData | 'unavailable';
}

export function MarkQuotedButton({ id, label, failedLine, estimateId, code, customerName, download }: MarkQuotedButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startRefresh] = useTransition();
  const first = useFirstOpen<MarkQuotedDialogProps>({ id, load: loadDialog, onOpen: () => setOpen(true) });
  // Where focus goes when the dialog is gone: the Quoted notice after a mark, the button otherwise.
  const focusAfter = useRef<string>(id);

  // The button leaves the page with the page being drawn again (a mark), taking the dialog and focus with it: hand focus to the place the person is going to.
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
          customerName={customerName}
          download={download}
          onMarked={() => {
            focusAfter.current = QUOTED_NOTICE_ID;
            setOpen(false);
            refresh();
          }}
          onStale={() => {
            // The page is out of date, or no answer came and the mark may have gone through: it is drawn again, and if it did the button goes and focus goes to the notice. The dialog stays open with its sentence until then.
            focusAfter.current = QUOTED_NOTICE_ID;
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
