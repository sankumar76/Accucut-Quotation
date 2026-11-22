import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { NODE_KIND_NAMES, type NodeKind } from '@/lib/estimate/node-kinds';

/**
 * The legend at the foot of the parts tree (CR-01 item 3B, UX spec section 0.9 row 3; AQP-404): the four icons with their names, so a row needs no text label for its kind. A Part and a Sub-part share one
 * icon, so they share one entry ("Part or Sub-part"). The icons here are decorative: the words stand beside each one, so a screen reader reads the words, never an icon twice.
 */
export const TREE_LEGEND_TITLE = 'Row kinds';

const LEGEND: ReadonlyArray<{ readonly kind: NodeKind; readonly words: string }> = [
  { kind: 'MAIN_ASSEMBLY', words: NODE_KIND_NAMES.MAIN_ASSEMBLY },
  { kind: 'SUB_ASSEMBLY', words: NODE_KIND_NAMES.SUB_ASSEMBLY },
  { kind: 'PART', words: `${NODE_KIND_NAMES.PART} or Sub-part` },
  { kind: 'FASTENER', words: NODE_KIND_NAMES.FASTENER },
];

export function TreeLegend() {
  return (
    <section aria-label={TREE_LEGEND_TITLE} data-tree-legend="" className="flex flex-col gap-s-2 border-t border-border pt-s-3">
      <p className="text-label font-semibold text-ink-2">{TREE_LEGEND_TITLE}</p>
      <ul className="flex flex-wrap gap-x-s-4 gap-y-s-2">
        {LEGEND.map(({ kind, words }) => (
          <li key={kind} className="flex items-center gap-s-2 text-label text-ink-2">
            <NodeKindIcon kind={kind} size="small" />
            {words}
          </li>
        ))}
      </ul>
    </section>
  );
}
