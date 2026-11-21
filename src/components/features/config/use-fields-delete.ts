'use client';

import { useRef, useState } from 'react';

import type { ConfigFieldRow } from '@/lib/config/fields-client';

import { focusOpener, type Opener } from '../masters/master-opener';
import { useDialogOpener } from '../masters/use-dialog-opener';

import type { DeleteFieldDialogProps } from './delete-field-dialog';
import type { DeleteTarget } from './use-delete-field';

/**
 * What SCR-17 holds around the delete dialog of SCR-20 (STORY-08.04 AC-1, AC-3, AC-10), apart from how it looks: which field's dialog is open, the sentence shown above the list after a delete, and where focus goes
 * when the dialog closes. The dialog's own code is **not** in the first load of the page (NFR-009, ADR-016): a bare `import()` on the first press of a Delete button, through the shared first-open loader
 * (`useDialogOpener`, architecture section 10); the type of its props is imported as a type only.
 *
 * **Focus.** The button that was pressed gets focus back when the dialog closes without a delete. After a delete the row is gone, so focus goes to the page heading (`focusOpener` with no opener), once the list is
 * read again. The deleted field's text stays set after the dialog closes, so it does not change while the panel fades out.
 */

const loadDialog = () => import('./delete-field-dialog').then((module) => module.DeleteFieldDialog);

/** Remembers which button opened a dialog (a plain function, so the ref it is given is not mistaken for a hook value being modified). */
function remember(ref: { current: Opener | null }, value: Opener | null): void {
  ref.current = value;
}

const LOADER_ID = 'fields-delete-dialog';
const DELETE_ACTION = 'delete';

export interface FieldsDeleteInputs {
  /** Reads the list again, so what is on screen is the server's. */
  readonly readAgain: () => Promise<void>;
  /** The list could not be read again after a delete: its error owns focus (it takes it on mount), so closing the dialog must not take it away (DEF-020). */
  readonly listFailed: boolean;
}

export function useFieldsDelete({ readAgain, listFailed }: FieldsDeleteInputs) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const returnToRef = useRef<Opener | null>(null);
  const { loader, pressed, opener, press } = useDialogOpener<DeleteFieldDialogProps>({ id: LOADER_ID, load: loadDialog });

  /** A Delete button was pressed: remember it, and open the dialog for that field. A second press while the code loads does nothing. */
  function onDelete(row: ConfigFieldRow, _button: HTMLButtonElement, byKeyboard: boolean): void {
    const from: Opener = { itemId: row.id, action: DELETE_ACTION };
    const opened = press(from, byKeyboard, () => {
      setTarget({ id: row.id, letter: row.letter, label: row.label });
      setOpen(true);
    });
    if (!opened) return;
    remember(returnToRef, from);
    setNotice(null);
  }

  /** The delete worked: close, say so above the list, read the list again. The row is gone with the field, so focus falls back to the page heading. */
  function onDeleted(message: string): void {
    remember(returnToRef, null);
    remember(opener, null);
    setOpen(false);
    setNotice(message);
    void readAgain();
  }

  /** The list is out of date, or no answer came: read it again behind the dialog, which stays open with its sentence. Focus stays where it is. */
  function onStale(): void {
    void readAgain();
  }

  function onCloseAutoFocus(event: Event): void {
    // Radix has no trigger to return focus to, so it is placed here: the button that opened the dialog, or the heading when that row is gone.
    event.preventDefault();
    focusOpener(returnToRef.current, listFailed);
  }

  return { open, setOpen, target, notice, loader, pressedId: loader.pending ? (pressed?.itemId ?? null) : null, onDelete, onDeleted, onStale, onCloseAutoFocus };
}

export type FieldsDelete = ReturnType<typeof useFieldsDelete>;
