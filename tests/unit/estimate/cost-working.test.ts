import { describe, expect, it } from 'vitest';

import { compilePlan } from '@/lib/formula';
import { buildCostWorking, WorkingMismatchError, type CostWorking, type WorkingLine } from '@/lib/estimate/cost-working';
import { findFieldByKey } from '@/lib/fields/registry';
import { Decimal } from '@/lib/decimal';
import { toTwoPlaces } from '@/lib/money';
import { MATERIAL_IN_DRAWING_KEY } from '@/lib/fields/types';

import { defined } from '../../support/defined';
import { ROW, WORKED_2DP } from '../../support/row-oracle';
import { cloneSeedConfig, seedConfig, seedFieldAt } from '../../support/seed-config';
import { SEED_PLAN, storedRowOf, type StoredRow, type StoredRowOptions } from '../../support/stored-row';

/**
 * STORY-06.03 AC-1 to AC-6 (FR-058 to FR-060, FR-026; SPEC sections 7.4 and 14 items 1 and 5; architecture section 4.9): the working of one stored row, from the row of `row-oracle.ts` whose figures were worked
 * by hand before the code. The record is made by the real row calculator, and every working line below is written out by hand beside the figure it must give. Every value is invented (ADR-014).
 */

const idOf = (letter: string): string => seedFieldAt(letter).id;

function working(options: StoredRowOptions = {}, change?: (row: StoredRow) => void): CostWorking {
  const row = storedRowOf(options);
  change?.(row);
  const document = options.document ?? seedConfig;
  const plan = options.document === undefined ? SEED_PLAN : compilePlan(options.document.fields);
  return buildCostWorking({ document, plan, inputs: row.inputs, outputs: row.outputs, snapshot: row.snapshot });
}

const linesOf = (result: CostWorking): WorkingLine[] => result.stages.flatMap((stage) => [...stage.lines]);
const line = (result: CostWorking, letter: string): WorkingLine => defined(linesOf(result).find((candidate) => candidate.letter === letter), `line ${letter}`);
const lettersOf = (result: CostWorking, stage: number): string[] => defined(result.stages[stage - 1]).lines.map((candidate) => candidate.letter);

describe('AC-1: six stages, and in each the lines of the SPEC with a letter, a name, a formula, a working and a value', () => {
  const result = working();

  it('has the six stages in order, with the names of the registry', () => {
    expect(result.stages.map((stage) => [stage.number, stage.name])).toEqual([
      [1, 'Weights & Areas'],
      [2, 'Material Cost'],
      [3, 'Process Costs'],
      [4, 'Sub Total'],
      [5, 'Rejection, Overheads & Logistics'],
      [6, 'Pricing'],
    ]);
  });

  it('puts M, O, AH and AI in stage 1; I (as a reference) and AK in stage 2; AZ, BA and BB in stage 4; BC to BF in stage 5; BG to BK in stage 6', () => {
    expect(lettersOf(result, 1)).toEqual(['M', 'O', 'AH', 'AI']);
    expect(lettersOf(result, 2)).toEqual(['I', 'AK']);
    expect(lettersOf(result, 4)).toEqual(['AZ', 'BA', 'BB']);
    expect(lettersOf(result, 5)).toEqual(['BC', 'BD', 'BE', 'BF']);
    expect(lettersOf(result, 6)).toEqual(['BG', 'BH', 'BI', 'BJ', 'BK']);
  });

  it('puts the process costs, the two typed entries (AP, AU) and the total AY in stage 3, under their sub-headings', () => {
    const stage = defined(result.stages[2]);
    expect(stage.lines.map((candidate) => candidate.letter)).toEqual(['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY']);
    expect(stage.subHeadings).toEqual(['Cutting', 'Bending', 'Welding', 'Surface Treatment', 'Entered directly', 'Process Total']);
    expect(['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AU', 'AY'].map((letter) => line(result, letter).group)).toEqual([
      'Cutting',
      'Bending',
      'Welding',
      'Welding',
      'Entered directly',
      'Surface Treatment',
      'Entered directly',
      'Process Total',
    ]);
  });

  it('lists no product-scope field (BL, BN, BO) and no field that is only an input to the row', () => {
    const letters = linesOf(result).map((candidate) => candidate.letter);
    for (const letter of ['BL', 'BN', 'BO', 'H', 'J', 'N', 'Z']) expect(letters, letter).not.toContain(letter);
  });

  it('holds the formula in letters and rate names as the registry has it, and the stored value, on every calculated line', () => {
    expect(line(result, 'AK').formula).toBe('(M * I) - (O * Material-Scrap-Rate)');
    expect(line(result, 'AL').formula).toBe('P * Cutting-Rate-per-Sec');
    expect(line(result, 'BD').formula).toBe('BB * OH Profit %');
    expect(line(result, 'BJ').formula).toBe('BG / BH');
    expect(new Decimal(defined(line(result, 'BG').value)).toFixed(6)).toBe('451.398096');
  });

  it.each(WORKED_2DP)('%s: the stored value is the hand-worked figure %s to 2 decimals', (letter, expected) => {
    expect(toTwoPlaces(defined(line(result, letter).value))).toBe(expected);
  });

  it('shows a typed entry (AP, AU) as typed, with no formula and no working, and the material rate as a lookup', () => {
    expect(line(result, 'AP')).toMatchObject({ kind: 'typed', value: '15', formula: null, working: null });
    expect(line(result, 'AU')).toMatchObject({ kind: 'typed', value: '7', formula: null, working: null });
    expect(line(result, 'I')).toMatchObject({ kind: 'lookup', value: '60', formula: null, working: null, blank: false });
  });
});

describe('AC-2: the working uses the operands really used, and a hand repeat gives the printed figure', () => {
  const result = working();

  it('AK = (0.3140 x 60) - (0.1140 x 25) = 15.99: calculated values to 4 decimals, the price and the rate as stored', () => {
    // M = 0.314 and O = 0.114 are calculated (4 decimals); I = 60 and Material-Scrap-Rate = 25 are the material's own numbers.
    expect(line(result, 'AK').working).toBe('(0.3140 × 60) - (0.1140 × 25)');
    expect(0.314 * 60 - 0.114 * 25).toBeCloseTo(15.99, 10);
    expect(line(result, 'AK').value).toBe('15.99');
  });

  it.each([
    ['M', '(2 × 100 × 200 × 7.85) / 1000000'],
    ['AH', '(200 × 100 × 2) / 645'],
    ['AI', '62.0155 / 144'],
    ['AL', '10 × 0.5'],
    ['AM', '4 × 2'],
    ['AN', '(2 + 1 + 1) × 3'],
    ['AO', '0.2 × 40 × 3'],
    ['AQ', '(0.2 × 10) × 1'],
    ['AZ', '2 × 5'],
    ['BH', '80'],
    ['BJ', '451.3981 / 80.0000'],
  ])('%s is worked as %s', (letter, expected) => {
    expect(line(result, letter).working).toBe(expected);
  });

  it('the inputs are as typed (0.2 stays 0.2) and the calculated operands are to 4 decimals (BB 377.738992 is 377.7390)', () => {
    expect(line(result, 'BA').working).toBe('15.9900 + 99.9230 + 10.0000');
    expect(line(result, 'BB').working).toBe('125.9130 × 3');
  });

  it('the Scrap Weight working keeps the seeded formula and shows that the specific gravity is above 0 (UX-41)', () => {
    expect(line(result, 'O').formula).toBe('IF(Material-Specific-Gravity > 0, M - N, 0)');
    expect(line(result, 'O').working).toBe('IF(7.85 > 0, 0.3140 - 0.2, 0)');
  });

  it('a percent rate is printed as typed, 12%, and 2.5%, and never as the fraction a formula uses', () => {
    expect(line(result, 'BD').working).toBe('377.7390 × 12%');
    expect(line(result, 'BE').working).toBe('377.7390 × 2.5%');
    expect(line(result, 'BF').working).toBe('377.7390 × 5%');
  });

  it('every line that has a formula has a working, and every working is a formula with its operands replaced: no letter of a column is left in it', () => {
    for (const calculated of linesOf(result).filter((candidate) => candidate.kind === 'calculated')) {
      expect(calculated.formula, calculated.letter).not.toBeNull();
      expect(calculated.working, calculated.letter).not.toBeNull();
      // Only the function name IF may remain in letters; every operand is a number, a percentage or a dash.
      expect(defined(calculated.working).replaceAll('IF', ''), calculated.letter).not.toMatch(/[A-Za-z]/);
    }
  });

  it('puts the total of a stage on its heading: AY for stage 3, BB for stage 4, the sum of BC to BF for stage 5, BG for stage 6, none for stage 1', () => {
    const totals = result.stages.map((stage) => stage.total);
    expect(totals[0]).toBeNull();
    expect(totals[1]).toMatchObject({ letters: ['AK'], value: '15.99' });
    expect(totals[2]).toMatchObject({ letters: ['AY'], value: line(result, 'AY').value });
    expect(totals[3]).toMatchObject({ letters: ['BB'], value: line(result, 'BB').value });
    expect(totals[4]?.letters).toEqual(['BC', 'BD', 'BE', 'BF']);
    expect(totals[5]).toMatchObject({ letters: ['BG'], value: line(result, 'BG').value });
  });

  it('says nothing about rounding when the lines as shown add to the rounded total (stage 5: 0 + 45.33 + 9.44 + 18.89 = 73.66)', () => {
    expect(defined(result.stages[4]).total?.shownLinesSum).toBeNull();
  });

  it('says what the lines as shown add to when that is not the rounded total (0.13 + 0.03 + 0.05 = 0.21 beside 0.20)', () => {
    const small = working({ row: { H: '1', AP: '1.05' }, material: 'not-applicable' });
    expect(defined(small.stages[4]).total).toMatchObject({ value: '0.20475', shownLinesSum: '0.21' });
  });

  it('prints the price in dollars and euros from the exchange rates the calculation used', () => {
    expect(line(result, 'BI').working).toBe('90');
    expect(line(result, 'BK').working).toBe('451.3981 / 90.0000');
  });
});

describe('AC-3 (SPEC section 14 item 5): treatment lines that are not selected are hidden, and still calculated as 0', () => {
  it('hides AR (Primer) and AW (Foam), whose flags are 0, and counts them', () => {
    const result = working();
    expect(linesOf(result).filter((candidate) => candidate.hidden).map((candidate) => candidate.letter)).toEqual(['AR', 'AW']);
    expect(result.hiddenLineCount).toBe(2);
    expect(line(result, 'AR')).toMatchObject({ value: '0', hidden: true });
    expect(line(result, 'AW')).toMatchObject({ value: '0', hidden: true });
  });

  it('with no flag chosen, the seven flag-dependent lines AQ, AR, AS, AT, AV, AW and AX are hidden, and the two typed entries are not', () => {
    const none = Object.fromEntries(Object.entries(ROW).filter(([letter]) => !['Z', 'AA', 'AB', 'AC', 'AE', 'AF', 'AG'].includes(letter)));
    const result = working({ row: none });
    expect(linesOf(result).filter((candidate) => candidate.hidden).map((candidate) => candidate.letter)).toEqual(['AQ', 'AR', 'AS', 'AT', 'AV', 'AW', 'AX']);
    expect(result.hiddenLineCount).toBe(7);
    expect(line(result, 'AU').hidden).toBe(false);
    for (const letter of ['AQ', 'AR', 'AS', 'AT', 'AV', 'AW', 'AX']) expect(line(result, letter).value, letter).toBe('0');
  });
});

describe('AC-4 (FR-026): a division by zero is no figure, and the rest of the row still has its working', () => {
  const result = working({ exchange: { usd: '0', eur: '90' } });

  it('BJ has no value, its working ends in the zero it divided by, and BG, BK and the other lines are as they were', () => {
    expect(line(result, 'BJ')).toMatchObject({ value: null, working: '451.3981 / 0.0000' });
    expect(line(result, 'BH')).toMatchObject({ value: '0', working: '0' });
    expect(line(result, 'BK').value).toBe(line(working(), 'BK').value);
    expect(line(result, 'BG').value).toBe(line(working(), 'BG').value);
  });

  it('an exchange rate that was never saved is no figure for the line that reads it, and its operand is a dash', () => {
    const none = working({ exchange: { usd: null, eur: '90' } });
    expect(line(none, 'BH')).toMatchObject({ value: null, working: '—' });
    expect(line(none, 'BJ')).toMatchObject({ value: null, working: '451.3981 / —' });
  });
});

describe('AC-5 (D-17, D-27, UX-34): a row with the "Not applicable" material', () => {
  const result = working({ material: 'not-applicable' });

  it('is marked, and has the material rate blank', () => {
    expect(result.notApplicable).toBe(true);
    expect(line(result, 'I')).toMatchObject({ value: null, blank: true, working: null });
    expect(working().notApplicable).toBe(false);
  });

  it('shows 0 for M, O and AK, with their formulas and with no worked line', () => {
    for (const letter of ['M', 'O', 'AK']) expect(line(result, letter), letter).toMatchObject({ value: '0', working: null });
    for (const letter of ['M', 'O', 'AK']) expect(line(result, letter).formula, letter).not.toBeNull();
  });

  it('the Scrap Weight formula is printed as seeded (AC-6)', () => {
    expect(line(result, 'O').formula).toBe('IF(Material-Specific-Gravity > 0, M - N, 0)');
  });

  /**
   * A probe registry: Area in Sq. in (AH) is given a formula that **names** the material in a branch that is not taken, `IF(0 > 1, Material-Price-per-kg, (J * K * 2) / 645)`. The evaluation never
   * reads the material, but the working prints the value of every operand of the formula, the branch not taken included, so a line decided by the path taken would print the material's number
   * (review SQR-01 of AQP-320). Decided by the formula's references, the line has no worked line on a "Not applicable" row.
   */
  describe('a formula that names the material only in a branch that is not taken (review SQR-01 of AQP-320)', () => {
    const probe = cloneSeedConfig();
    const probeFields = probe.fields.map((field) =>
      field.id === idOf('AH') && field.kind === 'output'
        ? { ...field, formula: `IF(0 > 1, {{mat:pricePerKg}}, ({{f:${idOf('J')}}} * {{f:${idOf('K')}}} * 2) / 645)` }
        : field,
    );
    const document = { ...probe, fields: probeFields };

    it('has no worked line on a "Not applicable" row, and still has its formula and its value', () => {
      const notApplicable = working({ material: 'not-applicable', document });
      expect(line(notApplicable, 'AH')).toMatchObject({ working: null, formula: 'IF(0 > 1, Material-Price-per-kg, (J * K * 2) / 645)', value: line(working({ document }), 'AH').value });
    });

    it('control: on an ordinary row the same line has its worked line, with the material\'s price in it', () => {
      expect(line(working({ document }), 'AH').working).toBe('IF(0 > 1, 60, (200 × 100 × 2) / 645)');
    });
  });

  it('prints no Material- operand value and no price of a material anywhere in the working, and the other stages work as usual', () => {
    // Every line whose formula names the material (a Material- operand, or the material rate I) has no worked line, whatever path the evaluation took.
    const naming = linesOf(result).filter((candidate) => candidate.formula !== null && /Material-|I/.test(candidate.formula));
    expect(naming.map((candidate) => candidate.letter)).toEqual(['M', 'O', 'AK']);
    for (const candidate of naming) expect(candidate.working, candidate.letter).toBeNull();
    expect(linesOf(result).flatMap((candidate) => (candidate.working === null ? [] : [candidate.working])).join(' ')).not.toMatch(/Material-/);
    expect(line(result, 'AL').working).toBe('10 × 0.5');
    expect(line(result, 'BA').working).toBe('0.0000 + 99.9230 + 10.0000');
    expect(line(result, 'AY').value).toBe(line(working(), 'AY').value);
  });
});

describe('the record must explain itself: a working that does not reproduce the stored figure is a fault, never a printed line', () => {
  it('throws when a stored output is not what its formula gives from the stored operands', () => {
    expect(() => working({}, (row) => void (row.outputs[idOf('AK')] = '16'))).toThrow(WorkingMismatchError);
  });

  it('throws when a stored output that a formula reads has been changed (the one after it no longer follows)', () => {
    expect(() => working({}, (row) => void (row.outputs[idOf('M')] = '0.4'))).toThrow(WorkingMismatchError);
  });

  it('throws when a figure is stored for a line that has no figure, and when none is stored for a formula', () => {
    expect(() => working({ exchange: { usd: '0', eur: '90' } }, (row) => void (row.outputs[idOf('BJ')] = '5'))).toThrow(WorkingMismatchError);
    expect(() => working({}, (row) => void Reflect.deleteProperty(row.outputs, idOf('AK')))).toThrow(WorkingMismatchError);
  });

  it('the error holds no figure and no formula', () => {
    expect(new WorkingMismatchError().message).toBe('The stored figures of a row cannot be reproduced from the calculation record.');
  });

  it('throws when the record holds no material for the row, in plain words', () => {
    const field = defined(findFieldByKey(seedConfig, MATERIAL_IN_DRAWING_KEY));
    expect(() => working({}, (row) => void (row.inputs[field.id] = 'Words of no material'))).toThrow('The calculation record holds no material for a row.');
  });

  it('does not recompute with a later price: the working follows the snapshot of the calculation, so a master changed since changes nothing here', () => {
    // The stored outputs were made at 60 a kg. A snapshot that says 70 cannot explain them, so it is refused instead of silently printing the dearer working.
    expect(() => working({}, (row) => void (row.snapshot.materials[0] = { ...defined(row.snapshot.materials[0]), pricePerKg: '70' }))).toThrow(WorkingMismatchError);
  });
});
