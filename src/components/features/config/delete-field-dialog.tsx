'use client';

import { useRef, type RefObject } from 'react';

import { AlertDialog, AlertDialogContent } from '@/components/ui/alert-dialog';

import { DeleteFieldPanel } from './delete-field-view';
import { useDeleteField, type DeleteTarget } from './use-delete-field';

/**
 * The delete dialog of SCR-20 (STORY-08.04 AC-1 to AC-4, AC-10; UX spec SCR-20): an alertdialog over the list of fields. It is fetched on the first press of a Delete button, through the overlay loader every dialog uses
 * (`useFirstOpen`, architecture section 10), and is **not** in the first load of the page (NFR-009, ADR-016). On open it asks the server what uses the field (`GET .../references`): a field that something uses shows the list
 * ("Blocked by formulas", no password field); one that nothing uses shows the confirm state with the Admin's password. The server judges everything; the dialog only shows its answer (see `use-delete-field.ts`).
 *
 * It is an AlertDialog, so focus starts on the safe choice and Escape closes it with nothing sent; neither works while the delete is under way. Radix has no trigger to return focus to, so the screen places it in
 * `onCloseAutoFocus`.
 */

export interface DeleteFieldDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The field the dialog is about. It stays set after the dialog closes, so the text does not change while the panel fades out. */
  readonly target: DeleteTarget;
  /** The delete worked: the sentence to show above the list. */
  readonly onDeleted: (message: string) => void;
  /** The list is out of date, or no usable answer came: read it again. */
  readonly onStale: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** The state mounts when the dialog opens and goes when it closes, so every opening reads the references again and starts with an empty password. */
function DeleteFieldHost({ target, onDeleted, onStale, inFlightRef }: Pick<DeleteFieldDialogProps, 'target' | 'onDeleted' | 'onStale'> & { readonly inFlightRef: RefObject<boolean> }) {
  const state = useDeleteField({ target, onDeleted, onStale, inFlightRef });
  return <DeleteFieldPanel target={target} state={state} />;
}

export function DeleteFieldDialog(props: DeleteFieldDialogProps) {
  const inFlightRef = useRef(false);
  return (
    // Escape and the way out do nothing while the delete is under way (it cannot be recalled).
    <AlertDialog open={props.open} onOpenChange={(next) => (next || !inFlightRef.current ? props.onOpenChange(next) : undefined)}>
      <AlertDialogContent onCloseAutoFocus={props.onCloseAutoFocus}>
        <DeleteFieldHost target={props.target} onDeleted={props.onDeleted} onStale={props.onStale} inFlightRef={inFlightRef} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
