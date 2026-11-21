'use client';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import type { CheckpointRow } from '@/lib/config/checkpoints-client';
import { formatIst } from '@/lib/time';

import { CARDS_LABEL, CURRENT_VERSION_TAG, REVERT_ROW_LABEL, SEED_SAVED_BY, TABLE_CAPTION, TABLE_REGION_LABEL } from './checkpoints-texts';

/**
 * The rows of SCR-21 (STORY-08.06 AC-3, AC-10): a table from 768 px, where it scrolls inside its own named, focusable region and never the page, and a card for each checkpoint below it. It draws the rows it is given
 * and decides nothing. **Revert** is on every row except the one that names the current version (AC-3); it opens the dialog of the screen, and is named for the checkpoint it reverts to ("Revert to Before AY insert").
 * The seed checkpoint has no person: its "Saved by" cell is a dash, and a screen reader hears "no person, the original configuration".
 */

export interface CheckpointsTableProps {
  readonly rows: ReadonlyArray<CheckpointRow>;
  /** The number of the current version: the row that names it has no Revert. */
  readonly currentNumber: number;
  readonly onRevert: (row: CheckpointRow, byKeyboard: boolean) => void;
  /** The row whose dialog's code is still loading: its Revert keeps its pressed look and says it is busy (UX spec 7.3.1 rule 11). */
  readonly pressedRowId: string | null;
}

/** The person who saved it, or the dash of the seed checkpoint, which no person saved. */
function SavedBy({ row }: { readonly row: CheckpointRow }) {
  if (row.savedBy !== null) return <>{row.savedBy}</>;
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">No person, {SEED_SAVED_BY.toLowerCase()}</span>
    </>
  );
}

function RevertButton({ row, onRevert, pressed }: { readonly row: CheckpointRow; readonly onRevert: CheckpointsTableProps['onRevert']; readonly pressed: boolean }) {
  return (
    <Button
      variant="secondary"
      className="self-start"
      data-action="revert"
      aria-haspopup="dialog"
      {...(pressed ? ({ 'aria-busy': true } as const) : {})}
      onClick={(event) => onRevert(row, event.detail === 0)}
    >
      {REVERT_ROW_LABEL}
      <span className="sr-only"> to {row.name}</span>
    </Button>
  );
}

/** The action cell: Revert, or the tag that says this is the current version. */
function RowAction({ row, currentNumber, onRevert, pressedRowId }: Omit<CheckpointsTableProps, 'rows'> & { readonly row: CheckpointRow }) {
  if (row.versionNumber === currentNumber) return <Badge tone="neutral">{CURRENT_VERSION_TAG}</Badge>;
  return <RevertButton row={row} onRevert={onRevert} pressed={pressedRowId === row.id} />;
}

function CheckpointsTable(props: CheckpointsTableProps) {
  return (
    <Table regionLabel={TABLE_REGION_LABEL} caption={TABLE_CAPTION}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Version</TableHead>
          <TableHead>Saved</TableHead>
          <TableHead>By</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.rows.map((row) => (
          <TableRow key={row.id} data-item-id={row.id}>
            <TableCell className={cn('align-top font-semibold text-ink', BREAK_LONG_NAMES)}>{row.name}</TableCell>
            <TableCell className="align-top text-right tabular-nums">{row.versionNumber}</TableCell>
            <TableCell className="align-top text-ink-2">{formatIst(new Date(row.savedAt))}</TableCell>
            <TableCell className={cn('align-top text-ink-2', BREAK_LONG_NAMES)}>
              <SavedBy row={row} />
            </TableCell>
            <TableCell className="align-top">
              <RowAction row={row} currentNumber={props.currentNumber} onRevert={props.onRevert} pressedRowId={props.pressedRowId} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A card for each checkpoint below 768 px: the name, then the version, when and by whom, then Revert. */
function CheckpointCards(props: CheckpointsTableProps) {
  return (
    <ul aria-label={CARDS_LABEL} className="flex flex-col">
      {props.rows.map((row) => (
        <li key={row.id} data-item-id={row.id} className="flex flex-col gap-s-2 border-b border-border p-s-4 last:border-b-0">
          <span className={cn('min-w-0 font-semibold text-ink', BREAK_LONG_NAMES)}>{row.name}</span>
          <p className={cn('text-label text-ink-2', BREAK_LONG_NAMES)}>
            Version {row.versionNumber} · {formatIst(new Date(row.savedAt))} · <SavedBy row={row} />
          </p>
          <RowAction row={row} currentNumber={props.currentNumber} onRevert={props.onRevert} pressedRowId={props.pressedRowId} />
        </li>
      ))}
    </ul>
  );
}

export function CheckpointsList(props: CheckpointsTableProps) {
  return (
    <>
      <div className="hidden md:block">
        <CheckpointsTable {...props} />
      </div>
      <div className="md:hidden">
        <CheckpointCards {...props} />
      </div>
    </>
  );
}
