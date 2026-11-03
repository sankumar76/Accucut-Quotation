import 'server-only';

import type { FieldKind, RowScope } from '../fields/types';

import { nodesOf, type Expression } from './ast';
import { FormulaError, type FormulaIssue } from './errors';
import { analyzeFormulas, type FormulaOrder, type GraphField } from './graph';
import { toInternalForm } from './internal-form';
import type { ReferenceContext } from './names';
import { parseFormula } from './parser';

/**
 * Save-time validation (SPEC section 8.2; FR-023; AC-5): "unknown column letters or rate names, syntax errors and
 * cycles block the save, with a clear message".
 *
 * Two entry points, for the two moments an Admin's edit passes through:
 *
 * - `checkDisplayFormula`: one formula as typed, in display form. Unknown names, bad characters and syntax errors
 *   are found here, with their character position. If it passes, the caller stores `internalForm`.
 * - `validateFormulas`: the stored formulas of a whole configuration, in internal form. A reference to a field
 *   that does not exist, a syntax error, a cycle and a breach of the scope rule are found here.
 *
 * Messages hold no text from a formula (see `errors.ts`).
 */

/** The part of a registry field that validation reads. A `FieldDefinition` of the document schema fits. */
export interface ValidatableField {
  readonly id: string;
  readonly position: number;
  readonly rowScope: RowScope;
  readonly kind: FieldKind;
  /** The stored (internal form) formula; only an output field has one. */
  readonly formula?: string | null;
}

export interface ValidationOptions {
  /**
   * The IDs of the Process Master rates that exist. When given, a formula that refers to another rate is
   * refused. The registry document does not hold rates, so a caller that has them passes them.
   */
  readonly rateIds?: ReadonlySet<string>;
  /** Reads one stored formula. Defaults to the internal-form parser; a test passes a counting one. */
  readonly parse?: (text: string) => Expression;
}

export interface ConfigurationAnalysis {
  readonly issues: ReadonlyArray<FormulaIssue>;
  /** Each formula that could be read, by field ID. */
  readonly parsed: ReadonlyMap<string, Expression>;
  /** `null` when there is a cycle. */
  readonly order: FormulaOrder | null;
}

function parseStored(text: string): Expression {
  return parseFormula(text, { form: 'internal' });
}

/** References in a parsed formula that point at nothing. */
function unresolvedReferences(fieldId: string, expression: Expression, ids: ReadonlySet<string>, options: ValidationOptions): FormulaIssue[] {
  const issues: FormulaIssue[] = [];
  for (const node of nodesOf(expression)) {
    const missingField =
      (node.kind === 'reference' && node.reference.kind === 'field' && !ids.has(node.reference.id)) ||
      (node.kind === 'sum' && !ids.has(node.fieldId));
    if (missingField) {
      issues.push({ code: 'BAD_FIELD_REFERENCE', message: 'A formula refers to a field that is not in the registry.', fieldId });
    }
    if (node.kind === 'reference' && node.reference.kind === 'rate' && options.rateIds !== undefined && !options.rateIds.has(node.reference.id)) {
      issues.push({ code: 'UNKNOWN_RATE', message: 'A formula refers to a rate that is not in the Process Master.', fieldId });
    }
  }
  return issues;
}

/** Reads every stored formula, once. Returns what could be read and the problems with the rest. */
function readFormulas(fields: ReadonlyArray<ValidatableField>, parse: (text: string) => Expression): { parsed: Map<string, Expression>; issues: FormulaIssue[] } {
  const parsed = new Map<string, Expression>();
  const issues: FormulaIssue[] = [];
  for (const field of fields) {
    if (field.kind !== 'output' || typeof field.formula !== 'string') continue;
    try {
      parsed.set(field.id, parse(field.formula));
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      issues.push({ ...error.issue, fieldId: field.id });
    }
  }
  return { parsed, issues };
}

/**
 * Reads, resolves and orders the stored formulas of a configuration. `parsed` and `order` are what a compiled
 * plan is built from, so the formulas are parsed here only once.
 */
export function analyzeConfiguration(fields: ReadonlyArray<ValidatableField>, options: ValidationOptions = {}): ConfigurationAnalysis {
  const { parsed, issues } = readFormulas(fields, options.parse ?? parseStored);
  const ids = new Set(fields.map((field) => field.id));
  for (const [fieldId, expression] of parsed) issues.push(...unresolvedReferences(fieldId, expression, ids, options));

  const graphFields: GraphField[] = fields.map((field) => ({
    id: field.id,
    position: field.position,
    rowScope: field.rowScope,
    expression: parsed.get(field.id) ?? null,
  }));
  const graph = analyzeFormulas(graphFields);
  return { issues: [...issues, ...graph.issues], parsed, order: graph.order };
}

/** Every problem in the stored formulas of a configuration. Empty means they can be saved. */
export function validateFormulas(fields: ReadonlyArray<ValidatableField>, options: ValidationOptions = {}): FormulaIssue[] {
  return [...analyzeConfiguration(fields, options).issues];
}

export type FormulaCheck =
  | { readonly ok: true; readonly internalForm: string; readonly expression: Expression }
  | { readonly ok: false; readonly issue: FormulaIssue };

/**
 * Checks one formula as the Admin typed it. If it is valid, `internalForm` is the text to store. Otherwise
 * `issue` says what is wrong and where; for an unknown name it also carries the name, for the editor to show.
 */
export function checkDisplayFormula(displayForm: string, context: ReferenceContext): FormulaCheck {
  try {
    const expression = parseFormula(displayForm, { form: 'display', context });
    return { ok: true, internalForm: toInternalForm(displayForm, context), expression };
  } catch (error) {
    if (error instanceof FormulaError) return { ok: false, issue: error.issue };
    throw error;
  }
}
