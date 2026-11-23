import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { AssignErrors, EngineerOption } from '@/lib/tasks/assign';
import type { ReassignErrors, ReassignInput } from '@/lib/tasks/reassign';
import { istIsoDateOf, istTimeInputOf, parseIstDateTime } from '@/lib/time';

import type { AssignFormValues } from './assign-form-model';
import { NOT_ACTIVE_SUFFIX } from './reassign-texts';

/**
 * What the edit mode of SCR-04 ("Reassign or change deadline", STORY-04.07) holds, and how it becomes the request. The form is the one of assigning with only two of its
 * fields live (`AssignFields`' Engineer and deadline controls), so it keeps the same values and the same field names for the messages; the three fields it locks have no value here.
 * Kept apart from the components so the hook and the tests share one description. The deadline is two controls (the IST date and time), the stored value an instant in UTC.
 */

/** The task as the page reads it: what edit mode shows, and what it needs to know about the task it changes. */
export interface ReassignTaskData {
  readonly id: string;
  readonly code: string;
  readonly engineer: EngineerOption;
  /** An ISO 8601 instant in UTC. */
  readonly deadlineAt: string;
  readonly folderPath: string;
  /** The `file:` link the server built, or null for a stored path that has none (the path is then shown as text). */
  readonly folderUrl: string | null;
  readonly title: string;
  readonly notes: string | null;
  /** The status of the estimate. An approved one means the task is closed: the form is not shown (A-14). */
  readonly status: EstimateStatus;
}

/** The form as the task is now: the stored Engineer, and the stored deadline as the date and the time it has in IST. */
export function reassignValuesOf(task: Pick<ReassignTaskData, 'engineer' | 'deadlineAt'>): AssignFormValues {
  const deadline = new Date(task.deadlineAt);
  return { engineerId: task.engineer.id, customerId: '', folderPath: '', deadlineDate: istIsoDateOf(deadline), deadlineTime: istTimeInputOf(deadline), title: '', subject: '', notes: '' };
}

/**
 * The Engineers the control offers: the active ones, and the task's own Engineer when they are not among them (deactivated since), marked as such, so the control shows who has the
 * task. Choosing that person again changes nothing and is accepted (D-3); choosing anyone else works as for any task.
 */
export function engineerOptionsFor(task: Pick<ReassignTaskData, 'engineer'>, active: ReadonlyArray<EngineerOption>): ReadonlyArray<EngineerOption> {
  return active.some((engineer) => engineer.id === task.engineer.id) ? active : [...active, { id: task.engineer.id, name: `${task.engineer.name}${NOT_ACTIVE_SUFFIX}` }];
}

/**
 * What to send: only a value that differs from what the task holds (`saved`), the Engineer as chosen and the deadline as the UTC instant of the two controls. A date or a time that was
 * emptied or is not a real one is sent as an empty deadline, which the rules refuse with the spec's words. Nothing differs: nothing is sent.
 */
export function reassignInputOf(values: AssignFormValues, saved: AssignFormValues): ReassignInput {
  const deadlineChanged = values.deadlineDate !== saved.deadlineDate || values.deadlineTime !== saved.deadlineTime;
  return {
    ...(values.engineerId === saved.engineerId ? {} : { engineerId: values.engineerId }),
    ...(deadlineChanged ? { deadlineAt: parseIstDateTime(values.deadlineDate, values.deadlineTime)?.toISOString() ?? '' } : {}),
  };
}

/** The messages under the controls of the form: the rules call the deadline `deadlineAt`, and its message sits under the form's `deadline`. */
export function reassignErrorsOf(errors: ReassignErrors): AssignErrors {
  return {
    ...(errors.engineerId === undefined ? {} : { engineerId: errors.engineerId }),
    ...(errors.deadlineAt === undefined ? {} : { deadline: errors.deadlineAt }),
  };
}

/** The messages the server gave for the two fields this form has, and nothing for any other field. */
export function serverReassignErrors(fields: Readonly<Record<string, string>>): AssignErrors {
  return reassignErrorsOf({
    ...(fields['engineerId'] === undefined ? {} : { engineerId: fields['engineerId'] }),
    ...(fields['deadlineAt'] === undefined ? {} : { deadlineAt: fields['deadlineAt'] }),
  });
}
