'use client';

import { Plus } from 'lucide-react';
import { useRef } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { CustomerSummaryRow } from '@/lib/masters/customers-client';

import { CustomerResults } from './customer-results';
import {
  ADD_CUSTOMER,
  CUSTOMER_SEARCH_LABEL,
  CUSTOMER_SEARCH_PLACEHOLDER,
  CUSTOMERS_DESCRIPTION,
  CUSTOMERS_TITLE,
} from './customer-texts';
import { MasterDialogsFailed } from './master-dialogs-failed';
import { isOpener } from './master-opener';
import { MasterSearchBox } from './master-search-box';
import { BREAK_LONG_NAMES, FAILED_CONFIRMATION_TITLE, FAILED_DIALOGS_TITLE } from './master-texts';
import { useCustomers, type CustomersState } from './use-customers';

/**
 * SCR-12 "Customer master", the list (STORY-02.02 AC-1, AC-8). It lays out the page and hands everything else to `useCustomers`: the list the server
 * rendered, the search by name, the Add customer dialog and the notice under the header. It decides nothing: every rule (a name that is free, an
 * e-mail address that looks like one, the rates a new customer starts with, the audit entry) is the server's, and this screen puts the server's reason
 * where the person can read it. After an add it asks the server for the list again, so the order and the counts on screen are the server's.
 *
 * The dialog is not in the first load of the page (NFR-009): it is fetched the first time the button opens it, through the shared first-open loader
 * (architecture section 10, AQP-188). Focus returns to the button that opened it, or to the heading when that button is gone. There is deliberately no
 * `loading.tsx` beside the page (it would turn the 403 of a refused role into a streamed 200, TD-06): the first paint already holds the list, and the
 * loading state is the list being read again.
 */

export interface CustomerScreenProps {
  readonly initialItems: ReadonlyArray<CustomerSummaryRow>;
}

function AddCustomerButton({ customers }: { readonly customers: CustomersState }) {
  const { dialog } = customers;
  const busy = isOpener(dialog.pressed, null, 'add') && dialog.loader.pending;
  return (
    <Button data-action="add" {...(busy ? { 'aria-busy': true } : {})} onClick={(event) => customers.onAdd(event.detail === 0)}>
      <Icon icon={Plus} />
      {ADD_CUSTOMER}
    </Button>
  );
}

export function CustomerScreen({ initialItems }: CustomerScreenProps) {
  const customers = useCustomers(initialItems);
  const { list, dialog, remove, notice } = customers;
  const search = useRef<HTMLInputElement>(null);
  const Dialog = dialog.loader.shown ? dialog.loader.Overlay : null;
  const DeleteDialogs = remove.loader.shown ? remove.loader.Overlay : null;

  return (
    <>
      <PageHeader title={CUSTOMERS_TITLE} description={CUSTOMERS_DESCRIPTION} actions={<AddCustomerButton customers={customers} />} />
      {dialog.loader.failed ? <MasterDialogsFailed title={FAILED_DIALOGS_TITLE} /> : null}
      {remove.loader.failed ? <MasterDialogsFailed title={FAILED_CONFIRMATION_TITLE} /> : null}
      {notice === null ? null : (
        <Notice tone={notice.tone} role="status" className={BREAK_LONG_NAMES} {...(notice.title === undefined ? {} : { title: notice.title })}>
          {notice.text}
        </Notice>
      )}
      <Card aria-busy={list.status === 'loading' || undefined}>
        <MasterSearchBox
          id="customer-search"
          label={CUSTOMER_SEARCH_LABEL}
          placeholder={CUSTOMER_SEARCH_PLACEHOLDER}
          query={list.query}
          onChange={list.setQuery}
          inputRef={search}
        />
        <CustomerResults customers={customers} changeSaved={notice !== null} />
      </Card>
      {Dialog === null ? null : (
        <Dialog open={dialog.open} onClose={() => dialog.setOpen(false)} onSaved={customers.onSaved} onCloseAutoFocus={customers.onCloseAutoFocus} />
      )}
      {DeleteDialogs === null ? null : (
        <DeleteDialogs
          open={remove.open}
          target={remove.target}
          uses={remove.uses}
          onClose={() => remove.setOpen(null)}
          onDeleted={remove.onDeleted}
          onBlocked={remove.onBlocked}
          onGone={remove.onGone}
          onCloseAutoFocus={customers.onCloseAutoFocus}
        />
      )}
    </>
  );
}
