import 'server-only';

import { FormulaError, type FormulaIssue } from './errors';
import { fixedOperands } from './names';
import { tokenize } from './tokenizer';

/**
 * Which rate names are safe to use in a formula (GitHub #35, QLT-05; ADR-005, "a rate name cannot be a valid
 * column letter, because letters move").
 *
 * In display form a name is matched exactly, before column letters. A name that could also be read as part of
 * a formula, such as `AB`, `A-B` or `5`, would mean one thing when the Admin types it and another when the rate
 * list changes, and the stored formula would then be a different price with no error. So such a name is refused
 * when the rate is created or renamed, whatever the registry's size is today: letters move, and a registry can
 * grow to reach them. `OH Profit %` is safe: it begins with a column's letters, but `Profit` is not an operand,
 * so the whole text cannot be read any other way.
 *
 * The rule holds for the whole set of names, not for the new name alone (`rateSetIssues`): adding `Cost` and `Waste` after
 * `Cost-Waste` exists would make the stored formula `{{rate:Cost}}-{{rate:Waste}}` come back from display form as the compound rate
 * just the same. Messages state the rule and never repeat a name.
 */

/** Longest rate name accepted. */
export const MAX_RATE_NAME_LENGTH = 100;

/** Characters that mean something in a formula and so cannot be inside a rate name. A hyphen can: `Cutting-Rate-per-Sec`. */
const STRUCTURAL_CHARACTER = /[{}(),+*/<>=]/;
const CONTROL_CHARACTER = /\p{Cc}/u;

function issue(code: FormulaIssue['code'], message: string): FormulaIssue {
  return { code, message };
}

function invalidShape(name: string): FormulaIssue | undefined {
  if (name.length === 0) return issue('RATE_NAME_INVALID', 'A rate name cannot be empty.');
  if (name.length > MAX_RATE_NAME_LENGTH) {
    return issue('RATE_NAME_INVALID', `A rate name is limited to ${MAX_RATE_NAME_LENGTH} characters.`);
  }
  if (name !== name.trim()) return issue('RATE_NAME_INVALID', 'A rate name cannot start or end with a space.');
  if (CONTROL_CHARACTER.test(name) || STRUCTURAL_CHARACTER.test(name)) {
    return issue('RATE_NAME_INVALID', 'A rate name cannot hold braces, brackets, commas, arithmetic or comparison signs, or control characters.');
  }
  return undefined;
}

/**
 * True when the text, in a registry where `otherNames` are the other rates, reads as a run of operands, numbers and operators
 * that is **not** just one of those other rates (that is a duplicate, which is said in its own words).
 *
 * The other names are part of the formula language the text is read in (DEF-006, GitHub #49): `Cost-Waste` is one rate while no
 * `Cost` and `Waste` exist, and `Cost - Waste` once they do, so a stored formula `{{rate:Cost}}-{{rate:Waste}}` would come back
 * from display form as the new rate, a different price with no error. Reading the name with an empty rate list, as before,
 * could not see that. A name that is *exactly* another rate's name is one token and is left to the duplicate check; any other
 * run of two or more tokens is refused. The tokenizer matches names longest first, as a formula does, so the reading here is the
 * reading a formula gets. A stand-in ID is given to each rate, because only the shape of the reading matters, not what it points at.
 */
function readsAsFormulaText(name: string, otherNames: ReadonlyArray<string>): boolean {
  const rates = otherNames.map((otherName) => ({ id: otherName, name: otherName }));
  try {
    const tokens = tokenize(name, { form: 'display', context: { fieldIds: [], rates }, anyColumn: true });
    const [only] = tokens;
    const isExactlyAnotherRate = tokens.length === 1 && only?.kind === 'reference' && only.reference.kind === 'rate';
    return !isExactlyAnotherRate;
  } catch (error) {
    if (error instanceof FormulaError) return false;
    throw error;
  }
}

/**
 * The problems with a proposed rate name, or an empty list if it is safe. `otherNames` are the names of the
 * other rates; a name equal to one of them is refused, as the exact-match rule could not tell them apart.
 */
export function rateNameIssues(name: string, otherNames: ReadonlyArray<string> = []): FormulaIssue[] {
  const shape = invalidShape(name);
  if (shape !== undefined) return [shape];
  if (fixedOperands().some((operand) => operand.name === name)) {
    return [issue('RATE_NAME_IS_OPERAND', 'A rate cannot be named like a Material-* or ExchangeRate-* operand.')];
  }
  if (readsAsFormulaText(name, otherNames)) {
    return [
      issue(
        'RATE_NAME_IS_COLUMN_LETTER',
        'A rate name cannot read as column letters, numbers, operators or other rate names: a formula would take it for those.',
      ),
    ];
  }
  if (otherNames.includes(name)) return [issue('RATE_NAME_DUPLICATE', 'Another rate already has this name.')];
  return [];
}

/** Said once for each name that the set makes readable as something else. It names no rate (STD-05 of the rule above). */
export const RATE_SET_AMBIGUOUS_MESSAGE =
  'This set of names would make a rate name read as column letters, numbers, operators or other rate names: a formula would take it for those.';

/**
 * The problems of a whole set of rate names read together (DEF-006, QLT-01 of the G6 of AQP-113): a name that reads as other names in
 * the set and an operator, whichever of them was added first. `rateNameIssues` judges one new name against the others; this judges
 * every name against the rest, so it also finds an *existing* name that a new one has made ambiguous. Run it on the set a change
 * would leave (`[...others, newName]`) before the change is made. It reports a name once, with `RATE_SET_AMBIGUOUS`; shape,
 * operand and duplicate problems of one name stay with `rateNameIssues`. The cost is one reading of each name against the other
 * names, that is about n squared name matches for n rates.
 */
export function rateSetIssues(names: ReadonlyArray<string>): FormulaIssue[] {
  return ambiguousRateNames(names).map(() => issue('RATE_SET_AMBIGUOUS', RATE_SET_AMBIGUOUS_MESSAGE));
}

/**
 * The names of a set that read as other names in it and an operator (the names `rateSetIssues` reports, which it does not give). A
 * change is judged by what it *introduces*: the names that are ambiguous after it and were not before, so a set that was already
 * unsafe does not refuse every later change (QLT-17).
 */
export function ambiguousRateNames(names: ReadonlyArray<string>): string[] {
  return names.filter((name, index) => {
    if (invalidShape(name) !== undefined) return false;
    return readsAsFormulaText(name, names.filter((_, position) => position !== index));
  });
}
