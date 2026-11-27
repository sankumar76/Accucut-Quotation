import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FieldsScreen } from '@/components/features/config/fields-screen';
import { FieldsList } from '@/components/features/config/fields-table';
import { toConfigFieldRow, type ConfigFieldRow } from '@/lib/config/fields-client';
import { configurationNote, placeLabel } from '@/lib/config/fields-list';

/**
 * AQP-473 (DEF-118; UX spec SCR-17, the mock-up `SCR-17.html` and `SCR-17-lead.html`, conformance C-17-01; ux-expert answers of 2026-11-26): the header has the Admin's two buttons and the note of the configuration
 * version; the section column shows the name of the section, a stage its number and name; the kind is a neutral badge with its glyph and its word; the formula column says where an auto field's value comes from, and an
 * input shows a faint dash; the Admin's row actions are icon buttons that keep their names. The words are written out from the mock-up, not imported. The widths, axe and the keyboard are `tests/e2e/config-fields.spec.ts`.
 * Every name is invented.
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
  lookup: null,
  canEditFormula: true,
  isProtected: false,
  ...overrides,
});

const INPUT = row({ id: '00000000-0000-4000-8000-00000000f010', letter: 'ZA', label: 'Invented Input', place: 'Section 1: Invented Section', kind: 'input', formula: null, canEditFormula: false });
const AUTO_WITH_SOURCE = row({ id: '00000000-0000-4000-8000-00000000f011', letter: 'ZB', label: 'Invented Auto', place: 'Section 2: Another Section', kind: 'auto', formula: null, canEditFormula: false, lookup: 'Invented-Lookup for ZA', isProtected: true });
const AUTO_PLAIN = row({ id: '00000000-0000-4000-8000-00000000f012', letter: 'ZC', label: 'Invented Plain Auto', place: null, kind: 'auto', formula: null, canEditFormula: false });
const OUTPUT = row({ id: '00000000-0000-4000-8000-00000000f013', letter: 'ZD', label: 'Invented Cost' });
const ROWS = [INPUT, AUTO_WITH_SOURCE, AUTO_PLAIN, OUTPUT];

const table = (html: string): string => html.slice(html.indexOf('<table'), html.indexOf('</table>'));
const admin = (rows: ReadonlyArray<ConfigFieldRow> = ROWS): string => renderToStaticMarkup(createElement(FieldsList, { rows, canEdit: true, onDelete: () => undefined }));

describe('AQP-473: the section or stage column', () => {
  it('shows a section by its name and a stage by its number and name', () => {
    expect(placeLabel('Section 1: Part Details')).toBe('Part Details');
    expect(placeLabel('Stage 3: Process Costs')).toBe('3 Process Costs');
    expect(placeLabel('Something else')).toBe('Something else');
    expect(placeLabel(null)).toBeNull();
  });

  it('draws it so in the table and the cards', () => {
    const html = renderToStaticMarkup(createElement(FieldsList, { rows: ROWS }));
    expect(html).toContain('>Invented Section<');
    expect(html).toContain('>9 Invented Stage<');
    expect(html).not.toContain('Section 1:');
    expect(html).not.toContain('Stage 9:');
  });
});

describe('AQP-473: the kind is a neutral badge with its glyph and its word', () => {
  it.each([
    ['Input', 'lucide-pen-line'],
    ['Auto', 'lucide-arrow-down-to-line'],
    ['Output', 'lucide-calculator'],
  ])('draws %s with %s, the glyph hidden from assistive technology', (word, glyph) => {
    const html = table(renderToStaticMarkup(createElement(FieldsList, { rows: ROWS })));
    const badge = new RegExp(`<span[^>]*data-slot="badge"[^>]*><svg[^>]*${glyph}[^>]*aria-hidden="true"[^>]*>[\\s\\S]*?</svg>${word}</span>`);
    expect(html).toMatch(badge);
  });
});

describe('AQP-473: the formula column', () => {
  it('says where an auto field gets its value when the server gave the words, and "No formula" for any other auto field', () => {
    const html = table(renderToStaticMarkup(createElement(FieldsList, { rows: ROWS })));
    expect(html).toContain('Invented-Lookup for ZA');
    const plain = html.slice(html.indexOf('Invented Plain Auto'));
    expect(plain.slice(0, plain.indexOf('</tr>'))).toContain('No formula');
  });

  it('shows an input a faint dash, with "No formula" for a screen reader', () => {
    const html = table(renderToStaticMarkup(createElement(FieldsList, { rows: [INPUT] })));
    expect(html).toMatch(/<span aria-hidden="true" class="text-ink-3">—<\/span><span class="sr-only">No formula<\/span>/);
  });
});

describe('AQP-473: the Admin\'s row actions are icon buttons that keep their names', () => {
  it('draws Insert after as an icon link named for its column, and Delete as an icon button, with no visible word', () => {
    const html = table(admin([INPUT]));
    expect(html).toContain('aria-label="Insert after ZA Invented Input"');
    expect(html).toContain('aria-label="Delete ZA Invented Input"');
    expect(html).toContain('lucide-plus');
    expect(html).toContain('lucide-trash-2');
    expect(html).not.toMatch(/>Insert after</);
    expect(html).not.toMatch(/>Delete</);
  });

  it('keeps "Edit formula" as the words it was, on a field that has a formula', () => {
    expect(table(admin([OUTPUT]))).toContain('Edit formula');
  });
});

describe('AQP-473: the head of the page', () => {
  const screen = (viewOnly: boolean): string => renderToStaticMarkup(createElement(FieldsScreen, { viewOnly }));

  it('gives the Admin the description of the mock-up, Checkpoints and Insert field', () => {
    const html = screen(false);
    expect(html).toContain('The worksheet as a column list. Letters follow the column order and update when you insert or delete a field.');
    expect(html).toMatch(/<a[^>]*href="\/config\/checkpoints"[^>]*>[\s\S]*?Checkpoints<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/config\/fields\/new"[^>]*>[\s\S]*?Insert field<\/a>/);
  });

  it('gives a Lead the read-only description and neither button', () => {
    const html = screen(true);
    expect(html).toContain('The worksheet as a column list. You can read every formula; only the Admin can change them.');
    expect(html).not.toContain('Insert field');
    expect(html).not.toContain('href="/config/checkpoints"');
  });

  it('writes the note of the configuration, with the version once it is known and without it before', () => {
    expect(configurationNote(9, 67, 'A', 'BO')).toBe('Configuration version 9. 67 columns, A to BO.');
    expect(configurationNote(null, 67, 'A', 'BO')).toBe('67 columns, A to BO.');
  });
});

describe('AQP-473: the answer of the server carries the words of an auto field', () => {
  it('reads `lookup` as text or null, and refuses a row without it', () => {
    expect(toConfigFieldRow({ ...AUTO_WITH_SOURCE })?.lookup).toBe('Invented-Lookup for ZA');
    expect(toConfigFieldRow({ ...INPUT })?.lookup).toBeNull();
    expect(toConfigFieldRow(Object.fromEntries(Object.entries(INPUT).filter(([key]) => key !== 'lookup')))).toBeNull();
  });
});
