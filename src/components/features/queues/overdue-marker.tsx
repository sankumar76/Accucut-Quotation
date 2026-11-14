import { Clock } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { overdueBy } from '@/lib/tasks/overdue';
import type { TaskEstimateStatus } from '@/lib/tasks/queue';

import { OVERDUE_BY } from './queue-texts';

/**
 * The cues of an overdue row (STORY-04.03 AC-1; FR-036, UX spec SCR-03 "Content"): a clock icon, the words "Overdue by 1 d 18 h", and an amber bar and tint on the row
 * (`OVERDUE_ROW_CLASS`, `OVERDUE_CARD_CLASS`). The three appear together and none carries the meaning alone, so the cue survives a colour-blind reader and a screen reader.
 * "Overdue" is judged at `asOf`, the instant the server judged the counts at (never the browser's clock), so the first paint and the hydrated page say the same words.
 */

/** The row of the table: an amber bar down its left edge (on its first cell, which a collapsed table border draws reliably) and a tint. */
export const OVERDUE_ROW_CLASS = 'bg-accent-soft [&>:first-child]:border-l-4 [&>:first-child]:border-l-accent';

/** The card of a phone: the same bar and tint. */
export const OVERDUE_CARD_CLASS = 'border-l-4 border-l-accent bg-accent-soft';

/** How late an open task is, in words (`1 d 18 h`), or null when it is not overdue. A closed (approved) task is never overdue, whatever its deadline. */
export function lateTextFor(task: { readonly deadlineAt: string; readonly status: TaskEstimateStatus }, asOf: string): string | null {
  return task.status === 'APPROVED' ? null : overdueBy(new Date(task.deadlineAt), new Date(asOf));
}

export function OverdueMarker({ late }: { readonly late: string }) {
  return (
    <span data-overdue-marker="" className="inline-flex items-center gap-s-1 text-label font-semibold text-accent-ink">
      <Icon icon={Clock} size="hint" />
      {`${OVERDUE_BY} ${late}`}
    </span>
  );
}
