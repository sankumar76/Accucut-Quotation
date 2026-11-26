import Link from 'next/link';
import type { ReactNode } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { QuantityTag } from '@/components/shared/quantity-tag';
import { RowName } from '@/components/shared/row-name';
import { TOUCH_LINK } from '@/components/shared/touch-link';
import { TREE_ROW_NUMBER } from '@/components/shared/tree-row-number';
import { cn } from '@/lib/cn';
import { rowNameOf } from '@/lib/estimates/row-name';
import { formatCount, formatFigure, NO_FIGURE } from '@/lib/money';
import type { CostNode, CostsView } from '@/server/views/schemas/costs';

import { CLEARED, COST_DETAILS_LINK, COUNT_HIDDEN_LABEL, COUNT_UNIT, rowCurrencies } from './review-texts';

/**
 * One row of the review's parts tree: the first line is the link to the row's inputs, the second its count, its own figures, the mark of a warned row and the way to its cost details (AQP-488, DEF-131; UX ruling
 * `lead-admin-edit-inputs-2026-11-27.md` 3.1 and 4.7). **No hook and no `'use client'`**: the server tree of an estimate that cannot be edited (Approved, Quoted, ignored) and the editing island of one that can both draw
 * their rows with this one component, so the two cannot drift. The island hands it `onChoose` (a press chooses the row in place, with no navigation) and `takesFocus` (the row that was just added takes the focus); the
 * server tree hands neither, and the link is then a plain soft navigation.
 */

function figureOf(state: CostsView['state'], node: CostNode): ReactNode {
  if (state === 'current') return formatFigure(node.figures?.unitPrice ?? null);
  return state === 'out-of-date' ? <span className="italic">{CLEARED}</span> : NO_FIGURE;
}

/** The address of SCR-07 for a row: the task code and the row's Sl. No (STORY-06.03). A Lead and an Admin only: this folder is loaded for no one else. */
export const costDetailsHref = (code: string, slNo: string): string => `/estimates/${encodeURIComponent(code)}/costs/${encodeURIComponent(slNo)}`;

/** The address of a row's inputs on this page (AQP-488, DEF-131 Stage 1): the row is in the address, so the choice survives a reload and can be sent on; `#row-inputs` is where the block begins. */
export const inputsHref = (code: string, slNo: string): string => `/estimates/${encodeURIComponent(code)}?row=${encodeURIComponent(slNo)}#row-inputs`;

export interface TreeRowProps {
  readonly node: CostNode;
  readonly kindLabel: string;
  readonly state: CostsView['state'];
  readonly code: string;
  readonly warned: boolean;
  readonly selected: boolean;
  /** The island only: a press on the link (a mouse, a finger or Enter) chooses this row without leaving the page. The link keeps its address, so "open in a new tab" still works. */
  readonly onChoose?: ((id: string) => void) | undefined;
  /** The island only: true once for the row that was just added, whose link then takes the focus when it is mounted (CR-01 item 3C AC-3). A ref callback, so nothing is read while rendering. */
  readonly takesFocus?: ((id: string) => boolean) | undefined;
}

export function TreeRow({ node, kindLabel, state, code, warned, selected, onChoose, takesFocus }: TreeRowProps) {
  // The row's name by the one rule (AQP-446): typed, else the kind's own name, muted, with the words for a screen reader. The "Cost details" link says it in plain words.
  const name = rowNameOf(node.name, kindLabel);
  return (
    <div className="flex min-h-(--control-h) flex-col justify-center gap-s-1 py-s-1 pr-s-2 pl-s-1">
      {/* The first line is the link to this row's inputs (AQP-488): a soft navigation, so the tiles and the tree do not jump and no code is read again. Its name is the number and the name, "1.4 Top cover". */}
      <Link
        href={inputsHref(code, node.slNo)}
        scroll={false}
        prefetch={false}
        aria-label={`${node.slNo} ${name}`}
        {...(selected ? { 'aria-current': 'true' as const } : {})}
        {...(onChoose === undefined
          ? {}
          : {
              onClick: (event: { preventDefault: () => void }) => {
                event.preventDefault();
                onChoose(node.id);
              },
            })}
        {...(takesFocus === undefined
          ? {}
          : {
              ref: (link: HTMLAnchorElement | null) => {
                if (link !== null && takesFocus(node.id)) link.focus();
              },
            })}
        className={cn(
          'flex min-h-(--control-h) items-center gap-s-2 rounded-md text-body text-ink no-underline hover:bg-surface fine-wide:min-h-0',
          selected && 'bg-surface font-semibold shadow-[inset_3px_0_0_var(--primary)]',
        )}
      >
        <NodeKindIcon kind={node.nodeKind} label={kindLabel} />
        <span data-sl-no="" className={TREE_ROW_NUMBER}>
          {node.slNo}
        </span>
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
