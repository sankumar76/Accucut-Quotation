'use client';

import { CUSTOMER_IN_USE_CODE } from '@/lib/errors';
import type { EstimateUsesRow } from '@/lib/masters/estimate-uses';
import { deleteCustomer } from '@/lib/masters/customers-client';

import {
  DELETE_CONFIRM_CUSTOMER,
  DELETE_KEEP_CUSTOMER,
  deleteCustomerDescription,
  deleteCustomerTitle,
  FAILED_DELETE_CUSTOMER_MESSAGE,
  FAILED_WRITE_BODY,
} from './customer-texts';
import { MasterDeleteDialog, MasterInUseDialog, type DeleteConfirmTexts, type DeleteTarget } from './master-delete-dialogs';

/**
 * The two dialogs of the delete on SCR-12 as one module (STORY-02.07 AC-2, AC-7), so the page fetches them together the first time a Delete button is pressed
 * and keeps them mounted (AQP-188, NFR-009, architecture section 10): the alert dialog is not part of the first load of `/masters/customers`. The screen owns
 * which dialog is open and about which customer; this only draws them, in the customer's words.
 */

/** Which dialog of the delete is open: the confirmation, or the refusal that names the open estimates. */
export type CustomerDeleteKind = 'delete' | 'blocked';

export interface CustomerDeleteDialogsProps {
  readonly open: CustomerDeleteKind | null;
  /** The customer the dialogs are about. It stays set after they close, so the text does not change while the panel fades out. */
  readonly target: DeleteTarget | null;
  /** The open estimates the refusal names. */
  readonly uses: EstimateUsesRow | null;
  readonly onClose: () => void;
  readonly onDeleted: (target: DeleteTarget) => void;
  /** An open estimate began to use the customer since the list was read: the screen shows the refusal with these. */
  readonly onBlocked: (uses: EstimateUsesRow) => void;
  readonly onGone: (target: DeleteTarget) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

const CONFIRM_TEXTS: DeleteConfirmTexts = {
  title: deleteCustomerTitle,
  description: deleteCustomerDescription,
  keep: DELETE_KEEP_CUSTOMER,
  confirm: DELETE_CONFIRM_CUSTOMER,
  failedTitle: FAILED_DELETE_CUSTOMER_MESSAGE,
  failedBody: FAILED_WRITE_BODY,
};

export function CustomerDeleteDialogs({ open, target, uses, onClose, onDeleted, onBlocked, onGone, onCloseAutoFocus }: CustomerDeleteDialogsProps) {
  return (
    <>
      <MasterDeleteDialog
        open={open === 'delete'}
        target={target}
        texts={CONFIRM_TEXTS}
        remove={(id) => deleteCustomer(id)}
        inUseCode={CUSTOMER_IN_USE_CODE}
        onClose={onClose}
        onDeleted={onDeleted}
        onBlocked={onBlocked}
        onGone={onGone}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <MasterInUseDialog open={open === 'blocked'} kind="customer" name={target?.name ?? null} uses={uses} onClose={onClose} onCloseAutoFocus={onCloseAutoFocus} />
    </>
  );
}
