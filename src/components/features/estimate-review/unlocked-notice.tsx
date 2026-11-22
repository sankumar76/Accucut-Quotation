import { UNLOCKED_NOTICE_ID } from '@/components/features/estimate-unlock/unlock-ids';
import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Notice } from '@/components/shared/notice';
import { cn } from '@/lib/cn';
import { formatIst } from '@/lib/time';
import type { CostsView } from '@/server/views/schemas/costs';

import {
  UNLOCKED_FIGURES_CLEARED,
  UNLOCKED_FIGURES_CURRENT,
  UNLOCKED_PRICE_STAYS,
  unlockedNoticeTitle,
  unlockedQueueLine,
  unlockedReasonLine,
} from './review-texts';

/**
 * The notice of an unlocked Draft (STORY-06.08 AC-3; UX spec SCR-06 states "Draft after unlock" and "Unlocked and changed"): who unlocked and when (IST), the reason the Lead gave, what the figures are (still the
 * ones from the approval, or cleared because an input changed since), that the price approved earlier stays, and whose Open queue the task is back in. It is drawn from the approval's own unlock, which the costs
 * view carries whatever the state of the figures, and only while the estimate is a Draft: the sentence about the queue stops being true once the estimate is Prepared again. It holds focus when an unlock has
 * just worked (`tabIndex` -1). A Server Component with no script. The reason is typed text, drawn as text: its line breaks are kept and a long word wraps.
 */

export interface UnlockedNoticeProps {
  readonly state: CostsView['state'];
  /** `null` while the approval stands (or there is none): nothing is drawn. */
  readonly unlock: NonNullable<CostsView['approval']>['unlock'] | null;
  /** The notice is for a Draft only. */
  readonly isDraft: boolean;
}

export function UnlockedNotice({ state, unlock, isDraft }: UnlockedNoticeProps) {
  if (unlock === null || !isDraft) return null;
  return (
    <div id={UNLOCKED_NOTICE_ID} tabIndex={-1} className="rounded-md">
      <Notice tone="info" role="status" title={unlockedNoticeTitle(formatIst(new Date(unlock.at)), unlock.byName)}>
        {unlock.reason === null ? null : <p className={cn('whitespace-pre-line', BREAK_LONG_NAMES)}>{unlockedReasonLine(unlock.reason)}</p>}
        <p>{state === 'current' ? UNLOCKED_FIGURES_CURRENT : UNLOCKED_FIGURES_CLEARED}</p>
        <p>{UNLOCKED_PRICE_STAYS}</p>
        <p>{unlockedQueueLine(unlock.engineerName)}</p>
      </Notice>
    </div>
  );
}
