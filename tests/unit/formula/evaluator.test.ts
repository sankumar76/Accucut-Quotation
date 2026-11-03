import { describe, expect, it } from 'vitest';

import { evaluate, evaluateWithWorking } from '@/lib/formula';

import { d, fieldAt, makeResolver, parseDisplay, RATE_PERCENT, show, type ResolverInput } from '../../support/formula-fixtures';

/**
 * AC-1, AC-2, AC-3 and AC-7: values.
 *
 * ORACLE. Every expected value below was worked out by hand from the invented inputs in `INPUT` before the
 * engine was run; none comes from the sample workbook (ADR-014). The working is written beside each row.
 *
 *   A = 12, B = 4, C = 0, D = 2.5, E has no figure.
 *   Test-Rate-per-kg = 3, Test Spaced Rate = 0.5, Test Share % = 12 (a percentage: 0.12),
 *   Cutting-Rate-per-Sec = 2, OH Profit % = 8 (0.08), Inspection & Packing % = 2.5 (0.025).
 *   Material: price 50, specific gravity 7.5, scrap rate 10. Exchange: USD 80, EUR 90.
 *   Column A over three rows: 1, 2, 3.5. Column B over two rows: 10.1, 20.2.
 */

const INPUT: ResolverInput = {
  fields: { A: '12', B: '4', C: '0', D: '2.5', E: null },
  columns: { A: ['1', '2', '3.5'], B: ['10.1', '20.2'], E: ['1', null, '3'] },
  rates: {
    'Test-Rate-per-kg': '3',
    'Test Spaced Rate': '0.5',
    'Test Share %': '12',
    'Cutting-Rate-per-Sec': '2',
    'OH Profit %': '8',
    'Inspection & Packing %': '2.5',
  },
  material: { pricePerKg: '50', specificGravity: '7.5', scrapRate: '10' },
  exchange: { USD: '80', EUR: '90' },
};

function calc(text: string, input: ResolverInput = INPUT): string | null {
  return show(evaluate(parseDisplay(text), makeResolver(input)));
}

describe('evaluator: operators (AC-1, AC-2)', () => {
  it.each([
    ['AC-1: addition', 'A + B', '16'], // 12 + 4
    ['AC-1: subtraction', 'A - B', '8'], // 12 - 4
    ['AC-1: multiplication', 'A * B', '48'], // 12 x 4
    ['AC-1: division', 'A / B', '3'], // 12 / 4
    ['AC-1: division that does not end', 'A / D', '4.8'], // 12 / 2.5
    ['AC-1: a decimal times itself', 'D * D', '6.25'],
    ['AC-1: brackets first', '(A + B) * 2', '32'], // 16 x 2
    ['AC-1: multiplication before addition', 'A + B * 2', '20'], // 12 + 8
    ['AC-1: left to right', 'A - B - D', '5.5'], // (12 - 4) - 2.5
    ['AC-1: unary minus', '-A + B', '-8'], // -12 + 4
    ['AC-1: subtracting a negative', 'A - -B', '16'], // 12 + 4
    ['AC-1: a number alone', '0', '0'],
    ['AC-2: 0.1 + 0.2 is exactly 0.3', '0.1 + 0.2', '0.3'],
    ['AC-2: a long decimal stays exact', '0.1 * 3', '0.3'],
    ['AC-2: money-sized numbers add exactly', '123456789012.34 + 0.01', '123456789012.35'],
  ])('%s', (_name, text, expected) => {
    expect(calc(text)).toBe(expected);
  });

  it('AC-2: a quotient is held to 34 significant digits', () => {
    // 12 / 7 = 1.714285 repeating; 34 significant digits are the 1 and 33 places, and the next digit is 2.
    expect(calc('A / 7')).toBe(`1.${'714285'.repeat(5)}714`);
  });
});

describe('evaluator: operands (AC-1, AC-2)', () => {
  it.each([
    ['AC-1: a rate', 'A * Test-Rate-per-kg', '36'], // 12 x 3
    ['AC-1: a rate with a space', 'A * Test Spaced Rate', '6'], // 12 x 0.5
    ['AC-1: a hyphenated rate', 'A * Cutting-Rate-per-Sec', '24'], // 12 x 2
    ['AC-2, FR-028: a rate ending in " %" typed as 12 is 0.12', 'A * Test Share %', '1.44'], // 12 x 0.12
    ['AC-2, FR-028: OH Profit % typed as 8 is 0.08', 'B * OH Profit %', '0.32'], // 4 x 0.08
    ['AC-2, FR-028: Inspection & Packing % typed as 2.5 is 0.025', 'A * Inspection & Packing %', '0.3'], // 12 x 0.025
    ['AC-1: Material-Specific-Gravity', 'Material-Specific-Gravity * B', '30'], // 7.5 x 4
    ['AC-1: Material-Scrap-Rate and Material-Price-per-kg', 'Material-Scrap-Rate - Material-Price-per-kg', '-40'], // 10 - 50
    ['AC-1: ExchangeRate-USD', 'A / ExchangeRate-USD', '0.15'], // 12 / 80
    ['AC-1: ExchangeRate-EUR', 'A * ExchangeRate-EUR', '1080'], // 12 x 90
    ['AC-1: a name between spaces and brackets', '(Test Spaced Rate + 1) * 2', '3'], // (0.5 + 1) x 2
  ])('%s', (_name, text, expected) => {
    expect(calc(text)).toBe(expected);
  });

  it('AC-2: a percent rate is divided by 100 in one place, so the same typed value always gives the same fraction', () => {
    const twelve = makeResolver({ rates: { 'Test Share %': '12' } });
    expect(show(twelve.rate(RATE_PERCENT))).toBe('0.12');
    expect(show(evaluate(parseDisplay('Test Share %'), twelve))).toBe('0.12');
    expect(show(evaluate(parseDisplay('Test Share % * 100'), twelve))).toBe('12');
  });
});

describe('evaluator: functions (AC-1)', () => {
  it.each([
    ['AC-1: SUM across all rows', 'SUM(A)', '6.5'], // 1 + 2 + 3.5
    ['AC-1: SUM added exactly', 'SUM(B)', '30.3'], // 10.1 + 20.2
    ['AC-1: SUM in a quotient', 'SUM(A) / B', '1.625'], // 6.5 / 4
    ['AC-1: MIN', 'MIN(A, B, D)', '2.5'],
    ['AC-1: MAX', 'MAX(A, B, D)', '12'],
    ['AC-1: MAX against a computed value', 'MAX(C, B - A)', '0'], // max(0, -8)
    ['AC-1: MIN of one value', 'MIN(D)', '2.5'],
    ['AC-1: ROUND down', 'ROUND(D / 3, 2)', '0.83'], // 0.8333...
    ['AC-1: ROUND up', 'ROUND(A / 7, 4)', '1.7143'], // 1.714285...
    ['AC-1: ROUND a tie away from zero', 'ROUND(D * 3, 0)', '8'], // 7.5
    ['AC-1: ROUND a negative tie away from zero', 'ROUND(-D * 3, 0)', '-8'], // -7.5
    ['AC-1: ROUND to a whole number', 'ROUND(D, 0)', '3'], // 2.5
    ['AC-1: ROUND what needs no rounding', 'ROUND(D, 5)', '2.5'],
  ])('%s', (_name, text, expected) => {
    expect(calc(text)).toBe(expected);
  });

  it.each([
    ['>', 'IF(A > B, 1, 2)', '1'], // 12 > 4
    ['>', 'IF(A > A, 1, 2)', '2'],
    ['>=', 'IF(A >= A, 1, 2)', '1'],
    ['>=', 'IF(B >= A, 1, 2)', '2'],
    ['<', 'IF(B < A, 1, 2)', '1'],
    ['<', 'IF(A < A, 1, 2)', '2'],
    ['<=', 'IF(A <= A, 1, 2)', '1'],
    ['<=', 'IF(A <= B, 1, 2)', '2'],
    ['=', 'IF(A = 12, 1, 2)', '1'],
    ['=', 'IF(A = B, 1, 2)', '2'],
    ['<>', 'IF(A <> B, 1, 2)', '1'],
    ['<>', 'IF(A <> 12, 1, 2)', '2'],
  ])('AC-1: the comparison %s in %s gives %s', (_operator, text, expected) => {
    expect(calc(text)).toBe(expected);
  });

  it('AC-2: a comparison is exact: 0.1 + 0.2 equals 0.3', () => {
    expect(calc('IF(0.1 + 0.2 = 0.3, 1, 2)')).toBe('1');
  });

  it('AC-1: the guarded Scrap Weight, with a real material and with the hidden one', () => {
    const guarded = 'IF(Material-Specific-Gravity > 0, A - B, 0)';
    expect(calc(guarded)).toBe('8'); // 7.5 > 0, so 12 - 4
    expect(calc(guarded, { ...INPUT, material: { specificGravity: '0' } })).toBe('0');
  });

  it('AC-1: only the branch taken is evaluated', () => {
    expect(calc('IF(A < 1, A / C, 2)')).toBe('2');
    expect(calc('IF(A > 1, 5, A / C)')).toBe('5');
  });
});

describe('evaluator: no figure spreads (AC-3)', () => {
  it.each([
    ['a divisor of 0', 'A / C'],
    ['a divisor of the literal 0', 'A / 0'],
    ['0 divided by 0', 'C / C'],
    ['through addition', '(A / C) + B'],
    ['through subtraction', 'B - (A / C)'],
    ['through multiplication', 'B * (A / C)'],
    ['through a further division', 'B / (A / C)'],
    ['through a minus sign', '-(A / C)'],
    ['through brackets', '((A / C))'],
    ['through MIN', 'MIN(A, A / C)'],
    ['through MAX', 'MAX(A / C, A)'],
    ['through ROUND', 'ROUND(A / C, 2)'],
    ['into the condition of IF', 'IF(A / C > 1, 1, 2)'],
    ['into the right side of the condition', 'IF(1 < A / C, 1, 2)'],
    ['into the branch taken', 'IF(A > 1, A / C, 2)'],
    ['a field with no figure', 'E + 1'],
    ['a rate with no value', 'A * Test-Rate-per-kg'],
    ['a SUM over a column with a missing figure', 'SUM(E)'],
    ['a SUM that sits in a sum', 'SUM(E) + 1'],
  ])('AC-3: %s gives no figure and does not throw', (_name, text) => {
    const input = text.includes('Test-Rate-per-kg') ? { ...INPUT, rates: {} } : INPUT;
    expect(calc(text, input)).toBeNull();
  });

  it('AC-3: an exchange rate of 0 gives no figure for the line that divides by it, and others are unaffected', () => {
    const input: ResolverInput = { ...INPUT, exchange: { USD: '0', EUR: '90' } };
    expect(calc('A / ExchangeRate-USD', input)).toBeNull();
    expect(calc('A / ExchangeRate-EUR', input)).toBe(`0.1${'3'.repeat(33)}`);
    expect(calc('A + B', input)).toBe('16');
  });

  it('AC-3: SUM over no rows is 0', () => {
    expect(calc('SUM(A)', { ...INPUT, columns: {} })).toBe('0');
    expect(calc('SUM(A)', { ...INPUT, columns: { A: [] } })).toBe('0');
  });

  it('AC-3: SUM does not skip a missing figure: a total is never quietly lower', () => {
    expect(calc('SUM(E)')).toBeNull();
    expect(calc('SUM(A)')).toBe('6.5');
  });
});

describe('evaluator: the working (AC-7)', () => {
  it('AC-7: returns the operands used, at stored precision, in order of first use', () => {
    const stored = '12.123456789012345678901234';
    const input: ResolverInput = { ...INPUT, fields: { ...INPUT.fields, A: stored } };
    const { value, operands } = evaluateWithWorking(parseDisplay('A * Test Share % + SUM(B)'), makeResolver(input));
    expect(operands).toHaveLength(3);
    const [first, second, third] = operands;
    expect(first).toMatchObject({ kind: 'value', reference: { kind: 'field', id: fieldAt('A') } });
    expect(first?.value?.toFixed()).toBe(stored);
    // The percent rate is shown as the fraction the formula used.
    expect(second).toMatchObject({ kind: 'value', reference: { kind: 'rate', id: RATE_PERCENT } });
    expect(second?.value?.toFixed()).toBe('0.12');
    expect(third).toMatchObject({ kind: 'sum', fieldId: fieldAt('B'), rowCount: 2 });
    expect(third?.value?.toFixed()).toBe('30.3');
    // 12.123456789012345678901234 x 0.12 + 30.3 = 1.45481481468148148146814808 + 30.3
    expect(value?.toFixed()).toBe('31.75481481468148148146814808');
  });

  it('AC-7: the working reproduces the result when its operands are put back into the formula', () => {
    const { value, operands } = evaluateWithWorking(parseDisplay('(A - B) * Test-Rate-per-kg + Material-Scrap-Rate'), makeResolver(INPUT));
    const [a, b, rate, scrap] = operands.map((operand) => operand.value);
    expect(operands).toHaveLength(4);
    expect(show(value)).toBe('34'); // (12 - 4) x 3 + 10
    expect(a?.minus(b ?? d('0')).times(rate ?? d('0')).plus(scrap ?? d('0')).toFixed()).toBe(show(value));
  });

  it('AC-7: lists a repeated operand once', () => {
    const { operands } = evaluateWithWorking(parseDisplay('A * A + A'), makeResolver(INPUT));
    expect(operands).toHaveLength(1);
  });

  it('AC-7: lists only the operands on the path taken: the branch that did not run is absent', () => {
    const { value, operands } = evaluateWithWorking(parseDisplay('IF(A > B, D, Test-Rate-per-kg)'), makeResolver(INPUT));
    expect(show(value)).toBe('2.5');
    const ids = operands.flatMap((operand) => (operand.kind === 'value' && operand.reference.kind === 'field' ? [operand.reference.id] : []));
    expect(ids).toEqual([fieldAt('A'), fieldAt('B'), fieldAt('D')]);
    expect(operands.some((operand) => operand.kind === 'value' && operand.reference.kind === 'rate')).toBe(false);
  });

  it('AC-7: lists a material, an exchange rate and an operand with no figure', () => {
    const { value, operands } = evaluateWithWorking(parseDisplay('Material-Specific-Gravity / ExchangeRate-USD + E'), makeResolver(INPUT));
    expect(value).toBeNull();
    expect(operands.map((operand) => (operand.kind === 'value' ? operand.reference.kind : operand.kind))).toEqual([
      'material',
      'exchange',
      'field',
    ]);
    expect(operands[2]?.value).toBeNull();
  });

  it('AC-7: the value is the same with or without the working', () => {
    const expression = parseDisplay('ROUND(A / 7, 6) + SUM(A)');
    const resolver = makeResolver(INPUT);
    expect(show(evaluateWithWorking(expression, resolver).value)).toBe(show(evaluate(expression, resolver)));
  });
});

describe('evaluator: long formulas (AC-1 edge cases)', () => {
  it('adds a long chain of terms without overflowing the stack', () => {
    const terms = 900;
    const text = Array.from({ length: terms }, () => 'D').join(' + ');
    expect(calc(text)).toBe('2250'); // 900 x 2.5
  });

  it('works out deeply nested brackets', () => {
    const depth = 90;
    expect(calc(`${'('.repeat(depth)}A + B${')'.repeat(depth)}`)).toBe('16');
  });
});
