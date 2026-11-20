import type { ReactNode } from 'react';

import { Notice } from '@/components/shared/notice';
import type { FigureState } from '@/lib/estimate/figure-state';
import { QUANTITY_WARNING_TITLE, quantityWarningMeaning, quantityWarningWhen, type WarnedRowText } from '@/lib/estimate/lead-warning-copy';

/**
 * "Warning on this calculation" (STORY-06.10 AC-3, AC-4; STORY-07.06 AC-1; UX spec v0.30 SCR-06 and SCR-10; UX-45 to UX-47; architecture section 4.3 "What the Lead sees"): the warn notice above the tiles (SCR-06) and
 * above the tables (SCR-10) that names who went ahead past a 0 in QTY per Assy, when, and on which rows. **One component for the two screens**, so they say the same words. It is drawn only while the figures are
 * `current`: in the other two states the list may be stale, so the view holds none (`figure-state`) and this draws nothing (AC-4). A Lead who recalculated is named with the time of that calculation, because each
 * calculation keeps its own record (A-26): `at` is the time of the calculation in view, written in IST. `children` are the extra sentences of a screen (SCR-10 says the file holds no warning).
 * A live region (`role="status"`); a Server Component with no script.
 */

export interface WarningNoticeProps {
  readonly state: FigureState;
  /** Who went ahead and the rows they went ahead on, as both views carry them (`costs.warning`, `export-summary.warning`); `null` when there is none. */
  readonly warning: { readonly madeBy: string; readonly rows: ReadonlyArray<WarnedRowText> } | null;
  /** The time of the calculation in view, written in IST (`formatIst`). */
  readonly at: string | null;
  /** Further sentences under the two that every screen says. */
  readonly children?: ReactNode;
}

export function WarningNotice({ state, warning, at, children }: WarningNoticeProps) {
  if (state !== 'current' || warning === null || at === null) return null;
  return (
    <Notice tone="warn" role="status" title={QUANTITY_WARNING_TITLE}>
      <p>{quantityWarningWhen(warning.madeBy, at, warning.rows)}</p>
      <p>{quantityWarningMeaning(warning.rows.length)}</p>
      {children}
    </Notice>
  );
}
