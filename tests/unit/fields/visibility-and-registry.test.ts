import { describe, expect, it } from 'vitest';

import {
  describeVisibleWhen,
  fieldLetter,
  fieldsInFormOrder,
  fieldsInStage,
  findFieldById,
  findFieldByKey,
  findSystemField,
  formatColumnRange,
  referenceContext,
  sectionColumnRange,
} from '@/lib/fields/registry';
import { engineerVisibleFields, isEngineerVisibleAllowed, isFieldShown } from '@/lib/fields/visibility';

import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';
import { defined } from '../../support/defined';

describe('visibility (AC-3, ADR-008)', () => {
  it('AC-3: the allow-list permits inputs and Material Considered, and nothing else', () => {
    expect(isEngineerVisibleAllowed({ kind: 'input', key: 'anything' })).toBe(true);
    expect(isEngineerVisibleAllowed({ kind: 'auto', key: 'material-considered' })).toBe(true);
    expect(isEngineerVisibleAllowed({ kind: 'auto', key: 'material-rate-per-kg' })).toBe(false);
    expect(isEngineerVisibleAllowed({ kind: 'auto', key: 'sl-no' })).toBe(false);
    expect(isEngineerVisibleAllowed({ kind: 'output', key: 'exchange-rate-usd' })).toBe(false);
    // An output cannot take F's exception by borrowing its key.
    expect(isEngineerVisibleAllowed({ kind: 'output', key: 'material-considered' })).toBe(false);
  });

  it('AC-3: the Engineer\'s fields are the 32 inputs less none, plus F: 33 fields, and no output', () => {
    const shown = engineerVisibleFields(seedConfig.fields);
    expect(shown).toHaveLength(33);
    expect(shown.some((field) => field.kind === 'output')).toBe(false);
    expect(shown.some((field) => field.key === 'material-rate-per-kg')).toBe(false);
  });

  it.each([
    ['None', false],
    ['', false],
    [undefined, false],
    ['M6 bolt', true],
    ['none', true],
  ])('AC-3: Fasteners Qty is shown for Fasteners = %j: %s', (value, shown) => {
    const fasteners = seedFieldAt('S');
    const quantity = seedFieldAt('T');
    expect(isFieldShown(quantity, (id) => (id === fasteners.id ? value : undefined))).toBe(shown);
  });

  it('a field with no rule, and any output or auto field, is always shown', () => {
    expect(isFieldShown(seedFieldAt('J'), () => undefined)).toBe(true);
    expect(isFieldShown(seedFieldAt('AK'), () => undefined)).toBe(true);
    expect(isFieldShown(seedFieldAt('F'), () => undefined)).toBe(true);
  });
});

describe('registry helpers', () => {
  it('finds a field by id, by key and by system role', () => {
    const quantity = seedFieldAt('H');
    expect(findFieldById(seedConfig, quantity.id)).toBe(quantity);
    expect(findFieldById(seedConfig, 'missing')).toBeUndefined();
    expect(findFieldByKey(seedConfig, 'qty-per-assy')).toBe(quantity);
    expect(findFieldByKey(seedConfig, 'missing')).toBeUndefined();
    expect(fieldLetter(defined(findSystemField(seedConfig, 'approved-price')))).toBe('BO');
    expect(fieldLetter(defined(findSystemField(seedConfig, 'sl-no')))).toBe('A');
  });

  it('lists the fields of a stage', () => {
    const stage = defined(seedConfig.stages[4]);
    expect(fieldsInStage(seedConfig, stage).map(fieldLetter)).toEqual(['BC', 'BD', 'BE', 'BF']);
  });

  it('puts a field with no form order last in a section', () => {
    const document = structuredClone(seedConfig);
    const section = defined(document.sections[7]);
    const target = defined(document.fields.find((field) => field.key === 'remarks'));
    target.formOrder = null;
    expect(fieldsInFormOrder(document, section).map(fieldLetter)).toEqual(['AP', 'AU', 'BM', 'AJ']);
  });

  it('builds the reference context in position order with the rates it is given', () => {
    const context = referenceContext(seedConfig, SEED_PROCESS_ITEMS);
    expect(context.fieldIds).toHaveLength(67);
    expect(context.fieldIds[0]).toBe(seedFieldAt('A').id);
    expect(context.rates).toBe(SEED_PROCESS_ITEMS);
  });

  it('describes a visibility rule and returns null when there is none, or its field is gone', () => {
    expect(describeVisibleWhen(seedConfig, seedFieldAt('U'))).toBe("S not in ['None','']");
    expect(describeVisibleWhen(seedConfig, seedFieldAt('J'))).toBeNull();
    expect(describeVisibleWhen(seedConfig, seedFieldAt('AK'))).toBeNull();
    const document = structuredClone(seedConfig);
    const dangling = defined(document.fields.find((field) => field.key === 'fasteners-qty'));
    if (dangling.kind === 'input' && dangling.visibleWhen !== null) dangling.visibleWhen.fieldId = 'gone';
    expect(describeVisibleWhen(document, dangling)).toBeNull();
  });
});

describe('formatColumnRange (SPEC section 7.1 header tags)', () => {
  it.each([
    [[], ''],
    [[5], 'E'],
    [[5, 6], 'E, F'],
    [[5, 6, 10, 11, 12, 14], 'E, F, J–L, N'],
    [[14, 12, 5, 11, 10, 6], 'E, F, J–L, N'],
    [[5, 5, 6], 'E, F'],
    [[26, 27, 28], 'Z–AB'],
    [[1, 2, 3, 4, 7, 8], 'A–D, G, H'],
  ])('positions %j read %j', (positions, text) => {
    expect(formatColumnRange(positions)).toBe(text);
  });

  it('derives a section tag from its fields and, optionally, only the ones a viewer sees', () => {
    const material = defined(seedConfig.sections[1]);
    expect(sectionColumnRange(seedConfig, material)).toBe('E, F, I–L, N');
    expect(sectionColumnRange(seedConfig, material, (field) => field.engineerVisible)).toBe('E, F, J–L, N');
  });
});
