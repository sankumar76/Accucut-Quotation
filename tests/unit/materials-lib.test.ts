import { describe, expect, it } from 'vitest';

import { initialMaterialValues, materialEditChanges, materialFormProblems, newMaterialBody, withoutMaterialError } from '@/lib/masters/material-form';
import {
  materialChangesFrom,
  materialNumberProblem,
  materialTextProblem,
  MATERIAL_NAME_TOO_LONG_MESSAGE,
  MATERIAL_TEXT_MAX_LENGTH,
  NUMBER_MESSAGE,
  SPECIFIC_GRAVITY_ABOVE_ZERO_MESSAGE,
  SPECIFIC_GRAVITY_FORMAT_MESSAGE,
  specificGravityProblem,
  type MaterialValues,
} from '@/lib/masters/materials';

/**
 * STORY-02.03 (AC-2, AC-3, AC-8): the rules of a typed material that the screen and the server share, as pure functions on text. A price,
 * a specific gravity and a Material-Scrap-Rate are decimal text and never a floating-point number, so every check here reads characters.
 * Names and numbers are invented (`n.37`, ADR-014), except inputs that test the format (zero, a sign, three decimals, padding).
 */

const STEEL: MaterialValues = {
  materialInDrawing: 'Invented-sheet-grade-A',
  materialConsidered: 'Invented steel',
  pricePerKg: '58.37',
  specificGravity: '7.37',
  scrapRate: '22.37',
};

describe('specificGravityProblem (UX-37: must be above 0)', () => {
  it.each(['0.01', '7.37', '1', '19.37', '  2.37  ', '000.37', '123456789012.37'])('accepts %j', (value) => {
    expect(specificGravityProblem(value)).toBeNull();
  });

  it.each(['0', '0.0', '0.00', '000', ' 0 ', '-1', '-0.5', '-0', '-7.37'])('says "Enter a value above 0." for %j', (value) => {
    expect(specificGravityProblem(value)).toBe(SPECIFIC_GRAVITY_ABOVE_ZERO_MESSAGE);
  });

  it.each(['', '  ', 'heavy', '7.375', '7.', '.5', '1e3', '1,5', '+7.37', '1234567890123.00', '0.001'])('says what the shape is for %j', (value) => {
    expect(specificGravityProblem(value)).toBe(SPECIFIC_GRAVITY_FORMAT_MESSAGE);
  });

  it('uses the words of the UX spec for the zero state', () => {
    expect(SPECIFIC_GRAVITY_ABOVE_ZERO_MESSAGE).toBe('Enter a value above 0.');
  });
});

describe('materialNumberProblem (a price and a Material-Scrap-Rate: 0 or more, up to 2 decimals)', () => {
  it.each(['0', '0.00', '37', '5.37', '58.37', ' 22.37 ', '999999999999.37'])('accepts %j', (value) => {
    expect(materialNumberProblem(value)).toBeNull();
  });

  it.each(['', '-1', '-0.01', '58.123', '1e3', 'abc', '1,000', '1234567890123'])('refuses %j with the message of SCR-11 and SCR-13', (value) => {
    expect(materialNumberProblem(value)).toBe(NUMBER_MESSAGE);
  });
});

describe('materialTextProblem', () => {
  it('asks for text, ignoring surrounding spaces, and stops at the limit', () => {
    expect(materialTextProblem('  ', 'Enter it.')).toBe('Enter it.');
    expect(materialTextProblem(' MS sheet ', 'Enter it.')).toBeNull();
    expect(materialTextProblem('x'.repeat(MATERIAL_TEXT_MAX_LENGTH), 'Enter it.')).toBeNull();
    expect(materialTextProblem('x'.repeat(MATERIAL_TEXT_MAX_LENGTH + 1), 'Enter it.')).toBe(MATERIAL_NAME_TOO_LONG_MESSAGE);
  });
});

describe('materialChangesFrom: only what really changes', () => {
  it('is empty for a save that changes nothing, including a number typed another way', () => {
    expect(materialChangesFrom(STEEL, {})).toEqual({});
    expect(materialChangesFrom(STEEL, { specificGravity: '07.37', pricePerKg: '58.37', materialInDrawing: STEEL.materialInDrawing })).toEqual({});
  });

  it('names a field that differs, normalises a number to two decimals and counts a change of letter case in a name', () => {
    expect(materialChangesFrom(STEEL, { pricePerKg: '59.37', scrapRate: '022.37', materialInDrawing: 'INVENTED-SHEET-GRADE-A' })).toEqual({
      pricePerKg: '59.37',
      materialInDrawing: 'INVENTED-SHEET-GRADE-A',
    });
  });

  it('leaves out a field that is not given and one that is undefined', () => {
    expect(materialChangesFrom(STEEL, { scrapRate: undefined, materialConsidered: 'Invented stainless' })).toEqual({ materialConsidered: 'Invented stainless' });
  });
});

describe('the form of SCR-13 (material-form)', () => {
  it('starts an add empty and an edit from the material', () => {
    expect(initialMaterialValues(null)).toEqual({ materialInDrawing: '', materialConsidered: '', pricePerKg: '', specificGravity: '', scrapRate: '' });
    expect(initialMaterialValues(STEEL)).toEqual(STEEL);
  });

  it('puts a message under each field that has a problem, in the words of the spec, and none under a good one', () => {
    expect(materialFormProblems(initialMaterialValues(null), null)).toEqual({
      materialInDrawing: 'Enter the Material in Drawing.',
      materialConsidered: 'Enter the Material Considered.',
      pricePerKg: NUMBER_MESSAGE,
      specificGravity: SPECIFIC_GRAVITY_FORMAT_MESSAGE,
      scrapRate: NUMBER_MESSAGE,
    });
    expect(materialFormProblems({ ...STEEL, specificGravity: '0' }, null)).toEqual({ specificGravity: 'Enter a value above 0.' });
    expect(materialFormProblems(STEEL, null)).toEqual({});
  });

  it('checks a number in an edit only when it was changed, so a rename is not stopped by a value stored with more decimals', () => {
    const stored = { ...STEEL, specificGravity: '7.3712' };
    expect(materialFormProblems({ ...stored, materialConsidered: 'Invented steel 2' }, stored)).toEqual({});
    expect(materialFormProblems({ ...stored, specificGravity: '7.371' }, stored)).toEqual({ specificGravity: SPECIFIC_GRAVITY_FORMAT_MESSAGE });
  });

  it('sends nothing for an edit that changes nothing, and trims the names it does send', () => {
    expect(materialEditChanges(STEEL, { ...STEEL, materialInDrawing: ` ${STEEL.materialInDrawing} ` })).toEqual({});
    expect(materialEditChanges(STEEL, { ...STEEL, materialConsidered: ' Invented iron ', scrapRate: '23' })).toEqual({
      materialConsidered: 'Invented iron',
      scrapRate: '23.00',
    });
  });

  it('builds the body of an add with trimmed names and numbers as stored text', () => {
    expect(newMaterialBody({ ...STEEL, materialInDrawing: '  Invented ', pricePerKg: '058.3', specificGravity: '7', scrapRate: '1' })).toEqual({
      materialInDrawing: 'Invented',
      materialConsidered: 'Invented steel',
      pricePerKg: '58.30',
      specificGravity: '7.00',
      scrapRate: '1.00',
    });
  });

  it('clears the message of a field once the person changes it, and only that one', () => {
    expect(withoutMaterialError({ pricePerKg: 'a', scrapRate: 'b' }, 'pricePerKg')).toEqual({ scrapRate: 'b' });
  });
});
