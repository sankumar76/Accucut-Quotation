import type { RoleName } from '../auth/roles';
import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_MINUTE } from '../time';

/**
 * "Overdue" as the screens say it (STORY-04.03; FR-036, FR-037, NFR-015). Pure: every function takes the instant it judges at (a `Clock`'s `now()`, or the `asOf`
 * instant the server sent with a page), so a test sets the time and the first paint of a page and its hydration say the same words. No `Date.now()` here
 * (coding standards section 10, "Dates").
 *
 * A task is overdue when its deadline is **strictly before** the instant it is judged at, the rule of the queue (STORY-04.02): at the deadline instant it is
 * not overdue yet, and one millisecond later it is. The queue's SQL (`tabFilter` in `task-repository.ts`) and this file say the same thing; a test holds them together.
 * Whether the estimate is closed is not known here: the caller asks only for a task that is open.
 */

export function isOverdue(deadline: Date, now: Date): boolean {
  return deadline.getTime() < now.getTime();
}

/**
 * How late, in the UX spec's words (SCR-03): days and hours from a day on (`1 d 18 h`), whole hours under a day (`5 h`), minutes under an hour (`42 min`), and
 * `less than 1 min` under a minute. `null` for a deadline that is not past. The caller writes "Overdue by " in front.
 */
export function overdueBy(deadline: Date, now: Date): string | null {
  if (!isOverdue(deadline, now)) return null;
  const late = now.getTime() - deadline.getTime();
  const days = Math.floor(late / MILLISECONDS_PER_DAY);
  const hours = Math.floor((late % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR);
  if (days >= 1) return `${days} d ${hours} h`;
  if (hours >= 1) return `${hours} h`;
  const minutes = Math.floor(late / MILLISECONDS_PER_MINUTE);
  return minutes >= 1 ? `${minutes} min` : 'less than 1 min';
}

/** The count in words, singular where it is 1 (UX spec SCR-03, "Interactions"): `1 task is overdue`, `3 tasks are overdue`. */
export function overdueSummary(count: number): string {
  return count === 1 ? '1 task is overdue' : `${count} tasks are overdue`;
}

/**
 * Where the bell goes (FR-037, STORY-04.03 AC-3): the Overdue tab. A Lead's bell counts the overdue tasks that Lead assigned, so it opens the tab filtered the same
 * way (`assignedBy=me`), and the tab shows the set the bell counted. An Engineer's tab is their own tasks already, and an Admin's is every task.
 */
export function bellHrefFor(role: RoleName): string {
  return role === 'LEAD' ? '/queue?tab=overdue&assignedBy=me' : '/queue?tab=overdue';
}
