'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { UnitInput } from '@/components/shared/unit-input';
import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  initialMaterialValues,
  materialEditChanges,
  materialFormProblems,
  newMaterialBody,
  withoutMaterialError,
  type FieldErrors,
} from '@/lib/masters/material-form';
import { createMaterial, updateMaterial, type MaterialRow } from '@/lib/masters/materials-client';
import { RUPEE } from '@/lib/masters/master-rules';
import {
  MATERIAL_FIELD_LABELS,
  MATERIAL_FIELD_NAMES,
  SPECIFIC_GRAVITY_HINT,
  type MaterialFieldName,
  type MaterialValues,
} from '@/lib/masters/materials';

import { BREAK_LONG_NAMES, TRY_AGAIN_BODY } from './master-texts';
import {
  ADD_MATERIAL,
  ADDING_MATERIAL,
  editMaterialLabel,
  FAILED_ADD_MATERIAL_MESSAGE,
  FAILED_EDIT_MATERIAL_MESSAGE,
} from './material-texts';

/**
 * The "Add material" and "Edit" dialogs of SCR-13 (STORY-02.03 AC-2, AC-3, AC-7, AC-8). Add: the five fields. Edit: the same five, starting
 * from the material's own. The dialog only collects and shows; the server decides. A refusal comes back with its reason and is put under the
 * field it names: a name that is taken under Material in Drawing, a specific gravity of 0 under Specific gravity, with "Enter a value above
 * 0.". Nothing typed is cleared by a refusal. The first focus is the first field, and Escape or Cancel closes it with nothing sent. An edit
 * that changes nothing closes with no request and no message. The checks and the changes are pure and live in
 * `src/lib/masters/material-form.ts`.
 */

export interface MaterialFormDialogProps {
  readonly open: boolean;
  /** `null` adds a material; a material edits it. */
  readonly item: MaterialRow | null;
  readonly onClose: () => void;
  /** Called with the saved material after the server accepted the change. */
  readonly onSaved: (saved: MaterialRow, kind: 'added' | 'edited') => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type FormProps = Pick<MaterialFormDialogProps, 'item' | 'onClose' | 'onSaved'>;
type SaveOutcome = Awaited<ReturnType<typeof updateMaterial>>;

/** The element id of each field: unique on the page, so a label and a message are tied to their own control. */
const FIELD_IDS: Readonly<Record<MaterialFieldName, string>> = {
  materialInDrawing: 'material-in-drawing',
  materialConsidered: 'material-considered',
  pricePerKg: 'material-price',
  specificGravity: 'material-specific-gravity',
  scrapRate: 'material-scrap-rate',
};

/** The request for what was typed, or null for an edit that changes nothing. */
function requestFor(item: MaterialRow | null, values: MaterialValues): (() => Promise<SaveOutcome>) | null {
  if (item === null) return () => createMaterial(newMaterialBody(values));
  const changes = materialEditChanges(item, values);
  return Object.keys(changes).length === 0 ? null : () => updateMaterial(item.id, changes);
}

/** The messages the server gave for the fields this form has, and nothing for any other field. */
function serverErrors(fields: Readonly<Record<string, string>>): FieldErrors {
  return Object.fromEntries(MATERIAL_FIELD_NAMES.flatMap((field) => (fields[field] === undefined ? [] : [[field, fields[field]]])));
}

/** What the form holds, what it was told, and what pressing Add or Save does. */
function useMaterialForm({ item, onClose, onSaved }: FormProps) {
  const [values, setValues] = useState<MaterialValues>(() => initialMaterialValues(item));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // After a refusal, focus goes to the first field with a message (SCR-13, UX spec section 6.0 "Forms"), and never while a person types (DEF-024).
  const showErrors = useFocusOnRefusal(MATERIAL_FIELD_NAMES, (field) => document.getElementById(FIELD_IDS[field])?.focus(), setErrors);

  const setField = (field: MaterialFieldName, value: string): void => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutMaterialError(current, field));
  };

  /** Shows the server's answer to an add or an edit. */
  function finish(outcome: SaveOutcome): void {
    setSubmitting(false);
    if (outcome.status === 'ok') return onSaved(outcome.value, item === null ? 'added' : 'edited');
    const fromServer = outcome.status === 'refused' ? serverErrors(outcome.fields) : {};
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    showErrors(fromServer);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const found = materialFormProblems(values, item);
    showErrors(found);
    setFailed(false);
    if (Object.keys(found).length > 0) return;
    const request = requestFor(item, values);
    // Nothing changed: close with no request and no message, because nothing was saved.
    if (request === null) return onClose();
    setSubmitting(true);
    finish(await request());
  }

  return { values, errors, failed, submitting, setField, submit };
}

type MaterialFormState = ReturnType<typeof useMaterialForm>;

/** One text or number field: its label, the message under it, and the unit beside it when it has one. */
function MaterialField({ form, field, hint, unit }: { readonly form: MaterialFormState; readonly field: MaterialFieldName; readonly hint?: string; readonly unit?: string }) {
  const { values, errors, setField } = form;
  const input = {
    name: field,
    autoComplete: 'off',
    required: true,
    value: values[field],
    onChange: (event: ChangeEvent<HTMLInputElement>) => setField(field, event.target.value),
  };
  return (
    <FormField
      id={FIELD_IDS[field]}
      label={MATERIAL_FIELD_LABELS[field]}
      {...(hint === undefined ? {} : { hint })}
      {...(errors[field] === undefined ? {} : { error: errors[field] })}
    >
      {(control) => (unit === undefined ? <Input {...control} {...input} /> : <UnitInput {...control} {...input} unit={unit} inputMode="decimal" />)}
    </FormField>
  );
}

/** The five fields in the order of the table; the price and the specific gravity share a row from 640 px. */
function MaterialFields({ form }: { readonly form: MaterialFormState }) {
  return (
    <>
      <MaterialField form={form} field="materialInDrawing" />
      <MaterialField form={form} field="materialConsidered" />
      <div className="grid gap-s-4 sm:grid-cols-2">
        <MaterialField form={form} field="pricePerKg" unit={RUPEE} />
        <MaterialField form={form} field="specificGravity" hint={SPECIFIC_GRAVITY_HINT} />
      </div>
      <MaterialField form={form} field="scrapRate" unit={RUPEE} />
    </>
  );
}

/** The form inside the panel. It mounts when the dialog opens and goes when it closes, so every opening starts from the material's own values. */
function MaterialForm(props: FormProps) {
  const form = useMaterialForm(props);
  const adding = props.item === null;
  return (
    <form noValidate onSubmit={(event) => void form.submit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle className={BREAK_LONG_NAMES}>{adding ? ADD_MATERIAL : editMaterialLabel(props.item?.materialInDrawing ?? '')}</DialogTitle>
      </DialogHeader>
      {form.failed ? (
        <Notice tone="danger" title={adding ? FAILED_ADD_MATERIAL_MESSAGE : FAILED_EDIT_MATERIAL_MESSAGE}>
          {TRY_AGAIN_BODY}
        </Notice>
      ) : null}
      <MaterialFields form={form} />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={form.submitting}>
          {form.submitting ? (adding ? ADDING_MATERIAL : 'Saving') : adding ? ADD_MATERIAL : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MaterialFormDialog({ open, item, onClose, onSaved, onCloseAutoFocus }: MaterialFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <MaterialForm item={item} onClose={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}
