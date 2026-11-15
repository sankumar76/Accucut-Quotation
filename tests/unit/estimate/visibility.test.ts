import { describe, expect, it } from 'vitest';

import { buildFormSections } from '@/lib/estimate/form-fields';
import { hiddenFieldIds, HIDDEN_NUMBER, storedValueOf, zeroHiddenNumbers } from '@/lib/estimate/hidden-inputs';
import { isFieldShown } from '@/lib/fields/visibility';
import { isShownByRule, type ShownRule } from '@/lib/fields/visible-when';

import { cloneSeedConfig, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.05 AC-1, AC-3, AC-4, AC-5 (FR-048; SPEC sections 7.1, 7.3 and 14.4): the one rule of "does Fasteners Qty (T) and Fasteners Cost (U) show", read from the registry's `visibleWhen`,
 * and what is done with a hidden number (it is 0 wherever it is stored or read). Pure: no database. The part form's own use of the rule is in `form-values.test.ts`, the save in
 * `fasteners-save.test.ts`, and the same rule in the registry's `isFieldShown` is held here as well. Every value is invented.
 */

const S = seedFieldAt('S');
const T = seedFieldAt('T');
const U = seedFieldAt('U');
const RULE: ShownRule = { fieldId: S.id, values: ['None', ''] };

describe('AC-1: the rule shows T and U unless Fasteners is "None" (any letter case, spaces around it) or blank', () => {
  it.each([['None'], ['none'], ['NONE'], [' NONE '], ['\tNone\n'], [''], ['   '], [undefined]])('Fasteners %j hides them', (value) => {
    expect(isShownByRule(RULE, () => value)).toBe(false);
    expect(isFieldShown(T, (id) => (id === S.id ? value : undefined))).toBe(false);
    expect(isFieldShown(U, (id) => (id === S.id ? value : undefined))).toBe(false);
  });

  it.each([['Bolts'], ['M6 bolt'], ['None, plus 2 rivets'], ['Nonesuch'], ['0']])('Fasteners %j shows them', (value) => {
    expect(isShownByRule(RULE, () => value)).toBe(true);
    expect(isFieldShown(T, (id) => (id === S.id ? value : undefined))).toBe(true);
    expect(isFieldShown(U, (id) => (id === S.id ? value : undefined))).toBe(true);
  });

  it('a field with no rule always shows, and the rule reads the watched field only', () => {
    expect(isShownByRule(null, () => 'None')).toBe(true);
    expect(isShownByRule(RULE, (id) => (id === T.id ? 'Bolts' : undefined))).toBe(false);
  });

  it('the rule is in the registry on T and U only, and it is the one the form carries to the browser', () => {
    const withRule = seedConfig.fields.filter((field) => field.kind === 'input' && field.visibleWhen !== null).map((field) => field.id);
    expect(withRule.sort()).toEqual([T.id, U.id].sort());
    const offered = buildFormSections(seedConfig).flatMap((section) => section.fields);
    for (const field of offered) expect(field.visibleWhen, field.letter).toEqual(field.id === T.id || field.id === U.id ? { fieldId: S.id, values: ['None', ''] } : null);
  });
});

describe('AC-4: one rule: the registry decides, and a changed registry changes every reader', () => {
  it('a registry that hides T for another word hides it in the helper the save and Calculate read, and in the form the browser reads', () => {
    const changed = cloneSeedConfig();
    const t = changed.fields.find((field) => field.id === T.id);
    if (t === undefined || t.kind !== 'input') throw new Error('The seed has no input T.');
    t.visibleWhen = { fieldId: S.id, operator: 'not-in', values: ['No fasteners'] };
    expect([...hiddenFieldIds(changed, (id) => (id === S.id ? 'no fasteners' : undefined))]).toEqual([T.id]);
    expect([...hiddenFieldIds(changed, (id) => (id === S.id ? 'None' : undefined))]).toEqual([U.id]);
    const view = buildFormSections(changed)
      .flatMap((section) => section.fields)
      .find((field) => field.id === T.id);
    expect(view?.visibleWhen).toEqual({ fieldId: S.id, values: ['No fasteners'] });
  });
});

describe('hiddenFieldIds and storedValueOf: what is hidden for the values a part holds', () => {
  it('a part with nothing stored has Fasteners at its default "None", so T and U are hidden', () => {
    expect([...hiddenFieldIds(seedConfig, storedValueOf(seedConfig, {}))].sort()).toEqual([T.id, U.id].sort());
  });

  it('Fasteners stored as anything else shows them; a blank stored text is read as the default, and a stored value that is not text is read as none', () => {
    expect(hiddenFieldIds(seedConfig, storedValueOf(seedConfig, { [S.id]: 'Bolts' })).size).toBe(0);
    expect(hiddenFieldIds(seedConfig, storedValueOf(seedConfig, { [S.id]: '  ' })).size).toBe(2);
    expect(hiddenFieldIds(seedConfig, storedValueOf(seedConfig, { [S.id]: 7 })).size).toBe(2);
  });

  it('a default that is not "None" shows them while nothing is stored (the registry decides, not a letter)', () => {
    const changed = cloneSeedConfig();
    const s = changed.fields.find((field) => field.id === S.id);
    if (s === undefined || s.kind !== 'input') throw new Error('The seed has no input S.');
    s.defaultValue = 'Bolts';
    expect(hiddenFieldIds(changed, storedValueOf(changed, {})).size).toBe(0);
  });
});

describe('AC-3, AC-5: a hidden number is 0 where it holds a value', () => {
  it('a Qty and a Cost typed before Fasteners became "None" are 0.00; the rest of the part is as it was', () => {
    const inputs = { [S.id]: 'None', [T.id]: '5.00', [U.id]: '3.50', [seedFieldAt('J').id]: '9.00' };
    const zeroed = zeroHiddenNumbers(seedConfig, inputs);
    expect(zeroed).toEqual({ [S.id]: 'None', [T.id]: HIDDEN_NUMBER, [U.id]: HIDDEN_NUMBER, [seedFieldAt('J').id]: '9.00' });
    expect(HIDDEN_NUMBER).toBe('0.00');
    // The part that was read is not changed: a copy is returned.
    expect(inputs[T.id]).toBe('5.00');
  });

  it('is 0.00 for every spelling of "None" and for a blank Fasteners, and keeps what is shown', () => {
    for (const fasteners of ['none', ' NONE ', '']) expect(zeroHiddenNumbers(seedConfig, { [S.id]: fasteners, [T.id]: '5.00' })[T.id], fasteners).toBe('0.00');
    expect(zeroHiddenNumbers(seedConfig, { [S.id]: 'Bolts', [T.id]: '5.00', [U.id]: '3.50' })).toEqual({ [S.id]: 'Bolts', [T.id]: '5.00', [U.id]: '3.50' });
  });

  it('a hidden number with no value stays without one (nothing is stored for it, and every reader reads it as 0), and a value that is not text is left alone', () => {
    expect(zeroHiddenNumbers(seedConfig, { [S.id]: 'None' })).toEqual({ [S.id]: 'None' });
    expect(zeroHiddenNumbers(seedConfig, { [T.id]: 5 })[T.id]).toBe(5);
  });
});
