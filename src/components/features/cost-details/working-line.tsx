import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { cn } from '@/lib/cn';
import type { NodeCostsLine } from '@/server/views/schemas/node-costs';

import { BLANK_VALUE_LABEL, formulaLine, valueText, workingLine } from './cost-details-texts';

/**
 * One line of a stage on SCR-07 (STORY-06.03 AC-1, AC-2, AC-4, AC-5; UX spec SCR-07 "Layout"): the column tag, the name, the formula in letters (mono), the same formula with the values it was worked out
 * from (muted mono) and the value, right-aligned. It is a row of its stage's card (AQP-475, DEF-114: the mock-up's `.stage-row`): a grid of the tag, the bold name and the value on the first line, with the formula and
 * the working under the name; the text is in the order tag, name, value, formula, working, and the grid places it, so a screen reader and a test read what they always read. The text is plain text, never an image, and wraps at any width (`overflow-wrap: anywhere`), so a long formula never scrolls the page sideways at 360 px.
 * The line holds no control: a Lead only reads here (AC-6). A server component with no script.
 */

const TAG_KIND = { calculated: 'output', typed: 'input', lookup: 'auto' } as const;

export interface WorkingLineProps {
  readonly line: NodeCostsLine;
  /** True for the line of the row's own price (BG), which stage 6 draws highlighted. */
  readonly highlighted: boolean;
  /** True for the line that is the stage's total (the mock-up's `.is-total`): it is shaded. */
  readonly isTotal?: boolean;
}

export function WorkingLineItem({ line, highlighted, isTotal = false }: WorkingLineProps) {
  const formula = formulaLine(line);
  const worked = workingLine(line);
  return (
    <li
      className={cn(
        'grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-x-s-3 gap-y-s-1 border-t px-s-3 py-s-2 text-body md:grid-cols-[3.5rem_minmax(0,1fr)_auto]',
        highlighted ? 'border-nav bg-nav text-on-fill' : cn('border-border text-ink', isTotal && 'bg-surface-2'),
      )}
    >
      <span className="col-start-1 row-start-1 justify-self-start">
        <ColumnTag letter={line.letter} kind={TAG_KIND[line.kind]} />
      </span>
      <span className={cn('col-start-2 row-start-1 min-w-0 font-semibold', BREAK_LONG_NAMES)}>{line.name}</span>
      <span className="col-start-3 row-start-1 text-right font-semibold whitespace-nowrap tabular-nums">
        {line.blank ? <span className="sr-only">{BLANK_VALUE_LABEL}</span> : valueText(line)}
      </span>
      {formula === null ? null : <p className={cn('col-start-2 row-start-2 font-mono text-label', highlighted ? 'text-on-fill' : 'text-ink-2', BREAK_LONG_NAMES)}>{formula}</p>}
      {worked === null ? null : <p className={cn('col-start-2 row-start-3 font-mono text-label', highlighted ? 'text-on-fill' : 'text-ink-3', BREAK_LONG_NAMES)}>{worked}</p>}
    </li>
  );
}
