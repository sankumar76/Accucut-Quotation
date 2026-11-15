import type { FieldKind } from '../fields/types';

import type { ConfigFieldRow } from './fields-client';

/**
 * What the search box and the kind filter of SCR-17 keep (STORY-08.01 AC-1: "search by letter, name or formula and a filter by kind"). Pure and client-safe: it reads the rows the
 * server sent and decides nothing about a letter or a formula.
 */

/** The kind as a word, and as the filter's option (UX spec SCR-17: Input, Auto, Output). */
export const KIND_LABELS: Readonly<Record<FieldKind, string>> = { input: 'Input', auto: 'Auto', output: 'Output' };

/** "All fields" or one kind. */
export type KindFilter = 'all' | FieldKind;

export const KIND_FILTER_OPTIONS: ReadonlyArray<{ readonly value: KindFilter; readonly label: string }> = [
  { value: 'all', label: 'All fields' },
  { value: 'input', label: 'Inputs' },
  { value: 'auto', label: 'Auto fields' },
  { value: 'output', label: 'Outputs' },
];

export function isKindFilter(value: string): value is KindFilter {
  return KIND_FILTER_OPTIONS.some((option) => option.value === value);
}

/** The text a row is searched in: its letter, its name and its formula, so "BG", "cutting" and "SUM" all find it. */
function haystackOf(row: ConfigFieldRow): string {
  return `${row.letter} ${row.label} ${row.formula ?? ''}`.toLowerCase();
}

/** The rows that are of this kind and contain every word of the search, in any order and any case. An empty search keeps every row of the kind. */
export function filterFields(rows: ReadonlyArray<ConfigFieldRow>, query: string, kind: KindFilter): ReadonlyArray<ConfigFieldRow> {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  return rows.filter((row) => (kind === 'all' || row.kind === kind) && words.every((word) => haystackOf(row).includes(word)));
}
