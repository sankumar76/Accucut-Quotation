'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { listCustomers, type CustomerRow, type CustomerSummaryRow } from '@/lib/masters/customers-client';

import type { CustomerFormDialogProps } from './customer-form-dialog';
import { customerAddedNotice, customerDeletedNotice, customerGoneNotice } from './customer-texts';
import { focusOpener, type Opener } from './master-opener';
import type { PageNotice } from './master-texts';
import { remember, useMasterDelete } from './use-master-delete';
import { useDialogOpener } from './use-dialog-opener';
import { useMasterList } from './use-master-list';
import { useReadAgain } from './use-read-again';

/**
 * What SCR-12's list holds and does, apart from how it looks (STORY-02.02 AC-1, AC-8): the list and its search, whether the Add customer dialog is open,
 * the notice under the header, and where focus goes. `CustomerScreen` only draws it. The list body is `useMasterList` (DL-153, GitHub issue 245): this file
 * keeps no items, query, status, skeleton or read of its own. It is the shape of `useProcessMaster` (SCR-11): the page renders the list for the first paint,
 * the dialog's code is fetched the first time the button is pressed (NFR-009), and a change reads the list again so what is on screen is the server's.
 *
 * Opening a customer to edit it is a navigation to its page (`/masters/customers/{id}`), not a dialog, so it has no opener to return to: the list is read
 * again when the person comes back, because the page that lists is rendered fresh.
 */

/** The dialog's code: a bare `import()` that the loader can try again after a failure. */
const loadDialog = () => import('./customer-form-dialog').then((module) => module.CustomerFormDialog);

/** The delete dialogs' code, fetched the first time a Delete button is pressed (NFR-009). */
const loadDeleteDialogs = () => import('./customer-delete-dialogs').then((module) => module.CustomerDeleteDialogs);

/** Customers whose name contains what was typed, ignoring letter case and surrounding spaces. */
export function filterCustomersByName(items: ReadonlyArray<CustomerSummaryRow>, query: string): ReadonlyArray<CustomerSummaryRow> {
  const wanted = query.trim().toLowerCase();
  return wanted === '' ? items : items.filter((item) => item.name.toLowerCase().includes(wanted));
}

/** Whether the Add dialog is open, and the first-open loader that fetches its code on the first press. */
function useAddDialog() {
  const [open, setOpen] = useState(false);
  const { loader, pressed, opener, press } = useDialogOpener<CustomerFormDialogProps>({ id: 'customer-dialogs', load: loadDialog });
  return { open, setOpen, loader, pressed, opener, press };
}

/**
 * The whole of SCR-12's list behaviour. The notice is replaced by the next one and cleared by the next press of a button. Two dialogs open from it, each with
 * its own lazily fetched code (the Add dialog here, the delete dialogs in `useMasterDelete`), so the button that opened one is kept in `returnTo`, where
 * focus returns to when either closes and after the list is read again.
 */
export function useCustomers(initialItems: ReadonlyArray<CustomerSummaryRow>) {
  const list = useMasterList({ readList: listCustomers, initialItems, filter: filterCustomersByName });
  const dialog = useAddDialog();
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const returnTo = useRef<Opener | null>(null);
  const readAgain = useReadAgain({ status: list.status, result: list.items, opener: returnTo, refresh: list.refresh });
  const remove = useMasterDelete({ id: 'customer-delete-dialogs', load: loadDeleteDialogs, returnTo, setNotice, readAgain, deletedNotice: customerDeletedNotice, goneNotice: customerGoneNotice });
  const router = useRouter();

  function onAdd(byKeyboard: boolean): void {
    const from: Opener = { itemId: null, action: 'add' };
    const opened = dialog.press(from, byKeyboard, () => dialog.setOpen(true));
    if (!opened) return;
    remember(returnTo, from);
    setNotice(null);
  }

  /** The server added the customer: close, say so, read the list again. */
  function onSaved(created: CustomerRow): void {
    dialog.setOpen(false);
    setNotice(customerAddedNotice(created.name));
    void readAgain(true);
  }

  /** Radix returns focus only to a trigger, and this dialog has none: the opener is remembered here. A list in error keeps focus on its title. */
  function onCloseAutoFocus(event: Event): void {
    event.preventDefault();
    focusOpener(returnTo.current, list.status === 'error');
  }

  return {
    list,
    dialog,
    remove,
    notice,
    readAgain,
    onAdd,
    onSaved,
    onCloseAutoFocus,
    onEdit: (id: string): void => router.push(`/masters/customers/${encodeURIComponent(id)}`),
  };
}

export type CustomersState = ReturnType<typeof useCustomers>;
