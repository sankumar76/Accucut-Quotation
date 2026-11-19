/**
 * The suggestion list of the formula editor (STORY-08.02 AC-1; SCR-18): what is offered while the Admin types a name, and what the chosen one puts in the text. Pure and with no server import, so the editor's
 * chunk can use it in the browser. The list is names only: column letters with their field names, the Process Master rate names, the fixed operands of the Material Master and the exchange rates, and the five
 * functions. **No rate or operand name is written in this file**: the server sends them (`GET /config/sample-rows` and the Process Master list), so no script of the portal carries one (STORY-08.01 AC-5).
 * It decides nothing about whether a formula is valid; the check does (`checkFormulaEdit`).
 */

export type SuggestionKind = 'field' | 'rate' | 'value' | 'function';

export interface Suggestion {
  readonly kind: SuggestionKind;
  /** What goes into the text: a column letter, a rate or operand name, or a function and its bracket (`SUM(`). */
  readonly insert: string;
  /** The words that name it in the list: the field's name, the rate's name. */
  readonly label: string;
}

export interface SuggestionSource {
  readonly fields: ReadonlyArray<{ readonly letter: string; readonly label: string }>;
  readonly rateNames: ReadonlyArray<string>;
  /** The fixed operands of SPEC section 8.2 (the Material Master values and the exchange rates), by name, as the server sends them. */
  readonly operandNames: ReadonlyArray<string>;
}

export const FUNCTION_SUGGESTIONS: ReadonlyArray<string> = ['SUM(', 'MIN(', 'MAX(', 'ROUND(', 'IF('];

/** The most suggestions listed at once: more would not fit a phone and nobody reads past them. */
export const MAX_SUGGESTIONS = 8;

/** The characters a name is made of, a rate name's hyphens and percent sign included. */
const NAME_CHARACTER = /[A-Za-z0-9_%-]/;

export interface TypedWord {
  /** Where the word starts in the text. */
  readonly start: number;
  readonly prefix: string;
}

/** The name being typed just before the caret, or `null` when the caret is not at the end of one. */
export function wordBeforeCaret(text: string, caret: number): TypedWord | null {
  let start = caret;
  while (start > 0 && NAME_CHARACTER.test(text.charAt(start - 1))) start -= 1;
  const prefix = text.slice(start, caret);
  return prefix === '' ? null : { start, prefix };
}

const startsWith = (name: string, prefix: string): boolean => name.toLowerCase().startsWith(prefix.toLowerCase());
const hasWordStartingWith = (label: string, prefix: string): boolean => label.split(/[^A-Za-z0-9]+/).some((word) => startsWith(word, prefix));

function matching(prefix: string, source: SuggestionSource): Suggestion[] {
  const fieldHits = source.fields.filter((field) => startsWith(field.letter, prefix) || hasWordStartingWith(field.label, prefix));
  // A letter that is typed in full comes first, then letters that start with it, then fields found by a word of their name.
  const byLetter = (a: { letter: string }, b: { letter: string }): number =>
    Number(b.letter.toLowerCase() === prefix.toLowerCase()) - Number(a.letter.toLowerCase() === prefix.toLowerCase()) || a.letter.length - b.letter.length;
  const fields = [...fieldHits].sort(byLetter).map((field): Suggestion => ({ kind: 'field', insert: field.letter, label: field.label }));
  const rates = source.rateNames.filter((name) => startsWith(name, prefix)).map((name): Suggestion => ({ kind: 'rate', insert: name, label: name }));
  const values = source.operandNames.filter((name) => startsWith(name, prefix)).map((name): Suggestion => ({ kind: 'value', insert: name, label: name }));
  const functions = FUNCTION_SUGGESTIONS.filter((name) => startsWith(name, prefix)).map((name): Suggestion => ({ kind: 'function', insert: name, label: name.slice(0, -1) }));
  return [...fields, ...rates, ...values, ...functions];
}

/**
 * What to offer for the word being typed, or an empty list. A name with hyphens is also looked up from after each hyphen, so a minus sign typed before a rate name still finds it. A word that is exactly the one
 * suggestion is not offered again.
 */
export function suggestionsFor(word: TypedWord | null, source: SuggestionSource): ReadonlyArray<Suggestion> {
  if (word === null) return [];
  const starts = [0, ...[...word.prefix].flatMap((character, index) => (character === '-' ? [index + 1] : []))];
  for (const from of starts) {
    const prefix = word.prefix.slice(from);
    if (prefix === '') continue;
    const found = matching(prefix, source);
    if (found.length === 0) continue;
    if (found.length === 1 && found[0]?.insert === prefix) return [];
    return found.slice(0, MAX_SUGGESTIONS);
  }
  return [];
}

export interface Applied {
  readonly text: string;
  readonly caret: number;
}

/** Puts the chosen suggestion in place of the word being typed, and the caret after it. The word is the part from the last hyphen that the suggestion matched. */
export function applySuggestion(text: string, caret: number, word: TypedWord, suggestion: Suggestion): Applied {
  const typed = word.prefix;
  const typedLower = typed.toLowerCase();
  // The whole word when the suggestion starts like it, else the part after the hyphen the lookup used.
  const replaceFrom = suggestion.insert.toLowerCase().startsWith(typedLower) ? word.start : word.start + typed.lastIndexOf('-') + 1;
  const next = `${text.slice(0, replaceFrom)}${suggestion.insert}${text.slice(caret)}`;
  return { text: next, caret: replaceFrom + suggestion.insert.length };
}
