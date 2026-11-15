import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
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
 * The parts tree of SCR-06 (STORY-06.02 AC-2, AC-6; D-12, D-25; UX-53, UX-29): every row shows **its own BG** with its count beside it ("2 nos", already included in the figure). A parent shows
 * only its own row: there is no sum of the rows below it, no item total and no Σ, and the legend says so. While the figures may not be shown a row shows a dash ("Not calculated") or the
 * word "Cleared"; the count stays, because it is an input. The panel is a `details` element that is open at every width, so on a phone the tree can be folded away to leave the
 * tiles and the table in view (the "drawer" of the UX spec) with no script: nothing here ships to the browser as code.
 */

/** The indent of each level; a part deeper than the last entry keeps the last indent, so a deep tree never grows wider than its panel (no sideways scroll at 360 px). */
const LEVEL_INDENT = ['ml-0', 'ml-s-3', 'ml-s-4', 'ml-s-5', 'ml-s-6'] as const;

const levelOf = (slNo: string): number => slNo.split('.').length;
const indentOf = (slNo: string): string => LEVEL_INDENT[Math.min(levelOf(slNo), LEVEL_INDENT.length) - 1] ?? LEVEL_INDENT[0];

function figureOf(state: CostsView['state'], node: CostNode): ReactNode {
  if (state === 'current') return formatFigure(node.figures?.unitPrice ?? null);
  return state === 'out-of-date' ? <span className="italic">{CLEARED}</span> : NO_FIGURE;
}

/** The address of SCR-07 for a row: the task code and the row's Sl. No (STORY-06.03). A Lead and an Admin only: this folder is loaded for no one else. */
const costDetailsHref = (code: string, slNo: string): string => `/estimates/${encodeURIComponent(code)}/costs/${encodeURIComponent(slNo)}`;

function TreeRow({ node, state, code }: { readonly node: CostNode; readonly state: CostsView['state']; readonly code: string }) {
  return (
    <li className={cn('flex flex-col gap-s-1 rounded-md border border-border bg-surface px-s-3 py-s-2', indentOf(node.slNo))}>
      <div className="flex items-baseline gap-s-2 text-body text-ink">
        <span className="shrink-0 text-ink-2 tabular-nums">{node.slNo}</span>
        <span className={cn('min-w-0 flex-1', BREAK_LONG_NAMES)}>{node.name === '' ? TREE_PART_NAME : node.name}</span>
        <span className="shrink-0 text-label text-ink-2 tabular-nums">
          <span className="sr-only">{`${COUNT_HIDDEN_LABEL}: `}</span>
          {node.count === null ? NO_FIGURE : `${formatCount(node.count)} ${COUNT_UNIT}`}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{figureOf(state, node)}</span>
      </div>
      {state === 'current' && node.figures !== null ? (
        <p className="text-label text-ink-3 tabular-nums">{rowCurrencies(formatFigure(node.figures.unitPriceUsd), formatFigure(node.figures.unitPriceEur))}</p>
      ) : null}
      <p>
        <a href={costDetailsHref(code, node.slNo)} className="text-label font-semibold text-primary-ink underline underline-offset-2">
          {COST_DETAILS_LINK}
          <span className="sr-only">{` for ${node.slNo} ${node.name === '' ? TREE_PART_NAME : node.name}`}</span>
        </a>
      </p>
    </li>
  );
}

export interface ReviewTreeProps {
  /** The task code of the estimate, for the address of each row's cost details (STORY-06.03). */
  readonly code: string;
  readonly state: CostsView['state'];
  readonly letters: CostsView['letters'];
  readonly nodes: CostsView['nodes'];
}

export function ReviewTree({ code, state, letters, nodes }: ReviewTreeProps) {
  return (
    <details open className="rounded-md border border-border bg-surface-2">
      <summary className="flex min-h-(--control-h) cursor-pointer items-center px-s-4 text-body font-semibold text-ink">{TREE_TITLE}</summary>
      <div className="flex flex-col gap-s-3 px-s-4 pb-s-4">
        <p className="text-label text-ink-2">{treeLegend(letters.unitPrice, COUNT_FIELD_NAME)}</p>
        {state === 'out-of-date' ? <p className="text-label text-ink-2 italic">{TREE_CLEARED_LINE}</p> : null}
        {nodes.length === 0 ? (
          <p className="text-body text-ink-2">{TREE_EMPTY}</p>
        ) : (
          <ul className="flex flex-col gap-s-2">
            {nodes.map((node) => (
              <TreeRow key={node.id} node={node} state={state} code={code} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
