'use client';

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { UnitInput } from '@/components/shared/unit-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  editChanges,
  FIELD_NAMES,
  formProblems,
  initialValues,
  newRateBody,
  withoutError,
  type FieldErrors,
  type FieldName,
  type FormValues,
} from '@/lib/masters/process-form';
import { NAME_HINT, PROCESS_UNITS, unitLabel, valueSymbol } from '@/lib/masters/process-items';
import { createProcessItem, updateProcessItem, type ProcessItemRow } from '@/lib/masters/process-items-client';

import { ADD_RATE, FAILED_ADD_MESSAGE, FAILED_EDIT_MESSAGE, TRY_AGAIN_BODY } from './process-texts';

/**
 * The "Add rate" and "Edit" dialogs of SCR-11 (STORY-02.01 AC-2, AC-3, AC-7). Add: name, unit and default value. Edit: the same three,
 * starting from the rate's own. The dialog only collects and shows; the server decides. A refusal comes back with its reason and is
 * put under the field it names: a name that is taken or unsafe under the name, a value that is not a number under the value. Nothing
 * typed is cleared by a refusal. The first focus is the first field, and Escape or Cancel closes it with nothing sent. An edit that
 * changes nothing closes with no request and no message. An edit of a rate that was deleted elsewhere (404) is the screen's: it closes
 * the dialog and says so (QLT-06). The checks and the changes are pure and live in `src/lib/masters/process-form.ts`.
 */

export interface ProcessFormDialogProps {
  readonly open: boolean;
  /** `null` adds a rate; a rate edits it. */
  readonly item: ProcessItemRow | null;
  readonly onClose: () => void;
  /** Called with the saved rate after the server accepted the change. */
  readonly onSaved: (saved: ProcessItemRow, kind: 'added' | 'edited') => void;
  /** Called when the server said the rate being edited no longer exists. */
  readonly onGone: (item: ProcessItemRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type FormProps = Pick<ProcessFormDialogProps, 'item' | 'onClose' | 'onSaved' | 'onGone'>;
type SaveOutcome = Awaited<ReturnType<typeof updateProcessItem>>;

/** The request for what was typed, or null for an edit that changes nothing. */
function requestFor(item: ProcessItemRow | null, values: FormValues): (() => Promise<SaveOutcome>) | null {
  if (item === null) return () => createProcessItem(newRateBody(values));
  const changes = editChanges(item, values);
  return Object.keys(changes).length === 0 ? null : () => updateProcessItem(item.id, changes);
}

/** The messages the server gave for the fields this form has, and nothing for any other field. */
function serverErrors(fields: Readonly<Record<string, string>>): FieldErrors {
  return Object.fromEntries(FIELD_NAMES.flatMap((field) => (fields[field] === undefined ? [] : [[field, fields[field]]])));
}

/** After a refusal, focus goes to the first field with a message (SCR-11, UX spec section 6.0 "Forms"). */
function useFocusFirstError(errors: FieldErrors) {
  const name = useRef<HTMLInputElement>(null);
  const unit = useRef<HTMLSelectElement>(null);
  const defaultValue = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const first = FIELD_NAMES.find((field) => errors[field] !== undefined);
    const target = first === 'name' ? name : first === 'unit' ? unit : first === 'defaultValue' ? defaultValue : null;
    target?.current?.focus();
  }, [errors]);
  return { name, unit, defaultValue };
}

/** What the form holds, what it was told, and what pressing Add or Save does. */
function useProcessForm({ item, onClose, onSaved, onGone }: FormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(item));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const refs = useFocusFirstError(errors);

  const setField = (field: FieldName) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutError(current, field));
  };

  /** Shows the server's answer to an add or an edit. */
  function finish(outcome: SaveOutcome): void {
    setSubmitting(false);
    if (outcome.status === 'ok') return onSaved(outcome.value, item === null ? 'added' : 'edited');
    if (outcome.status === 'refused' && outcome.httpStatus === 404 && item !== null) return onGone(item);
    const fromServer = outcome.status === 'refused' ? serverErrors(outcome.fields) : {};
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    setErrors(fromServer);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const found = formProblems(values, item);
    setErrors(found);
    setFailed(false);
    if (Object.keys(found).length > 0) return;
    const request = requestFor(item, values);
    // Nothing changed: close with no request and no message, because nothing was saved.
    if (request === null) return onClose();
    setSubmitting(true);
    finish(await request());
  }

  return { values, errors, failed, submitting, refs, setField, submit };
}

type ProcessFormState = ReturnType<typeof useProcessForm>;

/** The three fields: the rate's name, its unit and its default value. */
function RateFields({ form }: { readonly form: ProcessFormState }) {
  const { values, errors, refs, setField } = form;
  const error = (field: FieldName) => (errors[field] === undefined ? {} : { error: errors[field] });
  const input = (ref: RefObject<HTMLInputElement | null>, field: FieldName) => ({
    ref,
    name: field,
    autoComplete: 'off',
    required: true,
    value: values[field],
    onChange: (event: { target: { value: string } }) => setField(field)(event.target.value),
  });
  return (
    <>
      <FormField id="rate-name" label="Rate name" hint={NAME_HINT} {...error('name')}>
        {(control) => <Input {...control} {...input(refs.name, 'name')} />}
      </FormField>
      <FormField id="rate-unit" label="Unit" {...error('unit')}>
        {(control) => (
          <NativeSelect {...control} ref={refs.unit} name="unit" required value={values.unit} onChange={(event) => setField('unit')(event.target.value)}>
            <option value="" disabled>
              Choose a unit
            </option>
            {PROCESS_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unitLabel(unit)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField id="rate-default" label="Default value" {...error('defaultValue')}>
        {(control) => <UnitInput {...control} {...input(refs.defaultValue, 'defaultValue')} unit={valueSymbol(values.unit)} inputMode="decimal" />}
      </FormField>
    </>
  );
}

/** The form inside the panel. It mounts when the dialog opens and goes when it closes, so every opening starts from the rate's own values. */
function ProcessForm(props: FormProps) {
  const form = useProcessForm(props);
  const adding = props.item === null;
  return (
    <form noValidate onSubmit={(event) => void form.submit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle className="[overflow-wrap:anywhere]">{adding ? ADD_RATE : `Edit ${props.item?.name ?? ''}`}</DialogTitle>
      </DialogHeader>
      {form.failed ? (
        <Notice tone="danger" title={adding ? FAILED_ADD_MESSAGE : FAILED_EDIT_MESSAGE}>
          {TRY_AGAIN_BODY}
        </Notice>
      ) : null}
      <RateFields form={form} />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={form.submitting}>
          {form.submitting ? (adding ? 'Adding rate' : 'Saving') : adding ? ADD_RATE : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ProcessFormDialog({ open, item, onClose, onSaved, onGone, onCloseAutoFocus }: ProcessFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <ProcessForm item={item} onClose={onClose} onSaved={onSaved} onGone={onGone} />
      </DialogContent>
    </Dialog>
  );
}
