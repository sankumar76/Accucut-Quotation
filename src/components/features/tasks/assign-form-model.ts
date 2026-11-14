import { joinDeadline, type AssignErrors, type AssignFieldName, type AssignInput } from '@/lib/tasks/assign';

/**
 * What the Assign task form holds, and how it becomes the request (STORY-04.01). Kept apart from the components so the hook and the fields share one
 * description of the form. The deadline is two controls (a date and a time) but one rule, so both write the `deadline` message.
 */

export interface AssignFormValues {
  readonly engineerId: string;
  readonly folderPath: string;
  readonly deadlineDate: string;
  readonly deadlineTime: string;
  readonly title: string;
  readonly notes: string;
}

export type AssignValueKey = keyof AssignFormValues;

export const EMPTY_ASSIGN_VALUES: AssignFormValues = { engineerId: '', folderPath: '', deadlineDate: '', deadlineTime: '', title: '', notes: '' };

/** The element id of each field: unique on the page, so a label and a message are tied to their own control and a link in the summary can reach it. */
export const ASSIGN_FIELD_IDS: Readonly<Record<AssignFieldName, string>> = {
  engineerId: 'assign-engineer',
  folderPath: 'assign-path',
  // The date control is where the deadline message sits and where focus goes; the time control has its own id below.
  deadline: 'assign-date',
  title: 'assign-title',
  notes: 'assign-notes',
};

export const ASSIGN_TIME_ID = 'assign-time';
export const ASSIGN_TIME_ADDON_ID = 'assign-time-ist';

/** The message field a control writes: the date and the time both belong to the deadline. */
export function errorFieldOf(key: AssignValueKey): AssignFieldName {
  return key === 'deadlineDate' || key === 'deadlineTime' ? 'deadline' : key;
}

/** The form as the rules and the request read it. */
export function inputOf(values: AssignFormValues): AssignInput {
  return {
    engineerId: values.engineerId,
    folderPath: values.folderPath,
    deadline: joinDeadline(values.deadlineDate, values.deadlineTime),
    title: values.title,
    notes: values.notes,
  };
}

/** The messages without the one for `field`: typing in a field takes its own message away and no other. */
export function withoutAssignError(errors: AssignErrors, field: AssignFieldName): AssignErrors {
  return Object.fromEntries(Object.entries(errors).filter(([name]) => name !== field));
}

/** The messages the server gave for the fields this form has, and nothing for any other field. */
export function serverAssignErrors(fields: Readonly<Record<string, string>>, names: ReadonlyArray<AssignFieldName>): AssignErrors {
  return Object.fromEntries(names.flatMap((name) => (fields[name] === undefined ? [] : [[name, fields[name]]])));
}
