'use client';

import { useRef, type MouseEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  WARNING_CHANGED_NOTICE,
  WARNING_DIALOG_DESCRIPTION,
  WARNING_GO_AHEAD,
  WARNING_GO_BACK,
  WARNING_LIST_LABEL,
  warningDialogTitle,
} from '@/lib/estimate/warning-copy';
import type { WarnedRowView } from '@/lib/estimates/calculate-client';

import { focusCalculate } from './calculate-button';
import { controlIdFor } from './field-ids';
import { focusFieldWhenPresent } from './focus-field';

export interface QuantityWarningDialogProps {
  /** The rows the server named, in reading order: at least one while the dialog is on the page. */
  readonly rows: ReadonlyArray<WarnedRowView>;
  /** True when the list is a new one: the person pressed "Calculate anyway" and something had changed in between, so nothing was calculated (AC-4). */
  readonly changed: boolean;
  /** True while "Calculate anyway" is on its way: the button is held and the dialog cannot be dismissed. */
  readonly busy: boolean;
  /** "Go back" (also Escape): closes the dialog and changes nothing (the estimate stays a draft). The dialog puts focus back on Calculate. */
  readonly onGoBack: () => void;
  /** "Calculate anyway": sends the acknowledgement for the revision of this list. */
  readonly onGoAhead: () => void;
  /** Chooses a part in the tree. The dialog then puts focus on that part's QTY per Assy once its form is on the page. */
  readonly onChoosePart: (nodeId: string) => void;
}

/**
 * "Check the quantity on 2 rows" (STORY-05.12 AC-6; UX spec SCR-05 state "Quantity warning"; UX-36): an alert dialog, so focus starts on the safe choice, "Go back", and Escape closes it with nothing sent.
 * It lists each row the server named, "QTY per Assy is 0 on 1.4 Top cover. That row will cost 0 in this estimate.", as a link to that row's field (the 0 is what the person typed; nothing here comes from a
 * calculation, NFR-002). "Go back" leaves the estimate a draft; "Calculate anyway" sends `{acknowledge: {inputsRevision}}`, which the server accepts only for the revision it named. If the list changed in between,
 * the same dialog shows the new list with the words that say so. Its words are in `warning-copy.ts`. The dialog is fetched after the page is up (NFR-009).
 *
 * Focus is placed here and not left to Radix, which has no trigger to return it to: "Go back" and every refusal or failure of "Calculate anyway" put it back on the Calculate button, a row link takes the person
 * to the field, and a good answer moves it to the Submitted notice (the workspace; Calculate is then disabled and takes none), so every way out puts focus somewhere deliberate (WCAG 2.4.3). A new list
 * (the bar gives the dialog a new `key`) mounts the dialog again, so focus starts on "Go back" again and the notice, a live region, is announced (WCAG 4.1.3).
 */
export function QuantityWarningDialog({ rows, changed, busy, onGoBack, onGoAhead, onChoosePart }: QuantityWarningDialogProps) {
  /** Closes the dialog and, once its focus trap is gone, puts focus back on Calculate (the row link then moves it on to the field). */
  function goBack(): void {
    onGoBack();
    window.setTimeout(focusCalculate, 0);
  }

  /** True once a row link was followed: focus then goes to that field, and the dialog must not send it back to Calculate when it has gone. */
  const toField = useRef(false);

  function goTo(event: MouseEvent<HTMLAnchorElement>, row: WarnedRowView): void {
    event.preventDefault();
    // While "Calculate anyway" is on its way the request is sent and cannot be recalled: going to a field now would look like going back, and the estimate would be submitted under the person.
    if (busy) return;
    toField.current = true;
    onGoBack();
    onChoosePart(row.nodeId);
    // Once the dialog has closed and its focus trap is gone: a focus placed now would be pulled back into the dialog.
    window.setTimeout(() => focusFieldWhenPresent(row.nodeId, row.fieldId), 0);
  }

  return (
    <AlertDialog open onOpenChange={(open) => (open || busy ? undefined : goBack())}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // Radix has no trigger to return focus to. A dialog that goes away for any reason but a row link (a refusal, a failure, Escape) leaves focus on Calculate; once submitted that button is disabled and takes none.
          event.preventDefault();
          if (!toField.current) focusCalculate();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{warningDialogTitle(rows.length)}</AlertDialogTitle>
          <AlertDialogDescription>{WARNING_DIALOG_DESCRIPTION}</AlertDialogDescription>
        </AlertDialogHeader>
        {changed ? (
          <Notice tone="warn" role="alert">
            {WARNING_CHANGED_NOTICE}
          </Notice>
        ) : null}
        <ul aria-label={WARNING_LIST_LABEL} data-quantity-warning-rows="" className="flex flex-col gap-s-2">
          {rows.map((row) => (
            <li key={row.nodeId} className="min-w-0">
              <a
                href={`#${controlIdFor(row.fieldId)}`}
                onClick={(event) => goTo(event, row)}
                aria-disabled={busy ? true : undefined}
                className={cn('inline-flex min-h-(--control-h) items-center text-body font-semibold text-primary-ink underline underline-offset-2', BREAK_LONG_NAMES)}
              >
                {row.message}
              </a>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{WARNING_GO_BACK}</AlertDialogCancel>
          <Button loading={busy} onClick={onGoAhead}>
            {WARNING_GO_AHEAD}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
