import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { NODE_KIND_NAMES, type NodeKind } from '@/lib/estimate/node-kinds';

/**
 * The legend at the foot of the parts tree (CR-01 item 3B, UX spec section 0.9 row 3; AQP-404): the four icons with their names, so a row needs no text label for its kind. A Part and a Sub-part share one
 * icon, so they share one entry ("Part or Sub-part"). The icons here are decorative: the words stand beside each one, so a screen reader reads the words, never an icon twice. There is no visible title and no
 * line above it, as in the SCR-05 mock-up (DEF-081 ruling item 14); the section keeps its name, "Row kinds", for assistive technology.
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
    <section aria-label={TREE_LEGEND_TITLE} data-tree-legend="">
      <ul className="flex flex-wrap gap-x-s-4 gap-y-s-2">
        {LEGEND.map(({ kind, words }) => (
          <li key={kind} className="flex items-center gap-s-2 text-label text-ink-2">
            <NodeKindIcon kind={kind} />
            {words}
          </li>
        ))}
      </ul>
    </section>
  );
}
