import { Notice } from '@/components/shared/notice';
import { QUANTITY_WARNING_TITLE, quantityWarningMeaning, quantityWarningWhen } from '@/lib/estimate/lead-warning-copy';
import type { CostsView } from '@/server/views/schemas/costs';

/**
 * "Warning on this calculation" (STORY-06.10 AC-3, AC-4; UX spec v0.30 SCR-06; UX-45, UX-46; architecture section 4.3 "What the Lead sees"): the warn notice above the tiles that names who went ahead past a 0 in
 * QTY per Assy, when, and on which rows. It is drawn only while the figures are `current`: in the other two states the list may be stale, so the costs view holds none (`figure-state`) and this draws nothing
 * (AC-4). A Lead who recalculated is named with the time of that calculation, because each calculation keeps its own record (A-26): `at` is the time of the calculation in view, written in IST.
 * A live region (`role="status"`, UX spec SCR-06 "Accessibility"); a Server Component with no script.
 */

export interface WarningNoticeProps {
  readonly state: CostsView['state'];
  readonly warning: CostsView['warning'];
  /** The time of the calculation in view, written in IST (`formatIst`). */
  readonly at: string | null;
}

export function WarningNotice({ state, warning, at }: WarningNoticeProps) {
  if (state !== 'current' || warning === null || at === null) return null;
  return (
    <Notice tone="warn" role="status" title={QUANTITY_WARNING_TITLE}>
      <p>{quantityWarningWhen(warning.madeBy, at, warning.rows)}</p>
      <p>{quantityWarningMeaning(warning.rows.length)}</p>
    </Notice>
  );
}
