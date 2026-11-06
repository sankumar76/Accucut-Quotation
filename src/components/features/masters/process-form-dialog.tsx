'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { UnitInput } from '@/components/shared/unit-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  defaultValueProblem,
  isProcessUnit,
  nameProblem,
  NAME_HINT,
  normaliseDefaultValue,
  PERCENT_UNIT,
  PROCESS_UNITS,
  UNIT_REQUIRED_MESSAGE,
  unitLabel,
} from '@/lib/masters/process-items';
import { createProcessItem, updateProcessItem, type ProcessItemChangesInput, type ProcessItemRow } from '@/lib/masters/process-items-client';

import { ADD_RATE, FAILED_ADD_MESSAGE, FAILED_EDIT_MESSAGE, TRY_AGAIN_BODY } from './process-texts';

/**
 * The "Add rate" and "Edit" dialogs of SCR-11 (STORY-02.01 AC-2, AC-3, AC-7). Add: name, unit and default value. Edit: the same three,
 * starting from the rate's own. The dialog only collects and shows; the server decides. A refusal comes back with its reason and is
 * put under the field it names: a name that is taken or unsafe under the name, a value that is not a number under the value. Nothing
 * typed is cleared by a refusal. The first focus is the first field, and Escape or Cancel closes it with nothing sent. An edit that
 * changes nothing closes with no request and no message.
 */

export interface ProcessFormDialogProps {
  readonly open: boolean;
  /** `null` adds a rate; a rate edits it. */
  readonly item: ProcessItemRow | null;
  readonly onClose: () => void;
  /** Called with the saved rate after the server accepted the change. */
  readonly onSaved: (saved: ProcessItemRow, kind: 'added' | 'edited') => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

interface Values {
  readonly name: string;
  readonly unit: string;
  readonly defaultValue: string;
}

type FieldName = 'name' | 'unit' | 'defaultValue';
type Errors = Readonly<Partial<Record<FieldName, string>>>;

const FIELD_NAMES: ReadonlyArray<FieldName> = ['name', 'unit', 'defaultValue'];
const RUPEE = '₹';

function initialValues(item: ProcessItemRow | null): Values {
  return item === null ? { name: '', unit: '', defaultValue: '' } : { name: item.name, unit: item.unit, defaultValue: item.defaultValue };
}

function problemsOf(values: Values): Errors {
  const found: Partial<Record<FieldName, string>> = {};
  const name = nameProblem(values.name);
  if (name !== null) found.name = name;
  if (!isProcessUnit(values.unit)) found.unit = UNIT_REQUIRED_MESSAGE;
  const value = defaultValueProblem(values.defaultValue);
  if (value !== null) found.defaultValue = value;
  return found;
}

/** What the person changed in an edit, or an empty object for nothing: letter case counts, spaces around the name do not. */
function changesOf(item: ProcessItemRow, values: Values): ProcessItemChangesInput {
  const name = values.name.trim();
  const defaultValue = normaliseDefaultValue(values.defaultValue);
  return {
    ...(name === item.name ? {} : { name }),
    ...(values.unit === item.unit ? {} : { unit: values.unit }),
    ...(defaultValue === item.defaultValue ? {} : { defaultValue }),
  };
}

function withoutError(errors: Errors, field: FieldName): Errors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}

export function ProcessFormDialog({ open, item, onClose, onSaved, onCloseAutoFocus }: ProcessFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <ProcessForm item={item} onClose={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

type FormProps = Pick<ProcessFormDialogProps, 'item' | 'onClose' | 'onSaved'>;

/** The form inside the panel. It mounts when the dialog opens and goes when it closes, so every opening starts from the rate's own values. */
function ProcessForm({ item, onClose, onSaved }: FormProps) {
  const adding = item === null;
  const [values, setValues] = useState<Values>(() => initialValues(item));
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLSelectElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);

  const set = (field: FieldName) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutError(current, field));
  };

  // After a refusal, focus goes to the first field with a message (SCR-11, UX spec section 6.0 "Forms").
  useEffect(() => {
    const first = FIELD_NAMES.find((field) => errors[field] !== undefined);
    if (first === 'name') nameRef.current?.focus();
    else if (first === 'unit') unitRef.current?.focus();
    else if (first === 'defaultValue') valueRef.current?.focus();
  }, [errors]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const found = problemsOf(values);
    setErrors(found);
    setFailed(false);
    if (Object.keys(found).length > 0) return;

    if (!adding) {
      const changes = changesOf(item, values);
      // Nothing changed: close with no request and no message, because nothing was saved.
      if (Object.keys(changes).length === 0) return onClose();
      setSubmitting(true);
      return finish(await updateProcessItem(item.id, changes), 'edited');
    }
    setSubmitting(true);
    return finish(
      await createProcessItem({ name: values.name.trim(), unit: values.unit, defaultValue: normaliseDefaultValue(values.defaultValue) }),
      'added',
    );
  }

  /** Shows the server's answer to an add or an edit. */
  function finish(outcome: Awaited<ReturnType<typeof updateProcessItem>>, kind: 'added' | 'edited'): void {
    setSubmitting(false);
    if (outcome.status === 'ok') return onSaved(outcome.value, kind);
    if (outcome.status === 'failed') return setFailed(true);
    const fromServer: Partial<Record<FieldName, string>> = {};
    for (const field of FIELD_NAMES) {
      const message = outcome.fields[field];
      if (message !== undefined) fromServer[field] = message;
    }
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    setErrors(fromServer);
  }

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle>{adding ? ADD_RATE : `Edit ${item.name}`}</DialogTitle>
      </DialogHeader>
      {failed ? (
        <Notice tone="danger" title={adding ? FAILED_ADD_MESSAGE : FAILED_EDIT_MESSAGE}>
          {TRY_AGAIN_BODY}
        </Notice>
      ) : null}
      <FormField id="rate-name" label="Rate name" hint={NAME_HINT} {...(errors.name === undefined ? {} : { error: errors.name })}>
        {(control) => (
          <Input {...control} ref={nameRef} name="name" autoComplete="off" required value={values.name} onChange={(event) => set('name')(event.target.value)} />
        )}
      </FormField>
      <FormField id="rate-unit" label="Unit" {...(errors.unit === undefined ? {} : { error: errors.unit })}>
        {(control) => (
          <NativeSelect {...control} ref={unitRef} name="unit" required value={values.unit} onChange={(event) => set('unit')(event.target.value)}>
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
      <FormField id="rate-default" label="Default value" {...(errors.defaultValue === undefined ? {} : { error: errors.defaultValue })}>
        {(control) => (
          <UnitInput
            {...control}
            ref={valueRef}
            unit={values.unit === PERCENT_UNIT ? PERCENT_UNIT : RUPEE}
            name="defaultValue"
            inputMode="decimal"
            autoComplete="off"
            required
            value={values.defaultValue}
            onChange={(event) => set('defaultValue')(event.target.value)}
          />
        )}
      </FormField>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={submitting}>
          {submitting ? (adding ? 'Adding rate' : 'Saving') : adding ? ADD_RATE : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
