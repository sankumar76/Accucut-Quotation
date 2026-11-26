import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FieldRenderer, type FieldRendererProps } from '@/components/features/estimate-workspace/field-renderer';
import { NOT_ENTERED } from '@/components/features/estimate-workspace/review-look-texts';
import type { FormField, FormRule } from '@/lib/estimates/form-client';

/**
 * AQP-488 (DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.4, RO-3, RO-4, RO-6, RO-14): the field of the Lead's read-only view, rendered to markup with no browser. An empty field says
 * `Not entered` (in the box, italic, muted, and in a hidden description a screen reader reads after the label); a stored `0` and `None` show as they are; a field that follows something (Sl. No., Material
 * Considered) is not "Not entered"; nothing is a control that changes a value. The same renderer as the Engineer's, with one prop. Every name is invented.
 */

const field = (id: string, rule: FormRule, over: Partial<FormField> = {}): FormField => ({
  id: `00000000-0000-4000-8000-00000000d0${id}`,
  letter: 'J',
  label: 'Length',
  kind: 'input',
  unit: 'mm',
  hint: null,
  defaultValue: null,
  required: false,
  editable: true,
  visibleWhen: null,
  rule,
  ...over,
});

const NUMBER = field('01', { type: 'number', decimals: 2 });
const TEXT = field('02', { type: 'text', maxLength: 100, multiline: false }, { letter: 'B', label: 'Part No.', unit: null });
const REMARKS = field('03', { type: 'text', maxLength: 1000, multiline: true }, { letter: 'AJ', label: 'Remarks', unit: null });
const CHOICE = field('04', { type: 'choice', options: ['Black', 'White'] }, { letter: 'S', label: 'Fasteners', unit: null });
const MATERIAL = field('05', { type: 'select', source: 'materials' }, { letter: 'E', label: 'Material in Drawing', unit: null });
const DERIVED = field('06', { type: 'derived', from: null }, { letter: 'A', label: 'Sl. No.', unit: null, editable: false, kind: 'auto' });

const render = (formField: FormField, text: string, overrides: Partial<FieldRendererProps> = {}): string =>
  renderToStaticMarkup(
    createElement(FieldRenderer, {
      field: formField,
      text,
      error: undefined,
      editable: false,
      materials: { status: 'ready', value: [] },
      onChange: () => undefined,
      onCommit: () => undefined,
      review: true,
      ...overrides,
    }),
  );

describe('RO-4: an empty field says "Not entered"', () => {
  it('a number: placeholder in italic ink-2 (not the faint ink-3) and a hidden description after the label', () => {
    const html = render(NUMBER, '');
    expect(html).toContain(`placeholder="${NOT_ENTERED}"`);
    expect(html).toMatch(/class="[^"]*placeholder:italic[^"]*placeholder:text-ink-2/);
    expect(html).toMatch(new RegExp(`<span id="[^"]+-empty" class="sr-only">${NOT_ENTERED}</span>`));
    expect(html).toMatch(/aria-describedby="[^"]*-empty/);
  });

  it('an empty field with a unit keeps the square right corner that joins the box to its unit (QLT-800-03)', () => {
    const html = render(NUMBER, '');
    expect(html).toMatch(/class="[^"]*rounded-r-none[^"]*placeholder:italic|class="[^"]*placeholder:italic[^"]*rounded-r-none/);
  });

  it('a text, a multi-line text, a list and the materials list: the same words', () => {
    expect(render(TEXT, '')).toContain(`placeholder="${NOT_ENTERED}"`);
    expect(render(REMARKS, '')).toContain(`placeholder="${NOT_ENTERED}"`);
    expect(render(CHOICE, '')).toMatch(new RegExp(`<option value=""[^>]*>${NOT_ENTERED}</option>`));
    expect(render(MATERIAL, '')).toMatch(new RegExp(`<option value=""[^>]*>${NOT_ENTERED}</option>`));
  });

  it('a field that follows something (Sl. No., Material Considered) is never "Not entered"', () => {
    const html = render(DERIVED, '');
    expect(html).not.toContain(NOT_ENTERED);
  });

  it('a stored 0 shows 0, a stored None shows None, and a typed text shows as it is: no "Not entered"', () => {
    for (const [formField, text] of [[NUMBER, '0'], [CHOICE, 'None'], [TEXT, 'None'], [REMARKS, 'Deburr all edges']] as const) {
      const html = render(formField, text);
      expect(html, text).not.toContain(NOT_ENTERED);
    }
    expect(render(NUMBER, '0')).toMatch(/value="0"/);
  });
});

describe('RO-6: nothing here changes a value', () => {
  it('every control is read-only: `readonly` and `aria-readonly` on a box, `aria-readonly` on a list, none `disabled` (it stays in the tab order)', () => {
    const number = render(NUMBER, '12.5');
    expect(number).toMatch(/<input[^>]*readOnly=""|<input[^>]*readonly=""/);
    expect(number).toContain('aria-readonly="true"');
    expect(number).not.toContain('disabled=""');
    const list = render(CHOICE, 'Black');
    expect(list).toContain('aria-readonly="true"');
    expect(list).not.toContain('disabled=""');
  });
});

describe('RO-11: no hint is drawn by the renderer when the part gives none, and a hint it is given stays', () => {
  it('draws the hint the caller leaves on the field (the QTY per Assy one) and nothing else', () => {
    expect(render({ ...NUMBER, hint: 'For the whole order.' }, '3')).toContain('For the whole order.');
    expect(render(NUMBER, '3')).not.toMatch(/-hint/);
  });
});
