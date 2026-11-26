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
/** "Delete 1.1 Sub-Assembly?": the row's number and its name (its Description, else its Part No., else its kind's own name), as the button that opened the dialog names it (AQP-446). */
const deleteTitle = (slNo: string, name: string): string => `Delete ${slNo} ${name}?`;
const rowCount = (count: number): string => `${count} row${count === 1 ? '' : 's'}`;
/** "This also deletes the 2 rows under it and everything typed into them. This cannot be undone." for a row with rows under it; a shorter one for a row with none. The rows under a row can be assemblies and Fasteners, so they are "rows" (PM ruling DL-303; UX spec section 0.9 row 3). */
const deleteDescription = (slNo: string, parts: number): string =>
  parts === 1
    ? `Row ${slNo} and everything typed into it will be deleted. This cannot be undone.`
    : `This also deletes the ${rowCount(parts - 1)} under it, and everything typed into them. This cannot be undone.`;
const deleteConfirm = (parts: number): string => (parts === 1 ? 'Delete row' : `Delete ${parts} rows`);
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
 * "Delete row" (STORY-05.02 AC-3; UX spec SCR-05 state "Delete part"; the words say "rows" since CR-01 item 3C, DL-303): an alert dialog, so focus starts on the safe choice, "Cancel", and Escape closes it with nothing sent.
 * It names how many rows would go ("This also deletes the 2 rows under it ... Delete 3 rows"), which is the number the server checks again, so a part added below since then
 * is not deleted unseen. A part with no sub-parts is a plain confirm. Cancelling changes nothing.
 */
export function DeletePartDialog({ target, open, deleting, onConfirm, onCancel, onCloseAutoFocus }: DeletePartDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{target === null ? '' : deleteTitle(target.slNo, target.name)}</AlertDialogTitle>
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
