import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FormulaEditor } from '@/components/features/config/formula-editor';
import type { ConfigFieldRow } from '@/lib/config/fields-client';

/**
 * AQP-479 (DEF-122; UX spec SCR-18, the mock-up `SCR-18.html`, conformance C-18-01): the editor has a breadcrumb, the intro of the mock-up, a card headed "Formula" with an "Output" tag, the label "Formula for AL",
 * and, under the check, "Shows in the cost details as" with the formula as typed (a faint dash while there is nothing to show). The words are written out from the mock-up. A static render: the live check, the
 * suggestions and the save are `tests/e2e/formula-editor.spec.ts`. Every name is invented.
 */

// A row as the editor reads it. Cast, not typed in full: the editor reads only the letter, the label and the formula, and the row's other members change with SCR-17's work (a new one is not this file's business).
const FIELD = {
  id: '00000000-0000-4000-8000-00000000f001',
  letter: 'ZA',
  label: 'Invented Cost',
  place: 'Stage 9: Invented Stage',
  kind: 'output',
  formula: 'ZB * Invented-Rate-per-Unit',
  systemRole: null,
  note: null,
  canEditFormula: true,
  isProtected: false,
} as ConfigFieldRow;

const html = (field: ConfigFieldRow = FIELD): string => renderToStaticMarkup(createElement(FormulaEditor, { field, fields: [field], version: 4 }));

describe('AQP-479: the head of the editor', () => {
  it('has a breadcrumb: Fields and formulas, a slash, and the field, which is the current page', () => {
    const page = html();
    expect(page).toMatch(/<nav aria-label="Breadcrumb"[^>]*><a[^>]*href="\/config\/fields"[^>]*>Fields and formulas<\/a><span[^>]*aria-hidden="true"[^>]*>\/<\/span><span[^>]*aria-current="page"[^>]*>ZA Invented Cost<\/span><\/nav>/);
    expect(page.indexOf('aria-label="Breadcrumb"')).toBeLessThan(page.indexOf('<h1'));
  });

  it('keeps the heading and uses the intro of the mock-up under it', () => {
    const page = html();
    expect(page).toContain('Edit formula: ZA Invented Cost');
    expect(page).toContain('Type letters, rate names, numbers, + - * / and brackets. SUM, MIN, MAX, ROUND and IF are available. SUM(column) adds a column over every row of the estimate.');
    expect(page).not.toContain('Check it as you type, try it on a sample row');
  });
});

describe('AQP-479: the card of the formula', () => {
  it('is headed "Formula" with an Output tag, and labels the box "Formula for" the column', () => {
    const page = html();
    expect(page).toMatch(/<h2[^>]*>Formula<\/h2>[\s\S]{0,300}?data-slot="badge"[^>]*>[\s\S]*?Output<\/span>/);
    expect(page).toMatch(/<label[^>]*for="formula-text"[^>]*>Formula for[\s\S]*?Excel column <\/span>ZA/);
  });

  it('shows the formula as typed under the check, in the mono face, with the mock-up\'s label', () => {
    const page = html();
    expect(page).toMatch(/Shows in the cost details as<\/span><code[^>]*font-mono[^>]*>ZB \* Invented-Rate-per-Unit<\/code>/);
  });

  it('shows a faint dash for a formula with nothing in it, and "No formula" for a screen reader', () => {
    const page = html({ ...FIELD, formula: '' });
    expect(page).toMatch(/Shows in the cost details as<\/span><span[^>]*aria-hidden="true"[^>]*>—<\/span><span class="sr-only">No formula<\/span>/);
  });
});
