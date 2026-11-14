import { Lock, Pencil, Send, type LucideIcon } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { APPROVED_LOCKED_LABEL, taskStatusOf, type TaskStatusLabel } from '@/lib/estimate/task-status';
import type { EstimateStatus } from '@/lib/estimate/state-machine';
import type { IconSize } from '@/lib/design-tokens';

/**
 * The status of a task, as one badge with its word and an icon, never colour alone (STORY-04.04 AC-1; UX spec section 8). The one badge every screen that lists or opens a
 * task draws, for every role: the words come from `taskStatusOf`, so they are the same on the queue, in the task header and for an Engineer, a Lead and an Admin (AC-5).
 * One badge for each status, as the G3 screens draw it: an approved task is "Approved" with a lock in a list, and "Approved and locked" in the task header (`variant="header"`),
 * where it also says why the inputs cannot be changed. "Closed" is the tab's name, not a second badge. It takes the status of the estimate and nothing else, so no amount,
 * approver or reason can be drawn through it (NFR-002); "Approved" shows no price.
 */

export interface StatusBadgeProps {
  readonly status: EstimateStatus;
  /** `list` (default): the word of the status. `header`: the task header's own wording of an approved estimate. */
  readonly variant?: 'list' | 'header';
  /** The icon's size role; the queue's rows use `hint`, the task header the smaller `badge`. */
  readonly iconSize?: IconSize;
}

const LOOK: Readonly<Record<TaskStatusLabel, { readonly tone: BadgeTone; readonly icon: LucideIcon }>> = {
  Draft: { tone: 'neutral', icon: Pencil },
  Submitted: { tone: 'info', icon: Send },
  Approved: { tone: 'success', icon: Lock },
};

export function StatusBadge({ status, variant = 'list', iconSize = 'badge' }: StatusBadgeProps) {
  const { label } = taskStatusOf(status);
  const { tone, icon } = LOOK[label];
  return (
    <span data-slot="status-badge" data-status={status} className="inline-flex flex-wrap items-center gap-s-1">
      <Badge tone={tone}>
        <Icon icon={icon} size={iconSize} />
        {variant === 'header' && label === 'Approved' ? APPROVED_LOCKED_LABEL : label}
      </Badge>
    </span>
  );
}
