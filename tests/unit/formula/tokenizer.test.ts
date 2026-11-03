import { describe, expect, it } from 'vitest';

import { FormulaError, type FormulaReference, type ReferenceContext } from '@/lib/formula';
import { MAX_FORMULA_LENGTH } from '@/lib/formula';
import { tokenize, type Token } from '@/lib/formula/tokenizer';

import {
  CONTEXT,
  fieldAt,
  fieldIdOf,
  RATE_AMPERSAND,
  RATE_COLUMN_PREFIX,
  RATE_HYPHENS,
  RATE_PERCENT,
  RATE_PLAIN,
  RATE_SPACED,
} from '../../support/formula-fixtures';
import { thrownAs } from '../../support/thrown';

/** AC-1: operands, operators and functions are read from display form and from internal form. */

const display = (text: string, context: ReferenceContext = CONTEXT): Token[] => tokenize(text, { form: 'display', context });
const internal = (text: string): Token[] => tokenize(text, { form: 'internal' });

function referencesIn(tokens: ReadonlyArray<Token>): FormulaReference[] {
  return tokens.flatMap((token) => (token.kind === 'reference' ? [token.reference] : []));
}

const rejected = (text: string, form: 'display' | 'internal' = 'display') =>
  thrownAs(() => (form === 'display' ? display(text) : internal(text)), FormulaError).issue;

describe('tokenizer: operands in display form (AC-1)', () => {
  it('AC-1: reads a column letter as a reference to the field in that position', () => {
    expect(referencesIn(display('A'))).toEqual([{ kind: 'field', id: fieldAt('A') }]);
    expect(referencesIn(display('AB'))).toEqual([{ kind: 'field', id: fieldAt('AB') }]);
    expect(referencesIn(display('CB'))).toEqual([{ kind: 'field', id: fieldAt('CB') }]);
  });

  it('AC-1: matches a rate name exactly, whatever it holds: hyphens, spaces, a percent sign, an ampersand', () => {
    expect(referencesIn(display('Test-Rate-per-kg'))).toEqual([{ kind: 'rate', id: RATE_PLAIN }]);
    expect(referencesIn(display('Test Spaced Rate'))).toEqual([{ kind: 'rate', id: RATE_SPACED }]);
    expect(referencesIn(display('Test Share %'))).toEqual([{ kind: 'rate', id: RATE_PERCENT }]);
    expect(referencesIn(display('Inspection & Packing %'))).toEqual([{ kind: 'rate', id: RATE_AMPERSAND }]);
  });

  it('AC-1: Cutting-Rate-per-Sec is one name and not a subtraction', () => {
    const tokens = display('Cutting-Rate-per-Sec');
    expect(tokens).toHaveLength(1);
    expect(referencesIn(tokens)).toEqual([{ kind: 'rate', id: RATE_HYPHENS }]);
  });

  it('AC-1: a name that begins with a column\'s letters is still the name (OH Profit % is not column OH)', () => {
    const tokens = display('OH Profit %');
    expect(tokens).toHaveLength(1);
    expect(referencesIn(tokens)).toEqual([{ kind: 'rate', id: RATE_COLUMN_PREFIX }]);
    // The letters alone are still a column.
    expect(referencesIn(display('OH'))).toEqual([{ kind: 'field', id: fieldAt('OH') }]);
  });

  it('AC-1: matches the longest name first, whichever order the list is in', () => {
    const shortFirst: ReferenceContext = {
      fieldIds: CONTEXT.fieldIds,
      rates: [
        { id: fieldIdOf(901), name: 'Foam' },
        { id: fieldIdOf(902), name: 'Foam Cost' },
        { id: fieldIdOf(903), name: 'Foam Cost Extra' },
      ],
    };
    const longFirst: ReferenceContext = { ...shortFirst, rates: [...shortFirst.rates].reverse() };
    for (const context of [shortFirst, longFirst]) {
      expect(referencesIn(display('Foam Cost Extra', context))).toEqual([{ kind: 'rate', id: fieldIdOf(903) }]);
      expect(referencesIn(display('Foam Cost', context))).toEqual([{ kind: 'rate', id: fieldIdOf(902) }]);
      expect(referencesIn(display('Foam', context))).toEqual([{ kind: 'rate', id: fieldIdOf(901) }]);
    }
  });

  it('AC-1: does not read a name out of the front of a longer word', () => {
    expect(rejected('Test Spaced Rates').name).toBe('Test');
    expect(rejected('Test-Rate-per-kgs').name).toBe('Test');
  });

  it('AC-1: a name can be followed by an operator or a bracket with no space', () => {
    expect(referencesIn(display('(Test-Rate-per-kg)*A'))).toEqual([
      { kind: 'rate', id: RATE_PLAIN },
      { kind: 'field', id: fieldAt('A') },
    ]);
    expect(referencesIn(display('Test Share %+1'))).toEqual([{ kind: 'rate', id: RATE_PERCENT }]);
  });

  it('AC-1: reads the three Material-* operands and the two exchange rates', () => {
    expect(
      referencesIn(display('Material-Price-per-kg Material-Specific-Gravity Material-Scrap-Rate ExchangeRate-USD ExchangeRate-EUR')),
    ).toEqual([
      { kind: 'material', key: 'pricePerKg' },
      { kind: 'material', key: 'specificGravity' },
      { kind: 'material', key: 'scrapRate' },
      { kind: 'exchange', currency: 'USD' },
      { kind: 'exchange', currency: 'EUR' },
    ]);
  });

  it('AC-1: reads numbers, including a decimal and a leading point', () => {
    const numbers = display('0 645 0.5 .25 1000000').flatMap((token) => (token.kind === 'number' ? [token.text] : []));
    expect(numbers).toEqual(['0', '645', '0.5', '.25', '1000000']);
  });

  it('AC-1: a second point ends a number, so "1.2.3" is two numbers and the parser refuses them', () => {
    const numbers = display('1.2.3').flatMap((token) => (token.kind === 'number' ? [token.text] : []));
    expect(numbers).toEqual(['1.2', '.3']);
  });

  it('AC-1: reads every operator, bracket and comma', () => {
    const symbols = display('+ - * / ( ) ,').flatMap((token) => (token.kind === 'symbol' ? [token.symbol] : []));
    expect(symbols).toEqual(['+', '-', '*', '/', '(', ')', ',']);
  });

  it('AC-1: reads the six comparisons, two-character ones first', () => {
    const operators = display('> >= < <= = <>').flatMap((token) => (token.kind === 'comparison' ? [token.operator] : []));
    expect(operators).toEqual(['>', '>=', '<', '<=', '=', '<>']);
  });

  it('AC-1: a word before a bracket is a function, with or without a space', () => {
    const names = display('SUM(A) IF (A > 1, 2, 3) MIN(1,2) MAX(1,2) ROUND(1,2)').flatMap((token) =>
      token.kind === 'function' ? [token.name] : [],
    );
    expect(names).toEqual(['SUM', 'IF', 'MIN', 'MAX', 'ROUND']);
  });

  it('keeps the span of every token, so a converter can copy the text between them', () => {
    const tokens = display('  A   *  2');
    expect(tokens.map(({ start, end }) => [start, end])).toEqual([
      [2, 3],
      [6, 7],
      [9, 10],
    ]);
  });

  it('gives no tokens for an empty or blank text', () => {
    expect(display('')).toEqual([]);
    expect(display('  \t ')).toEqual([]);
  });
});

describe('tokenizer: internal form (AC-1, AC-6)', () => {
  it('AC-6: reads the four reference kinds', () => {
    const text = `{{f:${fieldAt('A')}}} {{rate:${RATE_PLAIN}}} {{mat:scrapRate}} {{fx:EUR}}`;
    expect(referencesIn(internal(text))).toEqual([
      { kind: 'field', id: fieldAt('A') },
      { kind: 'rate', id: RATE_PLAIN },
      { kind: 'material', key: 'scrapRate' },
      { kind: 'exchange', currency: 'EUR' },
    ]);
  });

  it('AC-6: reads numbers, operators and functions around the references', () => {
    const tokens = internal(`IF({{mat:specificGravity}} > 0, {{f:${fieldAt('B')}}} * 2, 0)`);
    expect(tokens.map((token) => token.kind)).toEqual([
      'function', 'symbol', 'reference', 'comparison', 'number', 'symbol', 'reference', 'symbol', 'number', 'symbol', 'number', 'symbol',
    ]);
  });

  it.each([
    ['a field reference that is not an ID', '{{f:oops}}', 'BAD_FIELD_REFERENCE'],
    ['a rate reference that is not an ID', '{{rate:Cutting-Rate-per-Sec}}', 'BAD_RATE_REFERENCE'],
    ['a material value that does not exist', '{{mat:density}}', 'BAD_MATERIAL_REFERENCE'],
    ['an exchange rate that does not exist', '{{fx:JPY}}', 'BAD_EXCHANGE_REFERENCE'],
    ['a prefix that is not one of the four', '{{tax:USD}}', 'BAD_REFERENCE'],
    ['a reference that is never closed', '{{f:', 'BAD_REFERENCE'],
    ['a closing brace with no opening one', '1 } 2', 'BAD_REFERENCE'],
    ['a reference with a nested brace', '{{f:{x}}}', 'BAD_REFERENCE'],
  ])('AC-6: refuses %s', (_name, text, code) => {
    expect(rejected(text, 'internal').code).toBe(code);
  });

  it('AC-6: a column letter or a name is not valid in internal form: only references are', () => {
    expect(rejected('A * 2', 'internal').code).toBe('UNKNOWN_NAME');
    expect(rejected('Material-Scrap-Rate', 'internal').code).toBe('UNKNOWN_NAME');
  });
});

describe('tokenizer: errors (AC-5, STD-05)', () => {
  it('AC-5: names an unknown word and gives its character position', () => {
    const issue = rejected('A * Mystery');
    expect(issue).toMatchObject({ code: 'UNKNOWN_NAME', position: 5, length: 7, name: 'Mystery' });
  });

  it('AC-5: names an unknown function', () => {
    expect(rejected('ROLLUP(A)')).toMatchObject({ code: 'UNKNOWN_FUNCTION', position: 1, name: 'ROLLUP' });
    expect(rejected('sum(A)')).toMatchObject({ code: 'UNKNOWN_FUNCTION', name: 'sum' });
  });

  it('AC-5: names a column letter that the registry does not have', () => {
    expect(rejected('A + ZZ')).toMatchObject({ code: 'UNKNOWN_COLUMN', position: 5, name: 'ZZ' });
  });

  it('AC-5: treats lower-case letters as a name and not as a column', () => {
    expect(rejected('a')).toMatchObject({ code: 'UNKNOWN_NAME', name: 'a' });
  });

  it('AC-5: treats more than ten capital letters as a name and not as a column', () => {
    expect(rejected('ABCDEFGHIJK')).toMatchObject({ code: 'UNKNOWN_NAME' });
  });

  it.each(['A # B', 'A ; B', 'A $ 2', '%', 'A "x"', 'A [1]', '.', 'A ! B', 'A & B'])('AC-5: refuses the character in "%s"', (text) => {
    expect(rejected(text).code).toBe('INVALID_CHARACTER');
  });

  it('AC-5: refuses braces typed by hand in display form', () => {
    expect(rejected('{{f:x}}').code).toBe('BRACES_IN_DISPLAY_FORM');
    expect(rejected('A }').code).toBe('BRACES_IN_DISPLAY_FORM');
  });

  it('refuses a formula longer than the limit, and accepts one of exactly the limit', () => {
    expect(rejected('1'.repeat(MAX_FORMULA_LENGTH + 1)).code).toBe('TOO_LONG');
    expect(display('1'.repeat(MAX_FORMULA_LENGTH))).toHaveLength(1);
  });

  it('STD-05: no message repeats a word, letter, name or character from the formula', () => {
    const secrets = ['Zebra42', 'QQQ', 'Hidden Rate', 'Wombat'];
    const attempts = [
      'Zebra42 + A',
      'A + QQQ',
      'A * Hidden Rate',
      'ROLLUP(Wombat)',
      'Wombat(A)',
      'A ? Zebra42',
      '{{Zebra42:QQQ}}',
      '{{f:Wombat}}',
      '{{rate:Hidden Rate}}',
      '{{mat:Zebra42}}',
      '{{fx:QQQ}}',
    ];
    for (const attempt of attempts) {
      const form = attempt.includes('{{') ? 'internal' : 'display';
      const error = thrownAs(() => (form === 'internal' ? internal(attempt) : display(attempt)), FormulaError);
      for (const secret of secrets) expect(error.message, attempt).not.toContain(secret);
      expect(error.message, attempt).toMatch(/\(character \d+\)\.$/);
    }
  });
});
