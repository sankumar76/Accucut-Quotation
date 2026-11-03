import 'server-only';

import type { Value } from '../decimal';
import { ValidationError } from '../errors';

import type { FormulaIssue } from './errors';
import { evaluate, type Resolver } from './evaluator';
import type { OrderedFormula } from './graph';
import { analyzeConfiguration, type ValidatableField, type ValidationOptions } from './validate';

/**
 * The compiled plan: every formula of one configuration version, parsed once and listed in the order they must
 * be evaluated (architecture section 4.2; FR-023; AC-4, AC-9).
 *
 * Row-scope formulas come first, each after the fields it reads, and are evaluated once per node. Product-scope
 * formulas come after, evaluated once per estimate when every row is done. A version never changes, so a plan
 * built for its ID is never stale and the cache below has nothing to invalidate.
 */

/** One field's parsed formula, in its place in the plan. */
export type CompiledFormula = OrderedFormula;

export interface CompiledPlan {
  readonly rowFormulas: ReadonlyArray<CompiledFormula>;
  readonly productFormulas: ReadonlyArray<CompiledFormula>;
}

const MAX_LISTED_ISSUES = 5;

/** The configuration's formulas cannot be compiled. Lists rules and places, never formula text. */
export class FormulaConfigurationError extends ValidationError {
  readonly issues: ReadonlyArray<FormulaIssue>;

  constructor(issues: ReadonlyArray<FormulaIssue>) {
    const listed = issues
      .slice(0, MAX_LISTED_ISSUES)
      .map((issue) => issue.message)
      .join(' ');
    const more = issues.length > MAX_LISTED_ISSUES ? ` (and ${issues.length - MAX_LISTED_ISSUES} more)` : '';
    super(`The formulas of this configuration are not valid. ${listed}${more}`, { code: 'FORMULA_CONFIGURATION_INVALID' });
    this.issues = issues;
  }
}

/**
 * Parses and orders the formulas of a configuration. Throws `FormulaConfigurationError` if any is invalid, so a
 * plan always describes a configuration that passed `validateFormulas`.
 */
export function compilePlan(fields: ReadonlyArray<ValidatableField>, options: ValidationOptions = {}): CompiledPlan {
  const { issues, order } = analyzeConfiguration(fields, options);
  if (issues.length > 0 || order === null) throw new FormulaConfigurationError(issues);
  return { rowFormulas: order.rowOrder, productFormulas: order.productOrder };
}

/** Plans held in memory. A version is immutable, so this only bounds memory (architecture section 4.2). */
export const MAX_CACHED_PLANS = 16;

export interface PlanCache {
  /** The plan for this configuration version, compiled on the first call and reused after. */
  get(versionId: string, fields: ReadonlyArray<ValidatableField>): CompiledPlan;
  size(): number;
}

/**
 * A cache of compiled plans by `config_versions.id`. Drops the oldest plan first once full. `compile` is
 * injectable so a test can count how often a plan is built.
 */
export function createPlanCache(
  compile: (fields: ReadonlyArray<ValidatableField>) => CompiledPlan = (fields) => compilePlan(fields),
  maxEntries: number = MAX_CACHED_PLANS,
): PlanCache {
  const plans = new Map<string, CompiledPlan>();
  return {
    get(versionId, fields) {
      const cached = plans.get(versionId);
      if (cached !== undefined) return cached;
      const plan = compile(fields);
      plans.set(versionId, plan);
      for (const oldest of plans.keys()) {
        if (plans.size <= maxEntries) break;
        plans.delete(oldest);
      }
      return plan;
    },
    size: () => plans.size,
  };
}

/** A resolver that answers `fieldValue` from the results computed so far, and everything else from `base`. */
function withResults(base: Resolver, results: ReadonlyMap<string, Value>): Resolver {
  return {
    fieldValue(fieldId) {
      const computed = results.get(fieldId);
      return computed === undefined ? base.fieldValue(fieldId) : computed;
    },
    columnValues: (fieldId) => base.columnValues(fieldId),
    rate: (rateId) => base.rate(rateId),
    material: (key) => base.material(key),
    exchangeRate: (currency) => base.exchangeRate(currency),
  };
}

function evaluateInOrder(formulas: ReadonlyArray<CompiledFormula>, base: Resolver): Map<string, Value> {
  const results = new Map<string, Value>();
  const resolver = withResults(base, results);
  for (const { fieldId, expression } of formulas) results.set(fieldId, evaluate(expression, resolver));
  return results;
}

/**
 * Every row-scope output of one node, in dependency order. `base.fieldValue` supplies the node's typed and
 * looked-up values; a calculated field is read from the results already computed, so a later formula sees an
 * earlier one's value. A `null` result (no figure) is kept and the next formula still runs (FR-026).
 */
export function evaluateRowFormulas(plan: CompiledPlan, base: Resolver): ReadonlyMap<string, Value> {
  return evaluateInOrder(plan.rowFormulas, base);
}

/**
 * Every product-scope output of the estimate, in dependency order. Call it after every row is evaluated:
 * `base.columnValues` must return the rows' results for `SUM`.
 */
export function evaluateProductFormulas(plan: CompiledPlan, base: Resolver): ReadonlyMap<string, Value> {
  return evaluateInOrder(plan.productFormulas, base);
}
