'use client';

import { useRef, useState } from 'react';

import { listMaterials, type MaterialRow } from '@/lib/masters/materials-client';

import { focusOpener, type Opener } from './master-opener';
import type { PageNotice } from './master-texts';
import type { MaterialFormDialogProps } from './material-form-dialog';
import { materialDeletedNotice, materialGoneNotice } from './material-texts';
import { useDialogOpener } from './use-dialog-opener';
import { remember, useMasterDelete } from './use-master-delete';
import { useMasterList } from './use-master-list';
import { useReadAgain, type ReadStatus } from './use-read-again';

/**
 * What the Materials tab of SCR-13 holds and does, apart from how it looks (STORY-02.03 AC-1, AC-2, AC-8): the list and its search, whether
 * the add / edit dialog is open and for which material, the notice under the header, and where focus goes. `MaterialsPanel` only draws it.
 * It is the shape of `useProcessMaster` (SCR-11) for one dialog: the same first-open loader, the same return of focus to the button that
 * opened the dialog, the same wait of 300 ms before the skeleton. The delete and its refusal (story 02.07) are `useMasterDelete`, shared with the Customers screen.
 */

export type MaterialListStatus = ReadStatus;

/** The dialog's code: a bare `import()` that the loader can try again after a failure (architecture section 10, AQP-188). */
const loadDialog = () => import('./material-form-dialog').then((module) => module.MaterialFormDialog);

/** The delete dialogs' code, fetched the first time a Delete button is pressed (NFR-009). */
const loadDeleteDialogs = () => import('./material-delete-dialogs').then((module) => module.MaterialDeleteDialogs);

/** Materials whose Material in Drawing or Material Considered contains what was typed, ignoring letter case and surrounding spaces. */
function filterMaterials(items: ReadonlyArray<MaterialRow>, query: string): ReadonlyArray<MaterialRow> {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return items;
  return items.filter((item) => item.materialInDrawing.toLowerCase().includes(wanted) || item.materialConsidered.toLowerCase().includes(wanted));
}

/** The materials, the search, and reading the list again (the list that was there stays until 300 ms have passed, then the skeleton). */
function useMaterialsList(initialItems: ReadonlyArray<MaterialRow>) {
  return useMasterList({ readList: listMaterials, initialItems, filter: filterMaterials });
}

/** Whether the dialog is open, for which material (null adds), and the first-open loader that fetches its code on the first press. */
function useMaterialDialog() {
  const [open, setOpen] = useState(false);
  // The material the dialog is about stays set after it closes, so the form does not change while the panel fades out.
  const [formItem, setFormItem] = useState<MaterialRow | null>(null);
  const { loader, pressed, opener, press } = useDialogOpener<MaterialFormDialogProps>({ id: 'material-dialog', load: loadDialog });

  function openDialog(item: MaterialRow | null, from: Opener, byKeyboard: boolean): boolean {
    return press(from, byKeyboard, () => {
      setFormItem(item);
      setOpen(true);
    });
  }

  return { open, setOpen, formItem, pressed, opener, loader, openDialog };
}

/** The whole of the Materials tab's behaviour. The notice is replaced by the next one and cleared by the next press of a button. */
export function useMaterialMaster(initialItems: ReadonlyArray<MaterialRow>) {
  const list = useMaterialsList(initialItems);
  const dialog = useMaterialDialog();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  // Two dialogs open from the list, each with its own lazily fetched code (the Add / Edit form here, the delete dialogs in `useMasterDelete`), so the button that
  // opened one is kept here, where focus returns to when either closes and after the list is read again.
  const returnTo = useRef<Opener | null>(null);
  const readAgain = useReadAgain({ status: list.status, result: list.items, opener: returnTo, refresh: list.refresh });
  const remove = useMasterDelete({ id: 'material-delete-dialogs', load: loadDeleteDialogs, returnTo, setNotice, readAgain, deletedNotice: materialDeletedNotice, goneNotice: materialGoneNotice });

  function onAdd(byKeyboard: boolean): void {
    const from: Opener = { itemId: null, action: 'add' };
    if (!dialog.openDialog(null, from, byKeyboard)) return;
    remember(returnTo, from);
    setNotice(null);
  }

  function onEdit(item: MaterialRow, byKeyboard: boolean): void {
    const from: Opener = { itemId: item.id, action: 'edit' };
    if (!dialog.openDialog(item, from, byKeyboard)) return;
    remember(returnTo, from);
    setNotice(null);
  }

  /** The server accepted a change: close, say so, read the list again. */
  async function onSaved(saved: PageNotice): Promise<void> {
    dialog.setOpen(false);
    setNotice(saved);
    await readAgain(true);
  }

  /** Radix returns focus only to a trigger, and this dialog has none: the opener is remembered here. */
  function onCloseAutoFocus(event: Event): void {
    event.preventDefault();
    focusOpener(returnTo.current, list.status === 'error');
  }

  return { list, dialog, remove, notice, readAgain, onAdd, onEdit, onSaved, onCloseAutoFocus };
}

export type MaterialMaster = ReturnType<typeof useMaterialMaster>;
