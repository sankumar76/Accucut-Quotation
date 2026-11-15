import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { cn } from '@/lib/cn';
import type { NodeCostsLine } from '@/server/views/schemas/node-costs';

import { BLANK_VALUE_LABEL, formulaLine, valueText, workingLine } from './cost-details-texts';

/**
 * One line of a stage on SCR-07 (STORY-06.03 AC-1, AC-2, AC-4, AC-5; UX spec SCR-07 "Layout"): the column tag, the name, the formula in letters (mono), the same formula with the values it was worked out
 * from (muted mono) and the value, right-aligned. The text is plain text, never an image, and wraps at any width (`overflow-wrap: anywhere`), so a long formula never scrolls the page sideways at 360 px.
 * The line holds no control: a Lead only reads here (AC-6). A server component with no script.
 */

const TAG_KIND = { calculated: 'output', typed: 'input', lookup: 'auto' } as const;

export interface WorkingLineProps {
  readonly line: NodeCostsLine;
  /** True for the line of the row's own price (BG), which stage 6 draws highlighted. */
  readonly highlighted: boolean;
}

export function WorkingLineItem({ line, highlighted }: WorkingLineProps) {
  const formula = formulaLine(line);
  const worked = workingLine(line);
  return (
    <li className={cn('flex flex-col gap-s-1 rounded-md border px-s-3 py-s-2', highlighted ? 'border-nav bg-nav text-on-fill' : 'border-border bg-surface text-ink')}>
      <div className="flex items-baseline gap-s-2 text-body">
        <ColumnTag letter={line.letter} kind={TAG_KIND[line.kind]} />
        <span className={cn('min-w-0 flex-1', BREAK_LONG_NAMES)}>{line.name}</span>
        <span className="shrink-0 text-right font-semibold tabular-nums">
          {line.blank ? <span className="sr-only">{BLANK_VALUE_LABEL}</span> : valueText(line)}
        </span>
      </div>
      {formula === null ? null : <p className={cn('font-mono text-label', highlighted ? 'text-on-fill' : 'text-ink-2', BREAK_LONG_NAMES)}>{formula}</p>}
      {worked === null ? null : <p className={cn('font-mono text-label', highlighted ? 'text-on-fill' : 'text-ink-3', BREAK_LONG_NAMES)}>{worked}</p>}
    </li>
  );
}
