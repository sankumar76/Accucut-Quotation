import { overdueBy } from '../../../lib/tasks/overdue';
import { formatIst } from '../../../lib/time';
import { renderMail } from '../layout';

/**
 * The "Task overdue" message (STORY-09.04 AC-7; SCR-22; architecture section 4.7): a pure function from a fixed DTO to the subject, the HTML and the plain text.
 *
 * The DTO is the whole input: the task's code and title, who assigned it, the folder as a path and as its `file:` link, the deadline, the instant the message is judged at and the link
 * to the task. It has no field for a cost, a rate, a formula, a customer or a price (NFR-002), and the function reads each field by name, so a value that rides along on the object is
 * never read. Every text is escaped by the shared layout; the deadline goes through `formatIst`, so 18:00 UTC on the 6th reads 23:30 IST on the 6th (NFR-015); "Overdue by" is the
 * queue's own wording (`overdueBy`, the one rule of "overdue" in `src/lib/tasks/overdue.ts`).
 */

export interface TaskOverdueMessage {
  readonly code: string;
  readonly title: string | null;
  /** The Lead or the Admin who assigned the task (BR-042). */
  readonly assignerName: string;
  /** The UNC path, as text. */
  readonly folderPath: string;
  /** The `file:` link the queue builds (`folderUrlOf`), or null for a stored path the portal would not have accepted. */
  readonly folderUrl: string | null;
  readonly deadlineAt: Date;
  /** The instant the message is judged at (the scan's clock): "Overdue by" is the time from the deadline to here. */
  readonly now: Date;
  /** A full address to the task's estimate, built from `APP_ORIGIN`. */
  readonly taskLink: string;
}

export interface RenderedTaskOverdue {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const TASK_OVERDUE_HEADING = 'Task overdue';
export const OPEN_THE_TASK = 'Open the task';

/** Said once in the message, as the page says it beside the folder: a mail program often refuses a `file:` link, and the path always works. */
const BLOCKED_LINK_ADVICE = 'If the link does not open (mail programs often block links to network folders), copy the path and paste it into File Explorer.';

export function renderTaskOverdue(message: TaskOverdueMessage): RenderedTaskOverdue {
  const { code, title, assignerName, folderPath, folderUrl, deadlineAt, now, taskLink } = message;
  const late = overdueBy(deadlineAt, now);
  if (late === null) throw new RangeError('A task that is not overdue has no overdue message.');

  const taskLines = [`Task: ${code}`];
  if (title !== null) taskLines.push(`Title: ${title}`);
  taskLines.push(`Assigned by: ${assignerName}`, `Overdue by: ${late}`);

  const folderLines = [`Folder: ${folderPath}`];
  if (folderUrl !== null) folderLines.push(`Folder link: ${folderUrl}`, BLOCKED_LINK_ADVICE);

  const { html, text } = renderMail({
    heading: TASK_OVERDUE_HEADING,
    paragraphs: [`This task is now overdue. It was due on ${formatIst(deadlineAt)}.`, taskLines.join('\n'), folderLines.join('\n')],
    action: { label: OPEN_THE_TASK, url: taskLink },
  });
  return { subject: `${TASK_OVERDUE_HEADING}: ${code}`, html, text };
}
