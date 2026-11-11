'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { SKELETON_DELAY_MS } from '@/components/shared/states';
import { useAfterDelay } from '@/components/shared/use-after-delay';
import { useFirstOpen } from '@/components/shared/use-first-open';
import { listProcessItems, type FormulaUseRow, type ProcessItemRow } from '@/lib/masters/process-items-client';

import { focusOpener, type Opener } from './master-opener';
import type { PageNotice } from './master-texts';
import type { DialogKind, ProcessDialogsProps } from './process-dialogs';
import type { RowAction } from './process-list';
import { goneNotice } from './process-texts';

/**
 * What SCR-11 holds and does, apart from how it looks (STD-01 of the G6 of AQP-113): the list and its search, which dialog is open and
 * about which rate, the notice under the header, and where focus goes. `ProcessScreen` only draws it. Three hooks, each small:
 * the list (`useItemsList`), the dialogs (`useDialogs`) and the two together (`useProcessMaster`).
 */

export type ListStatus = 'ready' | 'loading' | 'error';

/** The dialogs' code: a bare `import()` that the loader can try again after a failure. */
const loadDialogs = () => import('./process-dialogs').then((module) => module.ProcessDialogs);

/** Rates whose name contains what was typed, ignoring letter case and surrounding spaces. */
export function filterByName(items: ReadonlyArray<ProcessItemRow>, query: string): ReadonlyArray<ProcessItemRow> {
  const wanted = query.trim().toLowerCase();
  return wanted === '' ? items : items.filter((item) => item.name.toLowerCase().includes(wanted));
}

/** The rates, the search, and reading the list again (the list that was there stays until 300 ms have passed, then the skeleton). */
function useItemsList(initialItems: ReadonlyArray<ProcessItemRow>) {
  const [items, setItems] = useState<ReadonlyArray<ProcessItemRow>>(initialItems);
  const [status, setStatus] = useState<ListStatus>('ready');
  const [query, setQuery] = useState('');
  const showSkeleton = useAfterDelay(status === 'loading', SKELETON_DELAY_MS);

  /** Reads the list again. The change itself is already saved, so a failure says so and leaves the list as it was. */
  const refresh = useCallback(async (): Promise<void> => {
    setStatus('loading');
    const outcome = await listProcessItems();
    if (outcome.status === 'ok') setItems(outcome.value);
    setStatus(outcome.status === 'ok' ? 'ready' : 'error');
  }, []);

  return { items, status, query, setQuery, showSkeleton, shown: filterByName(items, query), refresh };
}

/** Which dialog is open, for which rate, and the first-open loader that fetches their code on the first press. */
function useDialogs() {
  const [open, setOpen] = useState<DialogKind | null>(null);
  // The rate a dialog is about stays set after it closes, so the text does not change while the panel fades out.
  const [target, setTarget] = useState<ProcessItemRow | null>(null);
  const [formItem, setFormItem] = useState<ProcessItemRow | null>(null);
  const [blockedBy, setBlockedBy] = useState<ReadonlyArray<FormulaUseRow>>([]);
  const [pressed, setPressed] = useState<Opener | null>(null);
  const opener = useRef<Opener | null>(null);
  const loader = useFirstOpen<ProcessDialogsProps>({ id: 'process-dialogs', load: loadDialogs });

  function openDialog(kind: DialogKind, item: ProcessItemRow | null, from: Opener, byKeyboard: boolean): boolean {
    // A second press while the first is loading does nothing (UX spec 7.3.1 rule 11): no second request, no second target.
    if (loader.pending) return false;
    opener.current = from;
    setPressed(from);
    setTarget(item);
    if (kind === 'add' || kind === 'edit') setFormItem(item);
    if (kind === 'blocked') setBlockedBy(item?.usedBy ?? []);
    setOpen(kind);
    loader.activate(byKeyboard);
    return true;
  }

  return { open, setOpen, target, formItem, blockedBy, setBlockedBy, pressed, opener, loader, openDialog };
}

type List = ReturnType<typeof useItemsList>;
type Dialogs = ReturnType<typeof useDialogs>;
type SetNotice = (notice: PageNotice | null) => void;

/**
 * Reading the list again after a change, and where focus goes afterwards: back to the button that opened the dialog, or to the page
 * heading when that button is gone (a deleted rate's row, ux-spec v0.17). If the list cannot be read, the error state takes focus.
 */
function useReadAgain(list: List, opener: Dialogs['opener']) {
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

/** The presses that open a dialog, and the return of focus when it closes. */
function openersFor(dialogs: Dialogs, list: List, setNotice: SetNotice) {
  function onRowAction(action: RowAction, item: ProcessItemRow, button: HTMLButtonElement, byKeyboard: boolean): void {
    // A rate a formula uses cannot be deleted: the refusal opens at once, from the list the page already holds (AC-4).
    const kind: DialogKind = action === 'delete' && item.usedBy.length > 0 ? 'blocked' : action;
    if (dialogs.openDialog(kind, item, { itemId: item.id, action: button.dataset['action'] ?? action }, byKeyboard)) setNotice(null);
  }

  function onAdd(byKeyboard: boolean): void {
    if (dialogs.openDialog('add', null, { itemId: null, action: 'add' }, byKeyboard)) setNotice(null);
  }

  /** Radix returns focus only to a trigger, and these dialogs have none: the opener is remembered here. */
  function onCloseAutoFocus(event: Event): void {
    event.preventDefault();
    focusOpener(dialogs.opener.current, list.status === 'error');
  }

  return { onRowAction, onAdd, onCloseAutoFocus };
}

/** What the server's answer to a dialog does to the screen. */
function outcomesFor(dialogs: Dialogs, setNotice: SetNotice, readAgain: (returnFocus: boolean) => Promise<void>) {
  /** A change was saved: close, say so, read the list again. */
  async function onSaved(saved: PageNotice): Promise<void> {
    dialogs.setOpen(null);
    setNotice(saved);
    await readAgain(true);
  }

  /** The rate was deleted elsewhere (404): close, say so, read the list again, and put focus on the heading (QLT-06). */
  function onGone(item: ProcessItemRow, what: 'edit' | 'delete'): void {
    dialogs.opener.current = null;
    dialogs.setOpen(null);
    setNotice(goneNotice(item.name, what));
    void readAgain(true);
  }

  /** A formula began to use the rate since the list was read: show the refusal, and read the list again behind it. */
  function onBlocked(formulas: ReadonlyArray<FormulaUseRow>): void {
    dialogs.setBlockedBy(formulas);
    dialogs.setOpen('blocked');
    void readAgain(false);
  }

  return { onSaved, onGone, onBlocked };
}

/** The whole of SCR-11's behaviour. The notice is replaced by the next one and cleared by the next press of a button. */
export function useProcessMaster(initialItems: ReadonlyArray<ProcessItemRow>) {
  const list = useItemsList(initialItems);
  const dialogs = useDialogs();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const readAgain = useReadAgain(list, dialogs.opener);
  return { list, dialogs, notice, readAgain, ...openersFor(dialogs, list, setNotice), ...outcomesFor(dialogs, setNotice, readAgain) };
}

export type ProcessMaster = ReturnType<typeof useProcessMaster>;
