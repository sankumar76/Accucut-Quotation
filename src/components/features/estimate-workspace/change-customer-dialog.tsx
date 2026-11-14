'use client';

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
import type { CustomerView } from '@/lib/estimates/estimates-client';

import { CHANGE_CONFIRM, CHANGE_TITLE, changeDescription, CUSTOMER_SAVING, FAILED_BODY, keepLabel, SAVE_FAILED_TITLE } from './estimate-texts';
import type { SaveProblem } from './use-customer-choice';

/**
 * "Change the customer?" (STORY-05.01 AC-4; UX spec SCR-05 state "Change customer"): an alert dialog, so focus starts on the safe choice, "Keep <name>", and Escape
 * closes it with nothing sent. It says what changes and what does not: nothing typed is lost, and the new customer applies the next time the estimate is
 * calculated. The request stays out until the server answers; the dialog closes then, and a refusal or a failure keeps it open with the reason and
 * everything as it was. The dialog is opened by the field, not by a button of its own, so it hands focus back to the field when it closes.
 */

export interface ChangeCustomerDialogProps {
  readonly current: CustomerView;
  /** The customer the person picked: what the dialog is about, and null before any pick. */
  readonly pending: CustomerView | null;
  readonly open: boolean;
  readonly saving: boolean;
  readonly problem: SaveProblem | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Where focus goes when the dialog closes: the customer field. */
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** A long customer name wraps inside the button, so a 360 px phone never scrolls sideways. */
const WRAPPING_BUTTON = cn('h-auto min-h-(--control-h) py-s-2 leading-snug whitespace-normal', BREAK_LONG_NAMES);

export function ChangeCustomerDialog({ current, pending, open, saving, problem, onConfirm, onCancel, onCloseAutoFocus }: ChangeCustomerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{CHANGE_TITLE}</AlertDialogTitle>
          <AlertDialogDescription className={BREAK_LONG_NAMES}>{pending === null ? '' : changeDescription(current.name, pending.name)}</AlertDialogDescription>
        </AlertDialogHeader>
        {problem === null ? null : (
          <Notice tone="danger" title={problem.kind === 'refused' ? problem.message : SAVE_FAILED_TITLE}>
            {problem.kind === 'refused' ? null : problem.kind === 'field' ? problem.message : FAILED_BODY}
          </Notice>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className={WRAPPING_BUTTON}>{keepLabel(current.name)}</AlertDialogCancel>
          <Button className={WRAPPING_BUTTON} loading={saving} onClick={onConfirm}>
            {saving ? CUSTOMER_SAVING : CHANGE_CONFIRM}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
