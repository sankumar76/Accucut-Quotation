import Link from 'next/link';
import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { QuantityTag } from '@/components/shared/quantity-tag';
import { RowName } from '@/components/shared/row-name';
import { TOUCH_LINK } from '@/components/shared/touch-link';
import { TREE_COLUMN_PANEL, TREE_COLUMN_SUMMARY } from '@/components/shared/tree-column-panel';
import { TreeLegend } from '@/components/shared/tree-legend';
import { TREE_ROW_NUMBER } from '@/components/shared/tree-row-number';
import { cn } from '@/lib/cn';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { hasRowName, NO_DESCRIPTION_YET, rowNameOf } from '@/lib/estimates/row-name';
import { formatCount, formatFigure, NO_FIGURE } from '@/lib/money';
import type { CostNode, CostsView } from '@/server/views/schemas/costs';

import {
  CLEARED,
  COST_DETAILS_LINK,
  COUNT_FIELD_NAME,
  COUNT_HIDDEN_LABEL,
  COUNT_UNIT,
  rowCurrencies,
  TREE_CLEARED_LINE,
  TREE_EMPTY,
  TREE_TITLE,
  treeLegend,
} from './review-texts';

/**
 * The parts tree of SCR-06 (STORY-06.02 AC-2, AC-6; D-12, D-25; UX-53, UX-29; CR-01 item 3B), **read-only**: the same row component as the workspace tree (`PartsTreeList`), with the arrow, the kind icon,
 * the number and the name on the first line and, for the Lead and the Admin, the row's figures on a second line. No button and no "+": an arrow only tells that a branch is there. Every row shows **its own BG**
 * with its count beside it ("2 nos", already included in the figure). A parent shows only its own row: there is no sum of the rows below it, no item total and no Σ, and the legend says so. While the figures
 * may not be shown a row shows a dash ("Not calculated") or the word "Cleared"; the count stays, because it is an input. The panel is a `details` element that is open at every width, so on a phone the tree can
 * be folded away to leave the tiles and the table in view (the "drawer" of the UX spec) with no script: nothing here ships to the browser as code.
 */

// The panel, its summary and the page layout are shared with SCR-07 (`tree-column-panel.ts`, AQP-465 and AQP-452).

function figureOf(state: CostsView['state'], node: CostNode): ReactNode {
  if (state === 'current') return formatFigure(node.figures?.unitPrice ?? null);
  return state === 'out-of-date' ? <span className="italic">{CLEARED}</span> : NO_FIGURE;
}

/** The address of SCR-07 for a row: the task code and the row's Sl. No (STORY-06.03). A Lead and an Admin only: this folder is loaded for no one else. */
const costDetailsHref = (code: string, slNo: string): string => `/estimates/${encodeURIComponent(code)}/costs/${encodeURIComponent(slNo)}`;

/** The address of a row's inputs on this page (AQP-488, DEF-131 Stage 1): the row is in the address, so the choice survives a reload and can be sent on; `#row-inputs` is where the block begins. */
const inputsHref = (code: string, slNo: string): string => `/estimates/${encodeURIComponent(code)}?row=${encodeURIComponent(slNo)}#row-inputs`;

function TreeRow({
  node,
  kindLabel,
  state,
  code,
  warned,
  selected,
  guarded,
}: {
  readonly node: CostNode;
  readonly kindLabel: string;
  readonly state: CostsView['state'];
  readonly code: string;
  readonly warned: boolean;
  readonly selected: boolean;
  readonly guarded: boolean;
}) {
  // The row's name by the one rule (AQP-446): typed, else the kind's own name, muted, with the words for a screen reader. The "Cost details" link says it in plain words.
  const name = rowNameOf(node.name, kindLabel);
  return (
    <div className="flex min-h-(--control-h) flex-col justify-center gap-s-1 py-s-1 pr-s-2 pl-s-1">
      {/* The first line is the link to this row's inputs (AQP-488): a soft navigation, so the tiles and the tree do not jump and no code is read again. Its name is the number and the name, "1.4 Top cover". */}
      <Link
        href={inputsHref(code, node.slNo)}
        replace={guarded}
        scroll={false}
        prefetch={false}
        // The name starts with the kind (the icon's own label) and then says what the text says, word for word, so what is seen is in the name (WCAG 2.5.3, axe label-content-name-mismatch): "Sub-Assembly 1.4 Top cover".
        aria-label={`${kindLabel} ${node.slNo} ${hasRowName(node.name) ? node.name : `${kindLabel}${NO_DESCRIPTION_YET}`}`}
        {...(selected ? { 'aria-current': 'true' as const } : {})}
        className={cn(
          'flex min-h-(--control-h) items-center gap-s-2 rounded-md text-body text-ink no-underline hover:bg-surface fine-wide:min-h-0',
          selected && 'bg-surface font-semibold shadow-[inset_3px_0_0_var(--primary)]',
        )}
      >
        <NodeKindIcon kind={node.nodeKind} label={kindLabel} />
        <span data-sl-no="" className={TREE_ROW_NUMBER}>
          {node.slNo}
        </span>{' '}
        <span className={cn('min-w-0 flex-1', BREAK_LONG_NAMES)}>
          <RowName label={node.name} kindLabel={kindLabel} />
        </span>
      </Link>
      {/* The second line: the row's own figures (a Lead's and an Admin's screen only), its count, the mark of a warned row and the way to its cost details. */}
      <div className="flex flex-wrap items-baseline gap-x-s-3 gap-y-s-1 text-label text-ink-2">
        <span className="tabular-nums">
          <span className="sr-only">{`${COUNT_HIDDEN_LABEL}: `}</span>
          {node.count === null ? NO_FIGURE : `${formatCount(node.count)} ${COUNT_UNIT}`}
        </span>
        <span className="text-body font-semibold text-ink tabular-nums">{figureOf(state, node)}</span>
        {state === 'current' && node.figures !== null ? <span className="text-ink-3 tabular-nums">{rowCurrencies(formatFigure(node.figures.unitPriceUsd), formatFigure(node.figures.unitPriceEur))}</span> : null}
        {warned ? <QuantityTag /> : null}
        <a href={costDetailsHref(code, node.slNo)} className={cn(TOUCH_LINK, 'font-semibold text-primary-ink underline underline-offset-2')}>
          {COST_DETAILS_LINK}
          <span className="sr-only">{` for ${node.slNo} ${name}`}</span>
        </a>
      </div>
    </div>
  );
}

export interface ReviewTreeProps {
  /** The task code of the estimate, for the address of each row's cost details (STORY-06.03). */
  readonly code: string;
  readonly state: CostsView['state'];
  readonly letters: CostsView['letters'];
  readonly nodes: CostsView['nodes'];
  /** The page has the leave guard (the review while it is editable): a row link then replaces the page's entry, since the guard counts on its own entry being the only one above the page's (DEF-149, PF-23). Pages without the guard keep their own behaviour. */
  readonly guarded?: boolean;
  /** The rows of the calculation's quantity warning (STORY-06.10): each carries the mark "Quantity 0". Empty while the figures are not current. */
  readonly warned: ReadonlySet<string>;
  /** The Sl. No of the row whose inputs are shown beside the tree (`aria-current`), or null for an estimate with no rows. */
  readonly selectedSlNo?: string | null;
}

export function ReviewTree({ code, state, letters, nodes, warned, selectedSlNo = null, guarded = false }: ReviewTreeProps) {
  const selected = selectedSlNo === null ? undefined : nodes.find((node) => node.slNo === selectedSlNo);
  const selectedName = selected === undefined ? '' : `${selected.slNo} ${rowNameOf(selected.name, nodeKindLabel(selected, nodes))}`;
  return (
    <details open data-review-tree="" className={TREE_COLUMN_PANEL}>
      <summary className={TREE_COLUMN_SUMMARY}>{TREE_TITLE}
        {/* Under 1024 px the panel folds after a row is chosen, and its summary says which row is open, so the way back to the tree is one press (AQP-488). */}
        {selectedName === '' ? null : <span className="ml-s-2 min-w-0 font-normal text-ink-2 min-[1024px]:hidden">{`· ${selectedName}`}</span>}
      </summary>
      <div className="flex flex-col gap-s-3 px-s-4 pb-s-4">
        <p className="text-label text-ink-2">{treeLegend(letters.unitPrice, COUNT_FIELD_NAME)}</p>
        {state === 'out-of-date' ? <p className="text-label text-ink-2 italic">{TREE_CLEARED_LINE}</p> : null}
        {nodes.length === 0 ? (
          <p className="text-body text-ink-2">{TREE_EMPTY}</p>
        ) : (
          <>
            <PartsTreeList
              label={TREE_TITLE}
              nodes={nodes}
              renderRow={(node, kindLabel) => <TreeRow node={node} kindLabel={kindLabel} state={state} code={code} warned={warned.has(node.id)} selected={node.slNo === selectedSlNo} guarded={guarded} />}
            />
            <TreeLegend />
          </>
        )}
      </div>
    </details>
  );
}
