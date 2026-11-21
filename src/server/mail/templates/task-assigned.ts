import { formatIst } from '../../../lib/time';
import { renderMail } from '../layout';

/**
 * The "Task assigned" message (STORY-09.03 AC-2, AC-3, AC-8; SCR-22; architecture section 4.7): a pure function from a fixed DTO to the subject, the HTML and the plain text.
 *
 * The DTO is the whole input: the task's code, title and notes, who assigned it, the folder as a path and as its `file:` link, the deadline and the link to the task. It has no field
 * for a cost, a rate, a formula, a customer or a price (NFR-002), and the function reads each field by name, so a value that rides along on the object is never read. Every text is
 * escaped by the shared layout; the deadline goes through `formatIst`, so 18:00 UTC on the 6th reads 23:30 IST on the 6th (NFR-015). The same function builds the message for a reassign
 * (STORY-09.03 AC-7): the caller passes the new Engineer's task and the person who made the change.
 */

export interface TaskAssignedMessage {
  readonly code: string;
  readonly title: string | null;
  readonly notes: string | null;
  /** The Lead or the Admin who assigned the task (or changed its Engineer). */
  readonly assignerName: string;
  /** The UNC path, as text. */
  readonly folderPath: string;
  /** The `file:` link the queue builds (`folderUrlOf`), or null for a stored path the portal would not have accepted. */
  readonly folderUrl: string | null;
  readonly deadlineAt: Date;
  /** A full address to the task's estimate, built from `APP_ORIGIN`. */
  readonly taskLink: string;
}

export interface RenderedTaskAssigned {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const TASK_ASSIGNED_HEADING = 'Task assigned';
export const OPEN_THE_TASK = 'Open the task';

/** Said once in the message, as the page says it beside the folder: a mail program often refuses a `file:` link, and the path always works. */
const BLOCKED_LINK_ADVICE = 'If the link does not open (mail programs often block links to network folders), copy the path and paste it into File Explorer.';

export function renderTaskAssigned(message: TaskAssignedMessage): RenderedTaskAssigned {
  const { code, title, notes, assignerName, folderPath, folderUrl, deadlineAt, taskLink } = message;

  const taskLines = [`Task: ${code}`];
  if (title !== null) taskLines.push(`Title: ${title}`);
  if (notes !== null) taskLines.push(`Notes: ${notes}`);
  taskLines.push(`Assigned by: ${assignerName}`, `Deadline: ${formatIst(deadlineAt)}`);

  const folderLines = [`Folder: ${folderPath}`];
  if (folderUrl !== null) folderLines.push(`Folder link: ${folderUrl}`, BLOCKED_LINK_ADVICE);

  const { html, text } = renderMail({
    heading: TASK_ASSIGNED_HEADING,
    paragraphs: [`${assignerName} assigned you a task.`, taskLines.join('\n'), folderLines.join('\n')],
    action: { label: OPEN_THE_TASK, url: taskLink },
  });
  return { subject: `${TASK_ASSIGNED_HEADING}: ${code}`, html, text };
}
