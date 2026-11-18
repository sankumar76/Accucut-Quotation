import { describe, expect, it } from 'vitest';

import { checkFormulaEdit, isFormulaField, MAX_STORED_FORMULA_LENGTH, withFormula } from '@/lib/config/formula-edit';
import { findFieldById } from '@/lib/fields/registry';

import { defined } from '../../support/defined';
import { seedConfig, seedFieldAt, SEED_PROCESS_ITEMS } from '../../support/seed-config';

/**
 * STORY-08.02 AC-2, AC-3 and AC-6: the check of one edited formula over the seed registry and its 15 seed rates. The sentences are written out here from SCR-18 of the UX spec and not imported from the
 * product, so a changed word fails a test. Every formula is invented or a seed formula.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
const AL = seedFieldAt('AL');
const BL = seedFieldAt('BL');

const check = (text: string, fieldId = AL.id) => checkFormulaEdit({ document: seedConfig, rates: RATES, fieldId, text });

function messageOf(text: string, fieldId = AL.id): string {
  const result = check(text, fieldId);
  if (result.ok) throw new Error('The formula was expected to be refused.');
  return result.message;
}

describe('AC-2: an unknown name, a syntax error or a loop is refused with the SCR-18 sentence', () => {
  it('names an unknown rate as it was typed, hyphens and all, and says what to do', () => {
    expect(messageOf('P * Cuting-Rate-per-Sec')).toBe(
      '"Cuting-Rate-per-Sec" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.',
    );
  });

  it('names an unknown column letter and an unknown function the same way', () => {
    expect(messageOf('P * ZZZ')).toBe('"ZZZ" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.');
    expect(messageOf('FOO(P)')).toBe('"FOO" is not a column letter, rate name or function. Check the spelling, or add the rate in the Process master first.');
  });

  it('says where a formula ends too soon, and after which sign', () => {
    // 29 characters, the SCR-18 example: the bracket that closes nothing sits at character 29.
    expect(messageOf('P * (Cutting-Rate-per-Sec + )')).toBe('The formula ends too soon. A number or name is missing after "+" (position 29).');
    expect(messageOf('P * ')).toBe('The formula ends too soon. A number or name is missing after "*" (position 5).');
    expect(messageOf('IF(P > , 1, 2)')).toBe('The formula ends too soon. A number or name is missing after ">" (position 8).');
  });

  it('keeps the rule and the place of any other grammar fault, and never quotes the formula back', () => {
    expect(messageOf('P Q')).toBe('An operator is expected between two operands (character 3).');
    expect(messageOf('')).toBe('A formula cannot be empty.');
    expect(messageOf('P * #')).toBe('A character that is not part of a formula (character 5).');
  });

  it('names the loop from the edited field and back, as SCR-18 words it', () => {
    expect(messageOf('P * Cutting-Rate-per-Sec + AY')).toBe('This formula would make AL depend on itself. The loop is AL → AY → AL. Remove one of these references.');
  });

  it('names a field that reads itself as a loop of one', () => {
    expect(messageOf('AL + 1')).toBe('This formula would make AL depend on itself. The loop is AL → AL. Remove one of these references.');
  });

  it('refuses a row formula that reads a product field and one that uses SUM, with the engine rule', () => {
    expect(messageOf('BL * 2')).toContain('AL is calculated per row and cannot read BL');
    expect(messageOf('SUM(P)')).toContain('AL is calculated per row and cannot use SUM');
  });

  it('refuses a formula whose stored form is longer than the registry allows', () => {
    const long = `${Array.from({ length: 200 }, () => 'AM + ').join('')}AM`;
    expect(long.length).toBeLessThan(MAX_STORED_FORMULA_LENGTH);
    expect(messageOf(long)).toBe('This formula is too long to save. Shorten it, for example by splitting it over two fields.');
  });

  it('does not blame the edit for a loop that does not run through the edited field', () => {
    expect(check('P * 2').ok).toBe(true);
  });
});

describe('AC-3: a valid formula says what it uses and what it feeds', () => {
  it('says: The formula is valid. It uses P (Cutting Time) and the rate Cutting-Rate-per-Sec. Column AL feeds AY.', () => {
    const result = check('P * Cutting-Rate-per-Sec');
    if (!result.ok) throw new Error(result.message);
    expect(result.message).toBe('The formula is valid. It uses P (Cutting Time) and the rate Cutting-Rate-per-Sec. Column AL feeds AY.');
    expect(result.uses).toEqual([
      { kind: 'field', name: 'P (Cutting Time)' },
      { kind: 'rate', name: 'Cutting-Rate-per-Sec' },
    ]);
    expect(result.feeds).toEqual([{ letter: 'AY', label: 'Total Process Cost' }]);
  });

  it('hands back the text to store: references by ID, not letters and names', () => {
    const result = check('P * Cutting-Rate-per-Sec');
    if (!result.ok) throw new Error(result.message);
    expect(result.internalForm).toBe(AL.kind === 'output' ? AL.formula : null);
    expect(result.internalForm).toContain('{{f:');
    expect(result.internalForm).toContain('{{rate:');
    expect(result.internalForm).not.toContain('Cutting-Rate-per-Sec');
  });

  it('lists the Material and Exchange operands by their names', () => {
    const result = check('P * Material-Price-per-kg * ExchangeRate-USD');
    if (!result.ok) throw new Error(result.message);
    expect(result.uses.map((use) => use.name)).toEqual(['P (Cutting Time)', 'Material-Price-per-kg', 'ExchangeRate-USD']);
    expect(result.message).toContain('It uses P (Cutting Time), Material-Price-per-kg and ExchangeRate-USD.');
  });

  it('says so when the formula reads nothing, and when no other field reads the column', () => {
    const none = check('1 + 2', seedFieldAt('AK').id);
    if (!none.ok) throw new Error(none.message);
    expect(none.message).toContain('It reads no field or rate.');
    const orphan = check('SUM(AK) * 2', seedFieldAt('BN').id);
    if (!orphan.ok) throw new Error(orphan.message);
    expect(orphan.message.endsWith('No other field reads column BN.')).toBe(true);
  });

  it('puts the edited formula in a copy of the document and leaves the document alone', () => {
    const result = check('P * 2');
    if (!result.ok) throw new Error(result.message);
    expect(findFieldById(result.edited, AL.id)).toMatchObject({ formula: result.internalForm });
    expect(findFieldById(seedConfig, AL.id)).not.toMatchObject({ formula: result.internalForm });
  });
});

describe('AC-6: system formulas edit like any other, and fields with no formula offer no editor', () => {
  it('lets BL, SUM(BG), be checked and re-lettered like any other', () => {
    const bg = seedFieldAt('BG');
    const result = check('SUM(BG)', BL.id);
    if (!result.ok) throw new Error(result.message);
    expect(result.uses).toEqual([{ kind: 'field', name: `BG (${bg.label})` }]);
    expect(check('SUM(BG) * 2', BL.id).ok).toBe(true);
  });

  it.each(['A', 'F', 'I', 'BO'])('has no formula to edit on %s', (letter) => {
    expect(isFormulaField(seedFieldAt(letter))).toBe(false);
    expect(() => check('1', seedFieldAt(letter).id)).toThrow('The field has no formula to check.');
  });

  it('knows a field with a formula, and a field that is none', () => {
    expect(isFormulaField(AL)).toBe(true);
    expect(isFormulaField(undefined)).toBe(false);
  });

  it('withFormula changes one output field and nothing else', () => {
    const edited = withFormula(seedConfig, AL.id, '{{f:x}}');
    expect(edited.fields.filter((field, index) => field !== seedConfig.fields[index]).map((field) => field.id)).toEqual([AL.id]);
    expect(withFormula(seedConfig, defined(seedFieldAt('P')).id, 'x').fields).toEqual(seedConfig.fields);
  });
});
