import { describe, expect, it } from 'vitest';

import { compilePlan, createPlanCache, type ValidatableField } from '@/lib/formula';

import { fieldAt } from '../../support/formula-fixtures';
import { SEED_PROCESS_ITEMS, seedConfig } from '../../support/seed-config';

/**
 * GitHub #432, DL-225 (architecture section 4.2, "The master snapshot keeps only the rates the plan references"): `referencedRateIds` is computed once by `compilePlan` and held on the plan. It is
 * every rate a row or product formula reads, each once, in order of first appearance over the row formulas and then the product formulas. A rate under `IF`, `MIN`, `MAX`, `ROUND` or a negation counts;
 * `SUM(column)` reads a field, never a rate. Invented IDs and formulas.
 */

const RATE_A = '00000000-0000-4000-8000-0bbb0000a001';
const RATE_B = '00000000-0000-4000-8000-0bbb0000a002';
const RATE_C = '00000000-0000-4000-8000-0bbb0000a003';
const RATE_D = '00000000-0000-4000-8000-0bbb0000a004';
const RATE_E = '00000000-0000-4000-8000-0bbb0000a005';
const RATE_F = '00000000-0000-4000-8000-0bbb0000a006';
const RATE_UNUSED = '00000000-0000-4000-8000-0bbb0000a0ff';

const rate = (id: string): string => `{{rate:${id}}}`;
const field = (letter: string): string => `{{f:${fieldAt(letter)}}}`;

function row(letter: string, position: number, formula: string): ValidatableField {
  return { id: fieldAt(letter), position, rowScope: 'row', kind: 'output', formula };
}

function product(letter: string, position: number, formula: string): ValidatableField {
  return { id: fieldAt(letter), position, rowScope: 'product', kind: 'output', formula };
}

const typed = (letter: string, position: number): ValidatableField => ({ id: fieldAt(letter), position, rowScope: 'row', kind: 'input' });

describe('referencedRateIds of a compiled plan (#432, architecture 4.2 test 1)', () => {
  it('lists each rate once, in order of first appearance over the row formulas', () => {
    const plan = compilePlan([
      typed('A', 1),
      row('B', 2, `${field('A')} * ${rate(RATE_B)} + ${rate(RATE_A)}`),
      row('C', 3, `${rate(RATE_A)} + ${rate(RATE_C)} + ${rate(RATE_B)}`),
    ]);
    expect(plan.referencedRateIds).toEqual([RATE_B, RATE_A, RATE_C]);
  });

  it('follows the evaluation order of the row formulas, not the field positions', () => {
    // C is placed before D but reads D, so D is evaluated first and its rate appears first.
    const plan = compilePlan([typed('A', 1), row('C', 2, `${field('D')} * ${rate(RATE_A)}`), row('D', 3, `${field('A')} + ${rate(RATE_B)}`)]);
    expect(plan.rowFormulas.map((formula) => formula.fieldId)).toEqual([fieldAt('D'), fieldAt('C')]);
    expect(plan.referencedRateIds).toEqual([RATE_B, RATE_A]);
  });

  it('puts the rates of the row formulas before those of the product formulas', () => {
    const plan = compilePlan([
      typed('A', 1),
      product('B', 2, `SUM(${field('C')}) * ${rate(RATE_A)}`),
      row('C', 3, `${field('A')} * ${rate(RATE_B)}`),
    ]);
    expect(plan.referencedRateIds).toEqual([RATE_B, RATE_A]);
  });

  it('includes a rate that only a product formula reads', () => {
    const plan = compilePlan([typed('A', 1), row('B', 2, `${field('A')} + 1`), product('C', 3, `SUM(${field('B')}) / ${rate(RATE_A)}`)]);
    expect(plan.referencedRateIds).toEqual([RATE_A]);
  });

  it('includes a rate that only an IF condition reads, and one in each branch', () => {
    const plan = compilePlan([
      typed('A', 1),
      row('B', 2, `IF(${rate(RATE_A)} > ${field('A')}, ${rate(RATE_B)}, ${rate(RATE_C)})`),
    ]);
    expect(plan.referencedRateIds).toEqual([RATE_A, RATE_B, RATE_C]);
  });

  it('includes a rate that only appears inside MIN, MAX or ROUND', () => {
    const plan = compilePlan([
      typed('A', 1),
      row('B', 2, `MIN(${field('A')}, ${rate(RATE_A)})`),
      row('C', 3, `MAX(${field('A')}, ${rate(RATE_B)})`),
      row('D', 4, `ROUND(${rate(RATE_C)}, 2)`),
    ]);
    expect(plan.referencedRateIds).toEqual([RATE_A, RATE_B, RATE_C]);
  });

  it('includes a rate that only appears under a negation', () => {
    const plan = compilePlan([typed('A', 1), row('B', 2, `-${rate(RATE_A)}`), row('C', 3, `${field('A')} * (-${rate(RATE_B)})`)]);
    expect(plan.referencedRateIds).toEqual([RATE_A, RATE_B]);
  });

  it('leaves out fields, materials, exchange rates and SUM, and a rate no formula reads', () => {
    const plan = compilePlan([
      typed('A', 1),
      row('B', 2, `${field('A')} * {{mat:pricePerKg}} + {{fx:USD}}`),
      product('C', 3, `SUM(${field('B')})`),
      row('D', 4, `${rate(RATE_D)} + 1`),
    ]);
    expect(plan.referencedRateIds).toEqual([RATE_D]);
    expect(plan.referencedRateIds).not.toContain(RATE_UNUSED);
  });

  it('is empty when no formula reads a rate', () => {
    const plan = compilePlan([typed('A', 1), row('B', 2, `${field('A')} + 1`), product('C', 3, `SUM(${field('B')})`)]);
    expect(plan.referencedRateIds).toEqual([]);
  });

  it('is the same list when the same version is compiled twice', () => {
    const fields = [typed('A', 1), row('B', 2, `${rate(RATE_E)} + ${rate(RATE_F)}`), product('C', 3, `SUM(${field('B')}) * ${rate(RATE_E)}`)];
    expect(compilePlan(fields).referencedRateIds).toEqual(compilePlan(fields).referencedRateIds);
  });

  it('is cached with the plan: the cache hands back the plan, and so the list, that it built once', () => {
    const cache = createPlanCache();
    const fields = [typed('A', 1), row('B', 2, `${rate(RATE_A)} + ${field('A')}`)];
    const first = cache.get('00000000-0000-4000-8000-0aaa0000c001', fields);
    expect(cache.get('00000000-0000-4000-8000-0aaa0000c001', fields).referencedRateIds).toBe(first.referencedRateIds);
  });
});

describe('referencedRateIds of the seed configuration', () => {
  const plan = compilePlan(seedConfig.fields);
  const seedIds = new Set(SEED_PROCESS_ITEMS.map((item) => item.id));

  it('holds only Process Master items of the seed, each once, and fewer than all of them (Plating-rate-per-sqin is read by no seed formula)', () => {
    expect(new Set(plan.referencedRateIds).size).toBe(plan.referencedRateIds.length);
    for (const id of plan.referencedRateIds) expect(seedIds.has(id), id).toBe(true);
    expect(plan.referencedRateIds.length).toBeGreaterThan(0);
    expect(plan.referencedRateIds.length).toBeLessThan(SEED_PROCESS_ITEMS.length);
    const plating = SEED_PROCESS_ITEMS.find((item) => item.name === 'Plating-rate-per-sqin');
    expect(plating).toBeDefined();
    expect(plan.referencedRateIds).not.toContain(plating?.id);
  });
});
