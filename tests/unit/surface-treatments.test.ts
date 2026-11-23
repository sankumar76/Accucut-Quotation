import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SurfaceTreatments, type SurfaceTreatmentsProps } from '@/components/features/estimate-workspace/surface-treatments';
import { surfaceSelectedText } from '@/components/features/estimate-workspace/surface-texts';
import { TreatmentSelect, type TreatmentSelectProps } from '@/components/features/estimate-workspace/treatment-select';
import type { FormField } from '@/lib/estimates/form-client';
import { encodeTreatment } from '@/lib/estimate/treatment-value';
import { OTHER_TREATMENT_ID } from '@/lib/masters/system-entries';

/**
 * STORY-05.06 AC-1, AC-2, AC-3: the two controls of the part form, rendered to markup with no browser (the first paint). The popover's list, the arrow keys and Escape, the "Other" box, "(no longer
 * listed)" and the three widths need a browser: `tests/e2e/estimate-treatments.spec.ts`, in CI. The first-load graph is held by `overlay-imports.test.ts`.
 */

const flag = (letter: string, label: string, index: number): FormField => ({
  id: `00000000-0000-4000-8000-00000000f0${String(index).padStart(2, '0')}`,
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

const FLAGS = [flag('Z', 'Hot Dip Galvanizing', 1), flag('AA', 'Primer', 2), flag('AB', 'Shot Blasting', 3), flag('AF', 'Foam', 4)];
const PRIMER = FLAGS[1] as FormField;
const FOAM = FLAGS[3] as FormField;

const surface = (overrides: Partial<SurfaceTreatmentsProps> = {}): string =>
  renderToStaticMarkup(createElement(SurfaceTreatments, { id: 'part-field-section', fields: FLAGS, texts: {}, editable: true, onToggle: () => undefined, ...overrides }));

describe('AC-2: the trigger says what is chosen, as text', () => {
  it('says "None selected" while nothing is chosen, and the label and the hint are there', () => {
    const markup = surface();
    expect(markup).toContain('None selected');
    expect(markup).toContain('Surface treatments');
    expect(markup).toContain('Choose every treatment this part needs.');
  });

  it('says how many are chosen and which, in the order of the list: "2 selected: Primer, Foam"', () => {
    expect(surface({ texts: { [FOAM.id]: '1', [PRIMER.id]: '1' } })).toContain('2 selected: Primer, Foam');
  });

  it('a 0 is not chosen, and a flag that was never typed is not chosen', () => {
    const markup = surface({ texts: { [PRIMER.id]: '0' } });
    expect(markup).toContain('None selected');
    expect(surfaceSelectedText([])).toBe('None selected');
    expect(surfaceSelectedText(['Foam'])).toBe('1 selected: Foam');
  });

  it('is one button that opens a list, named by its label and what is chosen, with the hint as its description; the list is not drawn until it is opened', () => {
    const markup = surface({ texts: { [PRIMER.id]: '1' } });
    expect(markup).toMatch(/<button[^>]*id="part-field-section"[^>]*aria-haspopup="dialog"/);
    expect(markup).toContain('aria-labelledby="part-field-section-label part-field-section-value"');
    expect(markup).toContain('aria-describedby="part-field-section-hint"');
    expect(markup).not.toContain('role="checkbox"');
  });

  it('the trigger is 44 px high at least, and may grow to show every chosen name', () => {
    expect(surface()).toContain('min-h-(--control-h)');
  });
});

const NAME = 'part-field-treatment';
const select = (text: string, overrides: Partial<TreatmentSelectProps> = {}): string =>
  renderToStaticMarkup(
    createElement(TreatmentSelect, {
      control: { id: NAME, 'aria-describedby': undefined, 'aria-invalid': undefined },
      name: '00000000-0000-4000-8000-0000000000aa',
      maxLength: 100,
      text,
      readOnly: false,
      marked: true,
      onChange: () => undefined,
      onCommit: () => undefined,
      ...overrides,
    }),
  );

describe('AC-3, AC-6: Treatment / Color as a drop-down', () => {
  it('is a native select with an empty first choice while the list is read, and marked for Enter to move on', () => {
    const markup = select('');
    expect(markup).toContain('<select');
    expect(markup).toContain('Loading the treatments');
    expect(markup).toContain('data-part-field="true"');
    expect(markup).not.toContain('Other treatment or colour');
  });

  it('shows the words of what the part holds as the current value while the list is read, so nothing flickers', () => {
    const markup = select(encodeTreatment({ id: '00000000-0000-4000-8000-000700000c01', text: 'Invented powder finish' }));
    expect(markup).toContain('Invented powder finish');
    expect(markup).toContain('value="00000000-0000-4000-8000-000700000c01"');
  });

  it('"Other" shows the box for the words, labelled, with the rule\'s length, marked for Enter, and holding the typed words', () => {
    const markup = select(encodeTreatment({ id: OTHER_TREATMENT_ID, text: 'Invented matt black' }));
    expect(markup).toContain('aria-label="Other treatment or colour"');
    expect(markup).toContain('maxLength="100"');
    expect(markup).toContain('value="Invented matt black"');
    expect(markup.match(/data-part-field="true"/g)).toHaveLength(2);
  });

  it('an estimate that may not be changed has a read-only list that is not disabled, a read-only box, and Enter does not stop at them (CR-01 item 7D: a read-only control stays in the reading order)', () => {
    const markup = select(encodeTreatment({ id: OTHER_TREATMENT_ID, text: 'Invented matt black' }), { readOnly: true, marked: false });
    expect(markup).not.toContain('disabled=""');
    expect(markup).toContain('aria-readonly="true"');
    expect(markup).toContain('readOnly=""');
    expect(markup).not.toContain('data-part-field');
  });
});

describe('NFR-009 (ADR-016): the controls are in the part form\'s fields, which load after the page', () => {
  const folder = join(__dirname, '..', '..', 'src', 'components', 'features', 'estimate-workspace');

  it('PartFields and FieldRenderer import them, and the first-load modules do not', () => {
    expect(readFileSync(join(folder, 'part-fields.tsx'), 'utf8')).toMatch(/from '\.\/surface-treatments'/);
    expect(readFileSync(join(folder, 'field-renderer.tsx'), 'utf8')).toMatch(/from '\.\/treatment-select'/);
    for (const name of ['estimate-workspace.tsx', 'part-form.tsx', 'focus-field.ts', 'field-ids.ts', 'use-form-definition.ts']) {
      expect(readFileSync(join(folder, name), 'utf8'), name).not.toMatch(/surface-treatments|treatment-select|ui\/popover|treatment-options/);
    }
  });
});
