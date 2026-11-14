'use client';

import { Lock } from 'lucide-react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import type { ConfigFieldRow } from '@/lib/config/fields-client';
import { KIND_LABELS } from '@/lib/config/fields-list';

import { CARDS_LABEL, NO_FORMULA, NO_PLACE, SYSTEM_TAG, SYSTEM_TAG_HINT, TABLE_CAPTION, TABLE_REGION_LABEL } from './fields-texts';

/**
 * The rows of SCR-17 (STORY-08.01 AC-1 to AC-3, AC-7): a table from 768 px, where it scrolls inside its own named, focusable region and never the page, and a card for each
 * field below it. It draws the rows it is given and decides nothing. There is no action in either layout: a Lead has none (AC-4), and the Admin's "Edit formula" and
 * "Delete" arrive with stories 08.02 onward, drawn from `canEditFormula` and `systemRole`, so a System field is tagged here but nothing offers to delete it.
 *
 * A formula is code, so it is set in the mono face, and it wraps anywhere (`BREAK_LONG_NAMES`): a long formula makes the row taller and never the page wider.
 */

export interface FieldsTableProps {
  readonly rows: ReadonlyArray<ConfigFieldRow>;
}

function SystemTag() {
  return (
    <Badge tone="neutral" title={SYSTEM_TAG_HINT}>
      <Icon icon={Lock} size="badge" />
      {SYSTEM_TAG}
    </Badge>
  );
}

/** The formula, or the words that say there is none, and the sentence that explains it when there is one (the estimate total, AC-3). */
function FormulaBlock({ row }: { readonly row: ConfigFieldRow }) {
  return (
    <div className="flex flex-col gap-s-2">
      {row.formula === null ? (
        <span className="text-ink-3">{NO_FORMULA}</span>
      ) : (
        <code className={cn('font-mono text-body text-ink', BREAK_LONG_NAMES)}>{row.formula}</code>
      )}
      {row.note === null ? null : <p className="max-w-prose text-label text-ink-2">{row.note}</p>}
    </div>
  );
}

function FieldsTable({ rows }: FieldsTableProps) {
  return (
    <Table regionLabel={TABLE_REGION_LABEL} caption={TABLE_CAPTION}>
      <TableHeader>
        <TableRow>
          <TableHead>Column</TableHead>
          <TableHead>Field</TableHead>
          <TableHead className="hidden lg:table-cell">Section or stage</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Formula</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-field-id={row.id}>
            <TableCell className="align-top">
              <ColumnTag letter={row.letter} kind={row.kind} />
            </TableCell>
            <TableCell className="align-top">
              <div className="flex flex-wrap items-center gap-s-2">
                <span className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{row.label}</span>
                {row.systemRole === null ? null : <SystemTag />}
              </div>
            </TableCell>
            <TableCell className={cn('hidden align-top text-ink-2 lg:table-cell', BREAK_LONG_NAMES)}>{row.place ?? NO_PLACE}</TableCell>
            <TableCell className="align-top text-ink-2">{KIND_LABELS[row.kind]}</TableCell>
            <TableCell className="align-top">
              <FormulaBlock row={row} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A card for each field below 768 px: the letter, the name and the tags on the first line, then where it sits and its formula. */
function FieldCards({ rows }: FieldsTableProps) {
  return (
    <ul aria-label={CARDS_LABEL} className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} data-field-id={row.id} className="flex flex-col gap-s-2 border-b border-border p-s-4 last:border-b-0">
          <div className="flex flex-wrap items-center gap-s-2">
            <ColumnTag letter={row.letter} kind={row.kind} />
            <span className={cn('min-w-0 font-semibold text-ink', BREAK_LONG_NAMES)}>{row.label}</span>
            {row.systemRole === null ? null : <SystemTag />}
          </div>
          <p className={cn('text-label text-ink-2', BREAK_LONG_NAMES)}>
            {KIND_LABELS[row.kind]}
            {' · '}
            {row.place ?? NO_PLACE}
          </p>
          <FormulaBlock row={row} />
        </li>
      ))}
    </ul>
  );
}

export function FieldsList({ rows }: FieldsTableProps) {
  return (
    <>
      <div className="hidden md:block">
        <FieldsTable rows={rows} />
      </div>
      <div className="md:hidden">
        <FieldCards rows={rows} />
      </div>
    </>
  );
}
