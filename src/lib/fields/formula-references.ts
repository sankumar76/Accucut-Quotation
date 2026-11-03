import { assertNever } from '../assert-never';
import { columnLetterToIndex, indexToColumnLetter, isColumnLetters } from '../columns';
import { ValidationError } from '../errors';

import {
  EXCHANGE_CURRENCIES,
  MATERIAL_OPERAND_KEYS,
  type ExchangeCurrency,
  type MaterialOperandKey,
} from './types';

/**
 * Formula text in its two forms (SPEC section 8.1, architecture section 4.5; ADR-004).
 *
 * - **Internal form** is what the registry stores. Every operand is a stable reference, so a rename or a
 *   re-lettering never changes the stored text: `{{f:<fieldId>}}`, `{{rate:<rateId>}}`, `{{mat:<key>}}`,
 *   `{{fx:USD}}`.
 * - **Display form** is what a Lead or Admin reads and edits: column letters, rate names, `Material-*` and
 *   `ExchangeRate-*` names, as in SPEC section 7.4.
 *
 * This module only swaps operands between the two forms. It does not tokenise, parse or evaluate a
 * formula: that is the formula engine (STORY-03.02). Everything that is not an operand (numbers,
 * operators, brackets, `IF`, `SUM`, spaces) is copied unchanged, so a round trip returns the original text.
 */

export class FormulaReferenceError extends ValidationError {
  constructor(message: string) {
    super(message, { code: 'FORMULA_REFERENCE_INVALID' });
  }
}

/** The rates a formula may name. Their IDs are fixed for the 15 seed items (`prisma/seed/config/seed-ids.ts`). */
export interface RateReference {
  readonly id: string;
  readonly name: string;
}

/** What is needed to convert: the fields in position order, and the Process Master rates. */
export interface ReferenceContext {
  /** Field IDs in position order: the field at index `n - 1` has position `n`, and so the letter for `n`. */
  readonly fieldIds: ReadonlyArray<string>;
  readonly rates: ReadonlyArray<RateReference>;
}

export type FormulaReference =
  | { readonly kind: 'field'; readonly id: string }
  | { readonly kind: 'rate'; readonly id: string }
  | { readonly kind: 'material'; readonly key: string }
  | { readonly kind: 'exchange'; readonly currency: string };

export const MATERIAL_OPERAND_NAMES: Readonly<Record<MaterialOperandKey, string>> = {
  pricePerKg: 'Material-Price-per-kg',
  specificGravity: 'Material-Specific-Gravity',
  scrapRate: 'Material-Scrap-Rate',
};

const EXCHANGE_NAME_PREFIX = 'ExchangeRate-';

/** Matches one stored reference. The value part is validated by the callers, not here. */
const INTERNAL_REFERENCE = /\{\{(f|rate|mat|fx):([^{}]*)\}\}/g;
const NAME_CHARACTER = /[A-Za-z0-9_-]/;
const WORD = /[A-Za-z_][A-Za-z0-9_]*/y;
const NUMBER = /[0-9.]+/y;
/** Characters copied unchanged: operators, brackets, comparison signs, commas and spaces. */
const PASS_THROUGH = /[\s+\-*/(),<>=]/;

function isMaterialKey(value: string): value is MaterialOperandKey {
  return MATERIAL_OPERAND_KEYS.some((key) => key === value);
}

function isExchangeCurrency(value: string): value is ExchangeCurrency {
  return EXCHANGE_CURRENCIES.some((currency) => currency === value);
}

function assertNoStrayBraces(text: string): void {
  if (text.replace(INTERNAL_REFERENCE, '').match(/[{}]/) !== null) {
    throw new FormulaReferenceError('A formula holds a reference that is not {{f:..}}, {{rate:..}}, {{mat:..}} or {{fx:..}}.');
  }
}

/** Every reference in a stored formula, in order. Throws if the text holds a malformed one. */
export function extractReferences(internalForm: string): FormulaReference[] {
  assertNoStrayBraces(internalForm);
  const references: FormulaReference[] = [];
  for (const match of internalForm.matchAll(INTERNAL_REFERENCE)) {
    const value = match[2] ?? '';
    switch (match[1]) {
      case 'f':
        references.push({ kind: 'field', id: value });
        break;
      case 'rate':
        references.push({ kind: 'rate', id: value });
        break;
      case 'mat':
        references.push({ kind: 'material', key: value });
        break;
      default:
        references.push({ kind: 'exchange', currency: value });
    }
  }
  return references;
}

interface NamedOperand {
  readonly name: string;
  readonly reference: string;
}

/** Operands that are spelled as a fixed name, longest first so that a name never loses to a shorter one. */
function namedOperands(context: ReferenceContext): NamedOperand[] {
  const operands: NamedOperand[] = [
    ...context.rates.map((rate) => ({ name: rate.name, reference: `{{rate:${rate.id}}}` })),
    ...MATERIAL_OPERAND_KEYS.map((key) => ({ name: MATERIAL_OPERAND_NAMES[key], reference: `{{mat:${key}}}` })),
    ...EXCHANGE_CURRENCIES.map((currency) => ({
      name: `${EXCHANGE_NAME_PREFIX}${currency}`,
      reference: `{{fx:${currency}}}`,
    })),
  ];
  return operands.sort((a, b) => b.name.length - a.name.length);
}

function matchNamedOperand(text: string, index: number, operands: ReadonlyArray<NamedOperand>): NamedOperand | undefined {
  return operands.find(({ name }) => {
    if (!text.startsWith(name, index)) return false;
    const next = text.charAt(index + name.length);
    return next === '' || !NAME_CHARACTER.test(next);
  });
}

function readAt(pattern: RegExp, text: string, index: number): string | undefined {
  pattern.lastIndex = index;
  return pattern.exec(text)?.[0];
}

function fieldReference(letters: string, context: ReferenceContext): string {
  const id = context.fieldIds[columnLetterToIndex(letters) - 1];
  if (id === undefined) throw new FormulaReferenceError(`The formula names column ${letters}, which does not exist.`);
  return `{{f:${id}}}`;
}

interface Token {
  readonly output: string;
  readonly length: number;
}

function readWord(word: string, rest: string, context: ReferenceContext): Token {
  // A word followed by an opening bracket is a function name (IF, SUM ...); no column is followed by one.
  if (rest.trimStart().startsWith('(')) return { output: word, length: word.length };
  if (!isColumnLetters(word)) {
    throw new FormulaReferenceError(`The formula names "${word}", which is not a column, rate or material name.`);
  }
  return { output: fieldReference(word, context), length: word.length };
}

/** The token that starts at `index`: a name, a number, a word, or one character that is copied. */
function readToken(text: string, index: number, operands: ReadonlyArray<NamedOperand>, context: ReferenceContext): Token {
  const named = matchNamedOperand(text, index, operands);
  if (named !== undefined) return { output: named.reference, length: named.name.length };
  const number = readAt(NUMBER, text, index);
  if (number !== undefined) return { output: number, length: number.length };
  const word = readAt(WORD, text, index);
  if (word !== undefined) return readWord(word, text.slice(index + word.length), context);
  const char = text.charAt(index);
  if (PASS_THROUGH.test(char)) return { output: char, length: 1 };
  throw new FormulaReferenceError(`The formula holds a character that is not allowed: "${char}".`);
}

/**
 * Display form to internal form. A word followed by `(` is a function name and is kept; any other word
 * must be a column letter, a rate name or a `Material-*` / `ExchangeRate-*` name, or this throws.
 */
export function toInternalForm(displayForm: string, context: ReferenceContext): string {
  if (/[{}]/.test(displayForm)) throw new FormulaReferenceError('A formula in display form cannot hold braces.');
  const operands = namedOperands(context);
  let result = '';
  let index = 0;
  while (index < displayForm.length) {
    const token = readToken(displayForm, index, operands, context);
    result += token.output;
    index += token.length;
  }
  return result;
}

function displayName(reference: FormulaReference, context: ReferenceContext): string {
  switch (reference.kind) {
    case 'field': {
      const index = context.fieldIds.indexOf(reference.id);
      if (index === -1) throw new FormulaReferenceError('The formula refers to a field that is not in the registry.');
      return indexToColumnLetter(index + 1);
    }
    case 'rate': {
      const rate = context.rates.find(({ id }) => id === reference.id);
      if (rate === undefined) throw new FormulaReferenceError('The formula refers to a rate that is not in the Process Master.');
      return rate.name;
    }
    case 'material': {
      if (!isMaterialKey(reference.key)) throw new FormulaReferenceError('The formula refers to a material value that does not exist.');
      return MATERIAL_OPERAND_NAMES[reference.key];
    }
    case 'exchange': {
      if (!isExchangeCurrency(reference.currency)) throw new FormulaReferenceError('The formula refers to an exchange rate that does not exist.');
      return `${EXCHANGE_NAME_PREFIX}${reference.currency}`;
    }
    default:
      return assertNever(reference);
  }
}

/** Internal form to display form: letters come from the fields' current positions. */
export function toDisplayForm(internalForm: string, context: ReferenceContext): string {
  const references = extractReferences(internalForm);
  let next = 0;
  return internalForm.replace(INTERNAL_REFERENCE, () => {
    const reference = references[next];
    next += 1;
    if (reference === undefined) throw new FormulaReferenceError('A formula reference could not be read.');
    return displayName(reference, context);
  });
}
