import { Notice } from '@/components/shared/notice';
import { RATES_CHANGED_AFTER_LINK, RATES_CHANGED_LINK, RATES_CHANGED_TITLE, ratesChangedSentence } from '@/lib/estimate/rates-changed-copy';
import type { CostsView } from '@/server/views/schemas/costs';

import { REVIEW_CALCULATE_ID } from './review-ids';

/**
 * "Rates changed" (STORY-06.11 AC-1, AC-4, AC-9; UX spec v0.31 SCR-06 state "Rates changed", UX-62; FR-106; architecture section 4.8): the info notice that tells a Lead or an Admin, before approving, that rates changed
 * since the calculation in view: how many, **by kind and never a value** (NFR-002), and since when (IST). The link is to **Recalculate** in the action bar, which the bar draws whenever this notice is drawn (see
 * `ReviewActions`: a link never points at a missing button, AC-10); **approving is not blocked**, and the notice says so. It is a live region (`role="status"`), a Server Component with no script: the link is a plain
 * fragment link, reachable with the keyboard, and the browser moves to the button.
 *
 * It is drawn only while the figures are `current` and the costs view holds the counts, which the service gives only for an estimate that is not APPROVED and only when something changed (AC-3, AC-4, AC-6). **The
 * notice is as true as the page load**: a rate that changes while the page is open is not caught until the page is drawn again (the story's documented limit).
 */

export interface RatesChangedNoticeProps {
  readonly state: CostsView['state'];
  readonly ratesChanged: CostsView['ratesChanged'];
  /** The time of the calculation in view, written in IST (`formatIst`). */
  readonly at: string | null;
}

export function RatesChangedNotice({ state, ratesChanged, at }: RatesChangedNoticeProps) {
  if (state !== 'current' || ratesChanged === null || at === null) return null;
  return (
    <Notice tone="info" role="status" title={RATES_CHANGED_TITLE}>
      <p>
        {ratesChangedSentence(ratesChanged, at)}{' '}
        <a href={`#${REVIEW_CALCULATE_ID}`} className="font-semibold text-primary-ink underline underline-offset-2">
          {RATES_CHANGED_LINK}
        </a>{' '}
        {RATES_CHANGED_AFTER_LINK}
      </p>
    </Notice>
  );
}
