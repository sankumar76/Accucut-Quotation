import { DEADLINE_MESSAGE, ENGINEER_MESSAGE } from './assign';

/**
 * The rules of "Reassign or change deadline" (STORY-04.07 AC-3; UX spec SCR-04 "Edit mode"), written once and used twice, as `assign.ts` is: the form runs them
 * before it sends, and the task service runs them again on the server, under the task's row lock, against the server's clock. The words are the ones of assigning,
 * so the form and the server say the same thing under the same field.
 *
 * **A field that is left out is not changed, and a field that holds the stored value is not changed either** (AC-3). A value that is not changed is not judged
 * (decision D-3): an overdue task keeps its past deadline when it is given to another Engineer, and a task whose Engineer was deactivated can still have its deadline
 * moved. Only a value that differs is checked: the Engineer must be chosen (that the person is an active Engineer is the service's, from the database), and a
 * deadline must be a real instant later than now.
 */

/** The `code` of the 409 of a task whose estimate is approved (STORY-04.07 AC-6, A-14). The browser compares with it to show the message. */
export const TASK_CLOSED_CODE = 'TASK_CLOSED';

/** The 409's words (proposed, for the ux-expert to rule on at the end review): true whether the task was approved before the form opened or while it was open, and silent about what was saved. */
export const TASK_CLOSED_MESSAGE = 'This task is approved, so its Engineer and deadline can no longer be changed.';

export const REASSIGN_FIELD_NAMES = ['engineerId', 'deadlineAt'] as const;

export type ReassignFieldName = (typeof REASSIGN_FIELD_NAMES)[number];

/** The message for each field that has a problem; a field that is fine has none. */
export type ReassignErrors = Readonly<Partial<Record<ReassignFieldName, string>>>;

/** What was sent: each field is optional, and `deadlineAt` is an ISO 8601 instant in UTC (the browser turns the IST date and time into it). */
export interface ReassignInput {
  readonly engineerId?: string | undefined;
  readonly deadlineAt?: string | undefined;
}

/** What the task holds now. */
export interface StoredAssignment {
  readonly engineerId: string;
  readonly deadlineAt: Date;
}

/** What a valid input changes: the new Engineer's ID and the new deadline, each `null` when that value stays as it is. */
export interface ReassignChanges {
  readonly engineerId: string | null;
  readonly deadlineAt: Date | null;
}

export type ReassignCheck = { readonly ok: true; readonly changes: ReassignChanges } | { readonly ok: false; readonly errors: ReassignErrors };

/** `2026-11-13T06:30:00Z` or with milliseconds: the instant as `Date.prototype.toISOString` writes it, and nothing looser. */
const INSTANT_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SECONDS_END = 19;

/** The instant the text names, or `null` when it is not an ISO instant in UTC or not a real date and time (31 February, hour 25). */
function instantOf(text: string): Date | null {
  if (!INSTANT_FORMAT.test(text)) return null;
  const parsed = new Date(text);
  // `Date` carries a 31 February over into March: a real date writes itself back the same.
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, SECONDS_END) !== text.slice(0, SECONDS_END) ? null : parsed;
}

/** The Engineer's ID to change to, `null` for no change, or the message. */
function engineerChange(sent: string | undefined, stored: string): string | null | { readonly error: string } {
  if (sent === undefined) return null;
  const engineerId = sent.trim();
  if (engineerId === '') return { error: ENGINEER_MESSAGE };
  return engineerId.toLowerCase() === stored.toLowerCase() ? null : engineerId;
}

/** The deadline to change to, `null` for no change, or the message. An unchanged deadline is not judged against the clock, even when it is in the past (D-3). */
function deadlineChange(sent: string | undefined, stored: Date, now: Date): Date | null | { readonly error: string } {
  if (sent === undefined) return null;
  const parsed = instantOf(sent.trim());
  if (parsed === null) return { error: DEADLINE_MESSAGE };
  if (parsed.getTime() === stored.getTime()) return null;
  return parsed.getTime() > now.getTime() ? parsed : { error: DEADLINE_MESSAGE };
}

const isRefusal = (change: unknown): change is { readonly error: string } => typeof change === 'object' && change !== null && 'error' in change;

/** Checks what was sent against what the task holds and the clock. Every problem is named at once. */
export function checkReassign(input: ReassignInput, stored: StoredAssignment, now: Date): ReassignCheck {
  const engineerId = engineerChange(input.engineerId, stored.engineerId);
  const deadlineAt = deadlineChange(input.deadlineAt, stored.deadlineAt, now);
  const errors: { engineerId?: string; deadlineAt?: string } = {};
  if (isRefusal(engineerId)) errors.engineerId = engineerId.error;
  if (isRefusal(deadlineAt)) errors.deadlineAt = deadlineAt.error;
  if (isRefusal(engineerId) || isRefusal(deadlineAt)) return { ok: false, errors };
  return { ok: true, changes: { engineerId, deadlineAt } };
}
