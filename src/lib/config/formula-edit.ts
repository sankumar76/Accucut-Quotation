import { findFieldById, fieldLetter, referenceContext } from '../fields/registry';
import type { FieldDefinition, OutputFieldDefinition } from '../fields/field-schema';
import type { ConfigDocument } from '../fields/schema';
import {
  analyzeConfiguration,
  checkDisplayFormula,
  dependenciesOf,
  referenceDisplayName,
  referencesOf,
  type Expression,
  type FormulaIssue,
  type RateReference,
  type ReferenceContext,
} from '../formula';

import { endsTooSoonMessage, FORMULA_TOO_LONG_MESSAGE, loopMessage, unknownNameMessage, validMessage } from './formula-words';

/**
 * The check of one edited formula (STORY-08.02; FR-022, FR-023, FR-073; SPEC section 8.2; architecture sections 4.5 and 6 "Formula check"): the text as the Admin typed it (display form) is read, turned into the stored form,
 * put in place of the field's formula in a copy of the current document, and the whole document's formulas are checked again for unknown names, syntax, scope and loops. Pure: the document and the rate list are
 * passed in, and nothing is stored or logged. The same function runs for the live check and again, on the server, when the Admin saves, so a client that skips the check cannot save a formula that fails it (AC-2).
 *
 * **No formula text is ever run as code** (AC-3): the text goes through the tokenizer and the Pratt parser of `lib/formula` and nothing else. `tests/unit/config/formula-editor-no-dynamic-code.test.ts` (and `tests/unit/formula/server-only.test.ts` for the whole tree) search the whole source tree for the two ways
 * JavaScript can run a string, and fails if either appears.
 *
 * The messages quote only what the Admin typed in this request (the unknown name, the character before the gap) and letters and labels of the registry. A formula that came from the registry is never quoted.
 */

/** The longest stored formula the registry schema accepts (`field-schema.ts`): it counts every stored reference to a field, which is longer than the letters it replaces. */
export const MAX_STORED_FORMULA_LENGTH = 2_000;

/** One thing the formula reads, as the editor lists it. */
export interface FormulaUse {
  readonly kind: 'field' | 'rate' | 'value';
  /** `P (Cutting Time)` for a field, the rate's name, or the name of a fixed operand of the Material Master or an exchange rate. */
  readonly name: string;
}

/** A field that reads the one being edited, so changing this formula changes it too ("Feeds", "Used by"). */
export interface FedField {
  readonly letter: string;
  readonly label: string;
}

export type FormulaEditCheck =
  | {
      readonly ok: true;
      /** The text to store. */
      readonly internalForm: string;
      /** The current document with this field's formula replaced (not yet validated by the registry schema). */
      readonly edited: ConfigDocument;
      readonly expression: Expression;
      readonly uses: ReadonlyArray<FormulaUse>;
      readonly feeds: ReadonlyArray<FedField>;
      readonly message: string;
    }
  | { readonly ok: false; readonly message: string };

/** A field whose formula the editor may change: an output that has one. A, F, I and BO have none. */
export function isFormulaField(field: FieldDefinition | undefined): field is OutputFieldDefinition & { readonly formula: string } {
  return field?.kind === 'output' && field.formula !== null;
}

/** The current document with one output field's formula replaced. Pure: a new document, the old one is not touched. */
export function withFormula(document: ConfigDocument, fieldId: string, internalForm: string): ConfigDocument {
  return { ...document, fields: document.fields.map((field) => (field.id === fieldId && field.kind === 'output' ? { ...field, formula: internalForm } : field)) };
}

/** The characters after which a number or a name must follow. */
const NEEDS_OPERAND_AFTER = /([+\-*/(,<>=])\s*$/;

/** The operator or bracket just before `position` (1-based) that left a gap, for "A number or name is missing after "+"". */
function gapAfter(text: string, position: number): string | null {
  return NEEDS_OPERAND_AFTER.exec(text.slice(0, position - 1))?.[1] ?? null;
}

function lettersOf(document: ConfigDocument, ids: ReadonlyArray<string>): string[] {
  return ids.map((id) => {
    const field = findFieldById(document, id);
    return field === undefined ? '?' : fieldLetter(field);
  });
}

/** The loop as the message names it: starting and ending at the edited field, "AL → AY → AL". */
function loopLetters(document: ConfigDocument, cycle: ReadonlyArray<string>, fieldId: string): string[] {
  const open = cycle.slice(0, -1);
  const start = Math.max(open.indexOf(fieldId), 0);
  const rotated = [...open.slice(start), ...open.slice(0, start)];
  return lettersOf(document, [...rotated, ...rotated.slice(0, 1)]);
}

/** A rate name has hyphens (`Invented-Rate-per-Unit`), and the reader stops at the first one, so the typed name is quoted whole: the word and every hyphen-joined word after it. */
const HYPHENATED_REST = /(?:-[A-Za-z_][A-Za-z0-9_]*)*/y;

function typedNameAt(text: string, start: number, length: number): string {
  HYPHENATED_REST.lastIndex = start + length;
  const rest = HYPHENATED_REST.exec(text)?.[0] ?? '';
  return text.slice(start, start + length + rest.length);
}

/** The sentence for a problem found while the text was read (it has a position in what was typed). */
function readingMessage(issue: FormulaIssue, text: string): string {
  const { position, length } = issue;
  if (position === undefined) return issue.message;
  if (issue.code === 'UNKNOWN_NAME' || issue.code === 'UNKNOWN_COLUMN' || issue.code === 'UNKNOWN_FUNCTION') {
    return unknownNameMessage(typedNameAt(text, position - 1, length ?? 1));
  }
  const atTheEnd = position - 1 >= text.trimEnd().length;
  const beforeBracket = text.charAt(position - 1) === ')' || text.charAt(position - 1) === ',';
  if (issue.code === 'UNEXPECTED_END' || (issue.code === 'EXPECTED_OPERAND' && (atTheEnd || beforeBracket))) {
    const after = gapAfter(text, position);
    if (after !== null) return endsTooSoonMessage(after, position);
  }
  return issue.message;
}

/** The sentence for a problem of the whole document (a loop or a scope rule) caused by this edit. */
function documentMessage(issue: FormulaIssue, document: ConfigDocument, field: FieldDefinition): string {
  if (issue.code === 'CYCLE' && issue.cycle !== undefined) return loopMessage(fieldLetter(field), loopLetters(document, issue.cycle, field.id));
  return issue.message;
}

/** The problems this edit causes: those of the field itself and the loops that run through it. A problem that was there before the edit is not blamed on it. */
function issuesOfEdit(issues: ReadonlyArray<FormulaIssue>, fieldId: string): FormulaIssue[] {
  return issues.filter((issue) => issue.fieldId === fieldId || issue.cycle?.includes(fieldId) === true);
}

function usesOf(expression: Expression, document: ConfigDocument, context: ReferenceContext): FormulaUse[] {
  const fields = dependenciesOf(expression).flatMap(({ fieldId }): FormulaUse[] => {
    const field = findFieldById(document, fieldId);
    return field === undefined ? [] : [{ kind: 'field', name: `${fieldLetter(field)} (${field.label})` }];
  });
  const named = new Map<string, FormulaUse>();
  for (const reference of referencesOf(expression)) {
    if (reference.kind === 'field') continue;
    const name = referenceDisplayName(reference, context);
    if (name !== undefined) named.set(name, { kind: reference.kind === 'rate' ? 'rate' : 'value', name });
  }
  return [...fields, ...named.values()];
}

function readsField(expression: Expression | undefined, fieldId: string): boolean {
  return expression !== undefined && dependenciesOf(expression).some((dependency) => dependency.fieldId === fieldId);
}

/** The fields whose formulas read this one, in column order. */
function feedsOf(fieldId: string, parsed: ReadonlyMap<string, Expression>, document: ConfigDocument): FedField[] {
  return [...document.fields]
    .sort((a, b) => a.position - b.position)
    .filter((candidate) => candidate.id !== fieldId && readsField(parsed.get(candidate.id), fieldId))
    .map((candidate) => ({ letter: fieldLetter(candidate), label: candidate.label }));
}

function useWords(use: FormulaUse): string {
  return use.kind === 'rate' ? `the rate ${use.name}` : use.name;
}

export interface FormulaEditInput {
  /** The current version's document. */
  readonly document: ConfigDocument;
  /** The Process Master rates, by ID and name. */
  readonly rates: ReadonlyArray<RateReference>;
  /** The field being edited. The caller has checked that it is a formula field (`isFormulaField`). */
  readonly fieldId: string;
  /** The formula as typed, in display form. */
  readonly text: string;
}

/** Checks one edited formula against the current document. Never throws for what a person typed. */
export function checkFormulaEdit({ document, rates, fieldId, text }: FormulaEditInput): FormulaEditCheck {
  const field = findFieldById(document, fieldId);
  if (!isFormulaField(field)) throw new Error('The field has no formula to check.');
  const context = referenceContext(document, rates);

  const read = checkDisplayFormula(text, context);
  if (!read.ok) return { ok: false, message: readingMessage(read.issue, text) };
  if (read.internalForm.length > MAX_STORED_FORMULA_LENGTH) return { ok: false, message: FORMULA_TOO_LONG_MESSAGE };

  const edited = withFormula(document, fieldId, read.internalForm);
  const analysis = analyzeConfiguration(edited.fields, { rateIds: new Set(rates.map((rate) => rate.id)) });
  const [first] = issuesOfEdit(analysis.issues, fieldId);
  if (first !== undefined) return { ok: false, message: documentMessage(first, edited, field) };

  const uses = usesOf(read.expression, edited, context);
  const feeds = feedsOf(fieldId, analysis.parsed, edited);
  return {
    ok: true,
    internalForm: read.internalForm,
    edited,
    expression: read.expression,
    uses,
    feeds,
    message: validMessage(uses.map(useWords), fieldLetter(field), feeds.map((fed) => fed.letter)),
  };
}
