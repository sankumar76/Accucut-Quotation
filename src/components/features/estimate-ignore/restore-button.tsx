'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { Button } from '@/components/ui/button';
import { EARLY_INTENT_ATTRIBUTE } from '@/lib/ui/early-intent';

import { ACTIONS_BAR_ID, IGNORED_NOTICE_ID } from './ignore-ids';
import type { RestoreDialogProps } from './restore-dialog';

/**
 * The Restore RFQ button in the Ignored notice of SCR-06 (CR-01 item 7D, AQP-401 AC-8; UX 12944 section 2): a script as small as it can be (NFR-009, ADR-016: `/estimates/[code]` has a budget, and this page is measured
 * by CI stage 11b). **One press of it restores nothing**: it opens the dialog, which is fetched by a bare `import()` on the first press, through the loader every overlay uses (`useFirstOpen`, architecture section 10),
 * and the type of its props is imported as a type only, so the dialog is not in the first load. A press before the page was interactive is kept (`data-early-intent`). The button is in the notice, and the notice
 * is drawn only while the estimate is ignored; the server decides all the same.
 *
 * Nothing is decided here. After a good Restore, a second press (which is done) and an answer that left the page out of date or was lost, the page is drawn again by the server (`router.refresh()`). The button leaves
 * the page with the notice, so focus goes to the page's heading, `h1`, and the polite status is said by the dialog (`announce`); a refusal that left the page out of date sends focus to the action bar or, where there is
 * none, to the notice.
 */

/** Fetched on the first press only (NFR-009). A fetch that fails is shown as the first-open failure line, and the next press tries again. */
const loadDialog = () => import('./restore-dialog').then((module) => module.RestoreDialog);

const FAILURE_ID = 'review-restore-first-open-failure';

export interface RestoreButtonProps {
  readonly id: string;
  readonly label: string;
  /** What the failure line says when the dialog's code did not come. */
  readonly failedLine: string;
  readonly estimateId: string;
  /** The task's code, for the dialog's title and the polite status. */
  readonly code: string;
  /** The status the estimate had when it was ignored. */
  readonly status: RestoreDialogProps['status'];
  readonly engineerName: string;
  readonly deadlineLabel: string;
  readonly deadlinePassed: boolean;
}

export function RestoreButton({ id, label, failedLine, estimateId, code, status, engineerName, deadlineLabel, deadlinePassed }: RestoreButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startRefresh] = useTransition();
  const first = useFirstOpen<RestoreDialogProps>({ id, load: loadDialog, onOpen: () => setOpen(true) });
  // Where focus goes when the dialog is gone: the heading after a Restore (the notice and its button are gone with the redraw), the notice after a refusal, the button otherwise.
  const focusAfter = useRef<string>(id);
  const refused = useRef(false);

  // The button leaves the page with the page being drawn again (a Restore), taking the dialog and focus with it: hand focus to the place the person is going to.
  useEffect(
    () => () => {
      if (focusAfter.current === 'h1') document.querySelector<HTMLElement>('h1')?.focus();
      else if (focusAfter.current !== id) document.getElementById(focusAfter.current)?.focus();
    },
    [id],
  );

  const refresh = (): void => startRefresh(() => router.refresh());
  const Dialog = first.Overlay;
  return (
    <div className="relative flex flex-col gap-s-1">
      <Button
        id={id}
        variant="secondary"
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
          onOpenChange={(next) => {
            setOpen(next);
            if (!next && refused.current) {
              refused.current = false;
              // The estimate changed elsewhere: the page is drawn again. The notice may stay (still ignored) or go (restored by someone else): the action bar is the stable place, else the notice.
              focusAfter.current = document.getElementById(ACTIONS_BAR_ID) === null ? IGNORED_NOTICE_ID : ACTIONS_BAR_ID;
              refresh();
            }
          }}
          estimateId={estimateId}
          code={code}
          status={status}
          engineerName={engineerName}
          deadlineLabel={deadlineLabel}
          deadlinePassed={deadlinePassed}
          onRestored={() => {
            focusAfter.current = 'h1';
            setOpen(false);
            refresh();
          }}
          onStale={() => {
            // No answer came: the Restore may have gone through. The page is drawn again and says what is true; the dialog stays open with its sentence until then.
            focusAfter.current = 'h1';
            refresh();
          }}
          onRefused={() => {
            refused.current = true;
          }}
          onCloseAutoFocus={(event) => {
            // Radix has no trigger to return focus to, so it is placed here: where the person is going, or back on the button.
            event.preventDefault();
            const target = focusAfter.current === 'h1' ? document.querySelector<HTMLElement>('h1') : document.getElementById(focusAfter.current);
            (target ?? document.getElementById(id))?.focus();
          }}
        />
      )}
    </div>
  );
}
