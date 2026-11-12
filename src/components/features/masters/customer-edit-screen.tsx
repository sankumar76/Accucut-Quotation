'use client';

import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRef, type RefObject } from 'react';

import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { differCount } from '@/lib/masters/customers';
import type { CustomerRow } from '@/lib/masters/customers-client';

import { CustomerDetailsFields } from './customer-details-fields';
import { CustomerRatesTable } from './customer-rates-table';
import {
  BREADCRUMB_LABEL,
  CANCEL_EDIT,
  CUSTOMERS_TITLE,
  DETAILS_TITLE,
  editDescription,
  RATES_HINT,
  RATES_TITLE,
  RESET_ACTION,
  SAVE_CUSTOMER,
  SAVING_CUSTOMER,
} from './customer-texts';
import { MasterDialogsFailed } from './master-dialogs-failed';
import { isOpener } from './master-opener';
import { BREAK_LONG_NAMES, FAILED_DIALOGS_TITLE } from './master-texts';
import { useCustomerEdit, type CustomerEditState } from './use-customer-edit';

/**
 * SCR-12 "Customer master", the edit page (STORY-02.02 AC-1 to AC-3, AC-8): the Details card, the rates of this customer against the defaults, Save
 * customer, and Reset to defaults with its confirmation. It lays out the page and hands everything else to `useCustomerEdit`. It decides nothing: every
 * rule (a name that is free, an e-mail address that looks like one, a rate that is a whole number for a percent item, the audit entry) is the server's,
 * and this screen puts the server's reason under the control it names. A save that changes nothing sends nothing and says so.
 *
 * The reset dialog is not in the first load of the page (NFR-009): it is fetched the first time the button opens it, through the shared first-open
 * loader (architecture section 10, AQP-188).
 */

export interface CustomerEditScreenProps {
  readonly initial: CustomerRow;
}

function Breadcrumb({ name }: { readonly name: string }) {
  return (
    <nav aria-label={BREADCRUMB_LABEL} className="flex flex-wrap items-center gap-s-2 text-body">
      <Link href="/masters/customers" className="text-primary-ink underline-offset-2 hover:underline">
        {CUSTOMERS_TITLE}
      </Link>
      <span aria-hidden="true" className="text-ink-3">
        /
      </span>
      <span aria-current="page" className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>
        {name}
      </span>
    </nav>
  );
}

function ResetButton({ edit }: { readonly edit: CustomerEditState }) {
  const busy = isOpener(edit.reset.pressed, null, 'reset') && edit.reset.loader.pending;
  return (
    <Button variant="secondary" data-action="reset" {...(busy ? { 'aria-busy': true } : {})} onClick={(event) => edit.onReset(event.detail === 0)}>
      <Icon icon={RotateCcw} />
      {RESET_ACTION}
    </Button>
  );
}

function Notices({ edit }: { readonly edit: CustomerEditState }) {
  const { notice, failure } = edit;
  return (
    <>
      {edit.reset.loader.failed ? <MasterDialogsFailed title={FAILED_DIALOGS_TITLE} /> : null}
      {failure === null ? null : (
        <Notice tone="danger" title={failure.title}>
          {failure.body}
        </Notice>
      )}
      {notice === null ? null : (
        <Notice tone={notice.tone} role="status" className={BREAK_LONG_NAMES} {...(notice.title === undefined ? {} : { title: notice.title })}>
          {notice.text}
        </Notice>
      )}
    </>
  );
}

function DetailsCard({ edit }: { readonly edit: CustomerEditState }) {
  return (
    <Card aria-labelledby="customer-details-title">
      <CardHeader>
        <CardTitle id="customer-details-title">{DETAILS_TITLE}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-s-4 md:grid-cols-2">
        <CustomerDetailsFields values={edit.values} errors={edit.errors} onChange={edit.setField} />
      </CardContent>
    </Card>
  );
}

function RatesCard({ edit, saveButton }: { readonly edit: CustomerEditState; readonly saveButton: RefObject<HTMLButtonElement | null> }) {
  const { customer } = edit;
  return (
    <Card aria-labelledby="customer-rates-title">
      <CardHeader>
        <CardTitle id="customer-rates-title">{RATES_TITLE}</CardTitle>
        <span className="ml-auto text-label text-ink-2">{RATES_HINT}</span>
      </CardHeader>
      <CustomerRatesTable customerName={customer.name} rates={customer.rates} inputs={edit.inputs} errors={edit.errors} onChange={edit.setRate} />
      <CardFooter className="justify-between">
        <Button variant="secondary" asChild>
          <Link href="/masters/customers">{CANCEL_EDIT}</Link>
        </Button>
        <Button ref={saveButton} type="submit" loading={edit.submitting}>
          {edit.submitting ? SAVING_CUSTOMER : SAVE_CUSTOMER}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function CustomerEditScreen({ initial }: CustomerEditScreenProps) {
  const saveButton = useRef<HTMLButtonElement>(null);
  const edit = useCustomerEdit(initial, saveButton);
  const { customer, reset } = edit;
  const Dialog = reset.loader.shown ? reset.loader.Overlay : null;

  return (
    <>
      <Breadcrumb name={customer.name} />
      <PageHeader title={customer.name} description={editDescription(differCount(customer.rates))} actions={<ResetButton edit={edit} />} />
      <Notices edit={edit} />
      <form noValidate onSubmit={(event) => void edit.save(event)} className="flex flex-col gap-s-5">
        <DetailsCard edit={edit} />
        <RatesCard edit={edit} saveButton={saveButton} />
      </form>
      {Dialog === null ? null : (
        <Dialog open={reset.open} customer={customer} onClose={() => reset.setOpen(false)} onReset={edit.onResetDone} onCloseAutoFocus={edit.onCloseAutoFocus} />
      )}
    </>
  );
}
