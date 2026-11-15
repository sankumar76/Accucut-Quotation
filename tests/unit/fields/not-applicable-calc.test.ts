import { describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { calculateRowOutputs, type RowCalculationInput } from '@/lib/estimate/row-calculator';
import { storeRowOutputs, type StoredRowOutputs } from '@/lib/estimate/row-outputs';
import { compilePlan, extractReferences } from '@/lib/formula';
import { isNotApplicableName, NOT_APPLICABLE_NAME } from '@/lib/masters/system-entries';

import { defined } from '../../support/defined';
import { EXCHANGE, MATERIAL, NOT_APPLICABLE, ROW, TYPED_RATES } from '../../support/row-oracle';
import { SEED_PROCESS_ITEMS, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * STORY-02.06 AC-7 and AC-8 at library level (SPEC section 4.3, 4.5 and 7.4 O; architecture section 4.9; test strategy section 6, "FR-018, scrap"): a row with the
 * hidden "Not applicable" material goes through the evaluator with the seed formulas. Material cost AK, Blank Weight M and Scrap Weight O (the guard, so no
 * negative weight) are 0 while the Part Weight N is above 0, and the cost that does not depend on the material is as it is on an ordinary row. No seed formula
 * reads Treatment / Color (G), so the entry cannot change a figure. What a part stores of the words (`E` and `F` in `calculation_rows.inputs`) is held by
 * `tests/unit/calculation-record.test.ts`; the second half of AC-7 (the operands of `GET /nodes/{nodeId}/costs`) belongs to the story that builds that route.
 * Every value is invented (ADR-014).
 */

const plan = compilePlan(seedConfig.fields);
const idOf = (letter: string): string => seedFieldAt(letter).id;

function stored(material: { readonly pricePerKg: string; readonly specificGravity: string; readonly scrapRate: string }): StoredRowOutputs {
  const input: RowCalculationInput = {
    document: seedConfig,
    plan,
    inputs: new Map(Object.entries(ROW).map(([letter, text]) => [idOf(letter), new Decimal(text)])),
    rates: SEED_PROCESS_ITEMS.map((item) => ({ id: item.id, name: item.name, value: new Decimal(defined(TYPED_RATES[item.name], item.name)) })),
    material: { pricePerKg: new Decimal(material.pricePerKg), specificGravity: new Decimal(material.specificGravity), scrapRate: new Decimal(material.scrapRate) },
    exchange: { usd: new Decimal(EXCHANGE.usd), eur: new Decimal(EXCHANGE.eur) },
  };
  return storeRowOutputs(calculateRowOutputs(input));
}

const at = (outputs: StoredRowOutputs, letter: string): string | null => {
  const value = outputs[idOf(letter)];
  if (value === undefined) throw new Error(`The row has no output for ${letter}.`);
  return value;
};

describe('AC-7 (D-27): a row with the "Not applicable" material', () => {
  const row = stored(NOT_APPLICABLE);
  const ordinary = stored(MATERIAL);

  it('has a Part Weight above 0, so the guard is what keeps the Scrap Weight from going negative', () => {
    expect(new Decimal(defined(ROW['N'])).gt(0)).toBe(true);
    // Without the guard, O would be M - N = -N.
    expect(at(row, 'M')).toBe('0');
    expect(at(row, 'O')).toBe('0');
  });

  it('has a Material Cost AK of 0 (Material-Scrap-Rate is 0), where an ordinary material has a cost', () => {
    expect(at(row, 'AK')).toBe('0');
    expect(new Decimal(defined(at(ordinary, 'AK'))).gt(0)).toBe(true);
  });

  it('holds no negative weight anywhere in the row', () => {
    for (const letter of ['M', 'O']) expect(new Decimal(defined(at(row, letter))).gte(0), letter).toBe(true);
  });

  it('still counts the labour that depends on the Part Weight (AO, AQ, AS), as the same row with a real material does', () => {
    for (const letter of ['AO', 'AQ', 'AS', 'AY']) expect(at(row, letter), letter).toBe(at(ordinary, letter));
  });
});

describe('AC-7, AC-8: the words and the name', () => {
  it('the words a part shows are the ones the migration stores, and the name rule matches them in any spelling', () => {
    expect(NOT_APPLICABLE_NAME).toBe('Not applicable');
    for (const spelling of ['Not applicable', 'NOT APPLICABLE', ' not  applicable ', 'Not\tapplicable']) expect(isNotApplicableName(spelling), spelling).toBe(true);
    for (const other of ['Not applicable here', 'Not-applicable', 'Applicable', '', 'Other']) expect(isNotApplicableName(other), other).toBe(false);
  });

  it('AC-8: no seed formula reads Treatment / Color (G), so choosing "Not applicable" there changes no figure', () => {
    const treatment = seedFieldAt('G');
    for (const field of seedConfig.fields) {
      if (field.kind !== 'output' || field.formula === null) continue;
      const reads = extractReferences(field.formula).some((reference) => reference.kind === 'field' && reference.id === treatment.id);
      expect(reads, `${field.label} reads Treatment / Color`).toBe(false);
    }
  });
});
