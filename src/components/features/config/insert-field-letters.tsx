'use client';

import { ArrowRight } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { ColumnTag } from '@/components/shared/column-tag';
import { Icon } from '@/components/shared/icon';
import { Notice } from '@/components/shared/notice';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { previewInsert, type InsertPreviewView } from '@/lib/config/insert-field-client';
import { buildSpec, letterRows, placeKey, withTypedLabels, type InsertForm, type LetterRow } from '@/lib/config/insert-field-form';
import type { Outcome } from '@/lib/api-client';

import { LETTERS_FAILED, LETTERS_HEADING, LETTERS_LOADING, LETTERS_REGION_LABEL, LETTERS_WAITING, MOVED_NOTHING, PREVIEW_CAPTION, PREVIEW_COLUMNS, PREVIEW_REGION_LABEL, productCellWords } from './insert-field-texts';

/**
 * The letters an insert changes, drawn twice from one list of rows (STORY-08.03 AC-2, AC-3, AC-10): the live list "Letters after this insert" beside the formula in step 2, and the table of step 3. Both are the
 * server's answer to the same pure function that the save runs, so what is shown is what is stored; this file only draws it. Each is a named, focusable region that scrolls inside itself and never the page.
 */

/** What the live list shows: nothing to ask yet, the answer on its way, no answer, or the letters. */
export type LettersState = { readonly kind: 'waiting' } | { readonly kind: 'loading' } | { readonly kind: 'failed' } | { readonly kind: 'ready'; readonly preview: InsertPreviewView };

/**
 * Asks the server for the letters whenever the places change (`placeKey`): the kind, the column chosen, and for a pair the cost column's place. Typing a label or a formula does not ask again. A late answer
 * for places the Admin has since changed is dropped, and the list says "working out" until the answer for the current places arrives. A refusal (a place that names no column) is the same as not having chosen one yet.
 */
export function useLettersAfterInsert(form: InsertForm): LettersState {
  const key = placeKey(form);
  const [answer, setAnswer] = useState<{ readonly key: string; readonly outcome: Outcome<InsertPreviewView> } | null>(null);
  const ask = useEffectEvent(() => previewInsert(buildSpec(form), true));
  const chosen = form.afterFieldId !== '';

  useEffect(() => {
    if (!chosen) return undefined;
    let live = true;
    void ask().then((outcome) => {
      if (live) setAnswer({ key, outcome });
    });
    return () => {
      live = false;
    };
  }, [key, chosen]);

  if (!chosen) return { kind: 'waiting' };
  if (answer === null || answer.key !== key) return { kind: 'loading' };
  if (answer.outcome.status === 'ok') return { kind: 'ready', preview: answer.outcome.value };
  return answer.outcome.status === 'refused' ? { kind: 'waiting' } : { kind: 'failed' };
}

/** `AY` `→` `BA`, read as "AY becomes BA". */
function Shift({ was, becomes }: { readonly was: string; readonly becomes: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-s-1">
      <ColumnTag letter={was} kind="output" />
      <Icon icon={ArrowRight} size="small" />
      <span className="sr-only">becomes</span>
      <ColumnTag letter={becomes} kind="input" />
    </span>
  );
}

function RowLabel({ row }: { readonly row: LetterRow }) {
  return (
    <>
      {row.label}
      {row.cell === null ? null : (
        <>
          {', and '}
          <span className="sr-only">{productCellWords(row.cell.from, row.cell.to)}</span>
          <span aria-hidden="true">
            its cell {row.cell.from} → {row.cell.to}
          </span>
        </>
      )}
    </>
  );
}

function LetterList({ rows }: { readonly rows: ReadonlyArray<LetterRow> }) {
  return (
    <ul className="flex flex-col gap-s-2">
      {rows.map((row) => (
        <li key={row.key} className={cn('flex flex-wrap items-center gap-s-2 text-body', BREAK_LONG_NAMES)}>
          {row.was === null ? <ColumnTag letter={row.becomes} kind="input" /> : <Shift was={row.was} becomes={row.becomes} />}
          <span className="min-w-0">
            <RowLabel row={row} />
            {row.isNew ? <span className="text-ink-3"> (new)</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "Letters after this insert": the live list of step 2, a named, focusable region that scrolls inside itself. `labels` are the names typed so far for the new fields, in order. */
export function LettersAfterInsert({ state, labels }: { readonly state: LettersState; readonly labels: ReadonlyArray<string> }) {
  return (
    <div className="flex flex-col gap-s-2">
      <h3 className="text-label font-semibold text-ink-2">{LETTERS_HEADING}</h3>
      {state.kind === 'failed' ? (
        <Notice tone="warn">{LETTERS_FAILED}</Notice>
      ) : (
        <div role="region" aria-label={LETTERS_REGION_LABEL} tabIndex={0} className="max-h-60 min-w-0 overflow-auto rounded-md border border-border bg-surface-2 p-s-3">
          {state.kind === 'waiting' ? <p className="text-ink-2">{LETTERS_WAITING}</p> : null}
          {state.kind === 'loading' ? <p className="text-ink-2">{LETTERS_LOADING}</p> : null}
          {state.kind === 'ready' ? <LetterList rows={withTypedLabels(letterRows(state.preview), labels)} /> : null}
          {state.kind === 'ready' && state.preview.moved.length === 0 ? <p className="mt-s-2 text-ink-2">{MOVED_NOTHING}</p> : null}
        </div>
      )}
    </div>
  );
}

/** The table of step 3: was, becomes and the field, with the product's cells beside their column (AC-3). */
export function LetterChangesTable({ preview }: { readonly preview: InsertPreviewView }) {
  const rows = letterRows(preview);
  return (
    <Table regionLabel={PREVIEW_REGION_LABEL} caption={PREVIEW_CAPTION}>
      <TableHeader>
        <TableRow>
          <TableHead>{PREVIEW_COLUMNS.was}</TableHead>
          <TableHead>{PREVIEW_COLUMNS.becomes}</TableHead>
          <TableHead>{PREVIEW_COLUMNS.field}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="align-top">{row.was === null ? <span className="text-ink-2">New</span> : <ColumnTag letter={row.was} kind="output" />}</TableCell>
            <TableCell className="align-top">
              <ColumnTag letter={row.becomes} kind="input" />
            </TableCell>
            <TableCell className={cn('align-top', BREAK_LONG_NAMES)}>
              <RowLabel row={row} />
              {row.kind === null ? null : <span className="text-ink-3"> ({row.kind})</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
