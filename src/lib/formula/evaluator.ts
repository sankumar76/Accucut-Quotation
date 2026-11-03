import 'server-only';

import { assertNever } from '../assert-never';
import { add, Decimal, divide, multiply, negate, subtract, type Value } from '../decimal';
import type { ExchangeCurrency, MaterialOperandKey } from '../fields/types';

import type { BinaryOperator, Condition, Expression, FormulaReference } from './ast';
import { formatReference } from './internal-form';

/**
 * Evaluates a parsed formula over decimal.js (ADR-005). Pure: it reads every outside value through a
 * `Resolver` and does no I/O, so it can be tested with invented numbers and reused by the calculation service.
 *
 * `null` is "no figure" (a division by zero, A-07). It spreads through every operator, `MIN`, `MAX`, `ROUND`
 * and `SUM`, and a comparison with a `null` side has no answer, so `IF` returns `null`. Nothing here throws on
 * data, so one bad figure never stops the other outputs of its row (FR-026).
 */

/** Where the evaluator reads values. Built by the calculation service for one row (or one estimate). */
export interface Resolver {
  /**
   * The value of a field in the current context: this row for a row-scope field, the estimate for a
   * product-scope one. For a calculated field it is the result computed earlier in dependency order.
   */
  fieldValue(fieldId: string): Value;
  /** The stored value of a row-scope field in every row of the estimate, for `SUM`. */
  columnValues(fieldId: string): ReadonlyArray<Value>;
  /** A Process Master rate as a formula uses it: a percent rate is already divided by 100 (`rates.ts`). */
  rate(rateId: string): Value;
  /** A value of the Material Master row for the part's Material in Drawing. */
  material(key: MaterialOperandKey): Value;
  /** Rupees for 1 unit of the currency. */
  exchangeRate(currency: ExchangeCurrency): Value;
}

/**
 * What one evaluation read, at the precision it was stored with (not rounded), so a cost details view can print
 * a working that reproduces the result (AC-7, UX-01). Each reference appears once, in order of first use, and
 * only those on the path that was taken: the branch of an `IF` that did not run is not listed.
 */
export type OperandUse =
  | { readonly kind: 'value'; readonly reference: FormulaReference; readonly value: Value }
  | { readonly kind: 'sum'; readonly fieldId: string; readonly rowCount: number; readonly value: Value };

export interface Evaluation {
  readonly value: Value;
  readonly operands: ReadonlyArray<OperandUse>;
}

type Recorder = ((use: OperandUse) => void) | undefined;

function readReference(reference: FormulaReference, resolver: Resolver): Value {
  switch (reference.kind) {
    case 'field':
      return resolver.fieldValue(reference.id);
    case 'rate':
      return resolver.rate(reference.id);
    case 'material':
      return resolver.material(reference.key);
    case 'exchange':
      return resolver.exchangeRate(reference.currency);
    default:
      return assertNever(reference, 'reference');
  }
}

function applyBinary(operator: BinaryOperator, left: Value, right: Value): Value {
  switch (operator) {
    case '+':
      return add(left, right);
    case '-':
      return subtract(left, right);
    case '*':
      return multiply(left, right);
    case '/':
      return divide(left, right);
    default:
      return assertNever(operator, 'operator');
  }
}

/** The total of a column, or `null` if any row has no figure. An estimate with no rows totals 0. */
function sumOf(values: ReadonlyArray<Value>): Value {
  let total: Value = new Decimal(0);
  for (const value of values) total = add(total, value);
  return total;
}

/** The smallest or largest of the figures, or `null` if any has none. */
function extremeOf(values: ReadonlyArray<Value>, pick: (figures: Decimal[]) => Decimal): Value {
  const figures: Decimal[] = [];
  for (const value of values) {
    if (value === null) return null;
    figures.push(value);
  }
  return pick(figures);
}

/** Whether the comparison holds, or `null` if either side has no figure. */
function compare(condition: Condition, resolver: Resolver, record: Recorder): boolean | null {
  const left = evaluateNode(condition.left, resolver, record);
  const right = evaluateNode(condition.right, resolver, record);
  if (left === null || right === null) return null;
  switch (condition.operator) {
    case '>':
      return left.greaterThan(right);
    case '>=':
      return left.greaterThanOrEqualTo(right);
    case '<':
      return left.lessThan(right);
    case '<=':
      return left.lessThanOrEqualTo(right);
    case '=':
      return left.equals(right);
    case '<>':
      return !left.equals(right);
    default:
      return assertNever(condition.operator, 'comparison');
  }
}

function evaluateAll(args: ReadonlyArray<Expression>, resolver: Resolver, record: Recorder): Value[] {
  return args.map((argument) => evaluateNode(argument, resolver, record));
}

function evaluateReference(reference: FormulaReference, resolver: Resolver, record: Recorder): Value {
  const value = readReference(reference, resolver);
  record?.({ kind: 'value', reference, value });
  return value;
}

function evaluateSum(fieldId: string, resolver: Resolver, record: Recorder): Value {
  const values = resolver.columnValues(fieldId);
  const total = sumOf(values);
  record?.({ kind: 'sum', fieldId, rowCount: values.length, value: total });
  return total;
}

function evaluateIf(node: Extract<Expression, { kind: 'if' }>, resolver: Resolver, record: Recorder): Value {
  const holds = compare(node.condition, resolver, record);
  if (holds === null) return null;
  // Only the branch that is taken runs, so a division by zero in the other one never spreads.
  return evaluateNode(holds ? node.whenTrue : node.whenFalse, resolver, record);
}

function evaluateNode(node: Expression, resolver: Resolver, record: Recorder): Value {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'reference':
      return evaluateReference(node.reference, resolver, record);
    case 'negate':
      return negate(evaluateNode(node.operand, resolver, record));
    case 'binary':
      return applyBinary(node.operator, evaluateNode(node.left, resolver, record), evaluateNode(node.right, resolver, record));
    case 'sum':
      return evaluateSum(node.fieldId, resolver, record);
    case 'min':
      return extremeOf(evaluateAll(node.args, resolver, record), (figures) => Decimal.min(...figures));
    case 'max':
      return extremeOf(evaluateAll(node.args, resolver, record), (figures) => Decimal.max(...figures));
    case 'round': {
      const value = evaluateNode(node.value, resolver, record);
      return value === null ? null : value.toDecimalPlaces(node.places, Decimal.ROUND_HALF_UP);
    }
    case 'if':
      return evaluateIf(node, resolver, record);
    default:
      return assertNever(node, 'expression');
  }
}

/** The value of `expression`, or `null` where there is no figure. Never throws on data. */
export function evaluate(expression: Expression, resolver: Resolver): Value {
  return evaluateNode(expression, resolver, undefined);
}

/** The value and the working: every operand read on the path taken, at stored precision (AC-7). */
export function evaluateWithWorking(expression: Expression, resolver: Resolver): Evaluation {
  const used = new Map<string, OperandUse>();
  const record = (use: OperandUse): void => {
    const key = use.kind === 'sum' ? `sum:${use.fieldId}` : formatReference(use.reference);
    if (!used.has(key)) used.set(key, use);
  };
  const value = evaluateNode(expression, resolver, record);
  return { value, operands: [...used.values()] };
}

