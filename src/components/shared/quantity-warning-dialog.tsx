'use client';

import type { MouseEvent } from 'react';

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
import { WARNING_CHANGED_NOTICE, WARNING_DIALOG_DESCRIPTION, WARNING_GO_BACK, WARNING_LIST_LABEL, warningDialogTitle } from '@/lib/estimate/warning-copy';

/**
 * One row of the dialog: the server's sentence for it, and, where the row can take the person somewhere, the address and what a press does. On SCR-05 a row is a link to that row's QTY per Assy field; on SCR-06
 * (STORY-06.10) the Lead has no form to go to, so a row is plain text.
 */
export interface QuantityWarningLine {
  readonly key: string;
  readonly text: string;
  /** Present when the row is a link (SCR-05). */
  readonly href?: string;
  /** The row's link is held while "go ahead" is on its way. */
  readonly disabled?: boolean;
  readonly onFollow?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface QuantityWarningDialogViewProps {
  /** The rows the server named, in reading order: at least one while the dialog is on the page. */
  readonly lines: ReadonlyArray<QuantityWarningLine>;
  /** True when the list is a new one: the person pressed the way on and something had changed in between, so nothing was calculated (STORY-05.12 AC-4). */
  readonly changed: boolean;
  /** True while the way on is on its way: its button is held and the dialog cannot be dismissed. */
  readonly busy: boolean;
  /** "Calculate anyway" on SCR-05; "Recalculate anyway" or "Calculate anyway" on SCR-06. */
  readonly goAheadLabel: string;
  /** A sentence added under the description (the Lead's, STORY-06.10 AC-1); absent on SCR-05. */
  readonly note?: string | undefined;
  /** "Go back" and Escape: closes the dialog and changes nothing. The caller decides where focus goes. */
  readonly onGoBack: () => void;
  /** The way on: sends the acknowledgement for the revision of this list. */
  readonly onGoAhead: () => void;
  /** Radix has no trigger to return focus to, so the caller places it (WCAG 2.4.3). */
  readonly onCloseAutoFocus: (event: Event) => void;
}

/**
 * "Check the quantity on 2 rows" (STORY-05.12 AC-6; STORY-06.10 AC-1; UX spec SCR-05 state "Quantity warning", SCR-06 state "Quantity warning (Recalculate)"; UX-36, UX-44): the alert dialog both screens draw, so
 * focus starts on the safe choice, "Go back", and Escape closes it with nothing sent. It is the **shared, presentational half**: it lists each row the server named and has the two buttons; what a press does,
 * where focus goes afterwards and whether a row is a link are the caller's (the workspace's `quantity-warning-dialog.tsx` for the Engineer, `recalculate-warning-dialog.tsx` for the Lead).
 * It holds an overlay, so a first-load module may never import it with a plain import: each caller is fetched after the page is up (NFR-009, ADR-016). Its words are in `warning-copy.ts`.
 */
export function QuantityWarningDialogView({ lines, changed, busy, goAheadLabel, note, onGoBack, onGoAhead, onCloseAutoFocus }: QuantityWarningDialogViewProps) {
  return (
    <AlertDialog open onOpenChange={(open) => (open || busy ? undefined : onGoBack())}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{warningDialogTitle(lines.length)}</AlertDialogTitle>
          <AlertDialogDescription>{WARNING_DIALOG_DESCRIPTION}</AlertDialogDescription>
        </AlertDialogHeader>
        {note === undefined ? null : <p className="text-body text-ink-2">{note}</p>}
        {changed ? (
          <Notice tone="warn" role="alert">
            {WARNING_CHANGED_NOTICE}
          </Notice>
        ) : null}
        <ul aria-label={WARNING_LIST_LABEL} data-quantity-warning-rows="" className="flex flex-col gap-s-2">
          {lines.map((line) => (
            <li key={line.key} className="min-w-0">
              {line.href === undefined ? (
                <span className={cn('inline-flex min-h-(--control-h) items-center text-body font-semibold text-ink', BREAK_LONG_NAMES)}>{line.text}</span>
              ) : (
                <a
                  href={line.href}
                  onClick={line.onFollow}
                  aria-disabled={line.disabled ? true : undefined}
                  className={cn('inline-flex min-h-(--control-h) items-center text-body font-semibold text-primary-ink underline underline-offset-2', BREAK_LONG_NAMES)}
                >
                  {line.text}
                </a>
              )}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{WARNING_GO_BACK}</AlertDialogCancel>
          <Button loading={busy} onClick={onGoAhead}>
            {goAheadLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
