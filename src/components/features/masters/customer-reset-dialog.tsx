'use client';

import { useState } from 'react';

import { Notice } from '@/components/shared/notice';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { differsFromDefault } from '@/lib/masters/customers';
import { resetCustomerRates, type CustomerRow, type ResetResult } from '@/lib/masters/customers-client';

import {
  rateWords,
  RESET_CONFIRM,
  RESET_FAILED_MESSAGE,
  RESET_KEEP,
  resetDescription,
  resetTitle,
  RESETTING,
  FAILED_WRITE_BODY,
} from './customer-texts';
import { BREAK_LONG_NAMES } from './master-texts';

/**
 * The reset dialog of SCR-12 (STORY-02.02 AC-3, AC-8): "Reset <customer> to defaults?". It is an alert dialog, because the action replaces values; focus
 * starts on the safe choice ("Keep current rates"), and Escape closes it with nothing sent. It **names the rates that will be replaced**, each with the value
 * the customer has now, from the customer as the server last sent it. The request stays out until the server has answered, and the dialog closes then,
 * handing the screen the customer as it is now and how many rates were replaced. A failed reset keeps the dialog open with the sentence for a write
 * with nothing typed, which never says "Nothing was changed." (ux-spec v0.21, section 6.0).
 */

export interface CustomerResetDialogProps {
  readonly open: boolean;
  readonly customer: CustomerRow;
  readonly onClose: () => void;
  /** Called after the server reset the rates. */
  readonly onReset: (result: ResetResult) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** The request of the confirmation and what it left: it is out, or it failed in a way the person can try again. */
function useResetRequest(customer: CustomerRow, onReset: CustomerResetDialogProps['onReset']) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function reset(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    const outcome = await resetCustomerRates(customer.id);
    setSubmitting(false);
    if (outcome.status === 'ok') return onReset(outcome.value);
    setFailed(true);
  }

  return { submitting, failed, clearFailure: () => setFailed(false), reset };
}

function ResetBody({ customer, request }: { readonly customer: CustomerRow; readonly request: ReturnType<typeof useResetRequest> }) {
  const differing = customer.rates.filter(differsFromDefault);
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className={BREAK_LONG_NAMES}>{resetTitle(customer.name)}</AlertDialogTitle>
        <AlertDialogDescription>{resetDescription(customer.rates.length, differing.length)}</AlertDialogDescription>
      </AlertDialogHeader>
      {differing.length === 0 ? null : (
        <ul aria-label="Rates that will be replaced" className="flex max-h-60 flex-col gap-s-1 overflow-y-auto pl-s-5 text-body list-disc">
          {differing.map((rate) => (
            <li key={rate.processItemId} className={BREAK_LONG_NAMES}>
              {rate.name} <span className="tabular-nums">{rateWords(rate, rate.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {request.failed ? (
        <Notice tone="danger" title={RESET_FAILED_MESSAGE}>
          {FAILED_WRITE_BODY}
        </Notice>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel>{RESET_KEEP}</AlertDialogCancel>
        <AlertDialogAction
          disabled={request.submitting}
          aria-busy={request.submitting || undefined}
          onClick={(event) => {
            // Stay open while the request is out: the dialog closes when the server has answered, not before.
            event.preventDefault();
            void request.reset();
          }}
        >
          {request.submitting ? RESETTING : RESET_CONFIRM}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export function CustomerResetDialog({ open, customer, onClose, onReset, onCloseAutoFocus }: CustomerResetDialogProps) {
  const request = useResetRequest(customer, onReset);
  const onOpenChange = (next: boolean): void => {
    if (next) return;
    request.clearFailure();
    onClose();
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <ResetBody customer={customer} request={request} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
