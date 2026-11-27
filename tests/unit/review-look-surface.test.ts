import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SurfaceTreatments, type SurfaceTreatmentsProps } from '@/components/features/estimate-workspace/surface-treatments';
import type { FormField } from '@/lib/estimates/form-client';

/**
 * AQP-488 (DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.4, RO-8): in the Lead's read-only view the surface treatments (Z to AG) are the chosen ones as chips, always visible, in the
 * registry's order, under the label; none chosen says `None selected`; there is no pop-over, no checkbox and no button. Rendered to markup, no browser. Every name is invented.
 */

const flag = (letter: string, label: string, index: number): FormField => ({
  id: `00000000-0000-4000-8000-00000000f1${String(index).padStart(2, '0')}`,
  letter,
  label,
  kind: 'input',
  unit: null,
  hint: null,
  defaultValue: '0',
  required: false,
  editable: true,
  visibleWhen: null,
  rule: { type: 'flag' },
});

const FLAGS = [flag('Z', 'Hot Dip Galvanizing', 1), flag('AA', 'Primer', 2), flag('AE', 'Powder Coating', 3), flag('AF', 'Foam', 4)];
const [, PRIMER, POWDER, FOAM] = FLAGS as [FormField, FormField, FormField, FormField];

const chips = (texts: Record<string, string>, overrides: Partial<SurfaceTreatmentsProps> = {}): string =>
  renderToStaticMarkup(createElement(SurfaceTreatments, { id: 'part-field-section', fields: FLAGS, texts, editable: false, onToggle: () => undefined, review: true, ...overrides }));

describe('RO-8: the chosen surface treatments are chips', () => {
  it('lists the chosen ones in the registry order with their letters and "= 1", under the label, with no pop-over, checkbox or button', () => {
    const html = chips({ [FOAM.id]: '1', [POWDER.id]: '1', [PRIMER.id]: '0' });
    expect(html).toContain('Surface treatments');
    expect(html.indexOf('Powder Coating')).toBeGreaterThan(-1);
    expect(html.indexOf('Powder Coating')).toBeLessThan(html.indexOf('Foam'));
    expect(html).not.toContain('Primer');
    expect(html).not.toContain('Hot Dip');
    expect(html).toMatch(/Powder Coating[\s\S]*?AE[\s\S]*?= 1/);
    expect(html).not.toMatch(/<button|role="checkbox"|aria-haspopup|data-radix/);
  });

  it('says "None selected" when none is chosen, and never "0 selected"', () => {
    const html = chips({});
    expect(html).toContain('None selected');
    expect(html).not.toMatch(/<li/);
  });

  it('is a list a screen reader reads as one: a labelled group of list items', () => {
    const html = chips({ [PRIMER.id]: '1' });
    expect(html).toMatch(/<ul[^>]*aria-labelledby="part-field-section-label"/);
    expect(html).toMatch(/<li[^>]*>[\s\S]*Primer/);
  });

  it('draws no hint (the review look has none) and no click target: the chips are not focusable', () => {
    const html = chips({ [PRIMER.id]: '1' });
    expect(html).not.toContain('Choose every treatment this part needs');
    expect(html).not.toContain('tabindex');
  });
});

describe('the Engineer\'s control is unchanged without the prop', () => {
  it('still draws the trigger and the hint', () => {
    const html = renderToStaticMarkup(createElement(SurfaceTreatments, { id: 'part-field-section', fields: FLAGS, texts: {}, editable: true, onToggle: () => undefined }));
    expect(html).toContain('Choose every treatment this part needs');
    expect(html).toMatch(/<button/);
  });
});
