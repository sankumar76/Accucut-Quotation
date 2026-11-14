'use client';

import { useState, type ComponentType, type RefObject } from 'react';

import type { EstimateUsesRow } from '@/lib/masters/estimate-uses';

import type { DeleteTarget, MasterDeleteKind } from './master-delete-dialogs';
import type { Opener } from './master-opener';
import type { PageNotice } from './master-texts';
import { useDialogOpener } from './use-dialog-opener';

/**
 * What the delete of a customer (SCR-12) or a material (SCR-13) holds and does, apart from how it looks (STORY-02.07 AC-2, AC-3, AC-7): which of the two dialogs
 * is open, which record it is about, the open estimates the refusal names, and what the server's answer does to the screen. The screen only draws it, and its own
 * hook composes it with the list: the list is read again after a change so what is on screen is the server's (the shape of `useProcessMaster`).
 *
 * The dialogs' code is not in the first load of the page (NFR-009): it is fetched the first time a Delete button is pressed, through the shared first-open
 * loader (architecture section 10, AQP-188), which is why this has a loader and an opener of its own beside the Add / Edit dialog's.
 *
 * **Focus.** `returnTo` is the button whose dialog was opened last, whichever dialog it was: the screen reads it to return focus when a dialog closes and after
 * the list is read again. A deleted record's row is gone, so after a delete (or a 404) `returnTo` is cleared and focus falls back to the page heading (QLT-06).
 */

/** Remembers which button opened a dialog (a plain function, so the ref it is given is not mistaken for a hook argument being modified). */
export function remember(ref: { current: Opener | null }, value: Opener | null): void {
  ref.current = value;
}

/** The props the lazily loaded dialogs module takes, whichever master it serves. */
export interface DeleteDialogsProps {
  readonly open: MasterDeleteKind | null;
  /** The record the dialogs are about. It stays set after they close, so the text does not change while the panel fades out. */
  readonly target: DeleteTarget | null;
  /** The open estimates the refusal names. */
  readonly uses: EstimateUsesRow | null;
  readonly onClose: () => void;
  readonly onDeleted: (target: DeleteTarget) => void;
  /** An open estimate began to use the record since the list was read: the screen shows the refusal with these. */
  readonly onBlocked: (uses: EstimateUsesRow) => void;
  readonly onGone: (target: DeleteTarget) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

export interface MasterDeleteInputs {
  /** Names the first-open loader of the dialogs. */
  readonly id: string;
  /** The dialogs' code: a bare `import()` that the loader can try again after a failure. */
  readonly load: () => Promise<ComponentType<DeleteDialogsProps>>;
  /** The button whose dialog was opened last, shared with the Add / Edit dialog. */
  readonly returnTo: RefObject<Opener | null>;
  readonly setNotice: (notice: PageNotice | null) => void;
  /** Reads the list again; `true` returns focus to `returnTo` when the read has settled. */
  readonly readAgain: (returnFocus: boolean) => Promise<void>;
  /** The notice after a delete, and after a delete that was already done elsewhere (404). */
  readonly deletedNotice: (name: string) => PageNotice;
  readonly goneNotice: (name: string) => PageNotice;
}

export function useMasterDelete({ id, load, returnTo, setNotice, readAgain, deletedNotice, goneNotice }: MasterDeleteInputs) {
  const [open, setOpen] = useState<MasterDeleteKind | null>(null);
  // The record a dialog is about stays set after it closes, so the text does not change while the panel fades out.
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [uses, setUses] = useState<EstimateUsesRow | null>(null);
  const { loader, pressed, opener, press } = useDialogOpener<DeleteDialogsProps>({ id, load });

  /** A Delete button was pressed: remember it, and open the confirmation for that record. */
  function onDelete(record: DeleteTarget, button: HTMLButtonElement, byKeyboard: boolean): void {
    const from: Opener = { itemId: record.id, action: button.dataset['action'] ?? 'delete' };
    const opened = press(from, byKeyboard, () => {
      setTarget({ id: record.id, name: record.name });
      setOpen('delete');
    });
    if (!opened) return;
    remember(returnTo, from);
    setNotice(null);
  }

  /** The row is gone with the record: focus goes to the page heading once the list has been read again. */
  function forgetRow(): void {
    remember(returnTo, null);
    remember(opener, null);
    setOpen(null);
  }

  /** The server deleted the record: close, say so, read the list again. */
  function onDeleted(deleted: DeleteTarget): void {
    forgetRow();
    setNotice(deletedNotice(deleted.name));
    void readAgain(true);
  }

  /** The record was deleted elsewhere (404): close, say so, read the list again (QLT-06). */
  function onGone(gone: DeleteTarget): void {
    forgetRow();
    setNotice(goneNotice(gone.name));
    void readAgain(true);
  }

  /** An open estimate began to use the record since the list was read: show the refusal, and read the list again behind it. */
  function onBlocked(named: EstimateUsesRow): void {
    setUses(named);
    setOpen('blocked');
    void readAgain(false);
  }

  return { open, setOpen, target, uses, loader, pressed, onDelete, onDeleted, onGone, onBlocked };
}

export type MasterDeleteState = ReturnType<typeof useMasterDelete>;
