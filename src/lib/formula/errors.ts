import 'server-only';

import { ValidationError } from '../errors';

/**
 * Every way a formula can be refused (SPEC section 8.2, architecture section 4.5).
 *
 * **Messages carry no formula text.** A formula is Restricted data and an error message can reach a log or a
 * response (GitHub #35, STD-05; the `ConfigDocumentError` policy). A message therefore states the rule that
 * failed and the place, as a character number, and never a word, a letter, a number or a rate name taken from
 * the formula. **No property of an issue holds formula text either** (G6 STD-01): an error or an issue can be
 * logged whole, and the logger redacts by field name only. SCR-18 quotes what the person typed from their own
 * text, using `position` and `length` (`text.slice(position - 1, position - 1 + length)`).
 */
export const FORMULA_ISSUE_CODES = [
  // Reading the text
  'EMPTY',
  'TOO_LONG',
  'TOO_DEEP',
  'INVALID_CHARACTER',
  'BRACES_IN_DISPLAY_FORM',
  'BAD_REFERENCE',
  'BAD_FIELD_REFERENCE',
  'BAD_RATE_REFERENCE',
  'BAD_MATERIAL_REFERENCE',
  'BAD_EXCHANGE_REFERENCE',
  'UNKNOWN_NAME',
  'UNKNOWN_COLUMN',
  'UNKNOWN_FUNCTION',
  'UNKNOWN_RATE',
  // Grammar
  'EXPECTED_OPERAND',
  'EXPECTED_OPERATOR',
  'UNEXPECTED_END',
  'UNCLOSED_BRACKET',
  'UNEXPECTED_CLOSING_BRACKET',
  'WRONG_ARGUMENT_COUNT',
  'COMPARISON_OUTSIDE_IF',
  'IF_NEEDS_COMPARISON',
  'SUM_NEEDS_COLUMN',
  'ROUND_NEEDS_PLACES',
  // The configuration as a whole
  'CYCLE',
  'ROW_FORMULA_USES_PRODUCT_FIELD',
  'SUM_IN_ROW_FORMULA',
  'SUM_OF_PRODUCT_FIELD',
  'PRODUCT_FORMULA_USES_ROW_FIELD',
  // Rate names
  'RATE_NAME_INVALID',
  'RATE_NAME_IS_COLUMN_LETTER',
  'RATE_NAME_IS_OPERAND',
  'RATE_NAME_DUPLICATE',
  'RATE_SET_AMBIGUOUS',
] as const;
export type FormulaIssueCode = (typeof FORMULA_ISSUE_CODES)[number];

/** One problem found in a formula or in the set of formulas. */
export interface FormulaIssue {
  readonly code: FormulaIssueCode;
  /** Safe to log: a rule and a place. Never holds text from the formula. */
  readonly message: string;
  /** 1-based character number in the text that was read: the first character is 1. Absent for whole-configuration problems. */
  readonly position?: number;
  /** How many characters the problem covers, from `position`. */
  readonly length?: number;
  /** The field whose formula has the problem, when the check ran over a whole configuration. */
  readonly fieldId?: string;
  /** For `CYCLE`: the field IDs around the loop, first and last the same. */
  readonly cycle?: ReadonlyArray<string>;
}

/** A formula that cannot be read or is not valid. Wraps one issue; see the policy above. */
export class FormulaError extends ValidationError {
  readonly issue: FormulaIssue;

  constructor(issue: FormulaIssue) {
    super(issue.message, { code: 'FORMULA_INVALID' });
    this.issue = issue;
  }
}

/** Shorthand used by the reader and the parser: build an issue for a span of characters. */
export function issueAt(code: FormulaIssueCode, message: string, start: number, end: number): FormulaIssue {
  return {
    code,
    message: `${message} (character ${start + 1}).`,
    position: start + 1,
    length: Math.max(end - start, 1),
  };
}

/** A formula problem raised at a span of characters. */
export function errorAt(code: FormulaIssueCode, message: string, start: number, end: number): FormulaError {
  return new FormulaError(issueAt(code, message, start, end));
}
