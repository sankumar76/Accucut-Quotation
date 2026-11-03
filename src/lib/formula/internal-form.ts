import 'server-only';

import { assertNever } from '../assert-never';
import { indexToColumnLetter } from '../columns';

import type { FormulaReference } from './ast';
import { errorAt } from './errors';
import { exchangeOperandName, MATERIAL_OPERAND_NAMES, type ReferenceContext } from './names';
import { tokenize, type Token } from './tokenizer';

/**
 * The one converter between the two forms of a formula (SPEC section 8.1, architecture sections 4.5 and 10;
 * ADR-004; GitHub #31).
 *
 * - **Internal form** is what the registry stores. Every operand is a stable reference, so a rename or a
 *   re-lettering never changes the stored text: `{{f:<fieldId>}}`, `{{rate:<rateId>}}`, `{{mat:<key>}}`, `{{fx:USD}}`.
 * - **Display form** is what a Lead or Admin reads and edits: column letters, rate names, `Material-*` and
 *   `ExchangeRate-*` names, as in SPEC section 7.4.
 *
 * It is built on the tokenizer, so names with spaces or `%`, and the longest-first match, behave here exactly as
 * they do in the parser. Only operands are swapped; every character between them (operators, brackets, numbers,
 * function names, spaces) is copied unchanged, so a round trip returns the original text. Grammar is not
 * checked here: `parseFormula` does that.
 *
 * Errors are `FormulaError`s whose message names a rule and a character number, never a word from the formula.
 */

/** A reference as it is stored: `{{f:..}}`, `{{rate:..}}`, `{{mat:..}}` or `{{fx:..}}`. */
export function formatReference(reference: FormulaReference): string {
  switch (reference.kind) {
    case 'field':
      return `{{f:${reference.id}}}`;
    case 'rate':
      return `{{rate:${reference.id}}}`;
    case 'material':
      return `{{mat:${reference.key}}}`;
    case 'exchange':
      return `{{fx:${reference.currency}}}`;
    default:
      return assertNever(reference, 'reference');
  }
}

/** Rebuilds `text` with each reference token replaced by `replace(reference, token)` and everything else copied. */
function rewrite(text: string, tokens: ReadonlyArray<Token>, replace: (reference: FormulaReference, token: Token) => string): string {
  let result = '';
  let cursor = 0;
  for (const token of tokens) {
    result += text.slice(cursor, token.start);
    result += token.kind === 'reference' ? replace(token.reference, token) : text.slice(token.start, token.end);
    cursor = token.end;
  }
  return result + text.slice(cursor);
}

/**
 * Display form to internal form. Throws `FormulaError` for a name that is not a column letter, rate name,
 * `Material-*` or `ExchangeRate-*` operand or function, for a column the registry does not have, and for a
 * character that does not belong in a formula.
 */
export function toInternalForm(displayForm: string, context: ReferenceContext): string {
  const tokens = tokenize(displayForm, { form: 'display', context });
  return rewrite(displayForm, tokens, (reference) => formatReference(reference));
}

/**
 * How a reference reads in display form: the column letter of its field's current position, the rate's current
 * name, or the `Material-*` / `ExchangeRate-*` name. `undefined` when the field or the rate is not in the context.
 */
export function referenceDisplayName(reference: FormulaReference, context: ReferenceContext): string | undefined {
  switch (reference.kind) {
    case 'field': {
      const index = context.fieldIds.indexOf(reference.id);
      return index === -1 ? undefined : indexToColumnLetter(index + 1);
    }
    case 'rate':
      return context.rates.find(({ id }) => id === reference.id)?.name;
    case 'material':
      return MATERIAL_OPERAND_NAMES[reference.key];
    case 'exchange':
      return exchangeOperandName(reference.currency);
    default:
      return assertNever(reference, 'reference');
  }
}

function displayName(reference: FormulaReference, context: ReferenceContext, token: Token): string {
  const name = referenceDisplayName(reference, context);
  if (name !== undefined) return name;
  if (reference.kind === 'rate') {
    throw errorAt('UNKNOWN_RATE', 'The formula refers to a rate that is not in the Process Master', token.start, token.end);
  }
  throw errorAt('BAD_FIELD_REFERENCE', 'The formula refers to a field that is not in the registry', token.start, token.end);
}

/** Internal form to display form: letters come from the fields' current positions, names from the rate list. */
export function toDisplayForm(internalForm: string, context: ReferenceContext): string {
  const tokens = tokenize(internalForm, { form: 'internal' });
  return rewrite(internalForm, tokens, (reference, token) => displayName(reference, context, token));
}

/** Every reference in a stored formula, in order of appearance, repeats included. Throws `FormulaError` if it cannot be read. */
export function extractReferences(internalForm: string): FormulaReference[] {
  const references: FormulaReference[] = [];
  for (const token of tokenize(internalForm, { form: 'internal' })) {
    if (token.kind === 'reference') references.push(token.reference);
  }
  return references;
}
