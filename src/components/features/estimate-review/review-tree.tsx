import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { QuantityTag } from '@/components/shared/quantity-tag';
import { TOUCH_LINK } from '@/components/shared/touch-link';
import { TreeLegend } from '@/components/shared/tree-legend';
import { TREE_ROW_NUMBER } from '@/components/shared/tree-row-number';
import { cn } from '@/lib/cn';
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
  TREE_PART_NAME,
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

function figureOf(state: CostsView['state'], node: CostNode): ReactNode {
  if (state === 'current') return formatFigure(node.figures?.unitPrice ?? null);
  return state === 'out-of-date' ? <span className="italic">{CLEARED}</span> : NO_FIGURE;
}

/** The address of SCR-07 for a row: the task code and the row's Sl. No (STORY-06.03). A Lead and an Admin only: this folder is loaded for no one else. */
const costDetailsHref = (code: string, slNo: string): string => `/estimates/${encodeURIComponent(code)}/costs/${encodeURIComponent(slNo)}`;

function TreeRow({ node, kindLabel, state, code, warned }: { readonly node: CostNode; readonly kindLabel: string; readonly state: CostsView['state']; readonly code: string; readonly warned: boolean }) {
  const name = node.name === '' ? TREE_PART_NAME : node.name;
  return (
    <div className="flex min-h-(--control-h) flex-col justify-center gap-s-1 py-s-1 pr-s-2 pl-s-1">
      <div className="flex items-center gap-s-2 text-body text-ink">
        <NodeKindIcon kind={node.nodeKind} label={kindLabel} />
        <span data-sl-no="" className={TREE_ROW_NUMBER}>
          {node.slNo}
        </span>
        <span className={cn('min-w-0 flex-1', BREAK_LONG_NAMES)}>{name}</span>
      </div>
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
  /** The rows of the calculation's quantity warning (STORY-06.10): each carries the mark "Quantity 0". Empty while the figures are not current. */
  readonly warned: ReadonlySet<string>;
}

export function ReviewTree({ code, state, letters, nodes, warned }: ReviewTreeProps) {
  return (
    <details open className="rounded-md border border-border bg-surface-2">
      <summary className="flex min-h-(--control-h) cursor-pointer items-center px-s-4 text-body font-semibold text-ink">{TREE_TITLE}</summary>
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
              renderRow={(node, kindLabel) => <TreeRow node={node} kindLabel={kindLabel} state={state} code={code} warned={warned.has(node.id)} />}
            />
            <TreeLegend />
          </>
        )}
      </div>
    </details>
  );
}
