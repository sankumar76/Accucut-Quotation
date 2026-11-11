'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { SKELETON_DELAY_MS } from '@/components/shared/states';
import { useAfterDelay } from '@/components/shared/use-after-delay';
import { listTreatments, type TreatmentRow } from '@/lib/masters/treatments-client';

import { focusOpener, type Opener } from './master-opener';
import type { PageNotice } from './master-texts';
import { treatmentGoneNotice } from './treatment-texts';
import { useFocusAfterRead } from './use-read-again';

/**
 * What the Treatment / Color tab of SCR-13 holds and does, apart from how it looks (STORY-02.05 AC-1, AC-4, AC-8): the list, which dialog is
 * open and about which treatment, the notice under the tab bar, and where focus goes. `TreatmentPanel` only draws it. It is the shape of
 * `useProcessMaster` (SCR-11) for a list the screen reads itself: the tab reads `GET /api/v1/treatments` when it first opens (it is not in the
 * first load of the page, NFR-009), a change reads the list again so what is on screen is the server's, and the skeleton waits 300 ms.
 *
 * **Focus after a change (DEF-020, ux-spec SCR-13 "focus goes to the title").** When a change succeeded and the read that follows fails, the load
 * error shows and takes focus on its title ("We could not load the treatments"). The step that would otherwise put focus back on the button that
 * opened the dialog must then do nothing (`focusOpener` with `listFailed`), or focus is taken from the error and ends up on the page heading. The
 * step falls back to the heading only when the opener's row is gone (a deleted treatment, a rename that re-sorts) and the list is not in error.
 *
 * **Focus inside the form moves only on a refusal** (DL-135): that is `useFocusOnRefusal` in the dialog. Nothing in this file moves focus on a
 * keystroke, and nothing is keyed on an object that typing rebuilds.
 */

export type TreatmentListStatus = 'loading' | 'ready' | 'error';

export type TreatmentDialogKind = 'add' | 'rename' | 'delete';

/** The buttons that open a dialog, by their `data-action`, so focus can come back to them. */
export const TREATMENT_ACTIONS = { add: 'add', rename: 'rename', delete: 'delete' } as const;

/**
 * The list, reading it, and where focus goes when a read that a person asked for has finished: back to the button that opened the dialog, unless
 * the read failed (the load error owns focus, DEF-020).
 */
function useTreatmentList(opener: { readonly current: Opener | null }) {
  const [items, setItems] = useState<ReadonlyArray<TreatmentRow> | null>(null);
  const [status, setStatus] = useState<TreatmentListStatus>('loading');
  // The number of the newest read: an older read that answers late must not replace what a newer one showed (QLT-04).
  const newest = useRef(0);
  const showSkeleton = useAfterDelay(status === 'loading' && items !== null, SKELETON_DELAY_MS);
  const askForFocus = useFocusAfterRead({ status, result: items, opener });

  /** Reads the list and settles the status. Sets nothing before the answer, and nothing at all if a newer read was started meanwhile (the latest read wins). */
  const read = useCallback(
    async (returnFocus: boolean): Promise<void> => {
      askForFocus(returnFocus);
      newest.current += 1;
      const mine = newest.current;
      const outcome = await listTreatments();
      if (mine !== newest.current) return;
      if (outcome.status === 'ok') setItems(outcome.value);
      setStatus(outcome.status === 'ok' ? 'ready' : 'error');
    },
    [askForFocus],
  );

  /** Reads the list again because a person asked (after a change, or Try again): the status goes to `loading` at once, from an event handler. */
  const readAgain = useCallback(
    (returnFocus: boolean): Promise<void> => {
      setStatus('loading');
      return read(returnFocus);
    },
    [read],
  );

  return { items, status, showSkeleton, read, readAgain };
}

/** Which dialog is open and for which treatment. The treatments stay set after the dialog closes, so their text does not change while it fades out. */
function useTreatmentDialog() {
  const [open, setOpen] = useState<TreatmentDialogKind | null>(null);
  const [target, setTarget] = useState<TreatmentRow | null>(null);
  // Kept apart from `target`, so the Add / Rename form does not change while it fades out and another dialog opens.
  const [formItem, setFormItem] = useState<TreatmentRow | null>(null);
  const opener = useRef<Opener | null>(null);

  function openDialog(kind: TreatmentDialogKind, item: TreatmentRow | null, from: Opener): void {
    opener.current = from;
    setTarget(item);
    if (kind !== 'delete') setFormItem(item);
    setOpen(kind);
  }

  /** The opener is gone with its row: focus then falls back to the page heading. */
  function forgetOpener(): void {
    opener.current = null;
  }

  return { open, setOpen, target, formItem, opener, openDialog, forgetOpener };
}

type TreatmentList = ReturnType<typeof useTreatmentList>;
type TreatmentDialog = ReturnType<typeof useTreatmentDialog>;
type SetNotice = (notice: PageNotice | null) => void;

/** The presses that open a dialog, what the server's answer does to the screen, and where focus goes when a dialog closes. */
function useTreatmentActions(dialog: TreatmentDialog, list: TreatmentList, setNotice: SetNotice) {
  const { readAgain, status } = list;

  function onAdd(): void {
    dialog.openDialog('add', null, { itemId: null, action: TREATMENT_ACTIONS.add });
    setNotice(null);
  }

  function onRowAction(action: 'rename' | 'delete', item: TreatmentRow): void {
    dialog.openDialog(action, item, { itemId: item.id, action: TREATMENT_ACTIONS[action] });
    setNotice(null);
  }

  /** The server accepted a change: close, say so, read the list again. */
  async function onSaved(saved: PageNotice): Promise<void> {
    dialog.setOpen(null);
    setNotice(saved);
    await readAgain(true);
  }

  /** The treatment was deleted elsewhere (404): close, say so, read the list again, and put focus on the heading (its row is gone). */
  function onGone(item: TreatmentRow, what: 'rename' | 'delete'): void {
    dialog.forgetOpener();
    dialog.setOpen(null);
    setNotice(treatmentGoneNotice(item.name, what));
    void readAgain(true);
  }

  /** Radix returns focus only to a trigger, and these dialogs have none: the opener is remembered here. A list in error keeps focus on its title. */
  function onCloseAutoFocus(event: Event): void {
    event.preventDefault();
    focusOpener(dialog.opener.current, status === 'error');
  }

  return { onAdd, onRowAction, onSaved, onGone, onCloseAutoFocus };
}

/** The whole of the Treatment / Color tab's behaviour. The notice is replaced by the next one and cleared by the next press of a button. */
export function useTreatments() {
  const dialog = useTreatmentDialog();
  const list = useTreatmentList(dialog.opener);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const { read, readAgain } = list;

  // The first activation of the tab: the list is read. The status starts as `loading`, so nothing is set before the answer.
  useEffect(() => {
    void read(false);
  }, [read]);

  return {
    items: list.items,
    status: list.status,
    showSkeleton: list.showSkeleton,
    notice,
    dialog,
    ...useTreatmentActions(dialog, list, setNotice),
    retry: () => void readAgain(false),
  };
}

export type TreatmentsState = ReturnType<typeof useTreatments>;
