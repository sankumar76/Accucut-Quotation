'use client';

import { Notice } from '@/components/shared/notice';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { LEAVE_ANYWAY, LEAVE_BODY, LEAVE_KEEP, LEAVE_SAVE, LEAVE_SAVE_FAILED_BODY, LEAVE_SAVE_FAILED_TITLE, LEAVE_TITLE, SAVING_LABEL } from './save-texts';

export interface LeaveDialogProps {
  readonly open: boolean;
  /** "Save draft and leave" is on its way: the buttons are held and the dialog cannot be dismissed. */
  readonly saving: boolean;
  /** The last "Save draft and leave" left a value unsaved: the dialog stays, says so, and offers the same two ways out. */
  readonly saveFailed: boolean;
  /** "Keep editing" (also Escape): the person stays and nothing changes. */
  readonly onKeep: () => void;
  /** "Leave without saving": what was typed and not saved is given up, by the person's own choice. */
  readonly onLeave: () => void;
  /** "Save draft and leave": saves the draft, and leaves only if it was saved. */
  readonly onSaveAndLeave: () => void;
  /** Where focus goes when the dialog closes and the person stays: back to where it was. */
  readonly onCloseAutoFocus: (event: Event) => void;
}

/**
 * "Leave without saving?" (STORY-05.08 AC-4, AC-8; UX spec SCR-05 state "Unsaved changes"): an alert dialog, so focus starts on the safe choice, "Keep editing", Escape closes it with the person
 * still on the page, and everything behind it is inert. The two choices of the spec are "Leave without saving" and "Save draft and leave"; "Keep editing" is the way to stay that a phone has (it has no
 * Escape). Leaving without saving is the one choice that gives typing up, so it is the danger button and never the focused one. Neither of the two buttons is a Radix action, which would close the dialog
 * by itself: the page decides when the dialog goes, and a draft that cannot be saved keeps it open.
 */
export function LeaveDialog({ open, saving, saveFailed, onKeep, onLeave, onSaveAndLeave, onCloseAutoFocus }: LeaveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next || saving ? undefined : onKeep())}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{LEAVE_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{LEAVE_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        {saveFailed ? (
          <Notice tone="danger" title={LEAVE_SAVE_FAILED_TITLE}>
            {LEAVE_SAVE_FAILED_BODY}
          </Notice>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{LEAVE_KEEP}</AlertDialogCancel>
          <Button variant="danger" disabled={saving} onClick={onLeave}>
            {LEAVE_ANYWAY}
          </Button>
          <Button loading={saving} onClick={onSaveAndLeave}>
            {saving ? SAVING_LABEL : LEAVE_SAVE}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
