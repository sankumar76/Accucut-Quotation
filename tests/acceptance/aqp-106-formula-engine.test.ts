import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import DecimalJs from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { Decimal, type Value } from '../../src/lib/decimal';
import { ConfigDocumentError, parseConfigDocument } from '../../src/lib/fields/schema';
import {
  analyzeConfiguration,
  checkDisplayFormula,
  compilePlan,
  createPlanCache,
  evaluate,
  evaluateProductFormulas,
  evaluateRowFormulas,
  evaluateWithWorking,
  formulaRateValue,
  FormulaError,
  MAX_FORMULA_LENGTH,
  parseFormula,
  rateNameIssues,
  toDisplayForm,
  toInternalForm,
  validateFormulas,
  type Expression,
  type FormulaIssue,
  type Resolver,
  type ValidatableField,
} from '../../src/lib/formula';
import { defined } from '../support/defined';
import { cloneSeedConfig, SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';

/**
 * QA acceptance tests for AQP-106 (STORY-03.02), the formula engine. Written from the AC text with a separate
 * oracle: every expected value is worked by hand (or with BigInt) below, never computed by the engine under test.
 * All numbers and names are invented, except the 15 seed rate names, which are structure (ADR-014).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// ---- A small registry of its own: letters A..Z, AA..BZ -----------------------------------------------------

const LETTERS: string[] = [];
for (const first of ['', 'A', 'B']) for (let code = 65; code <= 90; code += 1) LETTERS.push(first + String.fromCharCode(code));

function idAt(position: number): string {
  return `00000000-0000-4000-8000-0aaa${String(position).padStart(8, '0')}`;
}

const FIELD_IDS = LETTERS.map((_letter, index) => idAt(index + 1));
const id = (letter: string): string => defined(FIELD_IDS[LETTERS.indexOf(letter)], `field ${letter}`);

const RATE_FOAM = '00000000-0000-4000-8000-0ccc00000001';
const RATE_FOAM_COST = '00000000-0000-4000-8000-0ccc00000002';
const RATE_SHARE = '00000000-0000-4000-8000-0ccc00000003';
const RATE_CUT = '00000000-0000-4000-8000-0ccc00000004';
const RATES = [
  { id: RATE_FOAM, name: 'Foam' },
  { id: RATE_FOAM_COST, name: 'Foam Cost' },
  { id: RATE_SHARE, name: 'OH Profit %' },
  { id: RATE_CUT, name: 'Cutting-Rate-per-Sec' },
];
const CONTEXT = { fieldIds: FIELD_IDS, rates: RATES };

type Text = string | null;

interface Values {
  readonly fields?: Record<string, Text>;
  readonly columns?: Record<string, Text[]>;
  readonly rates?: Record<string, Text>;
  readonly material?: Record<string, Text>;
  readonly fx?: Record<string, Text>;
}

/** A resolver over invented text values. It records every field it was asked for. */
function resolver(values: Values = {}, asked: string[] = []): Resolver {
  const toValue = (text: Text | undefined): Value => (text === undefined || text === null ? null : new Decimal(text));
  const letterOf = (fieldId: string): string => defined(LETTERS[FIELD_IDS.indexOf(fieldId)], 'letter');
  return {
    fieldValue(fieldId) {
      asked.push(letterOf(fieldId));
      return toValue(values.fields?.[letterOf(fieldId)]);
    },
    columnValues: (fieldId) => (values.columns?.[letterOf(fieldId)] ?? []).map(toValue),
    rate(rateId) {
      const rate = RATES.find((candidate) => candidate.id === rateId);
      return rate === undefined ? null : formulaRateValue(rate.name, toValue(values.rates?.[rate.name]));
    },
    material: (key) => toValue(values.material?.[key]),
    exchangeRate: (currency) => toValue(values.fx?.[currency]),
  };
}

function display(text: string): Expression {
  return parseFormula(text, { form: 'display', context: CONTEXT });
}

/** The value of a display formula as plain digits, or null. */
function run(text: string, values: Values = {}): string | null {
  const value = evaluate(display(text), resolver(values));
  return value === null ? null : value.toFixed();
}

function issueOf(action: () => unknown): FormulaIssue {
  try {
    action();
  } catch (error) {
    if (error instanceof FormulaError) return error.issue;
    throw error;
  }
  throw new Error('Expected a FormulaError.');
}

const refuse = (text: string): FormulaIssue => issueOf(() => display(text));

// ---- AC-1 -------------------------------------------------------------------------------------------------------

describe('[AQP-106 AC-1] operands, operators, functions and comparisons', () => {
  it.each([
    ['2 + 3', '5'],
    ['2 - 3', '-1'],
    ['2 * 3', '6'],
    ['3 / 2', '1.5'],
    ['2 + 3 * 4', '14'],
    ['(2 + 3) * 4', '20'],
    ['10 - 2 - 3', '5'],
    ['24 / 4 / 2', '3'],
    ['2 * 3 + 4 * 5', '26'],
    ['-2 * 3', '-6'],
    ['2 * -3', '-6'],
    ['--2', '2'],
    ['- -2', '2'],
    ['-(2 + 3) * 2', '-10'],
    ['2 - -3', '5'],
    ['8 / -2 / -2', '2'],
    ['.5 + .25', '0.75'],
    ['((((1))))', '1'],
    ['  2\t+\n3  ', '5'],
  ])('[AQP-106 AC-1] %s = %s (precedence, associativity, unary minus, whitespace)', (text, expected) => {
    expect(run(text)).toBe(expected);
  });

  it('[AQP-106 AC-1] column letters read the same row; rate names, Material-* and ExchangeRate-* resolve', () => {
    const values: Values = {
      fields: { A: '2', Z: '3', AA: '5', BZ: '7' },
      rates: { Foam: '11', 'Foam Cost': '13', 'Cutting-Rate-per-Sec': '17', 'OH Profit %': '12' },
      material: { pricePerKg: '19', specificGravity: '23', scrapRate: '29' },
      fx: { USD: '31', EUR: '37' },
    };
    expect(run('A + Z + AA + BZ', values)).toBe('17');
    expect(run('Foam', values)).toBe('11');
    expect(run('Foam Cost', values)).toBe('13');
    expect(run('Foam Cost - Foam', values)).toBe('2');
    expect(run('Cutting-Rate-per-Sec', values)).toBe('17');
    expect(run('OH Profit %', values)).toBe('0.12');
    expect(run('Material-Price-per-kg + Material-Specific-Gravity + Material-Scrap-Rate', values)).toBe('71');
    expect(run('ExchangeRate-USD * ExchangeRate-EUR', values)).toBe('1147');
  });

  it('[AQP-106 AC-1] names are matched exactly and longest-first: "Foam Cost" is one operand, not Foam then an error', () => {
    const tree = display('Foam Cost');
    expect(tree).toEqual({ kind: 'reference', reference: { kind: 'rate', id: RATE_FOAM_COST } });
    expect(display('Cutting-Rate-per-Sec')).toEqual({ kind: 'reference', reference: { kind: 'rate', id: RATE_CUT } });
    // OH Profit % begins with the letters of a column; it is still the rate.
    expect(display('OH Profit %')).toEqual({ kind: 'reference', reference: { kind: 'rate', id: RATE_SHARE } });
    expect(refuse('FoamCost').code).toBe('UNKNOWN_NAME');
    expect(refuse('foam').code).toBe('UNKNOWN_NAME');
  });

  it('[AQP-106 AC-1] SUM adds a column over every row; MIN, MAX and ROUND; IF with each of the six comparisons', () => {
    expect(run('SUM(A)', { columns: { A: ['1.10', '2.20', '3.30'] } })).toBe('6.6');
    expect(run('MIN(3, 1.5, 2)')).toBe('1.5');
    expect(run('MAX(3, 1.5, 2)')).toBe('3');
    expect(run('MIN(-1)')).toBe('-1');
    expect(run('ROUND(2.345, 2)')).toBe('2.35');
    const table: ReadonlyArray<readonly [string, string, string, string]> = [
      // operator, at equality, left larger, left smaller
      ['>', '0', '1', '0'],
      ['>=', '1', '1', '0'],
      ['<', '0', '0', '1'],
      ['<=', '1', '0', '1'],
      ['=', '1', '0', '0'],
      ['<>', '0', '1', '1'],
    ];
    for (const [operator, equal, larger, smaller] of table) {
      expect(run(`IF(A ${operator} B, 1, 0)`, { fields: { A: '2.50', B: '2.5' } }), `${operator} equal`).toBe(equal);
      expect(run(`IF(A ${operator} B, 1, 0)`, { fields: { A: '2.51', B: '2.5' } }), `${operator} larger`).toBe(larger);
      expect(run(`IF(A ${operator} B, 1, 0)`, { fields: { A: '-3', B: '2.5' } }), `${operator} smaller`).toBe(smaller);
    }
  });

  it.each([
    ['a bare comparison', 'A > B'],
    ['a comparison in brackets', '1 + (A > B)'],
    ['a comparison as a MIN argument', 'MIN(A > B, 1)'],
    ['a comparison as an IF result', 'IF(A > B, A > B, 1)'],
    ['two comparisons in one condition', 'IF(A > B > C, 1, 2)'],
    ['= alone', 'A = B'],
    ['a doubled =', 'IF(A == B, 1, 2)'],
  ])('[AQP-106 AC-1] a comparison anywhere but the IF condition is refused: %s', (_name, text) => {
    expect(refuse(text).code).toBe('COMPARISON_OUTSIDE_IF');
  });

  it.each([
    ['ROLLUP is not a function', 'ROLLUP(A)', 'UNKNOWN_FUNCTION'],
    ['lower-case sum', 'sum(A)', 'UNKNOWN_FUNCTION'],
    ['AVERAGE', 'AVERAGE(A)', 'UNKNOWN_FUNCTION'],
    ['IF without a comparison', 'IF(A, 1, 2)', 'IF_NEEDS_COMPARISON'],
    ['IF with two arguments', 'IF(A > B, 1)', 'WRONG_ARGUMENT_COUNT'],
    ['IF with four arguments', 'IF(A > B, 1, 2, 3)', 'WRONG_ARGUMENT_COUNT'],
    ['SUM of an expression', 'SUM(A + B)', 'SUM_NEEDS_COLUMN'],
    ['SUM of a number', 'SUM(1)', 'SUM_NEEDS_COLUMN'],
    ['SUM of a rate', 'SUM(Foam)', 'SUM_NEEDS_COLUMN'],
    ['SUM of two columns', 'SUM(A, B)', 'WRONG_ARGUMENT_COUNT'],
    ['an empty SUM', 'SUM()', 'EXPECTED_OPERAND'],
    ['an empty MIN', 'MIN()', 'EXPECTED_OPERAND'],
    ['ROUND with one argument', 'ROUND(A)', 'WRONG_ARGUMENT_COUNT'],
    ['ROUND to a fraction of a place', 'ROUND(A, 1.5)', 'ROUND_NEEDS_PLACES'],
    ['ROUND to 21 places', 'ROUND(A, 21)', 'ROUND_NEEDS_PLACES'],
    ['ROUND to a column of places', 'ROUND(A, B)', 'ROUND_NEEDS_PLACES'],
    ['a unary plus', '+A', 'EXPECTED_OPERAND'],
    ['an exponent', '1e5', 'UNKNOWN_NAME'],
    ['a percent sign after a column', 'A%', 'INVALID_CHARACTER'],
    ['an unknown exchange rate', 'ExchangeRate-GBP', 'UNKNOWN_NAME'],
    ['part of a Material name', 'Material-Price', 'UNKNOWN_NAME'],
    ['braces in display form', 'A + {{f:x}}', 'BRACES_IN_DISPLAY_FORM'],
  ])('[AQP-106 AC-1] refuses %s', (_name, text, code) => {
    expect(refuse(text).code).toBe(code);
  });
});

// ---- AC-2 -------------------------------------------------------------------------------------------------------

describe('[AQP-106 AC-2] money in decimal.js, 34 digits, half-up; the percent resolver', () => {
  it('[AQP-106 AC-2] Decimal is configured to 34 significant digits, half-up, on a private clone (the global decimal.js is untouched)', () => {
    expect(Decimal.precision).toBe(34);
    expect(Decimal.rounding).toBe(DecimalJs.ROUND_HALF_UP);
    expect(DecimalJs.precision).toBe(20);
    expect(run('1 / 3')).toBe('0.3333333333333333333333333333333333');
    expect(run('2 / 3')).toBe('0.6666666666666666666666666666666667');
    expect(run('-2 / 3')).toBe('-0.6666666666666666666666666666666667');
    expect(run('0.1 + 0.2')).toBe('0.3');
    expect(run('1.1 * 1.1')).toBe('1.21');
  });

  it('[AQP-106 AC-2] 2,000 seeded random money strings add up exactly (oracle: BigInt cents), through SUM and through +', () => {
    let state = 106n;
    const texts: string[] = [];
    let cents = 0n;
    for (let index = 0; index < 2_000; index += 1) {
      state = (state * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
      const amount = (state % 10_000_000_000n) - 5_000_000_000n; // -50,000,000.00 to 49,999,999.99
      cents += amount;
      const sign = amount < 0n ? '-' : '';
      const magnitude = amount < 0n ? -amount : amount;
      texts.push(`${sign}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`);
    }
    const sign = cents < 0n ? '-' : '';
    const magnitude = cents < 0n ? -cents : cents;
    const expected = new Decimal(`${sign}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`).toFixed();
    expect(run('SUM(A)', { columns: { A: texts } })).toBe(expected);
    const chained = texts.slice(0, 150).join(' + ').replace(/\+ -/g, '- ');
    const head = texts.slice(0, 150).reduce((total, text) => total.plus(text), new Decimal(0));
    expect(evaluate(parseFormula(chained.startsWith('-') ? `0 ${chained}` : chained, { form: 'internal' }), resolver())?.toFixed()).toBe(head.toFixed());
  });

  it('[AQP-106 AC-2] ROUND rounds half away from zero, on exact decimals', () => {
    expect(run('ROUND(2.5, 0)')).toBe('3');
    expect(run('ROUND(-2.5, 0)')).toBe('-3');
    expect(run('ROUND(1.005, 2)')).toBe('1.01');
    expect(run('ROUND(-1.005, 2)')).toBe('-1.01');
    expect(run('ROUND(0.125, 2)')).toBe('0.13');
    expect(run('ROUND(2.4999, 0)')).toBe('2');
    expect(run('ROUND(1.23456789012345678901, 20)')).toBe('1.23456789012345678901');
  });

  it('[AQP-106 AC-2] a rate whose name ends in " %" is divided by 100, once; other rates are unchanged', () => {
    expect(run('OH Profit %', { rates: { 'OH Profit %': '12' } })).toBe('0.12');
    expect(run('OH Profit %', { rates: { 'OH Profit %': '12.5' } })).toBe('0.125');
    expect(run('100 * OH Profit %', { rates: { 'OH Profit %': '7' } })).toBe('7');
    expect(run('Foam Cost', { rates: { 'Foam Cost': '12' } })).toBe('12');
    expect(formulaRateValue('Transport %', new Decimal('3'))?.toFixed()).toBe('0.03');
    expect(formulaRateValue('Inspection & Packing %', new Decimal('2.5'))?.toFixed()).toBe('0.025');
    // Only the " %" suffix counts: no space, a trailing space, or % inside the name are plain rates.
    expect(formulaRateValue('Share%', new Decimal('12'))?.toFixed()).toBe('12');
    expect(formulaRateValue('Share % ', new Decimal('12'))?.toFixed()).toBe('12');
    expect(formulaRateValue('% Share', new Decimal('12'))?.toFixed()).toBe('12');
    expect(formulaRateValue('OH Profit %', null)).toBeNull();
  });

  it('[AQP-106 AC-2] the code that computes values holds no JavaScript arithmetic: no parseFloat, Number() or Math.* in the evaluator, plan, rates, AST or decimal.ts (positions in errors.ts are not money)', () => {
    const directory = `${ROOT}src/lib/formula/`;
    expect(readdirSync(directory)).toContain('evaluator.ts');
    const files = ['evaluator.ts', 'plan.ts', 'rates.ts', 'ast.ts'].map((name) => `${directory}${name}`).concat(`${ROOT}src/lib/decimal.ts`);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/parseFloat|Number\(|Math\.|\.toNumber\(\)\s*[+\-*/]/);
    }
  });

  it('[AQP-106 AC-2, QLT-16] a figure always prints as plain digits, never in exponent form, through String and JSON', () => {
    const tiny = defined(evaluate(display('1 / 10000000000 / 10000000000 / 10000000000 / 10000000000'), resolver()));
    const huge = defined(evaluate(display('10000000000 * 10000000000 * 10000000000 * 10000000000'), resolver()));
    expect(String(tiny)).toBe(`0.${'0'.repeat(39)}1`);
    expect(String(huge)).toBe(`1${'0'.repeat(40)}`);
    expect(JSON.stringify({ tiny, huge })).not.toMatch(/e[+-]?\d/i);
  });
});

// ---- AC-3 -------------------------------------------------------------------------------------------------------

describe('[AQP-106 AC-3] division by zero gives no figure, spreads, and never throws', () => {
  it.each([
    ['A / 0', null],
    ['A / B', null],
    ['0 / 0', null],
    ['A / (B - B)', null],
    ['1 + A / 0', null],
    ['-(A / 0)', null],
    ['(A / 0) * 0', null],
    ['MIN(1, A / 0)', null],
    ['MAX(1, A / 0)', null],
    ['ROUND(A / 0, 2)', null],
    ['IF(A / 0 > 1, 1, 2)', null],
    ['IF(1 > A / 0, 1, 2)', null],
    ['0 / A', '0'],
  ])('[AQP-106 AC-3] %s gives %s', (text, expected) => {
    expect(run(text, { fields: { A: '5', B: '0' } })).toBe(expected);
  });

  it('[AQP-106 AC-3] SUM is null when any row has no figure, 0 for no rows', () => {
    expect(run('SUM(A)', { columns: { A: ['1', null, '2'] } })).toBeNull();
    expect(run('SUM(A)', { columns: { A: [] } })).toBe('0');
    expect(run('SUM(A)', { columns: { A: ['0'] } })).toBe('0');
  });

  it('[AQP-106 AC-3] IF evaluates only the branch it takes: a division by zero or a missing value in the other branch has no effect and is not read', () => {
    const asked: string[] = [];
    const value = evaluate(display('IF(A > 0, A, B / 0 + C)'), resolver({ fields: { A: '4' } }, asked));
    expect(value?.toFixed()).toBe('4');
    expect(asked).not.toContain('B');
    expect(asked).not.toContain('C');
    expect(run('IF(A < 0, A / 0, 7)', { fields: { A: '4' } })).toBe('7');
  });

  it('[AQP-106 AC-3] in a plan, one output with no figure leaves every other output of the row present', () => {
    const fields: ValidatableField[] = [
      { id: id('A'), position: 1, rowScope: 'row', kind: 'input' },
      { id: id('B'), position: 2, rowScope: 'row', kind: 'input' },
      { id: id('C'), position: 3, rowScope: 'row', kind: 'output', formula: `{{f:${id('A')}}} / {{f:${id('B')}}}` },
      { id: id('D'), position: 4, rowScope: 'row', kind: 'output', formula: `{{f:${id('A')}}} + 1` },
      { id: id('E'), position: 5, rowScope: 'row', kind: 'output', formula: `{{f:${id('C')}}} + {{f:${id('D')}}}` },
      { id: id('F'), position: 6, rowScope: 'row', kind: 'output', formula: `{{f:${id('A')}}} * 2` },
    ];
    const results = evaluateRowFormulas(compilePlan(fields), resolver({ fields: { A: '3', B: '0' } }));
    expect([...results.entries()].map(([key, value]) => [LETTERS[FIELD_IDS.indexOf(key)], value?.toFixed() ?? null]).sort()).toEqual([
      ['C', null],
      ['D', '4'],
      ['E', null],
      ['F', '6'],
    ]);
  });
});

// ---- AC-4 and AC-5: the graph --------------------------------------------------------------------------------

function output(letter: string, formula: string, rowScope: 'row' | 'product' = 'row'): ValidatableField {
  const internal = toInternalForm(formula, CONTEXT);
  return { id: id(letter), position: LETTERS.indexOf(letter) + 1, rowScope, kind: 'output', formula: internal };
}

/** A product-scope output with no formula, as the Approved Quote Price (BO) is. */
function productWithoutFormula(letter: string): ValidatableField {
  return { id: id(letter), position: LETTERS.indexOf(letter) + 1, rowScope: 'product', kind: 'output', formula: null };
}

function input(letter: string): ValidatableField {
  return { id: id(letter), position: LETTERS.indexOf(letter) + 1, rowScope: 'row', kind: 'input' };
}

describe('[AQP-106 AC-4] evaluation order', () => {
  it('[AQP-106 AC-4] dependencies come first whatever the column order; row-scope formulas before product-scope ones', () => {
    const fields = [
      input('A'),
      output('B', 'E + 1'),
      output('C', 'SUM(B)', 'product'),
      output('D', 'C * 2', 'product'),
      output('E', 'F * A'),
      output('F', 'A + 1'),
      output('G', 'SUM(E) + SUM(F)', 'product'),
    ];
    const plan = compilePlan(fields);
    const rows = plan.rowFormulas.map((formula) => LETTERS[FIELD_IDS.indexOf(formula.fieldId)]);
    const products = plan.productFormulas.map((formula) => LETTERS[FIELD_IDS.indexOf(formula.fieldId)]);
    expect(rows.indexOf('F')).toBeLessThan(rows.indexOf('E'));
    expect(rows.indexOf('E')).toBeLessThan(rows.indexOf('B'));
    expect(products.indexOf('C')).toBeLessThan(products.indexOf('D'));
    expect([...rows].sort()).toEqual(['B', 'E', 'F']);
    expect([...products].sort()).toEqual(['C', 'D', 'G']);
    const row = evaluateRowFormulas(plan, resolver({ fields: { A: '2' } }));
    expect(row.get(id('B'))?.toFixed()).toBe('7');
    const product = evaluateProductFormulas(plan, resolver({ columns: { B: ['7', '3'], E: ['6', '1'], F: ['3', '1'] } }));
    expect(product.get(id('D'))?.toFixed()).toBe('20');
    expect(product.get(id('G'))?.toFixed()).toBe('11');
  });

  it.each([
    ['a row formula that reads a product field', [output('B', 'C + 1'), output('C', 'SUM(A)', 'product'), input('A')], 'ROW_FORMULA_USES_PRODUCT_FIELD'],
    ['a row formula that reads a product field with no formula', [output('B', 'C + 1'), productWithoutFormula('C')], 'ROW_FORMULA_USES_PRODUCT_FIELD'],
    ['SUM in a row formula', [input('A'), output('B', 'SUM(A)')], 'SUM_IN_ROW_FORMULA'],
    ['a product formula that reads a row field without SUM', [input('A'), output('B', 'A * 2', 'product')], 'PRODUCT_FORMULA_USES_ROW_FIELD'],
    ['SUM of a product field', [input('A'), output('B', 'SUM(A)', 'product'), output('C', 'SUM(B)', 'product')], 'SUM_OF_PRODUCT_FIELD'],
  ] satisfies ReadonlyArray<readonly [string, ReadonlyArray<ValidatableField>, string]>)('[AQP-106 AC-4] refuses %s', (_name, fields, code) => {
    const issues = validateFormulas(fields);
    expect(issues.map((issue) => issue.code)).toContain(code);
    expect(() => compilePlan(fields)).toThrow();
  });
});

describe('[AQP-106 AC-5] validation: unknown names, syntax with a position, cycles', () => {
  it.each([
    ['an unknown column (past the registry)', 'A + CA', 'UNKNOWN_COLUMN', 5, 2],
    ['an unknown rate name', 'A * Wombat', 'UNKNOWN_NAME', 5, 6],
    ['an unknown function', 'A + AVG(B)', 'UNKNOWN_FUNCTION', 5, 3],
    ['two operators', 'A + * B', 'EXPECTED_OPERAND', 5, 1],
    ['a missing operator', 'A B', 'EXPECTED_OPERATOR', 3, 1],
    ['an unclosed bracket', '(A + B', 'UNCLOSED_BRACKET', 1, 1],
    ['a stray closing bracket', 'A + B)', 'UNEXPECTED_CLOSING_BRACKET', 6, 1],
    ['an incomplete end', 'A +', 'UNEXPECTED_END', 4, 1],
    ['a stray character', 'A + B # 2', 'INVALID_CHARACTER', 7, 1],
    ['a trailing point', 'A + 1.', 'INVALID_CHARACTER', 6, 1],
  ])('[AQP-106 AC-5] %s is refused with the character position of the problem', (_name, text, code, position, length) => {
    const check = checkDisplayFormula(text, CONTEXT);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.issue).toMatchObject({ code, position, length });
    expect(check.issue.message).toContain(`(character ${position})`);
  });

  it('[AQP-106 AC-5] the empty formula and white space only are refused', () => {
    expect(refuse('').code).toBe('EMPTY');
    expect(refuse('   ').code).toBe('EMPTY');
  });

  it('[AQP-106 AC-5] a two-field cycle is named with column letters: "AL → AY → AL"', () => {
    const al = { id: idAt(38), position: 38, rowScope: 'row' as const, kind: 'output' as const, formula: `{{f:${idAt(51)}}} + 1` };
    const ay = { id: idAt(51), position: 51, rowScope: 'row' as const, kind: 'output' as const, formula: `{{f:${idAt(38)}}} * 2` };
    const issues = validateFormulas([al, ay]);
    const cycle = defined(issues.find((issue) => issue.code === 'CYCLE'));
    expect(cycle.message).toBe('These fields refer to each other in a loop: AL → AY → AL.');
    expect(cycle.cycle).toEqual([idAt(38), idAt(51), idAt(38)]);
    expect(analyzeConfiguration([al, ay]).order).toBeNull();
    expect(() => compilePlan([al, ay])).toThrow(/AL → AY → AL/);
  });

  it('[AQP-106 AC-5] a field that reads itself, a three-field loop, and a loop through IF and SUM are found', () => {
    expect(validateFormulas([output('B', 'B + 1')]).find((issue) => issue.code === 'CYCLE')?.message).toContain('B → B');
    const three = validateFormulas([output('B', 'D'), output('C', 'B'), output('D', 'C')]).filter((issue) => issue.code === 'CYCLE');
    expect(three).toHaveLength(1);
    expect(defined(three[0]).message).toContain('B → D → C → B');
    const viaIf = validateFormulas([input('A'), output('B', 'IF(A > 0, C, 0)'), output('C', 'B * 2')]);
    expect(viaIf.map((issue) => issue.code)).toContain('CYCLE');
    const viaSum = validateFormulas([input('A'), output('B', 'SUM(C)', 'product'), output('C', 'SUM(B)', 'product')]);
    expect(viaSum.map((issue) => issue.code)).toContain('CYCLE');
  });

  it('[AQP-106 AC-5] the seed configuration of 03.01 passes with 0 issues and 0 cycles, with the 15 seed rate IDs as the known rates', () => {
    const rateIds = new Set(SEED_PROCESS_ITEMS.map((item) => item.id));
    const analysis = analyzeConfiguration(seedConfig.fields, { rateIds });
    expect(analysis.issues).toEqual([]);
    expect(analysis.order).not.toBeNull();
    const order = defined(analysis.order);
    expect(order.rowOrder).toHaveLength(29);
    expect(order.productOrder).toHaveLength(2);
    // Every row formula comes after every row formula it reads.
    const place = new Map(order.rowOrder.map((formula, index) => [formula.fieldId, index]));
    for (const [index, formula] of order.rowOrder.entries()) {
      for (const other of order.rowOrder) {
        if (JSON.stringify(formula.expression).includes(other.fieldId)) expect(defined(place.get(other.fieldId))).toBeLessThan(index);
      }
    }
  });

  it('[AQP-106 AC-5] the seed with a planted cycle (AL reads AY) fails, as a stored document and as a plan', () => {
    const document = cloneSeedConfig();
    const ay = defined(document.fields[50]);
    const al = defined(document.fields[37]);
    Object.assign(al, { formula: `{{f:${ay.id}}} + 1` });
    expect(() => parseConfigDocument(document)).toThrow(ConfigDocumentError);
    try {
      parseConfigDocument(document);
    } catch (error) {
      expect(error instanceof Error ? error.message : '').toContain('AL → AY → AL');
    }
    expect(validateFormulas(document.fields).map((issue) => issue.code)).toContain('CYCLE');
  });

  it('[AQP-106 AC-5] an unknown rate ID in a stored formula is refused when the rates are known', () => {
    const fields = [input('A'), { ...output('B', 'A'), formula: `{{f:${id('A')}}} * {{rate:00000000-0000-4000-8000-0ddd00000001}}` }];
    expect(validateFormulas(fields, { rateIds: new Set([RATE_FOAM]) }).map((issue) => issue.code)).toEqual(['UNKNOWN_RATE']);
  });
});

// ---- AC-6: the converter -----------------------------------------------------------------------------------

describe('[AQP-106 AC-6] internal form and display form', () => {
  const seedContext = { fieldIds: seedConfig.fields.map((field) => field.id), rates: SEED_PROCESS_ITEMS };

  it('[AQP-106 AC-6] every one of the 31 seed formulas round-trips exactly: internal → display → internal', () => {
    let count = 0;
    for (const field of seedConfig.fields) {
      if (field.kind !== 'output' || field.formula === null) continue;
      const shown = toDisplayForm(field.formula, seedContext);
      expect(shown).not.toContain('{{');
      expect(toInternalForm(shown, seedContext), field.key).toBe(field.formula);
      count += 1;
    }
    expect(count).toBe(31);
  });

  it('[AQP-106 AC-6] display → internal → display is exact, spaces and all', () => {
    for (const text of ['A+B', '  A *  Foam Cost ', 'IF(OH Profit % > 0,SUM(BZ)/ 2 , -Z)', 'ROUND( Cutting-Rate-per-Sec*AA ,2)', 'ExchangeRate-USD / Material-Scrap-Rate']) {
      expect(toDisplayForm(toInternalForm(text, CONTEXT), CONTEXT)).toBe(text);
    }
  });

  it('[AQP-106 AC-6] re-lettering: a field inserted in front moves every displayed letter, and the stored text is not rewritten', () => {
    const stored = toInternalForm('A + Z * AA', CONTEXT);
    const inserted = { fieldIds: ['00000000-0000-4000-8000-0eee00000001', ...FIELD_IDS], rates: RATES };
    expect(toDisplayForm(stored, CONTEXT)).toBe('A + Z * AA');
    expect(toDisplayForm(stored, inserted)).toBe('B + AA * AB');
    expect(toInternalForm(toDisplayForm(stored, inserted), inserted)).toBe(stored);
  });

  it('[AQP-106 AC-6] a stored reference to a field or rate that no longer exists is refused when shown, with no text of the formula', () => {
    expect(issueOf(() => toDisplayForm('{{f:00000000-0000-4000-8000-0ddd00000009}} + 1', CONTEXT)).code).toBe('BAD_FIELD_REFERENCE');
    expect(issueOf(() => toDisplayForm('{{rate:00000000-0000-4000-8000-0ddd00000009}}', CONTEXT)).code).toBe('UNKNOWN_RATE');
  });

  it.each(['A', 'Z', 'AB', 'BO', 'XFD', 'ZZZ', 'A-B', 'A B', 'AB 2', '5', '1.5', 'SUM', 'IF', 'ROUND'])(
    '[AQP-106 AC-6] a rate cannot be named %j: it reads as letters, numbers or operators',
    (name) => {
      expect(rateNameIssues(name).map((issue) => issue.code)).toEqual(['RATE_NAME_IS_COLUMN_LETTER']);
    },
  );

  it('[AQP-106 AC-6] the 15 seed rate names are accepted; operand names, duplicates and structural characters are refused', () => {
    for (const item of SEED_PROCESS_ITEMS) expect(rateNameIssues(item.name, SEED_PROCESS_ITEMS.filter((other) => other !== item).map((other) => other.name)), item.name).toEqual([]);
    expect(rateNameIssues('Material-Scrap-Rate').map((issue) => issue.code)).toEqual(['RATE_NAME_IS_OPERAND']);
    expect(rateNameIssues('ExchangeRate-USD').map((issue) => issue.code)).toEqual(['RATE_NAME_IS_OPERAND']);
    expect(rateNameIssues('Foam Cost', ['Foam Cost']).map((issue) => issue.code)).toEqual(['RATE_NAME_DUPLICATE']);
    for (const name of ['', ' Foam', 'Foam ', 'Rate (kg)', 'Rate,2', 'Rate/kg', 'Rate*2', 'Rate>1', 'x'.repeat(101)]) {
      expect(rateNameIssues(name).map((issue) => issue.code), JSON.stringify(name)).toEqual(['RATE_NAME_INVALID']);
    }
  });

  // DEF-006 (GitHub #49), fixed in STORY-02.01 (AQP-113). It was a characterisation test that pinned the defect so CI stayed green;
  // it now states the rule: a name that reads as other rate names and an operator is refused, so the third rate never exists
  // and a stored formula keeps its meaning in a round trip.
  it('[AQP-106 AC-6, QLT-05] DEF-006: a rate name built from two other rate names and a minus sign is refused, and the stored formula round-trips exactly', () => {
    const rates = [
      { id: RATE_FOAM, name: 'Cost' },
      { id: RATE_FOAM_COST, name: 'Waste' },
    ];
    // "Cost-Waste" reads as Cost - Waste while those rates exist, so it must never become a rate.
    expect(rateNameIssues('Cost-Waste', rates.map((rate) => rate.name)).map((issue) => issue.code)).toEqual(['RATE_NAME_IS_COLUMN_LETTER']);
    // With the third rate refused, the stored formula is shown and read back as the same text.
    const context = { fieldIds: FIELD_IDS, rates };
    const stored = `{{rate:${RATE_FOAM}}}-{{rate:${RATE_FOAM_COST}}}`;
    expect(toDisplayForm(stored, context)).toBe('Cost-Waste');
    expect(toInternalForm(toDisplayForm(stored, context), context)).toBe(stored);
    // The same with a column: "AB-Waste" reads as AB - Waste.
    expect(rateNameIssues('AB-Waste', ['Waste']).map((issue) => issue.code)).toEqual(['RATE_NAME_IS_COLUMN_LETTER']);
  });
});

// ---- AC-7: the working --------------------------------------------------------------------------------------

describe('[AQP-106 AC-7] the working of an evaluation', () => {
  it('[AQP-106 AC-7] lists every operand read, once, at stored precision, and reproduces the result', () => {
    const values: Values = {
      fields: { A: '1.23456789012345', B: '3' },
      rates: { 'OH Profit %': '12.345678' },
      columns: { C: ['1.5', '2.25'] },
    };
    const text = 'A * B * OH Profit % + SUM(C) + A';
    const { value, operands } = evaluateWithWorking(display(text), resolver(values));
    expect(operands).toHaveLength(4);
    const byKind = operands.map((use) => (use.kind === 'sum' ? ['sum', use.rowCount, use.value?.toFixed()] : [use.reference.kind, use.value?.toFixed()]));
    expect(byKind).toEqual([
      ['field', '1.23456789012345'],
      ['field', '3'],
      ['rate', '0.12345678'],
      ['sum', 2, '3.75'],
    ]);
    // Reproduce: put the recorded operands back into the text and compute by hand with the same Decimal.
    const reproduced = new Decimal('1.23456789012345').times('3').times('0.12345678').plus('3.75').plus('1.23456789012345');
    expect(value?.toFixed()).toBe(reproduced.toFixed());
  });

  it('[AQP-106 AC-7] the branch of IF that did not run is not in the working', () => {
    const { operands } = evaluateWithWorking(display('IF(A > 0, B, C)'), resolver({ fields: { A: '1', B: '2', C: '3' } }));
    const fields = operands.flatMap((use) => (use.kind === 'value' && use.reference.kind === 'field' ? [LETTERS[FIELD_IDS.indexOf(use.reference.id)]] : []));
    expect(fields).toEqual(['A', 'B']);
  });
});

// ---- AC-9: the plan is built once per version ---------------------------------------------------------------

describe('[AQP-106 AC-9] a compiled plan is built once per configuration version and reused', () => {
  it('[AQP-106 AC-9] 50 reads of one version compile once and parse each seed formula once; a second version compiles once more', () => {
    let compiles = 0;
    let parses = 0;
    const cache = createPlanCache((fields) => {
      compiles += 1;
      return compilePlan(fields, {
        parse: (text) => {
          parses += 1;
          return parseFormula(text, { form: 'internal' });
        },
      });
    });
    const first = cache.get('version-1', seedConfig.fields);
    for (let read = 0; read < 49; read += 1) expect(cache.get('version-1', seedConfig.fields)).toBe(first);
    expect([compiles, parses]).toEqual([1, 31]);
    cache.get('version-2', seedConfig.fields);
    expect([compiles, parses, cache.size()]).toEqual([2, 62, 2]);
  });
});

// ---- STD-01 and the input limits ----------------------------------------------------------------------------

describe('[AQP-106 STD-01] no formula text in an error, an issue or a validation result', () => {
  const SENTINELS = ['Qwrtz', 'QQXZ', 'Zorbix', '987654321'];

  it.each([
    'A + Qwrtz',
    'Zorbix(A)',
    'A + QQXZ',
    'Qwrtz Zorbix',
    'IF(Qwrtz > 1, 2, 3)',
    'A # Qwrtz',
    'ROUND(Qwrtz, 2)',
    '987654321 987654321',
    'SUM(987654321)',
    'ROUND(A, 987654321)',
    '(987654321',
    'Qwrtz' + ' + A'.repeat(1_000),
  ])('[AQP-106 STD-01] the refusal of %j holds no word of the formula, in any field', (text) => {
    const check = checkDisplayFormula(text.slice(0, 5_000), CONTEXT);
    expect(check.ok).toBe(false);
    let thrown: unknown;
    try {
      toInternalForm(text, CONTEXT);
      parseFormula(text, { form: 'display', context: CONTEXT });
    } catch (error) {
      thrown = error;
    }
    const serialised = JSON.stringify({ check, thrown, message: thrown instanceof Error ? thrown.message : '', stack: '' });
    for (const sentinel of SENTINELS) expect(serialised).not.toContain(sentinel);
    if (!check.ok) {
      expect(Object.keys(check.issue).every((key) => ['code', 'message', 'position', 'length', 'fieldId', 'cycle'].includes(key))).toBe(true);
    }
  });

  it('[AQP-106 STD-01] a configuration error lists rules and places, not formula text', () => {
    const fields = [input('A'), { ...output('B', 'A'), formula: 'Qwrtz + {{f:not-an-id}}' }, output('C', 'D'), output('D', 'C')];
    let message = '';
    try {
      compilePlan(fields);
    } catch (error) {
      message = JSON.stringify({ message: error instanceof Error ? error.message : '', error });
    }
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain('Qwrtz');
    expect(message).not.toContain('not-an-id');
  });
});

describe('[AQP-106] input limits: 4,000 characters and nesting', () => {
  it('[AQP-106] 4,000 characters are read; 4,001 are refused as TOO_LONG before any parsing', () => {
    expect(MAX_FORMULA_LENGTH).toBe(4_000);
    const exact = `1${' + 1'.repeat(999)}`;
    expect(exact.length).toBe(3_997);
    expect(run(`${exact}   `)).toBe('1000');
    expect(() => display('1'.repeat(4_000))).not.toThrow();
    expect(refuse('1'.repeat(4_001)).code).toBe('TOO_LONG');
    expect(refuse(`A + ${'#'.repeat(4_000)}`).code).toBe('TOO_LONG');
  });

  it('[AQP-106] a 4,000-character chain of 2,000 additions parses and evaluates within a second and does not overflow the stack', () => {
    const chain = `1${'+1'.repeat(1_999)}`;
    const started = Date.now();
    expect(run(chain)).toBe('2000');
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('[AQP-106] deep nesting is refused as TOO_DEEP and does not overflow the stack (99 brackets read; 100 refused; unary minus the same)', () => {
    expect(run(`${'('.repeat(99)}1${')'.repeat(99)}`)).toBe('1');
    expect(refuse(`${'('.repeat(100)}1${')'.repeat(100)}`).code).toBe('TOO_DEEP');
    expect(run(`${'-'.repeat(98)}1`)).toBe('1');
    expect(refuse(`${'-'.repeat(100)}1`).code).toBe('TOO_DEEP');
    expect(refuse(`${'MIN('.repeat(1_000)}1${')'.repeat(1_000)}`).code).toBe('TOO_LONG');
    expect(refuse(`${'MIN('.repeat(700)}1${')'.repeat(700)}`).code).toBe('TOO_DEEP');
  });
});
