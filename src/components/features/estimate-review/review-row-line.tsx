import { QuantityTag } from '@/components/shared/quantity-tag';
import { TOUCH_LINK } from '@/components/shared/touch-link';
import { cn } from '@/lib/cn';
import { formatCount, formatFigure, formatRupees, NO_FIGURE } from '@/lib/money';
import type { CostNode, CostsView } from '@/server/views/schemas/costs';

import { CLEARED, COST_DETAILS_LINK, ROW_LINE_PREFIX, rowLineCount, rowLineFigures } from './review-texts';

export interface ReviewRowLineProps {
  readonly code: string;
  readonly node: CostNode;
  readonly state: CostsView['state'];
  readonly letters: CostsView['letters'];
  /** The row carries the mark of the calculation's quantity warning (STORY-06.10). */
  readonly warned: boolean;
}

/**
 * The row's own line under the title of its inputs (AQP-488, DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.3): `This row: ₹ 618.37 (BG) · $ 7.61 · € 6.97 · count 2 nos` and the way to its cost
 * details. While the figures are cleared it says `Cleared` and the count; while nothing is calculated, a dash and the count. The count is an input and always shows. It is drawn on the server from the one `CostNode`
 * the page has, so no figure is ever in the form or its code, and it is the only Lead-only output beside the inputs. A server component with no script.
 */
export function ReviewRowLine({ code, node, state, letters, warned }: ReviewRowLineProps) {
  const count = node.count === null ? NO_FIGURE : formatCount(node.count);
  const figure =
    state === 'current' && node.figures !== null
      ? rowLineFigures(formatRupees(node.figures.unitPrice), letters.unitPrice, formatFigure(node.figures.unitPriceUsd), formatFigure(node.figures.unitPriceEur))
      : state === 'out-of-date'
        ? CLEARED
        : NO_FIGURE;
  return (
    <p data-row-line="" className="flex flex-wrap items-baseline gap-x-s-2 gap-y-s-1 text-label text-ink-2 tabular-nums">
      <span>{`${ROW_LINE_PREFIX} ${figure} · ${rowLineCount(count)}`}</span>
      {warned ? <QuantityTag /> : null}
      <a href={`/estimates/${encodeURIComponent(code)}/costs/${encodeURIComponent(node.slNo)}`} className={cn(TOUCH_LINK, 'font-semibold text-primary-ink underline underline-offset-2')}>
        {COST_DETAILS_LINK}
      </a>
    </p>
  );
}
