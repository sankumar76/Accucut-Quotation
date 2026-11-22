'use client';

import { useEffect, useState, type ChangeEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/cn';
import { chooseCustomer, loadCustomerChoices, type CustomerView } from '@/lib/estimates/estimates-client';

import { CHANGE_CUSTOMER_FIELD_ID } from './customer-ids';
import {
  changeDescription,
  CHANGE_LABEL,
  CHANGE_TITLE,
  CHANGING_LABEL,
  CHOOSE_ANOTHER_MESSAGE,
  CLOSE_LABEL,
  FAILED_BODY,
  keepLabel,
  LOAD_FAILED_TITLE,
  LOADING_CUSTOMERS,
  NEW_CUSTOMER_LABEL,
  NEW_CUSTOMER_PLACEHOLDER,
  SAVE_FAILED_TITLE,
  SET_LABEL,
  SET_TITLE,
  TRY_AGAIN,
} from './customer-texts';

/**
 * "Change the customer?" on SCR-06 (STORY-05.01 AC-4, moved from SCR-05 by CR-01 item 6, AQP-390; UX spec SCR-06 state `changecust`): an alert dialog a Lead or an Admin opens on an estimate that is not approved. It
 * lists the customers (read from the assign context when it opens: names and short names only), takes the new one, and says what changes and what does not before anything is sent: nothing typed is lost, the new
 * customer's rates apply at the next Recalculate, and the change is logged. It is an AlertDialog, so focus starts on the safe choice, "Keep <current>", and Escape closes it with nothing sent. The request stays out
 * until the server answers; the dialog closes then (the page is drawn again by the button), and a refusal or a failure keeps it open with the reason and everything as it was. It is fetched on the first press of
 * the button and is **not** in the first load of the page (NFR-009, ADR-016).
 *
 * The server decides everything (the role, the state of the estimate, whether the customer exists); the dialog only shows its answer.
 */

export interface ChangeCustomerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly estimateId: string;
  /** The customer the estimate has now, or null for one made before CR-01 that has none. */
  readonly current: CustomerView | null;
  /** The change worked: the page is drawn again and shows the new customer. */
  readonly onChanged: () => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type Choices =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly options: ReadonlyArray<CustomerView> }
  | { readonly status: 'failed' };

/** What a change that did not go through left: the message under the field, the sentence the server gave for a refusal of the state, or nothing but "it failed". */
type Problem =
  | { readonly kind: 'field'; readonly message: string }
  | { readonly kind: 'refused'; readonly message: string }
  | { readonly kind: 'failed' };

/** A long customer name wraps inside the button, so a 360 px phone never scrolls sideways. */
const WRAPPING_BUTTON = cn('h-auto min-h-(--control-h) py-s-2 leading-snug whitespace-normal', BREAK_LONG_NAMES);

/** What the dialog holds and what pressing "Change customer" does. */
function useChangeCustomer({ estimateId, current, onChanged }: Pick<ChangeCustomerDialogProps, 'estimateId' | 'current' | 'onChanged'>) {
  const [choices, setChoices] = useState<Choices>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCustomerChoices().then((outcome) => {
      if (!cancelled) setChoices(outcome.status === 'ok' ? { status: 'ready', options: outcome.value } : { status: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const chosen = choices.status === 'ready' ? choices.options.find((option) => option.id === selected) : undefined;

  /** "Change customer": nothing is sent for no choice or for the customer the estimate already has. */
  async function confirm(): Promise<void> {
    if (saving || chosen === undefined) return;
    if (chosen.id === current?.id) return setProblem({ kind: 'field', message: CHOOSE_ANOTHER_MESSAGE });
    setSaving(true);
    setProblem(null);
    const outcome = await chooseCustomer(estimateId, chosen.id);
    setSaving(false);
    if (outcome.status === 'ok') return onChanged();
    const fieldMessage = outcome.status === 'refused' ? outcome.fields['customerId'] : undefined;
    if (fieldMessage !== undefined) return setProblem({ kind: 'field', message: fieldMessage });
    setProblem(outcome.status === 'refused' && outcome.httpStatus === 409 ? { kind: 'refused', message: outcome.title } : { kind: 'failed' });
  }

  function choose(id: string): void {
    setSelected(id);
    setProblem(null);
  }

  function readAgain(): void {
    setChoices({ status: 'loading' });
    setAttempt((count) => count + 1);
  }

  return { choices, selected, chosen, saving, problem, choose, confirm, readAgain };
}

export function ChangeCustomerDialog({ open, onOpenChange, estimateId, current, onChanged, onCloseAutoFocus }: ChangeCustomerDialogProps) {
  const change = useChangeCustomer({ estimateId, current, onChanged });
  const { choices, chosen, saving, problem } = change;
  const fieldError = problem?.kind === 'field' ? problem.message : undefined;
  const options = choices.status === 'ready' ? choices.options : [];

  return (
    // The dialog cannot be dismissed while a request is under way: the answer would have no place to go.
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        // What was picked is not kept for the next time the dialog opens.
        if (!next) change.choose('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{current === null ? SET_TITLE : CHANGE_TITLE}</AlertDialogTitle>
          <AlertDialogDescription className={BREAK_LONG_NAMES}>
            {chosen === undefined ? '' : changeDescription(current === null ? null : current.name, chosen.name)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {choices.status === 'failed' ? (
          <Notice tone="danger" title={LOAD_FAILED_TITLE}>
            <p>{FAILED_BODY}</p>
            <Button variant="secondary" className="mt-s-2" onClick={change.readAgain}>
              {TRY_AGAIN}
            </Button>
          </Notice>
        ) : null}
        {problem !== null && problem.kind !== 'field' ? (
          <Notice tone="danger" title={problem.kind === 'refused' ? problem.message : SAVE_FAILED_TITLE}>
            {problem.kind === 'refused' ? null : FAILED_BODY}
          </Notice>
        ) : null}
        <FormField id={CHANGE_CUSTOMER_FIELD_ID} label={NEW_CUSTOMER_LABEL} {...(fieldError === undefined ? {} : { error: fieldError })}>
          {(control) => (
            <NativeSelect
              {...control}
              name="customerId"
              required
              disabled={choices.status !== 'ready' || saving}
              aria-busy={saving || undefined}
              value={change.selected}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => change.choose(event.target.value)}
            >
              <option value="">{choices.status === 'loading' ? LOADING_CUSTOMERS : NEW_CUSTOMER_PLACEHOLDER}</option>
              {options.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {`${customer.name} (${customer.shortName})`}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <AlertDialogFooter>
          <AlertDialogCancel className={WRAPPING_BUTTON}>{current === null ? CLOSE_LABEL : keepLabel(current.name)}</AlertDialogCancel>
          <Button className={WRAPPING_BUTTON} loading={saving} disabled={chosen === undefined} onClick={() => void change.confirm()}>
            {saving ? CHANGING_LABEL : current === null ? SET_LABEL : CHANGE_LABEL}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
