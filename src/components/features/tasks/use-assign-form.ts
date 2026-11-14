'use client';

import { useState, type FormEvent } from 'react';

import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { ASSIGN_FIELD_NAMES, checkAssign, type AssignErrors } from '@/lib/tasks/assign';
import { assignTask, type AssignedTaskView } from '@/lib/tasks/tasks-client';
import { systemClock } from '@/lib/time';

import {
  ASSIGN_FIELD_IDS,
  EMPTY_ASSIGN_VALUES,
  errorFieldOf,
  inputOf,
  serverAssignErrors,
  withoutAssignError,
  type AssignFormValues,
  type AssignValueKey,
} from './assign-form-model';

type SaveOutcome = Awaited<ReturnType<typeof assignTask>>;

/**
 * What the Assign task form holds, what it was told, and what pressing "Assign task" does (STORY-04.01 AC-1, AC-3). The form runs the rules of
 * `lib/tasks/assign.ts` before it sends, and shows every message at once; the server runs them again against its own clock and has the last word, and a
 * refusal comes back with its reason and is put under the field it names. Nothing typed is cleared by a refusal. Focus moves to a field only after a refusal,
 * never while a person types (DL-135). After a task is assigned the form is emptied, so a second press cannot make a second task.
 */
export function useAssignForm() {
  const [values, setValues] = useState<AssignFormValues>(EMPTY_ASSIGN_VALUES);
  const [errors, setErrors] = useState<AssignErrors>({});
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assigned, setAssigned] = useState<AssignedTaskView | null>(null);
  // After a refusal, focus goes to the first field with a message (ux-spec section 6.0 "Forms"), and never while a person types.
  const showErrors = useFocusOnRefusal(ASSIGN_FIELD_NAMES, (field) => document.getElementById(ASSIGN_FIELD_IDS[field])?.focus(), setErrors);

  const setValue = (key: AssignValueKey, value: string): void => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => withoutAssignError(current, errorFieldOf(key)));
  };

  /** Shows the server's answer to an assignment. */
  function finish(outcome: SaveOutcome): void {
    setSubmitting(false);
    if (outcome.status === 'ok') {
      setAssigned(outcome.value);
      setValues(EMPTY_ASSIGN_VALUES);
      setErrors({});
      return;
    }
    const fromServer = outcome.status === 'refused' ? serverAssignErrors(outcome.fields, ASSIGN_FIELD_NAMES) : {};
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    showErrors(fromServer);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setFailed(false);
    setAssigned(null);
    const input = inputOf(values);
    const checked = checkAssign(input, systemClock.now());
    if (!checked.ok) return showErrors(checked.errors);
    setErrors({});
    setSubmitting(true);
    finish(await assignTask(input));
  }

  /** "Assign another": the notice goes, and focus goes to the first field. */
  function assignAnother(): void {
    setAssigned(null);
    document.getElementById(ASSIGN_FIELD_IDS.engineerId)?.focus();
  }

  return { values, errors, failed, submitting, assigned, setValue, submit, assignAnother };
}
