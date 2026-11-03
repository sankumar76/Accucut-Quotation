import { describe, expect, it } from 'vitest';

import { indexToColumnLetter } from '@/lib/columns';
import { assertNever } from '@/lib/assert-never';
import { FormulaError, MAX_FORMULA_LENGTH, parseFormula, type Expression, type FormulaReference } from '@/lib/formula';

import { CONTEXT, FIELD_IDS, parseDisplay, RATES } from '../../support/formula-fixtures';
import { thrownAs } from '../../support/thrown';

/** AC-1: the grammar. The tree is shown as a prefix string, so a test states the shape it expects. */

function referenceName(reference: FormulaReference): string {
  switch (reference.kind) {
    case 'field':
      return indexToColumnLetter(FIELD_IDS.indexOf(reference.id) + 1);
    case 'rate':
      return RATES.find((rate) => rate.id === reference.id)?.name ?? '?';
    case 'material':
      return `mat.${reference.key}`;
    case 'exchange':
      return `fx.${reference.currency}`;
    default:
      return assertNever(reference);
  }
}

/** `1 + 2 * 3` is shown as `(+ 1 (* 2 3))`. */
function shape(expression: Expression): string {
  switch (expression.kind) {
    case 'number':
      return expression.value.toFixed();
    case 'reference':
      return referenceName(expression.reference);
    case 'negate':
      return `(neg ${shape(expression.operand)})`;
    case 'binary':
      return `(${expression.operator} ${shape(expression.left)} ${shape(expression.right)})`;
    case 'sum':
      return `(SUM ${referenceName({ kind: 'field', id: expression.fieldId })})`;
    case 'min':
    case 'max':
      return `(${expression.kind} ${expression.args.map(shape).join(' ')})`;
    case 'round':
      return `(round ${shape(expression.value)} ${expression.places})`;
    case 'if': {
      const { operator, left, right } = expression.condition;
      return `(if (${operator} ${shape(left)} ${shape(right)}) ${shape(expression.whenTrue)} ${shape(expression.whenFalse)})`;
    }
    default:
      return assertNever(expression);
  }
}

const parsed = (text: string): string => shape(parseDisplay(text));

const refused = (text: string) => thrownAs(() => parseDisplay(text), FormulaError).issue;

describe('parser: operators (AC-1)', () => {
  it.each([
    ['AC-1: addition', 'A + B', '(+ A B)'],
    ['AC-1: subtraction', 'A - B', '(- A B)'],
    ['AC-1: multiplication', 'A * B', '(* A B)'],
    ['AC-1: division', 'A / B', '(/ A B)'],
    ['AC-1: multiplication binds tighter than addition', '1 + 2 * 3', '(+ 1 (* 2 3))'],
    ['AC-1: ... on either side', '1 * 2 + 3', '(+ (* 1 2) 3)'],
    ['AC-1: subtraction is left to right', '1 - 2 - 3', '(- (- 1 2) 3)'],
    ['AC-1: division is left to right', '8 / 2 / 4', '(/ (/ 8 2) 4)'],
    ['AC-1: brackets override precedence', '(1 + 2) * 3', '(* (+ 1 2) 3)'],
    ['AC-1: brackets nest', '((A + B) * (C - D))', '(* (+ A B) (- C D))'],
    ['AC-1: unary minus binds tighter than multiplication', '-A * B', '(* (neg A) B)'],
    ['AC-1: unary minus after an operator', '2 * -A', '(* 2 (neg A))'],
    ['AC-1: unary minus after a minus', 'A - -B', '(- A (neg B))'],
    ['AC-1: unary minus twice', '- - A', '(neg (neg A))'],
    ['AC-1: unary minus on a bracket', '-(A + B)', '(neg (+ A B))'],
    ['AC-1: a seed-shaped formula', '(L * K * J * Material-Specific-Gravity) / 1000000', '(/ (* (* (* L K) J) mat.specificGravity) 1000000)'],
    ['AC-1: a name with spaces and a percent', 'BB * OH Profit %', '(* BB OH Profit %)'],
    ['AC-1: a hyphenated name between operators', 'P * Cutting-Rate-per-Sec', '(* P Cutting-Rate-per-Sec)'],
    ['AC-1: a name then a subtraction with no spaces', 'Cutting-Rate-per-Sec-A', '(- Cutting-Rate-per-Sec A)'],
    ['AC-1: an exchange rate', 'BG / ExchangeRate-USD', '(/ BG fx.USD)'],
    ['AC-1: no spaces at all', '(A+B)*C', '(* (+ A B) C)'],
    ['AC-1: a decimal literal', 'A * 0.5', '(* A 0.5)'],
  ])('%s', (_name, text, expected) => {
    expect(parsed(text)).toBe(expected);
  });
});

describe('parser: functions (AC-1)', () => {
  it.each([
    ['AC-1: SUM of a column', 'SUM(BG)', '(SUM BG)'],
    ['AC-1: SUM with a space before the bracket', 'SUM (BG)', '(SUM BG)'],
    ['AC-1: SUM inside an expression', 'BL / SUM(BM)', '(/ BL (SUM BM))'],
    ['AC-1: MIN', 'MIN(A, B, 3)', '(min A B 3)'],
    ['AC-1: MAX', 'MAX(A, B * 2)', '(max A (* B 2))'],
    ['AC-1: MIN of one argument', 'MIN(A)', '(min A)'],
    ['AC-1: ROUND', 'ROUND(A / 3, 2)', '(round (/ A 3) 2)'],
    ['AC-1: ROUND to a whole number', 'ROUND(A, 0)', '(round A 0)'],
    ['AC-1: IF', 'IF(A > 1, B, 0)', '(if (> A 1) B 0)'],
    ['AC-1: IF with results that are expressions', 'IF(A > 1, B + 1, C * 2)', '(if (> A 1) (+ B 1) (* C 2))'],
    ['AC-1: IF nested in a result', 'IF(A > 1, IF(B < 2, 1, 2), 3)', '(if (> A 1) (if (< B 2) 1 2) 3)'],
    ['AC-1: IF in the condition', 'IF(IF(A > 1, 1, 0) = 1, 5, 6)', '(if (= (if (> A 1) 1 0) 1) 5 6)'],
    ['AC-1: the guarded Scrap Weight shape', 'IF(Material-Specific-Gravity > 0, M - N, 0)', '(if (> mat.specificGravity 0) (- M N) 0)'],
    ['AC-1: a function in a function', 'ROUND(SUM(BG) / 3, 2)', '(round (/ (SUM BG) 3) 2)'],
  ])('%s', (_name, text, expected) => {
    expect(parsed(text)).toBe(expected);
  });

  it.each([
    ['>', '(if (> A B) 1 0)'],
    ['>=', '(if (>= A B) 1 0)'],
    ['<', '(if (< A B) 1 0)'],
    ['<=', '(if (<= A B) 1 0)'],
    ['=', '(if (= A B) 1 0)'],
    ['<>', '(if (<> A B) 1 0)'],
  ])('AC-1: IF accepts the comparison %s in its condition', (operator, expected) => {
    expect(parsed(`IF(A ${operator} B, 1, 0)`)).toBe(expected);
    expect(parsed(`IF(A${operator}B,1,0)`)).toBe(expected);
  });

  it('AC-1: both sides of a comparison are whole expressions', () => {
    expect(parsed('IF(A + 1 >= B * 2, 1, 0)')).toBe('(if (>= (+ A 1) (* B 2)) 1 0)');
  });
});

describe('parser: what it refuses (AC-1, AC-5)', () => {
  it.each([
    ['at the top level', 'A > 1', 3],
    ['inside brackets', '(A > 1)', 4],
    ['as an operand', 'A + (B >= 1)', 8],
    ['as a result of IF', 'IF(A > 1, B > 2, 3)', 13],
    ['as the second result of IF', 'IF(A > 1, 2, B < 3)', 16],
    ['chained after the condition of IF', 'IF(A > 1 > 2, 1, 2)', 10],
    ['as an argument of MIN', 'MIN(A, B = 2)', 10],
    ['as an argument of SUM', 'SUM(A <> 1)', 7],
    ['as the value of ROUND', 'ROUND(A < 1, 2)', 9],
    ['with nothing before it', '> 1', 1],
  ])('AC-1: a comparison %s is a validation error', (_name, text, position) => {
    expect(refused(text)).toMatchObject({ code: 'COMPARISON_OUTSIDE_IF', position });
  });

  it('AC-1: ROLLUP is not a function', () => {
    expect(refused('ROLLUP(BG)')).toMatchObject({ code: 'UNKNOWN_FUNCTION', position: 1, length: 6 });
  });

  it('AC-1: IF needs a comparison as its first argument', () => {
    expect(refused('IF(A, 1, 2)')).toMatchObject({ code: 'IF_NEEDS_COMPARISON', position: 4 });
    expect(refused('IF(A + 1, 1, 2)')).toMatchObject({ code: 'IF_NEEDS_COMPARISON', position: 4 });
  });

  it.each([
    ['IF with two arguments', 'IF(A > 1, 2)'],
    ['IF with one argument', 'IF(A > 1)'],
    ['IF with four arguments', 'IF(A > 1, 2, 3, 4)'],
    ['SUM with two arguments', 'SUM(A, B)'],
    ['ROUND with one argument', 'ROUND(A)'],
    ['ROUND with three arguments', 'ROUND(A, 1, 2)'],
  ])('AC-1: %s has the wrong number of arguments', (_name, text) => {
    expect(refused(text).code).toBe('WRONG_ARGUMENT_COUNT');
  });

  it.each([
    ['an expression', 'SUM(A + 1)'],
    ['a number', 'SUM(2)'],
    ['a rate', 'SUM(Test-Rate-per-kg)'],
    ['a material operand', 'SUM(Material-Scrap-Rate)'],
  ])('AC-1: SUM takes a column, not %s', (_name, text) => {
    expect(refused(text).code).toBe('SUM_NEEDS_COLUMN');
  });

  it.each([
    ['a field', 'ROUND(A, B)'],
    ['a fraction', 'ROUND(A, 2.5)'],
    ['too many places', 'ROUND(A, 21)'],
    ['a negative number', 'ROUND(A, -1)'],
    ['an expression', 'ROUND(A, 1 + 1)'],
  ])('AC-1: ROUND needs a whole number of places from 0 to 20, not %s', (_name, text) => {
    expect(refused(text).code).toBe('ROUND_NEEDS_PLACES');
  });

  it.each([
    ['an operator with nothing after it', '1 +', 'UNEXPECTED_END', 4],
    ['a formula that stops inside a call', 'IF(A > 1,', 'UNEXPECTED_END', 10],
    ['an operator with nothing before it', '* 2', 'EXPECTED_OPERAND', 1],
    ['two operators in a row', 'A + * B', 'EXPECTED_OPERAND', 5],
    ['an empty pair of brackets', 'A + ()', 'EXPECTED_OPERAND', 6],
    ['an empty call', 'MIN()', 'EXPECTED_OPERAND', 5],
    ['two operands in a row', 'A B', 'EXPECTED_OPERATOR', 3],
    ['two numbers in a row', '1 2', 'EXPECTED_OPERATOR', 3],
    ['a number split by a second point', '1.2.3', 'EXPECTED_OPERATOR', 4],
    ['a bracket after an operand', '2 (B)', 'EXPECTED_OPERATOR', 3],
    ['a bracket that is not closed', '(A + 2', 'UNCLOSED_BRACKET', 1],
    ['a call that is not closed', 'MAX(A, 2', 'UNCLOSED_BRACKET', 4],
    ['a bracket that closes nothing', 'A + 2)', 'UNEXPECTED_CLOSING_BRACKET', 6],
    ['a comma outside a call', 'A, B', 'EXPECTED_OPERATOR', 2],
    ['a comma where an operand belongs', 'MIN(A,, B)', 'EXPECTED_OPERAND', 7],
  ])('AC-5: %s is a syntax error with its character position', (_name, text, code, position) => {
    expect(refused(text)).toMatchObject({ code, position });
  });

  it('AC-5: gives the position of the character, counting from 1, after leading spaces', () => {
    expect(refused('   A + * B')).toMatchObject({ code: 'EXPECTED_OPERAND', position: 8 });
  });

  it('refuses an empty formula, and one of only spaces', () => {
    expect(refused('').code).toBe('EMPTY');
    expect(refused('   ').code).toBe('EMPTY');
  });

  it('refuses a name it does not know (the tokenizer\'s error comes through the parser)', () => {
    expect(refused('A + Mystery')).toMatchObject({ code: 'UNKNOWN_NAME', position: 5, length: 7 });
  });
});

describe('parser: size (AC-1 edge cases)', () => {
  it('accepts brackets nested as deep as the limit allows', () => {
    const depth = 99;
    expect(parsed(`${'('.repeat(depth)}A${')'.repeat(depth)}`)).toBe('A');
  });

  it('refuses brackets nested deeper than the limit, without overflowing the stack', () => {
    const depth = 100;
    expect(refused(`${'('.repeat(depth)}A${')'.repeat(depth)}`).code).toBe('TOO_DEEP');
    expect(refused(`${'('.repeat(3_000)}A${')'.repeat(3_000)}`).code).toBe('TOO_LONG');
  });

  it('refuses a long run of minus signs as too deep', () => {
    expect(refused(`${'-'.repeat(150)}A`).code).toBe('TOO_DEEP');
  });

  it('refuses calls nested too deep', () => {
    const nested = `${'MIN('.repeat(60)}A${')'.repeat(60)}`;
    expect(refused(nested).code).toBe('TOO_DEEP');
  });

  it('parses a very long chain of terms without recursion trouble', () => {
    const terms = Math.floor((MAX_FORMULA_LENGTH - 1) / 4);
    const text = Array.from({ length: terms }, () => 'A').join(' + ');
    expect(text.length).toBeLessThanOrEqual(MAX_FORMULA_LENGTH);
    expect(parseDisplay(text).kind).toBe('binary');
  });

  it('parses the same formula given in internal form', () => {
    const internal = parseFormula(`{{f:${FIELD_IDS[0]}}} * 2`, { form: 'internal' });
    expect(shape(internal)).toBe('(* A 2)');
    expect(parseFormula('A * 2', { form: 'display', context: CONTEXT })).toEqual(parseFormula(`{{f:${FIELD_IDS[0]}}} * 2`, { form: 'internal' }));
  });

  it('parses a formula that is just a number, as the seed Rejection is 0', () => {
    expect(parsed('0')).toBe('0');
  });
});
