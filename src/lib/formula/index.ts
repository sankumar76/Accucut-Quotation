import 'server-only';

/**
 * The formula engine's public surface (architecture section 10). Pure, server-only code: no I/O, no Next.js,
 * no Prisma. A client component cannot import it (ADR-008, NFR-002).
 */
export { dependenciesOf, referencesOf } from './ast';
export type { Condition, Dependency, Expression, FormulaReference } from './ast';
export { FORMULA_ISSUE_CODES, FormulaError } from './errors';
export type { FormulaIssue, FormulaIssueCode } from './errors';
export { evaluate, evaluateWithWorking } from './evaluator';
export type { Evaluation, OperandUse, Resolver } from './evaluator';
export { analyzeFormulas } from './graph';
export type { FormulaOrder, GraphAnalysis, GraphField, OrderedFormula } from './graph';
export { extractReferences, formatReference, referenceDisplayName, toDisplayForm, toInternalForm } from './internal-form';
export { MATERIAL_OPERAND_NAMES, MAX_FORMULA_LENGTH } from './names';
export type { RateReference, ReferenceContext } from './names';
export { parseFormula, parseTokens } from './parser';
export { compilePlan, createPlanCache, evaluateProductFormulas, evaluateRowFormulas, FormulaConfigurationError } from './plan';
export type { CompiledFormula, CompiledPlan, PlanCache } from './plan';
export { MAX_RATE_NAME_LENGTH, rateNameIssues } from './rate-names';
export { createRateLookup, formulaRateValue, isPercentRate } from './rates';
export type { RateValue } from './rates';
export { analyzeConfiguration, checkDisplayFormula, validateFormulas } from './validate';
export type { ConfigurationAnalysis, FormulaCheck, ValidatableField, ValidationOptions } from './validate';
