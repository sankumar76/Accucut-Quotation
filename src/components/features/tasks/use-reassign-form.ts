'use client';

import { useState, type FormEvent } from 'react';

import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { isTaskClosed } from '@/lib/estimate/task-status';
import type { AssignErrors, AssignFieldName } from '@/lib/tasks/assign';
import { checkReassign, TASK_CLOSED_CODE } from '@/lib/tasks/reassign';

import { ESTIMATE_IGNORED_CODE } from '../estimate-ignore/ignore-codes';
import { reassignTask, type ReassignedTaskView } from '@/lib/tasks/tasks-client';
import { systemClock } from '@/lib/time';

import { ASSIGN_FIELD_IDS, errorFieldOf, withoutAssignError, type AssignFormValues, type AssignValueKey } from './assign-form-model';
import { reassignErrorsOf, reassignInputOf, reassignValuesOf, serverReassignErrors, type ReassignTaskData } from './reassign-form-model';

type SaveOutcome = Awaited<ReturnType<typeof reassignTask>>;

/** The two fields of the form that are live, in the order of the form: focus goes to the first that has a message. */
const LIVE_FIELDS: ReadonlyArray<AssignFieldName> = ['engineerId', 'deadline'];

/** What the task holds now, as the form last knew it: the stored Engineer and deadline, from the page and then from each save. */
interface Held {
  readonly engineer: ReassignTaskData['engineer'];
  readonly deadlineAt: string;
}

/**
 * What the edit form of SCR-04 holds, what it was told, and what pressing "Save changes" does (STORY-04.07 AC-2, AC-3, AC-6). The form runs the rules of `lib/tasks/reassign.ts`
 * before it sends, with the stored values it knows, and shows every message at once; the server runs them again against its own clock under the task's lock and has the last
 * word, and a refusal comes back with its reason and is put under the field it names. **Only what the person changed is sent**, so a deadline that was never touched is never judged
 * (D-3). Nothing typed is cleared by a refusal. After a save the form holds the new values as the task's own, and the next save compares with them. A 409 `TASK_CLOSED` (the task was
 * approved after the form opened) takes the form away and says so. Focus moves to a field only after a refusal, never while a person types (DL-135).
 */
export function useReassignForm(task: ReassignTaskData) {
  const [held, setHeld] = useState<Held>({ engineer: task.engineer, deadlineAt: task.deadlineAt });
  const [saved, setSaved] = useState<AssignFormValues>(() => reassignValuesOf(task));
  const [values, setValues] = useState<AssignFormValues>(saved);
  const [errors, setErrors] = useState<AssignErrors>({});
  const [failed, setFailed] = useState(false);
  const [unchanged, setUnchanged] = useState(false);
  // An ignored task (the layer over its status) is refused before it is judged closed: its words say "restore it first" (CR-01 item 7D).
  const [ignored, setIgnored] = useState(task.ignored);
  const [closed, setClosed] = useState(isTaskClosed(task.status, task.ignored));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<ReassignedTaskView | null>(null);
  const showErrors = useFocusOnRefusal(LIVE_FIELDS, (field) => document.getElementById(ASSIGN_FIELD_IDS[field])?.focus(), setErrors);

  const setValue = (key: AssignValueKey, value: string): void => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => withoutAssignError(current, errorFieldOf(key)));
    setUnchanged(false);
  };

  /** Shows the server's answer to a change. */
  function finish(outcome: SaveOutcome): void {
    setSubmitting(false);
    if (outcome.status === 'ok') {
      const next = { engineer: { id: values.engineerId, name: outcome.value.engineerName }, deadlineAt: outcome.value.deadlineAt };
      setHeld(next);
      const stored = reassignValuesOf(next);
      setSaved(stored);
      setValues(stored);
      setErrors({});
      setDone(outcome.value);
      return;
    }
    if (outcome.status === 'refused' && outcome.code === TASK_CLOSED_CODE) return setClosed(true);
    if (outcome.status === 'refused' && outcome.code === ESTIMATE_IGNORED_CODE) return setIgnored(true);
    const fromServer = outcome.status === 'refused' ? serverReassignErrors(outcome.fields) : {};
    if (Object.keys(fromServer).length === 0) return setFailed(true);
    showErrors(fromServer);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setFailed(false);
    setDone(null);
    const input = reassignInputOf(values, saved);
    if (Object.keys(input).length === 0) return setUnchanged(true);
    const checked = checkReassign(input, { engineerId: held.engineer.id, deadlineAt: new Date(held.deadlineAt) }, systemClock.now());
    if (!checked.ok) return showErrors(reassignErrorsOf(checked.errors));
    setErrors({});
    setSubmitting(true);
    finish(await reassignTask(task.id, input));
  }

  return { values, errors, failed, unchanged, closed, ignored, submitting, done, held, setValue, submit };
}
