import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FieldsScreen } from '@/components/features/config/fields-screen';
import { FieldsList } from '@/components/features/config/fields-table';
import { noMatchTitle } from '@/components/features/config/fields-texts';
import { listConfigFields, toConfigFieldRow, type ConfigFieldRow } from '@/lib/config/fields-client';
import { filterFields, isKindFilter, KIND_FILTER_OPTIONS } from '@/lib/config/fields-list';

import { defined } from '../support/defined';

/**
 * STORY-08.01 AC-1, AC-2, AC-4 and AC-7 without a browser: what SCR-17 draws from the rows the server sends (the columns, the System tag, "No formula", the sentence under the total),
 * the banner of a Lead, the search and the kind filter, and the reading of the server's answer. The words are written out here from the UX spec and the story, not imported from the
 * product, so a changed sentence fails a test. The layouts at 360, 768 and 1366 px, axe and the keyboard are `tests/e2e/config-fields.spec.ts`. Every name and formula is invented.
 */

const row = (overrides: Partial<ConfigFieldRow> = {}): ConfigFieldRow => ({
  id: '00000000-0000-4000-8000-00000000f001',
  letter: 'ZA',
  label: 'Invented Output',
  place: 'Stage 9: Invented Stage',
  kind: 'output',
  formula: 'ZB * Invented-Rate-per-Unit',
  systemRole: null,
  note: null,
  canEditFormula: true,
  ...overrides,
});

const ROWS: ReadonlyArray<ConfigFieldRow> = [
  row({ id: '00000000-0000-4000-8000-00000000f010', letter: 'ZA', label: 'Invented Input', place: 'Section 1: Invented Section', kind: 'input', formula: null, canEditFormula: false }),
  row({ id: '00000000-0000-4000-8000-00000000f011', letter: 'ZB', label: 'Invented Auto', place: null, kind: 'auto', formula: null, canEditFormula: false, systemRole: 'sl-no' }),
  row({ id: '00000000-0000-4000-8000-00000000f012', letter: 'ZC', label: 'Invented Cost', formula: 'ZA * Invented-Rate-per-Unit' }),
  row({
    id: '00000000-0000-4000-8000-00000000f013',
    letter: 'ZD',
    label: 'Invented Total',
    formula: 'SUM(ZC)',
    systemRole: 'total',
    note: "The estimate total is the sum of every row's ZC.",
  }),
];

const render = (rows: ReadonlyArray<ConfigFieldRow>): string => renderToStaticMarkup(createElement(FieldsList, { rows }));

describe('AC-1: the columns of the table', () => {
  it('heads the table Column, Field, Section or stage, Kind and Formula, in a named, focusable, scrollable region', () => {
    const html = render(ROWS);
    for (const heading of ['Column', 'Field', 'Section or stage', 'Kind', 'Formula']) expect(html).toContain(`>${heading}</th>`);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Fields and formulas, scrollable"');
    expect(html).toContain('tabindex="0"');
  });

  it('shows each row with its letter, name, place, kind word and formula', () => {
    const html = render(ROWS);
    expect(html).toContain('Section 1: Invented Section');
    expect(html).toContain('ZA * Invented-Rate-per-Unit');
    expect(html).toContain('Excel column </span>ZC');
    for (const kind of ['Input', 'Auto', 'Output']) expect(html).toContain(`>${kind}<`);
  });

  it('says "No formula" for a field that has none and "Not placed" for one with no section or stage', () => {
    const html = render(ROWS);
    expect(html).toContain('No formula');
    expect(html).toContain('Not placed');
  });

  it('also draws a card for each field, for a phone, with the same words', () => {
    const html = render(ROWS);
    expect(html).toContain('<ul aria-label="Fields and formulas"');
    expect(html.match(/<li /g)).toHaveLength(ROWS.length);
  });
});

describe('AC-2 and AC-3: System fields and the sentence under the total', () => {
  it('tags a System field "System" and no other, and draws no action for anyone', () => {
    const html = render(ROWS);
    expect(html.match(/>System</g)).toHaveLength(4);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Edit formula');
    expect(html).not.toContain('Delete');
  });

  it('prints the sentence the server sent under the total', () => {
    expect(render(ROWS)).toContain("The estimate total is the sum of every row&#x27;s ZC.");
  });
});

describe('AC-4: the Lead is shown the same table under a banner, and the Admin is not', () => {
  it('shows "View only. Formulas are shown so you can check the arithmetic." to a Lead', () => {
    const html = renderToStaticMarkup(createElement(FieldsScreen, { viewOnly: true }));
    expect(html).toContain('View only.');
    expect(html).toContain('Formulas are shown so you can check the arithmetic.');
  });

  it('shows no banner to an Admin', () => {
    const html = renderToStaticMarkup(createElement(FieldsScreen, { viewOnly: false }));
    expect(html).not.toContain('View only');
  });
});

describe('AC-1 and AC-7: the search, the filter and the states', () => {
  it('opens with a labelled search and a kind filter, with the title and the line under it', () => {
    const html = renderToStaticMarkup(createElement(FieldsScreen, { viewOnly: false }));
    expect(html).toContain('>Fields and formulas</h1>');
    expect(html).toContain('for="field-search"');
    expect(html).toContain('placeholder="Letter, name or formula"');
    expect(html).toContain('for="field-kind"');
    for (const option of ['All fields', 'Inputs', 'Auto fields', 'Outputs']) expect(html).toContain(`>${option}</option>`);
  });

  it('is busy while the first read has not answered: the card is aria-busy and no row is drawn', () => {
    const html = renderToStaticMarkup(createElement(FieldsScreen, { viewOnly: false }));
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-field-id');
  });

  it('words the empty answer by what was typed, or by the filter alone', () => {
    expect(noMatchTitle('  cutting ')).toBe('No field matches "cutting"');
    expect(noMatchTitle('')).toBe('No field matches this filter');
  });
});

describe('the search and the kind filter', () => {
  it('finds a field by its letter, its name or its formula, in any case', () => {
    expect(filterFields(ROWS, 'zc', 'all').map((found) => found.letter)).toEqual(['ZC', 'ZD']);
    expect(filterFields(ROWS, 'INVENTED COST', 'all').map((found) => found.letter)).toEqual(['ZC']);
    expect(filterFields(ROWS, 'sum(', 'all').map((found) => found.letter)).toEqual(['ZD']);
  });

  it('keeps a row only if it has every word of the search', () => {
    expect(filterFields(ROWS, 'invented-rate zc', 'all').map((found) => found.letter)).toEqual(['ZC']);
    expect(filterFields(ROWS, 'invented nothing-like-this', 'all')).toEqual([]);
  });

  it('filters by kind, and by kind with a search', () => {
    expect(filterFields(ROWS, '', 'input').map((found) => found.letter)).toEqual(['ZA']);
    expect(filterFields(ROWS, '', 'auto').map((found) => found.letter)).toEqual(['ZB']);
    expect(filterFields(ROWS, '', 'output').map((found) => found.letter)).toEqual(['ZC', 'ZD']);
    expect(filterFields(ROWS, 'sum', 'input')).toEqual([]);
  });

  it('keeps every row for an empty search and "All fields"', () => {
    expect(filterFields(ROWS, '   ', 'all')).toHaveLength(ROWS.length);
  });

  it('knows its own options', () => {
    expect(KIND_FILTER_OPTIONS.map((option) => option.value)).toEqual(['all', 'input', 'auto', 'output']);
    expect(isKindFilter('output')).toBe(true);
    expect(isKindFilter('formula')).toBe(false);
  });
});

describe('reading the server answer', () => {
  const answer = (body: unknown, status = 200): typeof fetch => () => Promise.resolve(Response.json(body, { status }));

  it('turns a good row into a row, and refuses a row with a missing or wrongly typed member', () => {
    expect(toConfigFieldRow(defined(ROWS[0]))).toEqual(ROWS[0]);
    expect(toConfigFieldRow({ ...defined(ROWS[0]), kind: 'formula' })).toBeNull();
    expect(toConfigFieldRow({ ...defined(ROWS[0]), canEditFormula: 'yes' })).toBeNull();
    expect(toConfigFieldRow({ ...defined(ROWS[0]), note: undefined })).toBeNull();
    expect(toConfigFieldRow('ZA')).toBeNull();
  });

  it('reads the fields of a 200', async () => {
    expect(await listConfigFields(answer({ fields: ROWS }))).toEqual({ status: 'ok', value: ROWS });
  });

  it('is a failure, not a crash, for an answer of the wrong shape, a server fault and no answer at all', async () => {
    expect(await listConfigFields(answer({ fields: [{ letter: 'ZA' }] }))).toEqual({ status: 'failed' });
    expect(await listConfigFields(answer({ rows: [] }))).toEqual({ status: 'failed' });
    expect(await listConfigFields(answer({ title: 'x' }, 500))).toEqual({ status: 'failed' });
    expect(await listConfigFields(() => Promise.reject(new Error('offline')))).toEqual({ status: 'failed' });
  });

  it('is a refusal, with the server reason, for a 403', async () => {
    const outcome = await listConfigFields(answer({ type: 'about:blank', title: 'No access', status: 403, code: 'FORBIDDEN' }, 403));
    expect(outcome).toMatchObject({ status: 'refused', httpStatus: 403, code: 'FORBIDDEN' });
  });
});
