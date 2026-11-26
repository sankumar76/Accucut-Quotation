import type { ReactNode } from 'react';

import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { TreeLegend } from '@/components/shared/tree-legend';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { rowNameOf } from '@/lib/estimates/row-name';
import type { CostsView } from '@/server/views/schemas/costs';

import { TreeRow } from './review-tree-row';
import { COUNT_FIELD_NAME, TREE_CLEARED_LINE, TREE_EMPTY, TREE_TITLE, treeLegend } from './review-texts';

/**
 * The parts tree of SCR-06 (STORY-06.02 AC-2, AC-6; D-12, D-25; UX-53, UX-29; CR-01 item 3B), **read-only**: the same row component as the workspace tree (`PartsTreeList`), with the arrow, the kind icon,
 * the number and the name on the first line and, for the Lead and the Admin, the row's figures on a second line. No button and no "+": an arrow only tells that a branch is there. Every row shows **its own BG**
 * with its count beside it ("2 nos", already included in the figure). A parent shows only its own row: there is no sum of the rows below it, no item total and no Σ, and the legend says so. While the figures
 * may not be shown a row shows a dash ("Not calculated") or the word "Cleared"; the count stays, because it is an input. The panel is a `details` element that is open at every width, so on a phone the tree can
 * be folded away to leave the tiles and the table in view (the "drawer" of the UX spec) with no script: nothing here ships to the browser as code.
 */

/**
 * The panel (AQP-465, DEF-108). Below 1024 px it is the foldable `details` it was. From 1024 px it is the left column of the review (`estimate-review.tsx`): sticky below the top bar, as high as the window leaves it
 * (the sticky offsets are measured by `use-sticky-offsets`, with the top bar's height as the fallback) with a scroll of its own, and no longer foldable: the summary takes no press, and the content is shown even if
 * the element were closed (`::details-content`, which a browser that does not know it simply ignores).
 */
const TREE_PANEL =
  'rounded-md border border-border bg-surface-2 min-[1024px]:sticky min-[1024px]:top-[var(--sticky-top,var(--topbar-h))] min-[1024px]:max-h-[calc(100dvh-var(--sticky-top,var(--topbar-h))-var(--sticky-bottom,0px)-var(--s-4))] min-[1024px]:overflow-y-auto min-[1024px]:[&::details-content]:[content-visibility:visible]';

export interface ReviewTreeProps {
  /** The task code of the estimate, for the address of each row's cost details (STORY-06.03). */
  readonly code: string;
  readonly state: CostsView['state'];
  readonly letters: CostsView['letters'];
  readonly nodes: CostsView['nodes'];
  /** The rows of the calculation's quantity warning (STORY-06.10): each carries the mark "Quantity 0". Empty while the figures are not current. */
  readonly warned: ReadonlySet<string>;
  /** The Sl. No of the row whose inputs are shown beside the tree (`aria-current`), or null for an estimate with no rows. */
  readonly selectedSlNo?: string | null;
  /** The estimate can be corrected: the panel carries the mark of the editing tree (`data-review-tree-edit`) while the island's code is on its way and takes this tree's place. */
  readonly edit?: boolean;
}

/**
 * The panel and the lines above the tree, drawn the same way by the read-only tree and by the editing island (`review-tree-editor.tsx`; no hook here): the title, the name of the open row under 1024 px, the legend of the
 * figures and, while the figures are cleared, the line that says so. `edit` marks the island's panel (the page and the tests tell the two apart by it).
 */
export function ReviewTreeFrame({ selectedName, letters, state, edit = false, children }: { readonly selectedName: string; readonly letters: CostsView['letters']; readonly state: CostsView['state']; readonly edit?: boolean; readonly children: ReactNode }) {
  return (
    <details open data-review-tree="" {...(edit ? { 'data-review-tree-edit': '' } : {})} className={TREE_PANEL}>
      <summary className="flex min-h-(--control-h) cursor-pointer items-center px-s-4 text-body font-semibold text-ink min-[1024px]:pointer-events-none min-[1024px]:cursor-default">{TREE_TITLE}
        {/* Under 1024 px the panel folds after a row is chosen, and its summary says which row is open, so the way back to the tree is one press (AQP-488). */}
        {selectedName === '' ? null : <span className="ml-s-2 min-w-0 font-normal text-ink-2 min-[1024px]:hidden">{`· ${selectedName}`}</span>}
      </summary>
      <div className="flex flex-col gap-s-3 px-s-4 pb-s-4">
        <p className="text-label text-ink-2">{treeLegend(letters.unitPrice, COUNT_FIELD_NAME)}</p>
        {state === 'out-of-date' ? <p className="text-label text-ink-2 italic">{TREE_CLEARED_LINE}</p> : null}
        {children}
      </div>
    </details>
  );
}

export function ReviewTree({ code, state, letters, nodes, warned, selectedSlNo = null, edit = false }: ReviewTreeProps) {
  const selected = selectedSlNo === null ? undefined : nodes.find((node) => node.slNo === selectedSlNo);
  const selectedName = selected === undefined ? '' : `${selected.slNo} ${rowNameOf(selected.name, nodeKindLabel(selected, nodes))}`;
  return (
    <ReviewTreeFrame selectedName={selectedName} letters={letters} state={state} edit={edit}>
      {nodes.length === 0 ? (
        <p className="text-body text-ink-2">{TREE_EMPTY}</p>
      ) : (
        <>
          <PartsTreeList
            label={TREE_TITLE}
            nodes={nodes}
            renderRow={(node, kindLabel) => <TreeRow node={node} kindLabel={kindLabel} state={state} code={code} warned={warned.has(node.id)} selected={node.slNo === selectedSlNo} />}
          />
          <TreeLegend />
        </>
      )}
    </ReviewTreeFrame>
  );
}
