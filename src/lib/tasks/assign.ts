import { parseIstDateTime } from '../time';

import { FOLDER_PATH_MAX_LENGTH, isUncPath } from './folder-path';

/**
 * The rules of "Assign task" (STORY-04.01 AC-3; UX spec SCR-04 "Form fields"), written once and used twice: the form (`src/components/features/tasks`) runs
 * them before it sends, and the task service runs them again on the server against the server's clock. The words are the UX spec's, so the form and the
 * server say the same thing under the same field.
 *
 * Fields are checked together, so the person sees every message at once (the error summary lists them). A message names what to do, never the value typed.
 */

export const ASSIGN_FIELD_NAMES = ['engineerId', 'folderPath', 'deadline', 'title', 'notes'] as const;

export type AssignFieldName = (typeof ASSIGN_FIELD_NAMES)[number];

/** The message for each field that has a problem; a field that is fine has none. */
export type AssignErrors = Readonly<Partial<Record<AssignFieldName, string>>>;

/** What a person typed, as text. `deadline` is the date and the time written `YYYY-MM-DDTHH:mm`, in IST. */
export interface AssignInput {
  readonly engineerId: string;
  readonly folderPath: string;
  readonly deadline: string;
  readonly title: string;
  readonly notes: string;
}

/** An Engineer as the Engineer field offers them: the ID that is sent and the name that is shown. */
export interface EngineerOption {
  readonly id: string;
  readonly name: string;
}

/** What a valid input comes to: trimmed, the deadline as the UTC instant, an empty title or notes as `null`. */
export interface AssignValues {
  readonly engineerId: string;
  readonly folderPath: string;
  readonly deadlineAt: Date;
  readonly title: string | null;
  readonly notes: string | null;
}

export const TITLE_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 1_000;

export const ENGINEER_MESSAGE = 'Choose an Engineer.';
export const FOLDER_PATH_MESSAGE = 'Enter the network folder path. It starts with two backslashes, like \\\\server\\share\\RFQ-123.';
export const FOLDER_PATH_TOO_LONG_MESSAGE = `Keep the network folder path under ${FOLDER_PATH_MAX_LENGTH} characters.`;
export const DEADLINE_MESSAGE = 'Choose a deadline later than now.';
export const TITLE_MESSAGE = `Keep the title under ${TITLE_MAX_LENGTH} characters.`;
export const NOTES_MESSAGE = 'Keep the notes under 1,000 characters.';

const DEADLINE_FORMAT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** The length in characters as the database counts them (a letter outside the basic plane is one), not in UTF-16 units. */
function lengthOf(text: string): number {
  return Array.from(text).length;
}

/** Writes the date and the time of two form fields as the one `deadline` text. Empty when either is empty, which `checkAssign` refuses. */
export function joinDeadline(date: string, time: string): string {
  return date === '' || time === '' ? '' : `${date}T${time}`;
}

function pathProblem(path: string): string | undefined {
  if (lengthOf(path) > FOLDER_PATH_MAX_LENGTH) return FOLDER_PATH_TOO_LONG_MESSAGE;
  return isUncPath(path) ? undefined : FOLDER_PATH_MESSAGE;
}

/** The deadline as a UTC instant, or `undefined` when it is missing, is not a real date and time, or is not later than now. */
function laterDeadline(deadline: string, now: Date): Date | undefined {
  const match = DEADLINE_FORMAT.exec(deadline);
  const parsed = match === null ? null : parseIstDateTime(match[1] ?? '', match[2] ?? '');
  return parsed !== null && parsed.getTime() > now.getTime() ? parsed : undefined;
}

export type AssignCheck = { readonly ok: true; readonly values: AssignValues } | { readonly ok: false; readonly errors: AssignErrors };

/**
 * Checks what was typed against the clock. Everything is trimmed first. The title and the notes are optional (an empty one is `null`); the Engineer is only
 * checked to be chosen here: that the person is an active Engineer is the server's, from the database (the service).
 */
export function checkAssign(input: AssignInput, now: Date): AssignCheck {
  const engineerId = input.engineerId.trim();
  const folderPath = input.folderPath.trim();
  const title = input.title.trim();
  const notes = input.notes.trim();
  const deadlineAt = laterDeadline(input.deadline.trim(), now);
  const problems: Array<[AssignFieldName, string | undefined]> = [
    ['engineerId', engineerId === '' ? ENGINEER_MESSAGE : undefined],
    ['folderPath', pathProblem(folderPath)],
    ['deadline', deadlineAt === undefined ? DEADLINE_MESSAGE : undefined],
    ['title', lengthOf(title) > TITLE_MAX_LENGTH ? TITLE_MESSAGE : undefined],
    ['notes', lengthOf(notes) > NOTES_MAX_LENGTH ? NOTES_MESSAGE : undefined],
  ];
  const errors = Object.fromEntries(problems.filter((entry): entry is [AssignFieldName, string] => entry[1] !== undefined));
  if (Object.keys(errors).length > 0 || deadlineAt === undefined) return { ok: false, errors };
  return { ok: true, values: { engineerId, folderPath, deadlineAt, title: title === '' ? null : title, notes: notes === '' ? null : notes } };
}
