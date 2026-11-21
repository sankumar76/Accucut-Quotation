import { describe, expect, it } from 'vitest';

import { insertFields, previewInsert, type InsertSpec } from '@/lib/config/field-insert';
import { describeInsertAudit, describeInsertBefore, insertAuditAfter } from '@/lib/config/field-insert-audit';
import { MAX_CHOICE_LENGTH, MAX_CHOICES, MAX_SECTION_NAME_LENGTH, MAX_SECTION_SHORT_NAME_LENGTH } from '@/lib/config/field-insert-limits';
import { nextSectionNumber, parseChoices } from '@/lib/config/field-insert-check';
import { parseConfigDocument } from '@/lib/fields/schema';

import { choiceInput } from '../../support/choice-section-version';
import { defined } from '../../support/defined';
import { fieldIdAt, newInput, newOutput, outputDetails } from '../../support/insert-specs';
import { SEED_PROCESS_ITEMS, seedConfig } from '../../support/seed-config';

/**
 * STORY-08.08 AC-6, AC-7 (FR-074, FR-077; A-2, A-3): the pure core of the insert reads a **choice input** (1 to 50 choices, each 1 to 100 characters, trimmed, different ignoring letter case, a default that is
 * one of them) and **a new section** (a name of 1 to 100 characters and a short name of 1 to 30, the next number after the highest, cards) and puts both in the one new document, so the save is one version
 * (FR-077). A new section moves no column. Each problem comes back under the control it belongs to, with the sentence of the story. Every name is invented.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`;

const input = (overrides = {}) => newInput(choiceInput(overrides));
const spec = (overrides = {}): InsertSpec => ({ kind: 'input', afterFieldId: fieldIdAt('AX'), input: input(overrides) });

function refused(over: InsertSpec) {
  const result = insertFields({ document: seedConfig, rates: RATES, spec: over, newId });
  if (result.ok) throw new Error('The insert was accepted, and the test expected it to be refused.');
  return result.issues;
}

function inserted(over: InsertSpec) {
  const result = insertFields({ document: seedConfig, rates: RATES, spec: over, newId });
  if (!result.ok) throw new Error(`The insert was refused: ${JSON.stringify(result.issues)}`);
  return result;
}

describe('AC-6: the choices', () => {
  it('stores the choices as the options, in the order typed, trimmed, a blank line dropped', () => {
    const result = inserted(spec({ choices: '  Coarse \r\n\r\nFine\nMirror\n' }));
    const field = defined(result.document.fields.find((candidate) => candidate.id === defined(result.inserted[0]).id));
    expect(field).toMatchObject({ kind: 'input', dataType: 'select', options: ['Coarse', 'Fine', 'Mirror'], mandatory: true, engineerVisible: true });
    expect(result.choices).toBe(3);
  });

  it('reads the text one way, for the check and the stored field', () => {
    expect(parseChoices(' a \n\n b\r\nc\rd ')).toEqual(['a', 'b', 'c', 'd']);
    expect(parseChoices(undefined)).toEqual([]);
    expect(parseChoices('   \n  ')).toEqual([]);
  });

  it('asks for at least one choice', () => {
    for (const text of ['', '   ', '\n\n']) expect(refused(spec({ choices: text })), JSON.stringify(text)).toContainEqual({ field: 'input.choices', message: 'Enter at least one choice.' });
    expect(refused(spec({ choices: undefined }))).toContainEqual({ field: 'input.choices', message: 'Enter at least one choice.' });
  });

  it('refuses a choice that is the same as another, ignoring letter case', () => {
    expect(refused(spec({ choices: 'Fine\nfine' }))).toContainEqual({ field: 'input.choices', message: 'Each choice must be different.' });
    expect(refused(spec({ choices: 'A\nB\n a ' }))).toContainEqual({ field: 'input.choices', message: 'Each choice must be different.' });
  });

  it('allows 50 choices and 100 characters, and refuses 51 and 101', () => {
    const fifty = Array.from({ length: MAX_CHOICES }, (_, index) => `Choice ${String(index)}`).join('\n');
    expect(inserted(spec({ choices: fifty })).choices).toBe(MAX_CHOICES);
    expect(refused(spec({ choices: `${fifty}\nOne more` }))).toContainEqual({ field: 'input.choices', message: `Enter at most ${String(MAX_CHOICES)} choices.` });
    expect(inserted(spec({ choices: 'x'.repeat(MAX_CHOICE_LENGTH) })).choices).toBe(1);
    expect(refused(spec({ choices: 'x'.repeat(MAX_CHOICE_LENGTH + 1) }))[0]).toMatchObject({ field: 'input.choices' });
  });

  it('refuses a choice with a control character', () => {
    expect(refused(spec({ choices: 'Fine\nBad\u0007one' }))[0]).toMatchObject({ field: 'input.choices' });
  });

  it('takes a default that is one of the choices, as typed, and refuses any other', () => {
    const result = inserted(spec({ defaultValue: ' Fine ' }));
    expect(result.document.fields.find((candidate) => candidate.id === defined(result.inserted[0]).id)).toMatchObject({ defaultValue: 'Fine' });
    expect(refused(spec({ defaultValue: 'Smooth' }))).toContainEqual({ field: 'input.defaultValue', message: 'The default must be one of the choices.' });
    expect(refused(spec({ defaultValue: 'fine' }))).toContainEqual({ field: 'input.defaultValue', message: 'The default must be one of the choices.' });
  });

  it('reads no choices for a Number or Text input, whatever was sent', () => {
    const result = inserted(spec({ dataType: 'number', choices: 'ignored\nignored', numFmt: '0.00' }));
    expect(result.choices).toBeNull();
    expect(result.document.fields.find((candidate) => candidate.id === defined(result.inserted[0]).id)).toMatchObject({ dataType: 'number', options: null });
  });
});

describe('AC-6, AC-7: a new section', () => {
  it('adds the section with the next number after the highest, as cards, in the same document as the field', () => {
    const result = inserted(spec());
    expect(result.document.sections).toHaveLength(seedConfig.sections.length + 1);
    const added = defined(result.document.sections.find((section) => section.id === defined(result.section).id));
    expect(added).toMatchObject({ number: 9, name: 'Invented Finishing', shortName: 'Finishing', displayMode: 'cards' });
    expect(result.document.fields.find((candidate) => candidate.id === defined(result.inserted[0]).id)).toMatchObject({ sectionId: added.id });
    expect(result.section).toMatchObject({ number: 9, name: 'Invented Finishing' });
  });

  it('takes the number after the highest even when the numbers have a gap', () => {
    const gap = { ...seedConfig, sections: seedConfig.sections.map((section) => (section.number === 8 ? { ...section, number: 12 } : section)) };
    expect(nextSectionNumber(gap)).toBe(13);
    const result = insertFields({ document: gap, rates: RATES, spec: spec(), newId });
    expect(result.ok && result.section?.number).toBe(13);
  });

  it('trims the names, and stores them as given otherwise', () => {
    const result = inserted(spec({ newSection: { name: '  Welding Two ', shortName: ' Weld 2 ' } }));
    expect(result.document.sections.at(-1)).toMatchObject({ name: 'Welding Two', shortName: 'Weld 2' });
  });

  it('asks for a name and a short name, with the sentence of the story for the first', () => {
    expect(refused(spec({ newSection: { name: '  ', shortName: 'Fine' } }))).toContainEqual({ field: 'input.newSectionName', message: 'Enter a section name.' });
    expect(refused(spec({ newSection: { name: 'Fine', shortName: '' } }))).toContainEqual({ field: 'input.newSectionShortName', message: 'Enter a short name for the section strip.' });
  });

  it('allows 100 and 30 characters, and refuses one more of each', () => {
    expect(inserted(spec({ newSection: { name: 'n'.repeat(MAX_SECTION_NAME_LENGTH), shortName: 's'.repeat(MAX_SECTION_SHORT_NAME_LENGTH) } })).section).not.toBeNull();
    expect(refused(spec({ newSection: { name: 'n'.repeat(MAX_SECTION_NAME_LENGTH + 1), shortName: 'ok' } }))[0]).toMatchObject({ field: 'input.newSectionName' });
    expect(refused(spec({ newSection: { name: 'ok', shortName: 's'.repeat(MAX_SECTION_SHORT_NAME_LENGTH + 1) } }))[0]).toMatchObject({ field: 'input.newSectionShortName' });
  });

  it('does not read the existing section when a new one is given, and does not ask for a new one when an existing one is chosen', () => {
    const existing = defined(seedConfig.sections[1]).id;
    expect(refused(spec({ sectionId: 'not-a-section', newSection: { name: '', shortName: '' } })).map((issue) => issue.field)).not.toContain('input.sectionId');
    const plain = inserted(spec({ sectionId: existing, newSection: null }));
    expect(plain.section).toBeNull();
    expect(plain.document.sections).toHaveLength(seedConfig.sections.length);
  });

  it('puts a Number input and a pair into a new section too, and the cost column of a choice pair cannot hide on 0', () => {
    const number = inserted({ kind: 'input', afterFieldId: fieldIdAt('AX'), input: input({ dataType: 'number', numFmt: '0.00', choices: '' }) });
    expect(number.section).not.toBeNull();
    const pair: InsertSpec = { kind: 'pair', afterFieldId: fieldIdAt('AX'), input: input(), cost: { ...outputDetails({ formula: '1' }), afterFieldId: null, hideWhenInputIsZero: true } };
    expect(refused(pair)).toContainEqual({ field: 'cost.hideWhenInputIsZero', message: 'Hide the line only for a Number input.' });
    const ok = inserted({ ...pair, cost: { ...pair.cost, hideWhenInputIsZero: false } });
    expect(ok.inserted.map((field) => field.kind)).toEqual(['input', 'output']);
  });

  it('gives an output no section: a single output has nothing to put in one', () => {
    const result = inserted({ kind: 'output', afterFieldId: fieldIdAt('AX'), output: newOutput() });
    expect(result.section).toBeNull();
    expect(result.choices).toBeNull();
  });

  it('is valid for the registry\'s own last gate, and keeps every field ID of the insert the same as without the section', () => {
    const withSection = inserted(spec());
    expect(() => parseConfigDocument(withSection.document)).not.toThrow();
    counter = 0;
    const first = inserted(spec());
    counter = 0;
    const second = inserted(spec({ newSection: null, sectionId: defined(seedConfig.sections[1]).id }));
    expect(first.inserted).toEqual(second.inserted);
  });
});

describe('AC-7: a new section moves no column, so the preview is the save', () => {
  it('shows the same letters for a choice in a new section as for the same input in an existing one', () => {
    counter = 0;
    const inNew = previewInsert({ document: seedConfig, rates: RATES, spec: spec(), newId });
    counter = 0;
    const inOld = previewInsert({ document: seedConfig, rates: RATES, spec: spec({ newSection: null, sectionId: defined(seedConfig.sections[1]).id }), newId });
    expect(inNew.ok && inOld.ok).toBe(true);
    if (inNew.ok && inOld.ok) expect(inNew.changes).toEqual(inOld.changes);
  });
});

describe('AC-7: the audit entry names the new section and the number of choices', () => {
  const result = inserted(spec());
  const entry = insertAuditAfter(result.changes, result.formulas, 10, { section: { number: 9, name: 'Invented Finishing' }, choices: 3 });

  it('keeps both in the stored After and says them in its words', () => {
    expect(entry).toMatchObject({ section: { number: 9, name: 'Invented Finishing' }, choices: 3, version: 10 });
    expect(describeInsertAudit(entry)).toBe('Added as AY after AX, a list of 3 choices, in the new section 09 Invented Finishing. Columns AY to BO moved one to the right (configuration version 10)');
    expect(describeInsertBefore(entry)).toBe('Not in the worksheet, no section 09 Invented Finishing');
  });

  it('says one choice in the singular, and keeps the words of an insert with neither exactly as 08.03 wrote them', () => {
    expect(describeInsertAudit({ ...entry, choices: 1, section: null })).toContain('a list of 1 choice.');
    const plain = insertAuditAfter(result.changes, result.formulas, 10);
    expect(plain).toMatchObject({ section: null, choices: null });
    expect(describeInsertAudit(plain)).toBe('Added as AY after AX. Columns AY to BO moved one to the right (configuration version 10)');
    expect(describeInsertBefore(plain)).toBe('Not in the worksheet');
  });
});
