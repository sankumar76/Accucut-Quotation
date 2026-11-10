'use client';

import { useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice } from '@/components/shared/notice';
import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  initialTreatmentValues,
  newTreatmentBody,
  TREATMENT_FIELD_NAMES,
  treatmentEditChanges,
  treatmentFormProblems,
  withoutTreatmentError,
  type TreatmentErrors,
  type TreatmentFieldName,
  type TreatmentValues,
} from '@/lib/masters/treatments';
import { createTreatment, updateTreatment, type TreatmentRow } from '@/lib/masters/treatments-client';

import { BREAK_LONG_NAMES } from './process-texts';
import {
  ADD_TREATMENT,
  ADDING_TREATMENT,
  CANCEL_TREATMENT,
  FAILED_ADD_TREATMENT_MESSAGE,
  FAILED_RENAME_TREATMENT_MESSAGE,
  FAILED_WRITE_KEEPS_FORM_BODY,
  renameTreatmentTitle,
  SAVE_TREATMENT,
  SAVING_TREATMENT,
  TREATMENT_NAME_FIELD_LABEL,
} from './treatment-texts';

/**
 * The "Add treatment" and "Rename" dialogs of SCR-13's Treatment / Color tab (STORY-02.05 AC-2, AC-8). One field, the name; Rename starts from the
 * treatment's own. The dialog only collects and shows; the server decides. A refusal comes back with its reason and is put under the field it
 * names: a name that is taken, or that the system keeps ("That name cannot be used."). Nothing typed is cleared by a refusal. The first focus is
 * the field, and Escape or Cancel closes it with nothing sent. A rename that changes nothing closes with no request and no message. A rename of a
 * treatment that was deleted elsewhere (404) is the screen's: it closes the dialog and says so. The checks and the changes are pure and live in
 * `src/lib/masters/treatments.ts`.
 *
 * **Focus moves only on a refusal** (DL-135): `useFocusOnRefusal` is told the messages of a refusal and nothing else, so typing, which only
 * clears the message of the field being typed in, never moves focus.
 */

export interface TreatmentFormDialogProps {
  readonly open: boolean;
  /** `null` adds a treatment; a treatment renames it. */
  readonly item: TreatmentRow | null;
  readonly onClose: () => void;
  /** Called with the saved treatment after the server accepted the change. */
  readonly onSaved: (saved: TreatmentRow, kind: 'added' | 'renamed') => void;
  /** Called when the server said the treatment being renamed no longer exists. */
  readonly onGone: (item: TreatmentRow) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

type FormProps = Pick<TreatmentFormDialogProps, 'item' | 'onClose' | 'onSaved' | 'onGone'>;
type SaveOutcome = Awaited<ReturnType<typeof updateTreatment>>;

/** The element id of each field: unique on the page, so a label and a message are tied to their own control. */
const FIELD_IDS: Readonly<Record<TreatmentFieldName, string>> = { name: 'treatment-name' };

/** The request for what was typed, or null for a rename that changes nothing. */
function requestFor(item: TreatmentRow | null, values: TreatmentValues): (() => Promise<SaveOutcome>) | null {
  if (item === null) return () => createTreatment(newTreatmentBody(values));
  const changes = treatmentEditChanges(item, values);
  return Object.keys(changes).length === 0 ? null : () => updateTreatment(item.id, changes);
}

/** The messages the server gave for the fields this form has, and nothing for any other field. */
function serverErrors(fields: Readonly<Record<string, string>>): TreatmentErrors {
  return Object.fromEntries(TREATMENT_FIELD_NAMES.flatMap((field) => (fields[field] === undefined ? [] : [[field, fields[field]]])));
}

/** What the form holds, what it was told, and what pressing Add or Save does. */
function useTreatmentForm({ item, onClose, onSaved, onGone }: FormProps) {
  const [values, setValues] = useState<TreatmentValues>(() => initialTreatmentValues(item));
  const [errors, setErrors] = useState<TreatmentErrors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // After a refusal, focus goes to the first field with a message (UX spec section 6.0 "Forms"), and never while a person types (DL-135).
  const showErrors = useFocusOnRefusal(TREATMENT_FIELD_NAMES, (field) => document.getElementById(FIELD_IDS[field])?.focus(), setErrors);

  const setField = (field: TreatmentFieldName, value: string): void => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutTreatmentError(current, field));
  };

  /** Shows the server's answer to an add or a rename. */
  function finish(outcome: SaveOutcome): void {
    setSubmitting(false);
    if (outcome.status === 'ok') return onSaved(outcome.value, item === null ? 'added' : 'renamed');
    if (outcome.status === 'refused' && outcome.httpStatus === 404 && item !== null) return onGone(item);
    const fromServer = outcome.status === 'refused' ? serverErrors(outcome.fields) : {};
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    showErrors(fromServer);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const found = treatmentFormProblems(values);
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

/** The form inside the panel. It mounts when the dialog opens and goes when it closes, so every opening starts from the treatment's own name. */
function TreatmentForm(props: FormProps) {
  const form = useTreatmentForm(props);
  const adding = props.item === null;
  return (
    <form noValidate onSubmit={(event) => void form.submit(event)} className="flex flex-col gap-s-4">
      <DialogHeader>
        <DialogTitle className={BREAK_LONG_NAMES}>{adding ? ADD_TREATMENT : renameTreatmentTitle(props.item?.name ?? '')}</DialogTitle>
      </DialogHeader>
      {form.failed ? (
        <Notice tone="danger" title={adding ? FAILED_ADD_TREATMENT_MESSAGE : FAILED_RENAME_TREATMENT_MESSAGE}>
          {FAILED_WRITE_KEEPS_FORM_BODY}
        </Notice>
      ) : null}
      <FormField id={FIELD_IDS.name} label={TREATMENT_NAME_FIELD_LABEL} {...(form.errors.name === undefined ? {} : { error: form.errors.name })}>
        {(control) => (
          <Input
            {...control}
            name="name"
            autoComplete="off"
            required
            value={form.values.name}
            onChange={(event) => form.setField('name', event.target.value)}
          />
        )}
      </FormField>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">{CANCEL_TREATMENT}</Button>
        </DialogClose>
        <Button type="submit" loading={form.submitting}>
          {form.submitting ? (adding ? ADDING_TREATMENT : SAVING_TREATMENT) : adding ? ADD_TREATMENT : SAVE_TREATMENT}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TreatmentFormDialog({ open, item, onClose, onSaved, onGone, onCloseAutoFocus }: TreatmentFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <TreatmentForm item={item} onClose={onClose} onSaved={onSaved} onGone={onGone} />
      </DialogContent>
    </Dialog>
  );
}
