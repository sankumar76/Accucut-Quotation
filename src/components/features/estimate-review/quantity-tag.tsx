import { TriangleAlert } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { QUANTITY_TAG } from '@/lib/estimate/lead-warning-copy';

/**
 * The mark on a row that went ahead with 0 in QTY per Assy (STORY-06.10 AC-3; UX spec v0.30 SCR-06; UX-46): an icon **and** the words "Quantity 0", never colour alone, in the parts tree and in "How the total
 * is built". It does not depend on the tree: it is drawn from the calculation's own list (the costs view's `warning`), so it is there in the table, which has no tree. A Server Component with no script.
 */
export function QuantityTag() {
  return (
    <span data-quantity-tag="" className="inline-flex shrink-0 items-center gap-s-1 rounded-sm border border-accent-line bg-accent-soft px-s-1 text-label font-semibold text-accent-ink">
      <Icon icon={TriangleAlert} size="hint" className="shrink-0" />
      {QUANTITY_TAG}
    </span>
  );
}

/** The IDs of the rows of the warning, to ask of each row whether it is one. An absent warning is the empty set. */
export function warnedNodeIds(warning: { readonly rows: ReadonlyArray<{ readonly nodeId: string }> } | null): ReadonlySet<string> {
  return new Set(warning === null ? [] : warning.rows.map((row) => row.nodeId));
}
