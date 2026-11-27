import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { TREE_COLUMN_PANEL, TREE_COLUMN_SUMMARY } from '@/components/shared/tree-column-panel';
import { TOOLBAR_RESERVE, TREE_FOOT } from '@/components/shared/tree-chrome';
import { TreeLegend } from '@/components/shared/tree-legend';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { ADD_MAIN_ASSEMBLY } from '@/lib/estimates/tree-actions';
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

// The panel, its summary and the page layout are shared with SCR-07 (`tree-column-panel.ts`, AQP-465 and AQP-452).

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
  /** The estimate can be corrected: the panel carries the mark of the editing tree (`data-review-tree-edit`) while the island's code is on its way and takes this tree's place, and the tree holds the room of what the island adds (below). */
  readonly edit?: boolean;
}

/**
 * The panel and the lines above the tree, drawn the same way by the read-only tree and by the editing island (`review-tree-editor.tsx`; no hook here): the title, the name of the open row under 1024 px, the legend of the
 * figures and, while the figures are cleared, the line that says so. `edit` marks the island's panel (the page and the tests tell the two apart by it).
 */
export function ReviewTreeFrame({ selectedName, letters, state, edit = false, children }: { readonly selectedName: string; readonly letters: CostsView['letters']; readonly state: CostsView['state']; readonly edit?: boolean; readonly children: ReactNode }) {
  return (
    <details open data-review-tree="" {...(edit ? { 'data-review-tree-edit': '' } : {})} className={TREE_COLUMN_PANEL}>
      <summary className={TREE_COLUMN_SUMMARY}>{TREE_TITLE}
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
            // The editing island adds a toolbar line under each row and the foot with "Add main assembly"; this first paint holds their room, with nothing a person can use (inert, hidden from the screen readers), so the island
            // takes the tree's place without moving the page (DL-465, PRF-811-03).
            {...(edit ? { renderToolbar: () => <div inert aria-hidden="true" data-review-tree-reserve="" className={TOOLBAR_RESERVE} /> } : {})}
          />
          {edit ? (
            <div className={TREE_FOOT}>
              {/* The room of the "Add main assembly" button, with its real classes and its words, and `invisible`: nothing to see, press or read, and nothing left on the page if the island never comes (PF-20). */}
              <div inert aria-hidden="true" data-review-tree-reserve="" className="invisible">
                <span className={cn(buttonVariants({ variant: 'ghost' }))}>
                  <Icon icon={Plus} />
                  {ADD_MAIN_ASSEMBLY}
                </span>
              </div>
              <TreeLegend />
            </div>
          ) : (
            <TreeLegend />
          )}
        </>
      )}
    </ReviewTreeFrame>
  );
}
