'use client';

import { Pencil, Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';

import { ColumnTag } from '@/components/shared/column-tag';
import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { Table, TableActionsCell, TableActionsHead, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { formatDefaultValue, PERCENT_UNIT, unitLabel } from '@/lib/masters/process-items';
import type { ProcessItemRow } from '@/lib/masters/process-items-client';

import { isOpener, type Opener } from './master-opener';
import { BREAK_LONG_NAMES } from './master-texts';
import { NOT_USED } from './process-texts';

/**
 * The rates of SCR-11 (STORY-02.01 AC-1, AC-7): a table from 768 px, where it scrolls inside its own container only, and a card for
 * each rate below it. Both carry the same two actions with the same names; the row actions of the table are the 36 px icon buttons
 * of dense tables, the cards' are full-size. It decides nothing: it draws the rates it is given and tells its parent which action
 * was pressed, with the button, so focus can return to it.
 *
 * "Used in" shows the column letters of the formulas that use the rate, which the server derived from the current configuration.
 * The column "Customers with own value" of the mock-up arrives with the customers (story 02.02).
 */

export type RowAction = 'edit' | 'delete';

export interface ProcessListProps {
  readonly items: ReadonlyArray<ProcessItemRow>;
  /** The button whose dialog is still loading: it keeps its pressed look and says it is busy (UX spec 7.3.1 rule 11). */
  readonly pendingOpener: Opener | null;
  readonly onAction: (action: RowAction, item: ProcessItemRow, opener: HTMLButtonElement, byKeyboard: boolean) => void;
}

/** The accessible name of an action: it names the rate, so a list of identical icons can be told apart. */
const ACTION_NAMES: Readonly<Record<RowAction, (item: ProcessItemRow) => string>> = {
  edit: (item) => `Edit ${item.name}`,
  delete: (item) => `Delete ${item.name}`,
};

function UsedIn({ item }: { readonly item: ProcessItemRow }) {
  if (item.usedBy.length === 0) return <span className="text-ink-3">{NOT_USED}</span>;
  const letters = [...new Set(item.usedBy.map((use) => use.letter))];
  return (
    <span className="flex flex-wrap gap-s-1">
      {letters.map((letter) => (
        <ColumnTag key={letter} letter={letter} kind="output" />
      ))}
    </span>
  );
}

function RowActions({ item, pendingOpener, onAction, compact }: ProcessListProps & { readonly item: ProcessItemRow; readonly compact: boolean }) {
  const press = (action: RowAction) => (event: MouseEvent<HTMLButtonElement>) => onAction(action, item, event.currentTarget, event.detail === 0);
  const size = compact ? 'icon-row' : 'default';
  const variant = compact ? 'ghost' : 'secondary';
  // Passed only when true: an explicit `aria-busy={undefined}` would replace the one a `loading` button sets itself.
  const busyFor = (action: RowAction) => (isOpener(pendingOpener, item.id, action) ? ({ 'aria-busy': true } as const) : {});
  const label = (text: string, glyph: typeof Pencil) => (compact ? <Icon icon={glyph} size="large" /> : <><Icon icon={glyph} />{text}</>);

  return (
    <div className={compact ? 'flex flex-nowrap items-center justify-end gap-s-2' : 'flex flex-wrap gap-s-2'}>
      <Button variant={variant} size={size} data-action="edit" aria-label={ACTION_NAMES.edit(item)} {...busyFor('edit')} onClick={press('edit')}>
        {label('Edit', Pencil)}
      </Button>
      <Button variant={variant} size={size} data-action="delete" aria-label={ACTION_NAMES.delete(item)} {...busyFor('delete')} onClick={press('delete')}>
        {label('Delete', Trash2)}
      </Button>
    </div>
  );
}

/** The table from 768 px: it scrolls inside its own container only. */
function ProcessTable(props: ProcessListProps) {
  return (
    <Table regionLabel="Process master rates, scrollable" caption="Process master rates" actionButtons={2}>
      <TableHeader>
        <TableRow>
          <TableHead>Rate name</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Default value</TableHead>
          <TableHead>Used in</TableHead>
          <TableActionsHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.items.map((item) => (
          <TableRow key={item.id} data-item-id={item.id}>
            <TableCell className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{item.name}</TableCell>
            <TableCell className="text-ink-2">{unitLabel(item.unit)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatDefaultValue(item.defaultValue, item.unit)}</TableCell>
            <TableCell>
              <UsedIn item={item} />
            </TableCell>
            <TableActionsCell>
              <RowActions {...props} item={item} compact />
            </TableActionsCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A card for each rate below 768 px. */
function ProcessCards(props: ProcessListProps) {
  return (
    <ul aria-label="Process master rates" className="flex flex-col">
      {props.items.map((item) => (
        <li key={item.id} data-item-id={item.id} className="flex flex-col gap-s-3 border-b border-border p-s-4 last:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-s-2">
            <span className="min-w-0 font-semibold break-words text-ink">{item.name}</span>
            <UsedIn item={item} />
          </div>
          <div className="flex flex-wrap items-baseline gap-s-2">
            <span className="text-sub font-semibold tabular-nums text-ink">{formatDefaultValue(item.defaultValue, item.unit)}</span>
            {item.unit === PERCENT_UNIT ? null : <span className="text-label text-ink-2">{unitLabel(item.unit)}</span>}
          </div>
          <RowActions {...props} item={item} compact={false} />
        </li>
      ))}
    </ul>
  );
}

export function ProcessList(props: ProcessListProps) {
  return (
    <>
      <div className="hidden md:block">
        <ProcessTable {...props} />
      </div>
      <div className="md:hidden">
        <ProcessCards {...props} />
      </div>
    </>
  );
}
