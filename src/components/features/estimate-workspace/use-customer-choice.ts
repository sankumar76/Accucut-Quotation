'use client';

import { useEffect, useState } from 'react';

import { chooseCustomer, loadCustomerOptions, type CustomerView } from '@/lib/estimates/estimates-client';

type OptionsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly options: ReadonlyArray<CustomerView> }
  | { readonly status: 'failed' };

/** What a save that did not go through left: the sentence the server gave for a refusal of the state, a message for the field, or nothing but "it failed". */
export type SaveProblem =
  | { readonly kind: 'field'; readonly message: string }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'failed' };

export interface CustomerChoiceArgs {
  readonly estimateId: string;
  /** The customer the estimate has when the page opens: null until one is chosen. */
  readonly initial: CustomerView | null;
  /** False once the estimate is no longer a draft: the list is not even read. */
  readonly editable: boolean;
}

/**
 * What the customer field holds and what choosing does (STORY-05.01 AC-2 to AC-5). The list is read from `GET /api/v1/options/customers` when the field
 * appears. The first choice is sent at once; a choice made while a customer is already chosen is only *held* (`pending`, `dialogOpen`) until the person confirms it in the
 * dialog, and cancelling drops it with nothing sent, so the revision is not raised. The same customer again sends nothing. A refusal or a failure keeps
 * everything the person typed: the field still shows the customer the server last confirmed. Focus is not moved here (DL-135); the dialog hands it back.
 */
export function useCustomerChoice({ estimateId, initial, editable }: CustomerChoiceArgs) {
  const [options, setOptions] = useState<OptionsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [current, setCurrent] = useState<CustomerView | null>(initial);
  // The customer waiting for a yes, and whether its dialog is open: the dialog keeps its words while it fades out, so `pending` is not cleared on close.
  const [pending, setPending] = useState<CustomerView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);

  useEffect(() => {
    if (!editable) return undefined;
    let cancelled = false;
    void loadCustomerOptions().then((outcome) => {
      if (!cancelled) setOptions(outcome.status === 'ok' ? { status: 'ready', options: outcome.value } : { status: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, editable]);

  async function save(customer: CustomerView): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    setSaved(false);
    setProblem(null);
    const outcome = await chooseCustomer(estimateId, customer.id);
    setSaving(false);
    if (outcome.status === 'ok') {
      setCurrent(outcome.value);
      setSaved(true);
      return true;
    }
    const fieldMessage = outcome.status === 'refused' ? outcome.fields['customerId'] : undefined;
    if (fieldMessage !== undefined) setProblem({ kind: 'field', message: fieldMessage });
    else setProblem(outcome.status === 'refused' && outcome.httpStatus === 409 ? { kind: 'refused', message: outcome.title } : { kind: 'failed' });
    return false;
  }

  /** The person picked an entry of the list. */
  function select(id: string): void {
    // While a choice is out, a second one is not taken: the field stays enabled so focus stays on it.
    if (saving || options.status !== 'ready' || id === '' || id === current?.id) return;
    const customer = options.options.find((option) => option.id === id);
    if (customer === undefined) return;
    setSaved(false);
    setProblem(null);
    setPending(customer);
    if (current === null) void save(customer);
    else setDialogOpen(true);
  }

  /** "Change customer" in the dialog: the dialog closes when the server has said yes, and stays, with the reason, when it has not. */
  async function confirmChange(): Promise<void> {
    if (pending !== null && (await save(pending))) setDialogOpen(false);
  }

  function cancelChange(): void {
    setDialogOpen(false);
    setProblem(null);
  }

  function readAgain(): void {
    setOptions({ status: 'loading' });
    setAttempt((count) => count + 1);
  }

  return { options, current, pending, dialogOpen, saving, saved, problem, select, confirmChange, cancelChange, readAgain };
}
