import { ChevronDown } from 'lucide-react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { Icon } from '@/components/shared/icon';
import { QuantityTag } from '@/components/shared/quantity-tag';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RowName } from '@/components/shared/row-name';
import { cn } from '@/lib/cn';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { hasRowName } from '@/lib/estimates/row-name';
import { formatCount, formatFigure, NO_FIGURE } from '@/lib/money';
import type { CostsView } from '@/server/views/schemas/costs';

import {
  BUILD_CAPTION,
  BUILD_EXAMPLE,
  BUILD_HEAD_PART,
  BUILD_HEAD_SL_NO,
  BUILD_HIDE,
  BUILD_SHOW,
  BUILD_REGION_LABEL,
  BUILD_TITLE,
  BUILD_TOTAL_LABEL,
  buildExplanation,
  COUNT_FIELD_NAME,
  ROUNDING_SENTENCE,
} from './review-texts';

/**
 * "How the total is built" (STORY-06.02 AC-3; UX spec SCR-06 "Content"; D-12, UX-02): one line for each row (Sl. No, part, its count for the whole order, its own BG) ending with the total, the
 * sum of the BG column, which is the BL tile's figure (CE-1: 0, 6 and 24 give 30). The worked example and the rounding sentence stand between the explanation and the table, as in the mock-up (AQP-491,
 * DEF-134); the Part column names the kind before the name, `Main Assembly: Control cabinet`, and a row with no name shows its kind once (DEF-135). It is a `details` panel, closed until
 * opened (AQP-468, DEF-112: the whole summary line is the control, with a chevron and the words "Show" while it is closed and "Hide" while it is open, by CSS alone), and it is drawn only while the figures are `current`: in the other states there is nothing to add up (UX spec SCR-06 "Total cleared"). The total is the figure the calculation stored,
 * not a sum made here, so the screen can never show a total that the record does not hold. No script.
 */

export interface BuildTableProps {
  readonly letters: CostsView['letters'];
  readonly nodes: CostsView['nodes'];
  readonly totalPrice: string | null;
  /** The rows of the calculation's quantity warning (STORY-06.10): each carries the mark "Quantity 0" in its Part cell. */
  readonly warned: ReadonlySet<string>;
}

export function BuildTable({ letters, nodes, totalPrice, warned }: BuildTableProps) {
  return (
    <details className="group/build rounded-md border border-border bg-surface">
      <summary className="flex min-h-(--control-h) cursor-pointer list-none items-center gap-s-2 px-s-4 text-body font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{BUILD_TITLE}</span>
        <span className="flex shrink-0 items-center gap-s-1 text-label font-normal text-ink-2">
          <Icon icon={ChevronDown} size="small" aria-hidden="true" className="transition-transform group-open/build:rotate-180" />
          <span className="group-open/build:hidden">{BUILD_SHOW}</span>
          <span className="hidden group-open/build:inline">{BUILD_HIDE}</span>
        </span>
      </summary>
      <div className="flex flex-col gap-s-3 px-s-4 pb-s-4">
        <p className="text-label text-ink-2">{buildExplanation(COUNT_FIELD_NAME, letters.count, letters.unitPrice)}</p>
        <p className="text-label text-ink-2">{BUILD_EXAMPLE}</p>
        <p className="text-label text-ink-2">{ROUNDING_SENTENCE}</p>
        <Table regionLabel={BUILD_REGION_LABEL} caption={BUILD_CAPTION}>
          <TableHeader>
            <TableRow>
              <TableHead>{BUILD_HEAD_SL_NO}</TableHead>
              <TableHead>{BUILD_HEAD_PART}</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-s-1">
                  {COUNT_FIELD_NAME}
                  <ColumnTag letter={letters.count} kind="input" />
                </span>
              </TableHead>
              <TableHead className="text-right">
                <ColumnTag letter={letters.unitPrice} kind="output" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => (
              <TableRow key={node.id}>
                <TableCell className="tabular-nums">{node.slNo}</TableCell>
                <TableCell className={cn('min-w-0', BREAK_LONG_NAMES)}>
                  {hasRowName(node.name) ? `${nodeKindLabel(node, nodes)}: ` : null}
                  <RowName label={node.name} kindLabel={nodeKindLabel(node, nodes)} />
                  {warned.has(node.id) ? (
                    <>
                      {' '}
                      <QuantityTag />
                    </>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{node.count === null ? NO_FIGURE : formatCount(node.count)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatFigure(node.figures?.unitPrice ?? null)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                {BUILD_TOTAL_LABEL(letters.unitPrice)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatFigure(totalPrice)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </details>
  );
}
