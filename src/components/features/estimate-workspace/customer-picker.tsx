'use client';

import type { ChangeEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import type { CustomerView } from '@/lib/estimates/estimates-client';

import {
  CUSTOMER_HINT,
  CUSTOMER_LABEL,
  CUSTOMER_LOADING,
  CUSTOMER_LOCKED_HINT,
  CUSTOMER_PLACEHOLDER,
  CUSTOMER_SAVED,
  CUSTOMER_TAG,
  FAILED_BODY,
  LOAD_FAILED_TITLE,
  SAVE_FAILED_TITLE,
  TRY_AGAIN,
} from './estimate-texts';
import type { useCustomerChoice } from './use-customer-choice';

/** The id of the control, which the change dialog hands focus back to. */
export const CUSTOMER_FIELD_ID = 'estimate-customer';

type Choice = ReturnType<typeof useCustomerChoice>;

export interface CustomerPickerProps {
  readonly choice: Choice;
  /** False once the estimate is no longer a draft: the field shows the customer and cannot be changed. */
  readonly editable: boolean;
}

/** The list, with the customer the estimate already has put in if it is not on it any more (a customer deleted after it was chosen is still the estimate's). */
function entriesOf(options: ReadonlyArray<CustomerView>, current: CustomerView | null): ReadonlyArray<CustomerView> {
  return current === null || options.some((option) => option.id === current.id) ? options : [current, ...options];
}

/**
 * The Customer field of SCR-05 (STORY-05.01 AC-2, AC-3): a drop-down of the active customers by name, with "Choose this first" beside the label and the hint
 * that changing it later asks to confirm. It sends an ID and a name and asks for nothing else; no rate or contact detail is requested or drawn. The choice is
 * the server's: the field shows the customer the server last confirmed, and a refusal is put under it in the server's words.
 */
export function CustomerPicker({ choice, editable }: CustomerPickerProps) {
  const { options, current, pending, saving, saved, problem } = choice;
  const ready = editable && options.status === 'ready';
  const shown = current?.id ?? (saving ? (pending?.id ?? '') : '');
  const list = ready ? entriesOf(options.options, current) : current === null ? [] : [current];
  const fieldError = problem?.kind === 'field' ? problem.message : undefined;
  const hint = editable ? CUSTOMER_HINT : CUSTOMER_LOCKED_HINT;

  return (
    <Card>
      <CardContent className="flex flex-col gap-s-4">
        {editable && options.status === 'failed' ? (
          <Notice tone="danger" title={LOAD_FAILED_TITLE}>
            <p>{FAILED_BODY}</p>
            <Button variant="secondary" className="mt-s-2" onClick={choice.readAgain}>
              {TRY_AGAIN}
            </Button>
          </Notice>
        ) : null}
        {editable && problem !== null && problem.kind !== 'field' && !choice.dialogOpen ? (
          <Notice tone="danger" title={problem.kind === 'refused' ? problem.message : SAVE_FAILED_TITLE}>
            {problem.kind === 'refused' ? null : FAILED_BODY}
          </Notice>
        ) : null}
        <div className="max-w-md">
          <FormField
            id={CUSTOMER_FIELD_ID}
            label={CUSTOMER_LABEL}
            tag={<span className="font-normal text-ink-3">{` ${CUSTOMER_TAG}`}</span>}
            hint={hint}
            {...(fieldError === undefined ? {} : { error: fieldError })}
          >
            {(control) => (
              <NativeSelect
                {...control}
                name="customerId"
                required
                disabled={!ready}
                aria-busy={saving || undefined}
                value={shown}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => choice.select(event.target.value)}
              >
                <option value="">{editable && options.status === 'loading' ? CUSTOMER_LOADING : CUSTOMER_PLACEHOLDER}</option>
                {list.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>
        <p role="status" className="text-label font-semibold text-ink">
          {saved ? CUSTOMER_SAVED : ''}
        </p>
      </CardContent>
    </Card>
  );
}
