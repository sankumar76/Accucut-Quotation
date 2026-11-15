import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatCount, formatFigure, NO_FIGURE } from '@/lib/money';
import type { CostsView } from '@/server/views/schemas/costs';

import {
  BUILD_CAPTION,
  BUILD_EXAMPLE,
  BUILD_HEAD_PART,
  BUILD_HEAD_SL_NO,
  BUILD_REGION_LABEL,
  BUILD_TITLE,
  BUILD_TOTAL_LABEL,
  COUNT_FIELD_NAME,
  ROUNDING_SENTENCE,
  TREE_PART_NAME,
} from './review-texts';

/**
 * "How the total is built" (STORY-06.02 AC-3; UX spec SCR-06 "Content"; D-12, UX-02): one line for each row (Sl. No, part, its count for the whole order, its own BG) ending with the total, the
 * sum of the BG column, which is the BL tile's figure (CE-1: 0, 6 and 24 give 30). The worked example and the rounding sentence stand under the table. It is a `details` panel, closed until
 * opened, and it is drawn only while the figures are `current`: in the other states there is nothing to add up (UX spec SCR-06 "Total cleared"). The total is the figure the calculation stored,
 * not a sum made here, so the screen can never show a total that the record does not hold. No script.
 */

export interface BuildTableProps {
  readonly letters: CostsView['letters'];
  readonly nodes: CostsView['nodes'];
  readonly totalPrice: string | null;
}

export function BuildTable({ letters, nodes, totalPrice }: BuildTableProps) {
  return (
    <details className="rounded-md border border-border bg-surface">
      <summary className="flex min-h-(--control-h) cursor-pointer items-center px-s-4 text-body font-semibold text-ink">{BUILD_TITLE(letters.unitPrice)}</summary>
      <div className="flex flex-col gap-s-3 px-s-4 pb-s-4">
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
                <TableCell className={cn('min-w-0', BREAK_LONG_NAMES)}>{node.name === '' ? TREE_PART_NAME : node.name}</TableCell>
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
        <p className="text-label text-ink-2">{BUILD_EXAMPLE}</p>
        <p className="text-label text-ink-2">{ROUNDING_SENTENCE}</p>
      </div>
    </details>
  );
}
