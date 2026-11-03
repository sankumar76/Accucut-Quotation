import 'server-only';

import { indexToColumnLetter } from '../columns';
import type { RowScope } from '../fields/types';

import { dependenciesOf, type Expression } from './ast';
import type { FormulaIssue } from './errors';

/**
 * The dependency graph of a configuration's formulas (SPEC section 8.2, FR-023; ADR-005; AC-4, AC-5).
 *
 * Fields are nodes; a formula that reads another field is an edge to it. From the graph this module:
 *
 * 1. refuses what the scope rule forbids (below),
 * 2. finds cycles and names the loop, and
 * 3. gives the evaluation order: dependencies first, row-scope formulas before product-scope ones.
 *
 * **Scope rule.** A row-scope field has one value per node (row); a product-scope field has one value per
 * estimate. So a row-scope formula may not read a product-scope field (the estimate is not known while a row is
 * being calculated) and may not use `SUM` (a total needs every row first); a product-scope formula reads a
 * row-scope field only through `SUM`, because "its value" would not say which row; and `SUM` adds up row values,
 * so its column must be row-scope.
 *
 * A loop is written with column letters taken from the fields' positions ("AL → AY → AL"): letters are column
 * labels, not formula text. Messages hold nothing else from a formula.
 */

export interface GraphField {
  readonly id: string;
  /** 1-based place in the registry; its column letter is derived from it. */
  readonly position: number;
  readonly rowScope: RowScope;
  /** The parsed formula, or `null` for a field that is typed in, looked up, or has no formula. */
  readonly expression: Expression | null;
}

/** A field's formula, ready to evaluate. */
export interface OrderedFormula {
  readonly fieldId: string;
  readonly expression: Expression;
}

export interface FormulaOrder {
  /** Fields with a row-scope formula, dependencies first. Evaluate once per row. */
  readonly rowOrder: ReadonlyArray<OrderedFormula>;
  /** Fields with a product-scope formula, dependencies first. Evaluate once per estimate, after every row. */
  readonly productOrder: ReadonlyArray<OrderedFormula>;
}

/** A field that has a formula: the only kind that is a node with edges and a place in the order. */
interface FormulaField extends GraphField {
  readonly expression: Expression;
}

function hasFormula(field: GraphField): field is FormulaField {
  return field.expression !== null;
}

export interface GraphAnalysis {
  readonly issues: ReadonlyArray<FormulaIssue>;
  /** `null` when a cycle was found, because no order exists. */
  readonly order: FormulaOrder | null;
}

function letterOf(field: Pick<GraphField, 'position'>): string {
  return indexToColumnLetter(field.position);
}

function scopeIssue(code: FormulaIssue['code'], message: string, field: GraphField): FormulaIssue {
  return { code, message, fieldId: field.id };
}

/** Problems with how one field's formula uses row and product scope. */
function scopeIssues(field: GraphField, byId: ReadonlyMap<string, GraphField>): FormulaIssue[] {
  if (field.expression === null) return [];
  const issues: FormulaIssue[] = [];
  const letter = letterOf(field);
  for (const { fieldId, aggregate } of dependenciesOf(field.expression)) {
    const target = byId.get(fieldId);
    if (target === undefined) continue;
    if (field.rowScope === 'row' && aggregate) {
      issues.push(scopeIssue('SUM_IN_ROW_FORMULA', `The formula of ${letter} is calculated per row and cannot use SUM, which needs every row.`, field));
    } else if (field.rowScope === 'row' && target.rowScope === 'product') {
      issues.push(scopeIssue('ROW_FORMULA_USES_PRODUCT_FIELD', `The formula of ${letter} is calculated per row and cannot read ${letterOf(target)}, which has one value per estimate.`, field));
    } else if (aggregate && target.rowScope === 'product') {
      issues.push(scopeIssue('SUM_OF_PRODUCT_FIELD', `The formula of ${letter} adds up ${letterOf(target)} over the rows, but ${letterOf(target)} has one value per estimate.`, field));
    } else if (field.rowScope === 'product' && !aggregate && target.rowScope === 'row') {
      issues.push(scopeIssue('PRODUCT_FORMULA_USES_ROW_FIELD', `The formula of ${letter} has one value per estimate and can read ${letterOf(target)}, which has a value per row, only through SUM.`, field));
    }
  }
  return issues;
}

/** The formula fields that `field` reads, in position order so the walk below is the same every time. */
function neighbours(field: FormulaField, byId: ReadonlyMap<string, GraphField>): FormulaField[] {
  const targets = new Map<string, FormulaField>();
  for (const { fieldId } of dependenciesOf(field.expression)) {
    const target = byId.get(fieldId);
    if (target !== undefined && hasFormula(target)) targets.set(target.id, target);
  }
  return [...targets.values()].sort((a, b) => a.position - b.position);
}

function cycleIssue(loop: ReadonlyArray<FormulaField>): FormulaIssue {
  const first = loop[0];
  const letters = loop.map(letterOf).join(' → ');
  return {
    code: 'CYCLE',
    message: `These fields refer to each other in a loop: ${letters}.`,
    ...(first === undefined ? {} : { fieldId: first.id }),
    cycle: loop.map((field) => field.id),
  };
}

interface Walk {
  readonly byId: ReadonlyMap<string, GraphField>;
  readonly state: Map<string, 'visiting' | 'done'>;
  readonly path: FormulaField[];
  /** Every formula field after all of the fields it reads, in the order they were finished. */
  readonly finished: FormulaField[];
  readonly loops: FormulaField[][];
}

function visit(field: FormulaField, walk: Walk): void {
  walk.state.set(field.id, 'visiting');
  walk.path.push(field);
  for (const target of neighbours(field, walk.byId)) {
    const state = walk.state.get(target.id);
    if (state === 'visiting') {
      const start = walk.path.findIndex((member) => member.id === target.id);
      walk.loops.push([...walk.path.slice(start), target]);
    } else if (state === undefined) {
      visit(target, walk);
    }
  }
  walk.path.pop();
  walk.state.set(field.id, 'done');
  walk.finished.push(field);
}

/** The formulas of one scope, in the order they were finished. */
function formulasOfScope(finished: ReadonlyArray<FormulaField>, scope: RowScope): OrderedFormula[] {
  return finished.filter((field) => field.rowScope === scope).map((field) => ({ fieldId: field.id, expression: field.expression }));
}

/**
 * Checks the scope rule, finds cycles and orders the formulas. Fields that are not in `fields` are ignored here
 * (a reference to a missing field is reported by `validate.ts`).
 */
export function analyzeFormulas(fields: ReadonlyArray<GraphField>): GraphAnalysis {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  const issues = ordered.flatMap((field) => scopeIssues(field, byId));

  const walk: Walk = { byId, state: new Map(), path: [], finished: [], loops: [] };
  for (const field of ordered) {
    if (hasFormula(field) && !walk.state.has(field.id)) visit(field, walk);
  }
  issues.push(...walk.loops.map(cycleIssue));

  if (walk.loops.length > 0) return { issues, order: null };
  return {
    issues,
    order: { rowOrder: formulasOfScope(walk.finished, 'row'), productOrder: formulasOfScope(walk.finished, 'product') },
  };
}
