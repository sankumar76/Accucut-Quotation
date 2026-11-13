'use client';

import { useState, type FormEvent } from 'react';

import { Notice } from '@/components/shared/notice';
import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  customerBody,
  customerFormProblems,
  CUSTOMER_FIELD_NAMES,
  initialCustomerValues,
  withoutCustomerError,
  type CustomerErrors,
  type CustomerFieldName,
  type CustomerValues,
} from '@/lib/masters/customers';
import { createCustomer, type CustomerRow } from '@/lib/masters/customers-client';

import { CUSTOMER_FIELD_IDS, CustomerDetailsFields } from './customer-details-fields';
import { ADD_CUSTOMER, ADDING_CUSTOMER, CANCEL_EDIT, FAILED_ADD_CUSTOMER_MESSAGE, FAILED_WRITE_KEEPS_FORM_BODY } from './customer-texts';

/**
 * The "Add customer" dialog of SCR-12 (STORY-02.02 AC-1, AC-8). The four fields of the details; every rate starts at the current default, which the
 * server copies (SPEC section 4.2 rule 1), and the rates are changed on the customer's own page afterwards. The dialog only collects and shows; the
 * server decides. A refusal comes back with its reason and is put under the field it names: a name that is taken under Customer name, an e-mail address
 * that does not look like one under E-mail. Nothing typed is cleared by a refusal. The first focus is the first field, and Escape or Cancel closes it with
 * nothing sent. Focus moves to a field only after a refusal, never while a person types (DL-135). The checks are pure and live in `src/lib/masters/customers.ts`.
 */

export interface CustomerFormDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Called with the new customer after the server accepted it. */
  readonly onSaved: (created: CustomerRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type FormProps = Pick<CustomerFormDialogProps, 'onSaved'>;
type SaveOutcome = Awaited<ReturnType<typeof createCustomer>>;

/** The messages the server gave for the fields this form has, and nothing for any other field. */
function serverErrors(fields: Readonly<Record<string, string>>): CustomerErrors {
  return Object.fromEntries(CUSTOMER_FIELD_NAMES.flatMap((field) => (fields[field] === undefined ? [] : [[field, fields[field]]])));
}

/** What the form holds, what it was told, and what pressing Add customer does. */
function useCustomerForm({ onSaved }: FormProps) {
  const [values, setValues] = useState<CustomerValues>(() => initialCustomerValues(null));
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // After a refusal, focus goes to the first field with a message (ux-spec section 6.0 "Forms"), and never while a person types (DEF-024).
  const showErrors = useFocusOnRefusal(CUSTOMER_FIELD_NAMES, (field) => document.getElementById(CUSTOMER_FIELD_IDS[field])?.focus(), setErrors);

  const setField = (field: CustomerFieldName, value: string): void => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutCustomerError(current, field));
  };

  /** Shows the server's answer to an add. */
  function finish(outcome: SaveOutcome): void {
    setSubmitting(false);
    if (outcome.status === 'ok') return onSaved(outcome.value);
    const fromServer = outcome.status === 'refused' ? serverErrors(outcome.fields) : {};
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    showErrors(fromServer);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const found = customerFormProblems(values);
    showErrors(found);
    setFailed(false);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    finish(await createCustomer(customerBody(values)));
  }

  return { values, errors, failed, submitting, setField, submit };
}

/** The form inside the panel. It mounts when the dialog opens and goes when it closes, so every opening starts empty. */
function CustomerForm(props: FormProps) {
  const form = useCustomerForm(props);
  return (
    <form noValidate onSubmit={(event) => void form.submit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle>{ADD_CUSTOMER}</DialogTitle>
      </DialogHeader>
      {form.failed ? (
        <Notice tone="danger" title={FAILED_ADD_CUSTOMER_MESSAGE}>
          {FAILED_WRITE_KEEPS_FORM_BODY}
        </Notice>
      ) : null}
      <div className="grid gap-s-4">
        <CustomerDetailsFields values={form.values} errors={form.errors} onChange={form.setField} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">{CANCEL_EDIT}</Button>
        </DialogClose>
        <Button type="submit" loading={form.submitting}>
          {form.submitting ? ADDING_CUSTOMER : ADD_CUSTOMER}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CustomerFormDialog({ open, onClose, onSaved, onCloseAutoFocus }: CustomerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <CustomerForm onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
