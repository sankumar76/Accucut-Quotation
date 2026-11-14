'use client';

import { useState, type RefObject } from 'react';

import type { EstimateUsesRow } from '@/lib/masters/estimate-uses';

import type { CustomerDeleteDialogsProps, CustomerDeleteKind } from './customer-delete-dialogs';
import { customerDeletedNotice, customerGoneNotice } from './customer-texts';
import type { DeleteTarget } from './master-delete-dialogs';
import type { Opener } from './master-opener';
import type { PageNotice } from './master-texts';
import { useDialogOpener } from './use-dialog-opener';

/**
 * What the delete of SCR-12 holds and does, apart from how it looks (STORY-02.07 AC-2, AC-7): which of the two dialogs is open, which customer it is about,
 * the open estimates the refusal names, and what the server's answer does to the screen. `CustomerScreen` only draws it, and `useCustomers` composes it with the
 * list: the list is read again after a change so what is on screen is the server's (the shape of `useProcessMaster`).
 *
 * The dialogs' code is not in the first load of the page (NFR-009): it is fetched the first time a Delete button is pressed, through the shared first-open
 * loader (architecture section 10, AQP-188), which is why this has a loader and an opener of its own beside the Add dialog's.
 *
 * **Focus.** `returnTo` is the button whose dialog was opened last, whichever dialog it was: the screen reads it to return focus when a dialog closes and after
 * the list is read again. A deleted customer's row is gone, so after a delete (or a 404) `returnTo` is cleared and focus falls back to the page heading (QLT-06).
 */

/** The dialogs' code: a bare `import()` that the loader can try again after a failure. */
const loadDialogs = () => import('./customer-delete-dialogs').then((module) => module.CustomerDeleteDialogs);

/** Remembers which button opened a dialog (a plain function, so the ref it is given is not mistaken for a hook argument being modified). */
export function remember(ref: { current: Opener | null }, value: Opener | null): void {
  ref.current = value;
}

export interface CustomerDeleteInputs {
  /** The button whose dialog was opened last, shared with the Add dialog. */
  readonly returnTo: RefObject<Opener | null>;
  readonly setNotice: (notice: PageNotice | null) => void;
  /** Reads the list again; `true` returns focus to `returnTo` when the read has settled. */
  readonly readAgain: (returnFocus: boolean) => Promise<void>;
}

export function useCustomerDelete({ returnTo, setNotice, readAgain }: CustomerDeleteInputs) {
  const [open, setOpen] = useState<CustomerDeleteKind | null>(null);
  // The customer a dialog is about stays set after it closes, so the text does not change while the panel fades out.
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [uses, setUses] = useState<EstimateUsesRow | null>(null);
  const { loader, pressed, opener, press } = useDialogOpener<CustomerDeleteDialogsProps>({ id: 'customer-delete-dialogs', load: loadDialogs });

  /** A Delete button was pressed: remember it, and open the confirmation for that customer. */
  function onDelete(customer: DeleteTarget, button: HTMLButtonElement, byKeyboard: boolean): void {
    const from: Opener = { itemId: customer.id, action: button.dataset['action'] ?? 'delete' };
    const opened = press(from, byKeyboard, () => {
      setTarget({ id: customer.id, name: customer.name });
      setOpen('delete');
    });
    if (!opened) return;
    remember(returnTo, from);
    setNotice(null);
  }

  /** The row is gone with the customer: focus goes to the page heading once the list has been read again. */
  function forgetRow(): void {
    remember(returnTo, null);
    remember(opener, null);
    setOpen(null);
  }

  /** The server deleted the customer: close, say so, read the list again. */
  function onDeleted(deleted: DeleteTarget): void {
    forgetRow();
    setNotice(customerDeletedNotice(deleted.name));
    void readAgain(true);
  }

  /** The customer was deleted elsewhere (404): close, say so, read the list again (QLT-06). */
  function onGone(gone: DeleteTarget): void {
    forgetRow();
    setNotice(customerGoneNotice(gone.name));
    void readAgain(true);
  }

  /** An open estimate began to use the customer since the list was read: show the refusal, and read the list again behind it. */
  function onBlocked(named: EstimateUsesRow): void {
    setUses(named);
    setOpen('blocked');
    void readAgain(false);
  }

  return { open, setOpen, target, uses, loader, pressed, onDelete, onDeleted, onGone, onBlocked };
}

export type CustomerDeleteState = ReturnType<typeof useCustomerDelete>;
