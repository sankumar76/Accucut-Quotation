import type { FieldKind } from '../fields/types';

import type { ConfigFieldRow } from './fields-client';

/**
 * What the search box and the kind filter of SCR-17 keep (STORY-08.01 AC-1: "search by letter, name or formula and a filter by kind"). Pure and client-safe: it reads the rows the
 * server sent and decides nothing about a letter or a formula.
 */

/** The kind as a word, and as the filter's option (UX spec SCR-17: Input, Auto, Output). */
export const KIND_LABELS: Readonly<Record<FieldKind, string>> = { input: 'Input', auto: 'Auto', output: 'Output' };

/**
 * The section or stage of a field as the mock-up writes it (AQP-473, DEF-118): a section by its name ("Part Details"), a stage by its number and name ("3 Process Costs"). The server sends "Section 1: Part Details"
 * and "Stage 3: Process Costs"; any other text is shown as it came.
 */
export function placeLabel(place: string | null): string | null {
  if (place === null) return null;
  const section = /^Section \d+: (.+)$/.exec(place);
  if (section?.[1] !== undefined) return section[1];
  const stage = /^Stage (\d+): (.+)$/.exec(place);
  if (stage?.[1] !== undefined && stage[2] !== undefined) return `${stage[1]} ${stage[2]}`;
  return place;
}

/** The note under the search of SCR-17: "Configuration version 9. 67 columns, A to BO." The version is left out until it is known. */
export function configurationNote(version: number | null, columns: number, first: string, last: string): string {
  const range = `${columns} columns, ${first} to ${last}.`;
  return version === null ? range : `Configuration version ${version}. ${range}`;
}

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
