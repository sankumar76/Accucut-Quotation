import { overdueBy } from '../../../lib/tasks/overdue';
import { formatIst, formatIstDate, formatIstTime } from '../../../lib/time';
import { renderMail, type MailCell } from '../layout';

/**
 * The "Daily digest" message (STORY-09.05 AC-4; FR-083; SCR-22; architecture section 4.7): a pure function from a fixed DTO to the subject, the HTML and the plain text.
 *
 * The DTO is the whole input: for each overdue task its code, title, the name of who assigned it, the deadline and the link to it, then the instant the message is judged at and the link to
 * the Engineer's list. It has no field for a cost, a rate, a formula, a customer or a price (NFR-002), and the function reads each field by name, so a value that rides along on the object is
 * never read. Every text is escaped by the shared layout; each deadline goes through `formatIst`, so 18:00 UTC on the 6th reads 23:30 IST on the 6th (NFR-015); "Overdue by" is the queue's own
 * wording (`overdueBy`, the one rule of "overdue" in `src/lib/tasks/overdue.ts`). The rows are sorted here, by deadline with the oldest first and by code when two deadlines are the same, so
 * the order does not depend on the caller.
 */

export interface DailyDigestTask {
  readonly code: string;
  readonly title: string | null;
  /** The Lead or the Admin who assigned the task (BR-043). */
  readonly assignerName: string;
  readonly deadlineAt: Date;
  /** A full address to the task's estimate, built from `APP_ORIGIN`. */
  readonly taskLink: string;
}

export interface DailyDigestMessage {
  /** The Engineer's open overdue tasks. Never empty: an Engineer with none gets no digest (AC-3). */
  readonly tasks: ReadonlyArray<DailyDigestTask>;
  /** The instant the message is judged at (the run's clock): "Overdue by" is the time from each deadline to here. */
  readonly now: Date;
  /** A full address to the Engineer's list of overdue tasks, built from `APP_ORIGIN`. */
  readonly myTasksLink: string;
}

export interface RenderedDailyDigest {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const DAILY_DIGEST_HEADING = 'Your overdue tasks';
export const OPEN_MY_TASKS = 'Open my tasks';
const OPEN_THE_TASK_LINK = 'Open';
const NO_TITLE = '-';

const HEADERS = ['Task', 'Title', 'Assigned by', 'Deadline (IST)', 'Overdue by', 'Link'] as const;

function byDeadline(a: DailyDigestTask, b: DailyDigestTask): number {
  const earlier = a.deadlineAt.getTime() - b.deadlineAt.getTime();
  if (earlier !== 0) return earlier;
  if (a.code < b.code) return -1;
  return a.code > b.code ? 1 : 0;
}

export function renderDailyDigest(message: DailyDigestMessage): RenderedDailyDigest {
  const { tasks, now, myTasksLink } = message;
  if (tasks.length === 0) throw new RangeError('An Engineer with no overdue task has no digest.');

  const rows: MailCell[][] = [...tasks].sort(byDeadline).map((task) => {
    const late = overdueBy(task.deadlineAt, now);
    if (late === null) throw new RangeError('A task that is not overdue is not in the digest.');
    return [task.code, task.title ?? NO_TITLE, task.assignerName, formatIst(task.deadlineAt), late, { text: OPEN_THE_TASK_LINK, url: task.taskLink }];
  });

  const count = tasks.length === 1 ? '1 overdue task' : `${tasks.length} overdue tasks`;
  const { html, text } = renderMail({
    heading: DAILY_DIGEST_HEADING,
    paragraphs: [`You have ${count} as of ${formatIstTime(now)} today.`],
    table: { headers: HEADERS, rows },
    action: { label: OPEN_MY_TASKS, url: myTasksLink },
  });
  return { subject: `${DAILY_DIGEST_HEADING}, ${formatIstDate(now)}`, html, text };
}
