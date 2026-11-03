import 'server-only';

import { assertNever } from '../assert-never';
import type { Decimal } from '../decimal';
import type { ExchangeCurrency, MaterialOperandKey } from '../fields/types';

/**
 * The shape of a parsed formula. Every operand is a stable reference, never a letter or a name, so a parsed
 * formula does not change when a field is re-lettered or a rate is renamed (ADR-004, architecture section 4.5).
 * A tree is plain immutable data and is shared by every evaluation of its compiled plan.
 */

export type FormulaReference =
  | { readonly kind: 'field'; readonly id: string }
  | { readonly kind: 'rate'; readonly id: string }
  | { readonly kind: 'material'; readonly key: MaterialOperandKey }
  | { readonly kind: 'exchange'; readonly currency: ExchangeCurrency };

export const BINARY_OPERATORS = ['+', '-', '*', '/'] as const;
export type BinaryOperator = (typeof BINARY_OPERATORS)[number];

/** The six comparisons, valid only as the condition of `IF` (SPEC section 8.2, architecture section 4.9). */
export const COMPARISON_OPERATORS = ['>', '>=', '<', '<=', '=', '<>'] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/** A comparison is not an expression: it has no value of its own, so it cannot be an operand or a result. */
export interface Condition {
  readonly operator: ComparisonOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export type Expression =
  | { readonly kind: 'number'; readonly value: Decimal }
  | { readonly kind: 'reference'; readonly reference: FormulaReference }
  | { readonly kind: 'negate'; readonly operand: Expression }
  | { readonly kind: 'binary'; readonly operator: BinaryOperator; readonly left: Expression; readonly right: Expression }
  /** `SUM(column)`: the total of one field over every row of the estimate. */
  | { readonly kind: 'sum'; readonly fieldId: string }
  | { readonly kind: 'min'; readonly args: ReadonlyArray<Expression> }
  | { readonly kind: 'max'; readonly args: ReadonlyArray<Expression> }
  | { readonly kind: 'round'; readonly value: Expression; readonly places: number }
  | { readonly kind: 'if'; readonly condition: Condition; readonly whenTrue: Expression; readonly whenFalse: Expression };

/** What a formula reads: one entry per reference, `aggregate` when it is read through `SUM` (across all rows). */
export interface Dependency {
  readonly fieldId: string;
  readonly aggregate: boolean;
}

function childrenOf(expression: Expression): ReadonlyArray<Expression> {
  switch (expression.kind) {
    case 'number':
    case 'reference':
    case 'sum':
      return [];
    case 'negate':
      return [expression.operand];
    case 'binary':
      return [expression.left, expression.right];
    case 'min':
    case 'max':
      return expression.args;
    case 'round':
      return [expression.value];
    case 'if':
      return [
        expression.condition.left,
        expression.condition.right,
        expression.whenTrue,
        expression.whenFalse,
      ];
    default:
      return assertNever(expression);
  }
}

/**
 * Every node of the tree, parent before children, left to right. Iterative, so a long chain such as
 * `1 + 1 + 1 + ...` cannot overflow the call stack.
 */
export function nodesOf(expression: Expression): Expression[] {
  const nodes: Expression[] = [];
  const pending: Expression[] = [expression];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    nodes.push(node);
    const children = childrenOf(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push(child);
    }
  }
  return nodes;
}

/** Every reference the formula reads, in order of appearance, with repeats. A `SUM` column is not included. */
export function referencesOf(expression: Expression): FormulaReference[] {
  const found: FormulaReference[] = [];
  for (const node of nodesOf(expression)) {
    if (node.kind === 'reference') found.push(node.reference);
  }
  return found;
}

/** The fields a formula reads, each once, and whether it reads the field in the same row or summed over all rows. */
export function dependenciesOf(expression: Expression): Dependency[] {
  const seen = new Set<string>();
  const found: Dependency[] = [];
  const add = (fieldId: string, aggregate: boolean): void => {
    const key = `${aggregate ? 'sum' : 'row'}:${fieldId}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ fieldId, aggregate });
  };
  for (const node of nodesOf(expression)) {
    if (node.kind === 'reference' && node.reference.kind === 'field') add(node.reference.id, false);
    if (node.kind === 'sum') add(node.fieldId, true);
  }
  return found;
}
