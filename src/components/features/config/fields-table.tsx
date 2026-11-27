'use client';

import { ArrowDownToLine, Calculator, Lock, PenLine, Plus, Trash2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { Icon } from '@/components/shared/icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import type { ConfigFieldRow } from '@/lib/config/fields-client';
import { KIND_LABELS, placeLabel } from '@/lib/config/fields-list';
import type { FieldKind } from '@/lib/fields/types';

import { DELETE_ROW_LABEL } from './delete-field-texts';
import { ACTIONS_HEAD, CARDS_LABEL, EDIT_FORMULA, INSERT_AFTER, NO_FORMULA, NO_PLACE, SYSTEM_TAG, SYSTEM_TAG_HINT, TABLE_CAPTION, TABLE_REGION_LABEL } from './fields-texts';

/**
 * The rows of SCR-17 (STORY-08.01 AC-1 to AC-3, AC-7; AQP-473 DEF-118): a table from 768 px, where it scrolls inside its own named, focusable region and never the page, and a card for each
 * field below it. It draws the rows it is given and decides nothing. A Lead has no action (AC-4). The Admin gets "Edit formula" (STORY-08.02) on a field that has a formula, drawn from
 * `canEditFormula`; an icon button "Insert after" (STORY-08.03) on every row; and an icon button "Delete" (STORY-08.04) on every row that is not protected (`isProtected`: a System field, or one the code finds
 * by key and cannot do without), which have the lock tag "System" instead. The two icon buttons keep the names they had (the words are their accessible name, "Insert after ZA Cutting Cost").
 *
 * The kind is a neutral badge with its glyph and its word, the section is its name and a stage its number and name, and the formula column says where an auto field's value comes from (`lookup`, made on the
 * server because it names a column) or "No formula"; an input shows a faint dash, with "No formula" for a screen reader (the ux-expert, 2026-11-26).
 * A formula is code, so it is set in the mono face, and it wraps anywhere (`BREAK_LONG_NAMES`): a long formula makes the row taller and never the page wider.
 */

export interface FieldsTableProps {
  readonly rows: ReadonlyArray<ConfigFieldRow>;
  /** The Admin may edit a formula (STORY-08.02): a field that has one shows "Edit formula", which opens SCR-18. A Lead has no action (STORY-08.01 AC-4). */
  readonly canEdit?: boolean;
  /** The Admin pressed Delete on a row (STORY-08.04): the screen opens the dialog of SCR-20. Without it no Delete is drawn. */
  readonly onDelete?: ((row: ConfigFieldRow, button: HTMLButtonElement, byKeyboard: boolean) => void) | undefined;
  /** The row whose delete dialog's code is still loading: its Delete keeps its pressed look and says it is busy (UX spec 7.3.1 rule 11). */
  readonly pressedDeleteId?: string | null | undefined;
}

/** The size of a row's icon button: 44 px, and 36 px from 1024 px with a fine pointer (the mock-up's 36 px; NFR-017). */
const ICON_BUTTON = 'fine-wide:size-9';

const KIND_GLYPH: Readonly<Record<FieldKind, LucideIcon>> = { input: PenLine, auto: ArrowDownToLine, output: Calculator };

/** The kind: a neutral badge, its glyph (decoration) and its word. */
function KindBadge({ kind }: { readonly kind: FieldKind }) {
  return (
    <Badge tone="neutral">
      <Icon icon={KIND_GLYPH[kind]} size="badge" />
      {KIND_LABELS[kind]}
    </Badge>
  );
}

/** "Edit formula" for one field: a link drawn as a button, named for the field it opens (a screen reader hears "Edit formula for AL Cutting Cost"). */
function EditFormulaLink({ row }: { readonly row: ConfigFieldRow }) {
  return (
    <Button asChild variant="secondary" className="self-start">
      <Link href={`/config/fields/${row.id}/formula`}>
        {EDIT_FORMULA}
        <span className="sr-only">
          {' '}
          for {row.letter} {row.label}
        </span>
      </Link>
    </Button>
  );
}

/** "Insert after" for one column (STORY-08.03 AC-1): an icon link that opens SCR-19 with this column chosen, named for the column it follows. */
function InsertAfterLink({ row }: { readonly row: ConfigFieldRow }) {
  return (
    <Button asChild variant="secondary" size="icon" className={ICON_BUTTON}>
      <Link href={`/config/fields/new?after=${row.id}`} aria-label={`${INSERT_AFTER} ${row.letter} ${row.label}`}>
        <Icon icon={Plus} />
      </Link>
    </Button>
  );
}

/** "Delete" for one column (STORY-08.04 AC-1): an icon button that opens the dialog of SCR-20 over the list; named for the column it removes. */
function DeleteButton({ row, onDelete, pressed }: { readonly row: ConfigFieldRow; readonly onDelete: NonNullable<FieldsTableProps['onDelete']>; readonly pressed: boolean }) {
  return (
    <Button
      variant="secondary"
      size="icon"
      className={ICON_BUTTON}
      data-action="delete"
      aria-haspopup="dialog"
      aria-label={`${DELETE_ROW_LABEL} ${row.letter} ${row.label}`}
      {...(pressed ? ({ 'aria-busy': true } as const) : {})}
      onClick={(event) => onDelete(row, event.currentTarget, event.detail === 0)}
    >
      <Icon icon={Trash2} />
    </Button>
  );
}

function SystemTag() {
  return (
    <Badge tone="neutral" title={SYSTEM_TAG_HINT}>
      <Icon icon={Lock} size="badge" />
      {SYSTEM_TAG}
    </Badge>
  );
}

/** What the Admin may do with a row: edit its formula, insert after it, delete it. Nothing for a Lead. */
function RowActions({ row, onDelete, pressedDeleteId }: Pick<FieldsTableProps, 'onDelete' | 'pressedDeleteId'> & { readonly row: ConfigFieldRow }) {
  return (
    <div className="flex flex-wrap items-center gap-s-2 md:justify-end md:flex-nowrap">
      {row.canEditFormula ? <EditFormulaLink row={row} /> : null}
      <InsertAfterLink row={row} />
      {onDelete === undefined || row.isProtected ? null : <DeleteButton row={row} onDelete={onDelete} pressed={pressedDeleteId === row.id} />}
    </div>
  );
}

/** The formula, or the words that say where an auto field's value comes from, or that there is none, and the sentence that explains it when there is one (the estimate total, AC-3). */
function FormulaBlock({ row }: { readonly row: ConfigFieldRow }) {
  return (
    <div className="flex flex-col gap-s-2">
      {row.formula !== null ? (
        <code className={cn('font-mono text-body text-ink', BREAK_LONG_NAMES)}>{row.formula}</code>
      ) : row.lookup !== null ? (
        <span className={cn('font-mono text-body text-ink', BREAK_LONG_NAMES)}>{row.lookup}</span>
      ) : row.kind === 'input' ? (
        <>
          <span aria-hidden="true" className="text-ink-3">
            —
          </span>
          <span className="sr-only">{NO_FORMULA}</span>
        </>
      ) : (
        <span className="text-ink-3">{NO_FORMULA}</span>
      )}
      {row.note === null ? null : <p className="max-w-prose text-label text-ink-2">{row.note}</p>}
    </div>
  );
}

function FieldsTable({ rows, canEdit = false, onDelete, pressedDeleteId }: FieldsTableProps) {
  return (
    <Table regionLabel={TABLE_REGION_LABEL} caption={TABLE_CAPTION}>
      <TableHeader>
        <TableRow>
          <TableHead>Column</TableHead>
          <TableHead>Field</TableHead>
          <TableHead className="hidden lg:table-cell">Section or stage</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead>Formula</TableHead>
          {canEdit ? (
            <TableHead>
              <span className="sr-only">{ACTIONS_HEAD}</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} data-field-id={row.id} data-item-id={row.id}>
            <TableCell className="align-top">
              <ColumnTag letter={row.letter} kind={row.kind} />
            </TableCell>
            <TableCell className="align-top">
              <div className="flex flex-wrap items-center gap-s-2">
                <span className={cn('font-semibold text-ink', BREAK_LONG_NAMES)}>{row.label}</span>
                {row.isProtected ? <SystemTag /> : null}
              </div>
            </TableCell>
            <TableCell className={cn('hidden align-top text-ink-2 lg:table-cell', BREAK_LONG_NAMES)}>{placeLabel(row.place) ?? NO_PLACE}</TableCell>
            <TableCell className="align-top">
              <KindBadge kind={row.kind} />
            </TableCell>
            <TableCell className="align-top">
              <FormulaBlock row={row} />
            </TableCell>
            {canEdit ? (
              <TableCell className="align-top">
                <RowActions row={row} onDelete={onDelete} pressedDeleteId={pressedDeleteId} />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** A card for each field below 768 px: the letter, the name and the tags on the first line, then where it sits and its formula. */
function FieldCards({ rows, canEdit = false, onDelete, pressedDeleteId }: FieldsTableProps) {
  return (
    <ul aria-label={CARDS_LABEL} className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} data-field-id={row.id} data-item-id={row.id} className="flex flex-col gap-s-2 border-b border-border p-s-4 last:border-b-0">
          <div className="flex flex-wrap items-center gap-s-2">
            <ColumnTag letter={row.letter} kind={row.kind} />
            <span className={cn('min-w-0 font-semibold text-ink', BREAK_LONG_NAMES)}>{row.label}</span>
            {row.isProtected ? <SystemTag /> : null}
          </div>
          <div className={cn('flex flex-wrap items-center gap-x-s-2 text-label text-ink-2', BREAK_LONG_NAMES)}>
            <KindBadge kind={row.kind} />
            <span>{placeLabel(row.place) ?? NO_PLACE}</span>
          </div>
          <FormulaBlock row={row} />
          {canEdit ? <RowActions row={row} onDelete={onDelete} pressedDeleteId={pressedDeleteId} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function FieldsList({ rows, canEdit = false, onDelete, pressedDeleteId }: FieldsTableProps) {
  return (
    <>
      <div className="hidden md:block">
        <FieldsTable rows={rows} canEdit={canEdit} onDelete={onDelete} pressedDeleteId={pressedDeleteId} />
      </div>
      <div className="md:hidden">
        <FieldCards rows={rows} canEdit={canEdit} onDelete={onDelete} pressedDeleteId={pressedDeleteId} />
      </div>
    </>
  );
}
