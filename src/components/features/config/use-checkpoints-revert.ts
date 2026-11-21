'use client';

import { useRef, useState } from 'react';

import type { RevertedVersion } from '@/lib/config/checkpoints-client';
import type { CheckpointRow } from '@/lib/config/checkpoints-client';

import { focusOpener, type Opener } from '../masters/master-opener';
import { useDialogOpener } from '../masters/use-dialog-opener';

import type { RevertDialogProps } from './revert-dialog';
import type { RevertTarget } from './use-revert';

/**
 * What SCR-21 holds around the revert dialog (STORY-08.06 AC-4, AC-7, AC-10), apart from how it looks: which version's dialog is open and on which base, the notice after a revert with its undo, and where focus goes
 * when the dialog closes. The dialog's own code is **not** in the first load of the page (NFR-009, ADR-016): a bare `import()` on the first press of a Revert button, through the shared first-open loader
 * (`useDialogOpener`, architecture section 10); the type of its props is imported as a type only.
 *
 * **The undo.** After a revert the notice offers "Revert to the version from before": a revert like any other, to the version that was latest just before (the ID the server answered), asked for with the password again.
 * Its base is the version the revert made, which the answer carries, so it is right at once and does not wait for the lists to be read again.
 *
 * **Focus.** The button that was pressed gets focus back when the dialog closes without a revert. After a revert the button may be gone (the row that names the current version has none), so focus falls back to the page
 * heading, once the lists are read again.
 */

const loadDialog = () => import('./revert-dialog').then((module) => module.RevertDialog);

/** Remembers which button opened a dialog (a plain function, so the ref it is given is not mistaken for a hook value being modified). */
function remember(ref: { current: Opener | null }, value: Opener | null): void {
  ref.current = value;
}

const LOADER_ID = 'checkpoints-revert-dialog';
const REVERT_ACTION = 'revert';
const UNDO_ACTION = 'undo';

/** The notice after a revert: what it copied, what it made, and the version the undo goes back to. */
export interface RevertedNotice {
  readonly copiedFrom: number;
  readonly version: number;
  readonly undo: RevertTarget;
}

export interface CheckpointsRevertInputs {
  /** Reads the lists and the current version again, so what is on screen is the server's. */
  readonly readAgain: () => Promise<void>;
  /** The lists could not be read again: their error owns focus (it takes it on mount), so closing the dialog must not take it away (DEF-020). */
  readonly listFailed: boolean;
  /** The number of the version the screen shows as current; `null` before the first read. */
  readonly currentNumber: number | null;
}

interface Opened {
  readonly target: RevertTarget;
  readonly base: number;
}

export function useCheckpointsRevert({ readAgain, listFailed, currentNumber }: CheckpointsRevertInputs) {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [notice, setNotice] = useState<RevertedNotice | null>(null);
  const returnToRef = useRef<Opener | null>(null);
  const { loader, pressed, opener, press } = useDialogOpener<RevertDialogProps>({ id: LOADER_ID, load: loadDialog });

  function openFor(from: Opener, target: RevertTarget, base: number, byKeyboard: boolean): void {
    const started = press(from, byKeyboard, () => {
      setOpened({ target, base });
      setOpen(true);
    });
    if (!started) return;
    remember(returnToRef, from);
    setNotice(null);
  }

  /** A Revert button of a row was pressed: open the dialog for that checkpoint's version, on the version the screen shows as current. */
  function onRevert(row: CheckpointRow, byKeyboard: boolean): void {
    if (currentNumber === null) return;
    openFor({ itemId: row.id, action: REVERT_ACTION }, { versionId: row.versionId, versionNumber: row.versionNumber, name: row.name }, currentNumber, byKeyboard);
  }

  /** "Revert to the version from before" was pressed: the same dialog, for the version that was latest before the revert, on the version the revert made. */
  function onUndo(byKeyboard: boolean): void {
    if (notice === null) return;
    openFor({ itemId: null, action: UNDO_ACTION }, notice.undo, notice.version, byKeyboard);
  }

  /** The revert worked: close, say so above the list with its undo, read the lists again. The button that opened the dialog may be gone, so focus falls back to the heading. */
  function onReverted(result: RevertedVersion): void {
    const before = opened?.base ?? null;
    remember(returnToRef, null);
    remember(opener, null);
    setOpen(false);
    if (before !== null) setNotice({ copiedFrom: result.copiedFrom, version: result.version, undo: { versionId: result.undoVersionId, versionNumber: before, name: null } });
    void readAgain();
  }

  /** The lists are out of date, or no answer came: read them again behind the dialog, which stays open with its sentence. Focus stays where it is. */
  function onStale(): void {
    setNotice(null);
    void readAgain();
  }

  function onCloseAutoFocus(event: Event): void {
    // Radix has no trigger to return focus to, so it is placed here: the button that opened the dialog, or the heading when that button is gone.
    event.preventDefault();
    focusOpener(returnToRef.current, listFailed);
  }

  return {
    open,
    setOpen,
    target: opened?.target ?? null,
    base: opened?.base ?? 0,
    notice,
    loader,
    pressedRowId: loader.pending && pressed?.action === REVERT_ACTION ? pressed.itemId : null,
    undoPressed: loader.pending && pressed?.action === UNDO_ACTION,
    onRevert,
    onUndo,
    onReverted,
    onStale,
    onCloseAutoFocus,
  };
}

export type CheckpointsRevert = ReturnType<typeof useCheckpointsRevert>;
