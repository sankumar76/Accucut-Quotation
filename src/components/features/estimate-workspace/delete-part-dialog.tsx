'use client';

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


import type { DeleteTarget } from './use-parts-tree';

/** The dialog's own words, here and not in `estimate-texts.ts`, which the first load carries whole: this dialog is fetched after the page is up (NFR-009). */
const deleteTitle = (slNo: string): string => `Delete part ${slNo}?`;
const subPartCount = (count: number): string => `${count} sub-part${count === 1 ? '' : 's'}`;
/** "This also deletes its 2 sub-parts and everything typed into them. This cannot be undone." for a part with sub-parts; a shorter one for a part with none. */
const deleteDescription = (slNo: string, parts: number): string =>
  parts === 1
    ? `Part ${slNo} and everything typed into it will be deleted. This cannot be undone.`
    : `This also deletes its ${subPartCount(parts - 1)}, and everything typed into them. This cannot be undone.`;
const deleteConfirm = (parts: number): string => (parts === 1 ? 'Delete part' : `Delete ${parts} parts`);
const DELETE_CANCEL = 'Cancel';

export interface DeletePartDialogProps {
  readonly target: DeleteTarget | null;
  readonly open: boolean;
  readonly deleting: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Where focus goes when the dialog closes: the tree (the part that was deleted has no element to return to). */
  readonly onCloseAutoFocus: (event: Event) => void;
}

/**
 * "Delete part" (STORY-05.02 AC-3; UX spec SCR-05 state "Delete part"): an alert dialog, so focus starts on the safe choice, "Cancel", and Escape closes it with nothing sent.
 * It names how many parts would go ("This also deletes its 2 sub-parts ... Delete 3 parts"), which is the number the server checks again, so a part added below since then
 * is not deleted unseen. A part with no sub-parts is a plain confirm. Cancelling changes nothing.
 */
export function DeletePartDialog({ target, open, deleting, onConfirm, onCancel, onCloseAutoFocus }: DeletePartDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{target === null ? '' : deleteTitle(target.slNo)}</AlertDialogTitle>
          <AlertDialogDescription>{target === null ? '' : deleteDescription(target.slNo, target.parts)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{DELETE_CANCEL}</AlertDialogCancel>
          <Button variant="danger" loading={deleting} onClick={onConfirm}>
            {target === null ? '' : deleteConfirm(target.parts)}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
