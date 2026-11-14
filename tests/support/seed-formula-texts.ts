import { displayFormOf } from './formula-display';
import { seedConfig, SEED_PROCESS_ITEMS } from './seed-config';

/**
 * Every seed formula as the confidentiality scan forbids it (STORY-01.03 QLT-05, STORY-08.01 AC-5): in the stored form (`{{f:...}}`, `{{rate:...}}`) and in the form a person reads it
 * (letters and rate names). The scan's forbidden list takes these through `forbiddenStrings(formulaTexts)`, so a route or page an Engineer can reach that sent a formula in either form
 * fails the test that scans it. The e2e scan reads the same two forms from the database it runs against (`readFormulaTexts` in `tests/e2e/support/auth.ts`).
 */
export function seedFormulaTexts(): ReadonlyArray<string> {
  const stored = seedConfig.fields.flatMap((field) => (field.kind === 'output' && field.formula !== null ? [field.formula] : []));
  const context = {
    positionOf: new Map(seedConfig.fields.map((field) => [field.id, field.position])),
    rateNameOf: new Map(SEED_PROCESS_ITEMS.map((item) => [item.id, item.name])),
  };
  return [...stored, ...stored.map((formula) => displayFormOf(formula, context))];
}
