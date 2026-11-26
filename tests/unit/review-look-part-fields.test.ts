import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PartFields, type PartFieldsProps } from '@/components/features/estimate-workspace/part-fields';
import type { PartItem } from '@/lib/estimates/tree-client';
import type { FormField, FormView } from '@/lib/estimates/form-client';
import { QTY_PER_ASSY_HINT } from '@/lib/estimate/quantity-hint';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * AQP-488 (DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 3.2, 3.4, 3.5, RO-3 to RO-11): the Engineer's `PartFields` with the review look, rendered to markup with the part's stored values
 * given (no browser, no request). The intro and the hints (except the QTY per Assy one) are gone, an empty field says "Not entered", the chosen surface treatments are chips, there is no picture control and no
 * save bar, the notice is the Lead's words, and the form draws no title or row line of its own (the review draws them on the server above it). Without the prop the Engineer's form is unchanged. Every name is invented.
 */

const STORED: Record<string, string> = {};
const state = { stored: { status: 'ready' as const, value: { inputs: STORED, picture: null, completeness: 'PARTIAL', revision: 3 } }, texts: STORED };

vi.mock('@/components/features/estimate-workspace/use-part-form', () => ({
  usePartValues: () => ({
    stored: state.stored,
    texts: state.texts,
    errors: {},
    unstored: new Set<string>(),
    problem: null,
    announcement: '',
    autosaveFailedAt: null,
    setText: () => undefined,
    commit: () => undefined,
    resolveConflict: () => undefined,
    inTurn: <T,>(job: () => Promise<T>) => job(),
    pictureSaved: () => undefined,
    readAgain: () => undefined,
  }),
}));

const field = (id: string, over: Partial<FormField>): FormField => ({
  id: `00000000-0000-4000-8000-00000000c0${id}`,
  letter: 'J',
  label: 'Length',
  kind: 'input',
  unit: 'mm',
  hint: 'Enter the length in millimetres.',
  defaultValue: null,
  required: true,
  editable: true,
  visibleWhen: null,
  rule: { type: 'number', decimals: 2 },
  ...over,
});

const LENGTH = field('01', {});
const QTY = field('02', { letter: 'H', label: 'QTY per Assy', unit: 'nos', hint: QTY_PER_ASSY_HINT });
const REMARKS = field('03', { letter: 'AJ', label: 'Remarks', unit: null, hint: 'Anything the Lead should know.', rule: { type: 'text', maxLength: 1000, multiline: true } });
const PRIMER = field('04', { letter: 'AA', label: 'Primer', unit: null, hint: null, rule: { type: 'flag' } });
const PICTURE = field('05', { letter: 'C', label: 'Part Model', unit: null, hint: 'Paste a picture.', rule: { type: 'picture' } });

const FORM: FormView = {
  sections: [
    { id: '00000000-0000-4000-8000-0000000000a1', number: 1, name: 'Part Details', shortName: 'Part', columnRange: 'A–D', fields: [QTY, PICTURE] },
    { id: '00000000-0000-4000-8000-0000000000a2', number: 2, name: 'Material and dimensions', shortName: 'Material', columnRange: 'I–M', fields: [LENGTH, REMARKS, PRIMER] },
  ],
  lastSavedAt: null,
};

const NODES: ReadonlyArray<PartItem> = [{ id: '00000000-0000-4000-8000-0000000000b1', parentId: null, slNo: '1.4', label: 'Top cover', nodeKind: 'PART', completeness: 'PARTIAL', revision: 3 }];

const props = (over: Partial<PartFieldsProps> = {}): PartFieldsProps => ({
  estimateId: '00000000-0000-4000-8000-000000000001',
  part: { id: NODES[0]?.id ?? '', slNo: '1.4', revision: 3 },
  editable: false,
  nodes: NODES,
  form: FORM,
  materials: { status: 'ready', value: [] },
  lastSavedAt: '2026-11-05T05:11:00.000Z',
  onSaved: () => undefined,
  onChanged: () => undefined,
  onNamed: () => undefined,
  onServerIgnored: () => undefined,
  onWrote: () => undefined,
  onReadMaterialsAgain: () => undefined,
  missing: new Set<string>(),
  gate: createSaveGate(),
  ...over,
});

const REVIEW = { notice: 'Read-only. These are the values saved for this part.', showing: 'Showing the inputs of 1.4 Top cover. Read-only.', figuresCurrent: false, chosen: false };
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const render = (over: Partial<PartFieldsProps> = {}): string => renderToStaticMarkup(createElement(PartFields, props(over)));

describe('the review look of the part form (RO-5, RO-11)', () => {
  const html = render({ review: REVIEW });

  it('has no intro and no hint except the QTY per Assy one', () => {
    expect(html).not.toContain('Every field is needed to Calculate');
    expect(html).not.toContain('Enter the length in millimetres.');
    expect(html).not.toContain('Anything the Lead should know.');
    expect(html).not.toContain('Paste a picture.');
    expect(html).toContain(QTY_PER_ASSY_HINT);
  });

  it('says "Not entered" for an empty field and keeps labels, letters and units', () => {
    expect(html).toContain('placeholder="Not entered"');
    expect(html).toContain('Length');
    expect(text(html)).toContain('mm');
    expect(html).toContain('Excel column');
  });

  it('draws the Lead\'s notice instead of the Engineer\'s "can no longer be changed"', () => {
    expect(text(html)).toContain('Read-only. These are the values saved for this part.');
    expect(html).not.toContain('This estimate can no longer be changed.');
  });

  it('draws no title and no row line of its own (the server draws them above), and keeps the count "n of m"', () => {
    expect(html).not.toContain('id="part-form-title"');
    expect(html).not.toContain('data-row-line');
    expect(html).toContain('inputs complete');
  });

  it('has chips for the surface treatments, no picture control and no save bar or edit button', () => {
    expect(html).toContain('None selected');
    expect(html).not.toMatch(/Choose a file|Replace|Remove|Save draft|Calculate|role="checkbox"|type="file"/);
  });

  it('is a region named by the title the server draws above it', () => {
    expect(html).toMatch(/<form[^>]*aria-labelledby="part-form-title"/);
  });
});

describe('the Engineer\'s form is unchanged without the prop', () => {
  it('keeps the intro, the hints and the locked notice', () => {
    const html = render();
    expect(html).toContain('Every field is needed to Calculate');
    expect(html).toContain('Enter the length in millimetres.');
    expect(html).toContain('This estimate can no longer be changed.');
    expect(html).not.toContain('Not entered');
  });
});

describe('the Engineer\'s form keeps its own title (RO-12)', () => {
  it('draws the head and the title as a focus target (tabIndex -1) when there is no review look', () => {
    expect(render()).toMatch(/<h3 id="part-form-title" tabindex="-1"/);
  });
});
