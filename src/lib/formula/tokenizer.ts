import 'server-only';

import { columnLetterToIndex, isColumnLetters } from '../columns';
import { EXCHANGE_CURRENCIES, MATERIAL_OPERAND_KEYS } from '../fields/types';

import type { ComparisonOperator, FormulaReference } from './ast';
import { errorAt, FormulaError } from './errors';
import { FUNCTION_NAMES, MAX_FORMULA_LENGTH, namedOperands, type FunctionName, type NamedOperand, type ReferenceContext } from './names';

/**
 * Turns formula text into tokens (SPEC section 8.2). It reads both forms of a formula:
 *
 * - **display form**, what a Lead or Admin types: column letters, rate names, `Material-*`, `ExchangeRate-*`;
 * - **internal form**, what the registry stores: `{{f:<id>}}`, `{{rate:<id>}}`, `{{mat:<key>}}`, `{{fx:<code>}}`.
 *
 * In both, an operand becomes one `reference` token that names its target by stable ID, so the parser and the
 * evaluator never see a letter or a name. Each token keeps the span of text it came from, so a converter can
 * copy everything between tokens (spaces, in particular) unchanged and a round trip is exact.
 *
 * Names are matched exactly and longest first, before column letters. Every error is a `FormulaError` whose
 * message holds no text from the formula (see `errors.ts`).
 */

export type TokenSource =
  | { readonly form: 'internal' }
  /**
   * `anyColumn` reads every valid run of capital letters as a column, whether or not the registry has that many
   * fields. Used only to ask whether a rate name could be mistaken for a column (`rate-names.ts`).
   */
  | { readonly form: 'display'; readonly context: ReferenceContext; readonly anyColumn?: boolean };

export type SymbolToken = '+' | '-' | '*' | '/' | '(' | ')' | ',';

export interface Span {
  readonly start: number;
  /** One past the last character. */
  readonly end: number;
}

export type Token = Span &
  (
    | { readonly kind: 'number'; readonly text: string }
    | { readonly kind: 'reference'; readonly reference: FormulaReference }
    | { readonly kind: 'function'; readonly name: FunctionName }
    | { readonly kind: 'symbol'; readonly symbol: SymbolToken }
    | { readonly kind: 'comparison'; readonly operator: ComparisonOperator }
  );

const NUMBER = /\d+(?:\.\d+)?|\.\d+/y;
const WORD = /[A-Za-z_][A-Za-z0-9_]*/y;
const INTERNAL_REFERENCE = /\{\{[^{}:]*:[^{}]*\}\}/y;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A character that may continue a name, so a name is never read out of the front of a longer word. */
const NAME_CHARACTER = /[A-Za-z0-9_]/;
const WHITESPACE = /\s/;
const SYMBOLS: ReadonlyArray<SymbolToken> = ['+', '-', '*', '/', '(', ')', ','];
/** Two-character comparisons first, so `>=` is not read as `>` followed by `=`. */
const COMPARISONS: ReadonlyArray<ComparisonOperator> = ['>=', '<=', '<>', '>', '<', '='];

function sticky(pattern: RegExp, text: string, index: number): RegExpExecArray | null {
  pattern.lastIndex = index;
  return pattern.exec(text);
}

function nextNonSpace(text: string, index: number): string {
  let cursor = index;
  while (cursor < text.length && WHITESPACE.test(text.charAt(cursor))) cursor += 1;
  return text.charAt(cursor);
}

function matchNamedOperand(text: string, index: number, operands: ReadonlyArray<NamedOperand>): NamedOperand | undefined {
  return operands.find(({ name }) => {
    if (!text.startsWith(name, index)) return false;
    const following = text.charAt(index + name.length);
    return following === '' || !NAME_CHARACTER.test(following);
  });
}

function readNumber(text: string, start: number): Token | undefined {
  const match = sticky(NUMBER, text, start);
  if (match === null) return undefined;
  return { kind: 'number', text: match[0], start, end: start + match[0].length };
}

function readSymbol(text: string, start: number): Token | undefined {
  const char = text.charAt(start);
  const comparison = COMPARISONS.find((operator) => text.startsWith(operator, start));
  if (comparison !== undefined) return { kind: 'comparison', operator: comparison, start, end: start + comparison.length };
  const symbol = SYMBOLS.find((candidate) => candidate === char);
  return symbol === undefined ? undefined : { kind: 'symbol', symbol, start, end: start + 1 };
}

/** The reference a `{{prefix:value}}` stands for, or the error that says why it is not one. */
function referenceFromParts(prefix: string, value: string, start: number, end: number): FormulaReference {
  switch (prefix) {
    case 'f':
      if (UUID.test(value)) return { kind: 'field', id: value };
      throw errorAt('BAD_FIELD_REFERENCE', 'A formula holds a field reference that is not an ID', start, end);
    case 'rate':
      if (UUID.test(value)) return { kind: 'rate', id: value };
      throw errorAt('BAD_RATE_REFERENCE', 'A formula holds a rate reference that is not an ID', start, end);
    case 'mat': {
      const key = MATERIAL_OPERAND_KEYS.find((candidate) => candidate === value);
      if (key !== undefined) return { kind: 'material', key };
      throw errorAt('BAD_MATERIAL_REFERENCE', 'A formula refers to a material value that does not exist', start, end);
    }
    case 'fx': {
      const currency = EXCHANGE_CURRENCIES.find((candidate) => candidate === value);
      if (currency !== undefined) return { kind: 'exchange', currency };
      throw errorAt('BAD_EXCHANGE_REFERENCE', 'A formula refers to an exchange rate that does not exist', start, end);
    }
    default:
      throw errorAt('BAD_REFERENCE', 'A reference is not written as {{f:..}}, {{rate:..}}, {{mat:..}} or {{fx:..}}', start, end);
  }
}

function readInternalReference(text: string, start: number): Token {
  const match = sticky(INTERNAL_REFERENCE, text, start);
  if (match === null) {
    throw errorAt('BAD_REFERENCE', 'A reference is not written as {{f:..}}, {{rate:..}}, {{mat:..}} or {{fx:..}}', start, start + 1);
  }
  const end = start + match[0].length;
  // The pattern guarantees braces on both sides and a colon inside; split on the first colon.
  const inner = match[0].slice(2, -2);
  const colon = inner.indexOf(':');
  const reference = referenceFromParts(inner.slice(0, colon), inner.slice(colon + 1), start, end);
  return { kind: 'reference', reference, start, end };
}

function isFunctionName(word: string): word is FunctionName {
  return FUNCTION_NAMES.some((name) => name === word);
}

/** A word followed by a bracket is a function name; any other word must be a column letter (display form only). */
function readWord(text: string, start: number, word: string, source: TokenSource): Token {
  const end = start + word.length;
  if (nextNonSpace(text, end) === '(') {
    if (isFunctionName(word)) return { kind: 'function', name: word, start, end };
    throw errorAt('UNKNOWN_FUNCTION', 'The function is not one of SUM, MIN, MAX, ROUND or IF', start, end, word);
  }
  if (source.form === 'display' && isColumnLetters(word)) {
    const id = source.anyColumn === true ? '' : source.context.fieldIds[columnLetterToIndex(word) - 1];
    if (id !== undefined) return { kind: 'reference', reference: { kind: 'field', id }, start, end };
    throw errorAt('UNKNOWN_COLUMN', 'The column is not in the registry', start, end, word);
  }
  throw errorAt('UNKNOWN_NAME', 'The name is not a column letter, rate name or function', start, end, word);
}

/** Display form only: a name from the rate list, `Material-*` or `ExchangeRate-*`. */
function readNamedOperand(text: string, start: number, operands: ReadonlyArray<NamedOperand>): Token | undefined {
  const named = matchNamedOperand(text, start, operands);
  return named === undefined ? undefined : { kind: 'reference', reference: named.reference, start, end: start + named.name.length };
}

function readBrace(char: string, text: string, start: number, source: TokenSource): Token {
  if (source.form === 'display') {
    throw errorAt('BRACES_IN_DISPLAY_FORM', 'A formula in display form cannot hold braces', start, start + 1);
  }
  if (char === '{') return readInternalReference(text, start);
  throw errorAt('BAD_REFERENCE', 'A reference is not written as {{f:..}}, {{rate:..}}, {{mat:..}} or {{fx:..}}', start, start + 1);
}

/** The token that starts at `start`, which is not white space. */
function readToken(text: string, start: number, source: TokenSource, operands: ReadonlyArray<NamedOperand>): Token {
  const char = text.charAt(start);
  if (char === '{' || char === '}') return readBrace(char, text, start, source);
  const named = source.form === 'display' ? readNamedOperand(text, start, operands) : undefined;
  if (named !== undefined) return named;
  const token = readNumber(text, start) ?? readSymbol(text, start);
  if (token !== undefined) return token;
  const word = sticky(WORD, text, start);
  if (word !== null) return readWord(text, start, word[0], source);
  throw errorAt('INVALID_CHARACTER', 'A character that is not part of a formula', start, start + 1);
}

/**
 * Every token of `text` in order. Throws `FormulaError` at the first problem. An empty text gives no token;
 * deciding whether that is acceptable is the parser's job.
 */
export function tokenize(text: string, source: TokenSource): Token[] {
  if (text.length > MAX_FORMULA_LENGTH) {
    throw new FormulaError({ code: 'TOO_LONG', message: `A formula is limited to ${MAX_FORMULA_LENGTH} characters.` });
  }
  const operands = source.form === 'display' ? namedOperands(source.context.rates) : [];
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    if (WHITESPACE.test(text.charAt(index))) {
      index += 1;
      continue;
    }
    const token = readToken(text, index, source, operands);
    tokens.push(token);
    index = token.end;
  }
  return tokens;
}
