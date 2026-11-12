'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type RefObject } from 'react';

import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import {
  customerEditChanges,
  customerEditProblems,
  editFieldOrder,
  initialRateInputs,
  rateErrorKey,
  RATE_KEY_PREFIX,
  serverEditErrors,
  withoutEditError,
  type EditErrors,
  type RateInputs,
} from '@/lib/masters/customer-form';
import { CUSTOMER_FIELD_NAMES, initialCustomerValues, type CustomerFieldName, type CustomerValues } from '@/lib/masters/customers';
import { updateCustomer, type CustomerRow, type ResetResult } from '@/lib/masters/customers-client';

import { CUSTOMER_FIELD_IDS } from './customer-details-fields';
import type { CustomerResetDialogProps } from './customer-reset-dialog';
import { rateInputId } from './customer-rates-table';
import {
  customerSavedNotice,
  FAILED_SAVE_CUSTOMER_MESSAGE,
  FAILED_WRITE_KEEPS_FORM_BODY,
  NOTHING_TO_SAVE_NOTICE,
  resetNotice,
} from './customer-texts';
import { focusOpener } from './master-opener';
import type { PageNotice } from './master-texts';
import { useDialogOpener } from './use-dialog-opener';

/**
 * What SCR-12's edit page holds and does, apart from how it looks (STORY-02.02 AC-1 to AC-3, AC-8): the customer as the server last sent it, what is
 * typed in the details and in each rate, the messages, the notice, whether the reset dialog is open, and where focus goes. `CustomerEditScreen` only
 * draws it.
 *
 * The page does not read the customer again after a save or a reset: both answer with the customer as it is now (the PATCH and the reset route send the
 * whole customer and its rates), and that answer, which the server wrote in the same transaction, replaces what is on screen. So there is no list read
 * here, no skeleton and no load error; the list is `useCustomers`, built on `useMasterList`.
 *
 * **Focus.** After a refusal it goes to the first control that has a message and never while a person types (`useFocusOnRefusal`, DL-135). After a save that
 * is accepted it goes back to the Save button, which was disabled while the request was out; after one that fails without naming a field it goes to the
 * notice that says so (the pattern of the sign-in form, DEF-032). After the reset dialog
 * closes it returns to the Reset button (Radix returns focus only to a trigger, and this dialog has none).
 */

/** What a failed save says: the title, and the sentence under it. */
export interface SaveFailure {
  readonly title: string;
  readonly body: string | null;
}

/** The reset dialog's code: a bare `import()` that the loader can try again after a failure. */
const loadResetDialog = () => import('./customer-reset-dialog').then((module) => module.CustomerResetDialog);

/** The element id of a control by the key of its message: a detail field by name, a rate by `rate:<ID>`. */
function controlId(key: string): string {
  const field = CUSTOMER_FIELD_NAMES.find((name) => name === key);
  return field === undefined ? rateInputId(key.slice(RATE_KEY_PREFIX.length)) : CUSTOMER_FIELD_IDS[field];
}

/** The reset dialog: whether it is open, and the first-open loader that fetches its code on the first press. */
function useResetDialog() {
  const [open, setOpen] = useState(false);
  const { loader, pressed, opener, press } = useDialogOpener<CustomerResetDialogProps>({ id: 'customer-reset-dialog', load: loadResetDialog });
  return { open, setOpen, loader, pressed, opener, press };
}

/** What the save needs from the page: what is typed, the server's customer, and the ways to show its answer. */
interface SaveContext {
  readonly customer: CustomerRow;
  readonly values: CustomerValues;
  readonly inputs: RateInputs;
  readonly saveButton: RefObject<HTMLButtonElement | null>;
  /** The wrapper of the failed-save notice, which takes focus when a save fails (the pattern of the sign-in form). */
  readonly failureNotice: RefObject<HTMLDivElement | null>;
  readonly setNotice: (notice: PageNotice | null) => void;
  /** Shows the messages of a refusal and moves focus to the first field that has one (`useFocusOnRefusal`). */
  readonly showErrors: (errors: EditErrors) => void;
  /** Replaces what is on screen with the customer the server sent, and refreshes the router's cached copies of the page. */
  readonly adopt: (next: CustomerRow) => void;
}

/**
 * The save: the request, the failure under it and where focus goes afterwards. Nothing is sent when nothing changed (a sentence says so), a refusal that
 * names fields goes to `showErrors`, and any other failure keeps what was typed and says so (ux-spec v0.21, section 6.0).
 */
function useCustomerSave({ customer, values, inputs, saveButton, failureNotice, setNotice, showErrors, adopt }: SaveContext) {
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveFocusRequest, setSaveFocusRequest] = useState(0);

  // The Save button is disabled while the request is out, which takes focus off it; once the save is accepted, focus goes back to it.
  useEffect(() => {
    if (saveFocusRequest > 0) saveButton.current?.focus();
  }, [saveFocusRequest, saveButton]);

  // A save that fails without naming a field moves focus to the notice, once it is in the page (ux-spec SCR-12 "Failed Save", AQP-142 DEF-032).
  useEffect(() => {
    if (failure !== null) failureNotice.current?.focus();
  }, [failure, failureNotice]);

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setFailure(null);
    setNotice(null);
    const found = customerEditProblems(values, customer.rates, inputs);
    showErrors(found);
    if (Object.keys(found).length > 0) return;
    const changes = customerEditChanges(customer, values, inputs);
    // Nothing changed: no request, and a sentence that says so, because nothing was saved.
    if (Object.keys(changes).length === 0) return setNotice(NOTHING_TO_SAVE_NOTICE);
    setSubmitting(true);
    const outcome = await updateCustomer(customer.id, changes);
    setSubmitting(false);
    if (outcome.status === 'ok') {
      adopt(outcome.value);
      setNotice(customerSavedNotice(outcome.value.name));
      return setSaveFocusRequest((count) => count + 1);
    }
    const fromServer = outcome.status === 'refused' ? serverEditErrors(outcome.fields, changes.rates) : {};
    if (Object.keys(fromServer).length > 0) return showErrors(fromServer);
    setFailure(
      outcome.status === 'refused' && outcome.httpStatus === 409
        ? { title: outcome.title, body: null }
        : { title: FAILED_SAVE_CUSTOMER_MESSAGE, body: FAILED_WRITE_KEEPS_FORM_BODY },
    );
  }
  return { failure, clearFailure: () => setFailure(null), submitting, save };
}

/**
 * What is typed and what the server last sent: the customer, the details, every rate and the messages under them. `adopt` replaces all of it with a
 * customer the server sent, and refreshes the router so the browser's Back button, which reuses cached pages, shows what was saved and not the page as it
 * was opened (QLT-02, AQP-142 G6).
 */
function useCustomerFields(initial: CustomerRow) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerRow>(initial);
  const [values, setValues] = useState<CustomerValues>(() => initialCustomerValues(initial));
  const [inputs, setInputs] = useState<RateInputs>(() => initialRateInputs(initial.rates));
  const [errors, setErrors] = useState<EditErrors>({});
  const showErrors = useFocusOnRefusal<string>(editFieldOrder(customer.rates), (key) => document.getElementById(controlId(key))?.focus(), setErrors);

  /** The details are kept when `keepDetails` is set (a reset changes rates only). */
  function adopt(next: CustomerRow, keepDetails = false): void {
    setCustomer(next);
    setInputs(initialRateInputs(next.rates));
    if (!keepDetails) setValues(initialCustomerValues(next));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(RATE_KEY_PREFIX))));
    router.refresh();
  }

  function setField(field: CustomerFieldName, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutEditError(current, field));
  }

  function setRate(processItemId: string, value: string): void {
    setInputs((current) => ({ ...current, [processItemId]: value }));
    setErrors((current) => withoutEditError(current, rateErrorKey(processItemId)));
  }

  return { customer, values, inputs, errors, showErrors, adopt, setField, setRate };
}

/** `saveButton` and `failureNotice` are the screen's refs to its Save button and to the wrapper of the failed-save notice, so the screen can attach them and the save can move focus to them. */
export function useCustomerEdit(initial: CustomerRow, saveButton: RefObject<HTMLButtonElement | null>, failureNotice: RefObject<HTMLDivElement | null>) {
  const { customer, values, inputs, errors, showErrors, adopt, setField, setRate } = useCustomerFields(initial);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const reset = useResetDialog();
  const { failure, clearFailure, submitting, save } = useCustomerSave({ customer, values, inputs, saveButton, failureNotice, setNotice, showErrors, adopt });

  function onReset(byKeyboard: boolean): void {
    const opened = reset.press({ itemId: null, action: 'reset' }, byKeyboard, () => reset.setOpen(true));
    if (!opened) return;
    setNotice(null);
    clearFailure();
  }

  /** The server reset the rates: close, adopt its customer (what was typed in a rate is replaced; the details stay), and say how many were replaced. */
  function onResetDone(result: ResetResult): void {
    reset.setOpen(false);
    adopt(result.customer, true);
    setNotice(resetNotice(result.customer.name, result.count));
  }

  /** Radix returns focus only to a trigger, and this dialog has none: the opener is remembered here. */
  function onCloseAutoFocus(event: Event): void {
    event.preventDefault();
    focusOpener(reset.opener.current);
  }

  return { customer, values, inputs, errors, notice, failure, submitting, reset, setField, setRate, save, onReset, onResetDone, onCloseAutoFocus };
}

export type CustomerEditState = ReturnType<typeof useCustomerEdit>;
