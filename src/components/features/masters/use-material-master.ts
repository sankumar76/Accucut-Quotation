'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { SKELETON_DELAY_MS } from '@/components/shared/states';
import { useAfterDelay } from '@/components/shared/use-after-delay';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { listMaterials, type MaterialRow } from '@/lib/masters/materials-client';

import type { MaterialFormDialogProps } from './material-form-dialog';
import { focusOpener, type Opener } from './process-opener';
import type { PageNotice } from './process-texts';

/**
 * What the Materials tab of SCR-13 holds and does, apart from how it looks (STORY-02.03 AC-1, AC-2, AC-8): the list and its search, whether
 * the add / edit dialog is open and for which material, the notice under the header, and where focus goes. `MaterialsPanel` only draws it.
 * It is the shape of `useProcessMaster` (SCR-11) for one dialog: the same first-open loader, the same return of focus to the button that
 * opened the dialog, the same wait of 300 ms before the skeleton. Delete and its refusal are story 02.07's.
 */

export type MaterialListStatus = 'ready' | 'loading' | 'error';

/** The dialog's code: a bare `import()` that the loader can try again after a failure (architecture section 10, AQP-188). */
const loadDialog = () => import('./material-form-dialog').then((module) => module.MaterialFormDialog);

/** Materials whose Material in Drawing or Material Considered contains what was typed, ignoring letter case and surrounding spaces. */
export function filterMaterials(items: ReadonlyArray<MaterialRow>, query: string): ReadonlyArray<MaterialRow> {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return items;
  return items.filter((item) => item.materialInDrawing.toLowerCase().includes(wanted) || item.materialConsidered.toLowerCase().includes(wanted));
}

/** The materials, the search, and reading the list again (the list that was there stays until 300 ms have passed, then the skeleton). */
function useMaterialsList(initialItems: ReadonlyArray<MaterialRow>) {
  const [items, setItems] = useState<ReadonlyArray<MaterialRow>>(initialItems);
  const [status, setStatus] = useState<MaterialListStatus>('ready');
  const [query, setQuery] = useState('');
  const showSkeleton = useAfterDelay(status === 'loading', SKELETON_DELAY_MS);

  /** Reads the list again. The change itself is already saved, so a failure says so and leaves the list as it was. */
  const refresh = useCallback(async (): Promise<void> => {
    setStatus('loading');
    const outcome = await listMaterials();
    if (outcome.status === 'ok') setItems(outcome.value);
    setStatus(outcome.status === 'ok' ? 'ready' : 'error');
  }, []);

  return { items, status, query, setQuery, showSkeleton, shown: filterMaterials(items, query), refresh };
}

/** Whether the dialog is open, for which material (null adds), and the first-open loader that fetches its code on the first press. */
function useMaterialDialog() {
  const [open, setOpen] = useState(false);
  // The material the dialog is about stays set after it closes, so the form does not change while the panel fades out.
  const [formItem, setFormItem] = useState<MaterialRow | null>(null);
  const [pressed, setPressed] = useState<Opener | null>(null);
  const opener = useRef<Opener | null>(null);
  const loader = useFirstOpen<MaterialFormDialogProps>({ id: 'material-dialog', load: loadDialog });

  function openDialog(item: MaterialRow | null, from: Opener, byKeyboard: boolean): boolean {
    // A second press while the first is loading does nothing (UX spec 7.3.1 rule 11): no second request, no second target.
    if (loader.pending) return false;
    opener.current = from;
    setPressed(from);
    setFormItem(item);
    setOpen(true);
    loader.activate(byKeyboard);
    return true;
  }

  return { open, setOpen, formItem, pressed, opener, loader, openDialog };
}

type List = ReturnType<typeof useMaterialsList>;
type Dialog = ReturnType<typeof useMaterialDialog>;

/**
 * Reading the list again after a change, and where focus goes afterwards: back to the button that opened the dialog. If the list cannot
 * be read, the error state takes focus instead.
 */
function useReadAgain(list: List, opener: Dialog['opener']) {
  const wantsFocus = useRef(false);
  const { refresh, status, items } = list;

  useEffect(() => {
    if (status === 'loading' || !wantsFocus.current) return;
    wantsFocus.current = false;
    if (status === 'ready') focusOpener(opener.current);
  }, [status, items, opener]);

  return useCallback(
    async (returnFocus: boolean): Promise<void> => {
      wantsFocus.current = returnFocus;
      await refresh();
    },
    [refresh],
  );
}

/** The whole of the Materials tab's behaviour. The notice is replaced by the next one and cleared by the next press of a button. */
export function useMaterialMaster(initialItems: ReadonlyArray<MaterialRow>) {
  const list = useMaterialsList(initialItems);
  const dialog = useMaterialDialog();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const readAgain = useReadAgain(list, dialog.opener);

  function onAdd(byKeyboard: boolean): void {
    if (dialog.openDialog(null, { itemId: null, action: 'add' }, byKeyboard)) setNotice(null);
  }

  function onEdit(item: MaterialRow, byKeyboard: boolean): void {
    if (dialog.openDialog(item, { itemId: item.id, action: 'edit' }, byKeyboard)) setNotice(null);
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
    focusOpener(dialog.opener.current);
  }

  return { list, dialog, notice, readAgain, onAdd, onEdit, onSaved, onCloseAutoFocus };
}

export type MaterialMaster = ReturnType<typeof useMaterialMaster>;
