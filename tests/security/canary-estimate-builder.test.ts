import { describe, expect, it } from 'vitest';

import { Decimal, type Value } from '@/lib/decimal';
import { compilePlan, createRateLookup, evaluateProductFormulas, evaluateRowFormulas, type Resolver } from '@/lib/formula';

import { canaryMasters, SEED_RATE_SENTINELS } from '../support/canary-masters';
import {
  assertNoOutputEqualsInput,
  canaryEstimateInputs,
  CANARY_FLAG_KEYS,
  CANARY_NO_TYPED_VALUE_KEYS,
  findOutputsEqualToInputs,
} from '../support/canary-estimate-builder';
import { seedConfig } from '../support/seed-config';

/**
 * STORY-01.03 T7 (AC-7; test strategy section 6, "Typed values are allowed"): the canary estimate's inputs are chosen so that no
 * output equals a typed value. An Engineer sees what they typed, so a typed value in a response is no leak; an output that
 * happened to equal one would make the scan raise a false alarm. Estimates and calculations arrive in later stories, so the
 * builder is verified here on its own, against the real seed registry and the real formula engine, with the canary masters as
 * the rates, the material and the exchange rates (the sentinels a later scan seeds).
 */

const fields = seedConfig.fields;
const keyOfId = new Map(fields.map((field) => [field.id, field.key]));

function sentinelValue(kind: string, index = 0): Decimal {
  const found = canaryMasters.filter((sentinel) => sentinel.kind === kind)[index];
  if (found === undefined) throw new Error(`no ${kind} sentinel`);
  return new Decimal(found.value);
}

function numeric(text: string | undefined): Value {
  return text !== undefined && /^-?\d+(\.\d+)?$/.test(text) ? new Decimal(text) : null;
}

/** Calculates the one row of an estimate typed as `inputs`, and returns every output by field key. */
function calculate(inputs: Readonly<Record<string, string>>): Record<string, string | null> {
  const plan = compilePlan(fields);
  const rowResults = new Map<string, Value>();
  const typed = (fieldId: string): Value => {
    const key = keyOfId.get(fieldId);
    if (key === undefined) return null;
    // `material-rate-per-kg` is looked up from the Material Master: here, the canary price.
    return key === 'material-rate-per-kg' ? sentinelValue('material-price', 0) : numeric(inputs[key]);
  };
  const base: Resolver = {
    fieldValue: typed,
    columnValues: (fieldId) => [rowResults.get(fieldId) ?? typed(fieldId)],
    rate: createRateLookup(SEED_RATE_SENTINELS.map((rate) => ({ id: rate.id, name: rate.name, value: new Decimal(rate.value) }))),
    material: (key) => {
      switch (key) {
        case 'pricePerKg':
          return sentinelValue('material-price', 0);
        case 'specificGravity':
          return sentinelValue('specific-gravity');
        case 'scrapRate':
          return sentinelValue('scrap-rate');
      }
    },
    exchangeRate: (currency) => sentinelValue('exchange-rate', currency === 'USD' ? 0 : 1),
  };
  for (const [fieldId, value] of evaluateRowFormulas(plan, base)) rowResults.set(fieldId, value);
  const productResults = evaluateProductFormulas(plan, { ...base, fieldValue: (fieldId) => rowResults.get(fieldId) ?? typed(fieldId) });
  const outputs: Record<string, string | null> = {};
  for (const [fieldId, value] of [...rowResults, ...productResults]) {
    const key = keyOfId.get(fieldId);
    if (key !== undefined) outputs[key] = value === null ? null : value.toFixed();
  }
  return outputs;
}

const inputKeys = fields.filter((field) => field.kind === 'input').map((field) => field.key);

describe('the canary estimate builder (AC-7)', () => {
  it('types a value into every input field of the seed registry, and into no other (a new input field fails here until it is added)', () => {
    const built = Object.keys(canaryEstimateInputs()).sort();
    const expected = inputKeys.filter((key) => !CANARY_NO_TYPED_VALUE_KEYS.includes(key)).sort();
    expect(built).toEqual(expected);
  });

  it('types no zero and no empty value, and makes every number differ from every other (the flags excepted)', () => {
    const inputs = canaryEstimateInputs();
    for (const [key, text] of Object.entries(inputs)) {
      expect(text.trim(), key).not.toBe('');
      const value = numeric(text);
      if (value !== null) expect(value.isZero(), key).toBe(false);
    }
    const numbers = Object.entries(inputs).filter(([key, text]) => numeric(text) !== null && !CANARY_FLAG_KEYS.includes(key));
    const texts = numbers.map(([, text]) => new Decimal(text).toFixed());
    expect(new Set(texts).size).toBe(texts.length);
    for (const key of CANARY_FLAG_KEYS) expect(inputs[key], key).toBe('1');
  });

  it('gives a calculation with outputs that equal no typed value, under the canary masters (the rule, on the real seed formulas)', () => {
    const outputs = calculate(canaryEstimateInputs());
    // The control that the calculation really ran: the totals exist and are figures, not "no figure".
    for (const key of ['total-process-cost', 'cost-per-piece', 'unit-price', 'total-price']) expect(outputs[key], key).not.toBeNull();
    expect(Object.keys(outputs).length).toBeGreaterThan(25);
    expect(findOutputsEqualToInputs(canaryEstimateInputs(), outputs)).toEqual([]);
    expect(() => assertNoOutputEqualsInput(canaryEstimateInputs(), outputs)).not.toThrow();
  });

  it('can fail: an estimate with only Machining Cost set makes the process total equal it, and the rule says so', () => {
    const zeros = Object.fromEntries(
      Object.keys(canaryEstimateInputs()).map((key) => [key, numeric(canaryEstimateInputs()[key]) === null ? (canaryEstimateInputs()[key] ?? '') : '0']),
    );
    const onlyMachining = { ...zeros, 'machining-cost': '1234.5' };
    const outputs = calculate(onlyMachining);
    const collisions = findOutputsEqualToInputs(onlyMachining, outputs);
    expect(collisions).toEqual(expect.arrayContaining([expect.objectContaining({ outputKey: 'total-process-cost', inputKey: 'machining-cost' })]));
    expect(() => assertNoOutputEqualsInput(onlyMachining, outputs)).toThrow(/total-process-cost equals the typed machining-cost/);
  });

  it('compares numbers, not text: 2.50 equals 2.5, and a word equals nothing', () => {
    expect(findOutputsEqualToInputs({ a: '2.5', b: 'text' }, { x: '2.50', y: 'text', z: null })).toEqual([{ outputKey: 'x', inputKey: 'a', value: '2.5' }]);
  });

  it('compares the printed forms, as the scan matches them (QLT-07): an output that prints like a typed value, or sits inside one', () => {
    // 1234.499 prints to two decimals as 1234.50, which is the typed 1234.5.
    expect(findOutputsEqualToInputs({ machining: '1234.5' }, { total: '1234.499' })).toEqual([
      { outputKey: 'total', inputKey: 'machining', value: '1234.499' },
    ]);
    // 34.50 is found inside 1234.50 by a substring search.
    expect(findOutputsEqualToInputs({ machining: '1234.5' }, { total: '34.5' })).toHaveLength(1);
    // A typed value printed in Indian grouping (45,67,890.75) is found by an output of the same digits.
    expect(findOutputsEqualToInputs({ tool: '4567890.75' }, { total: '4567890.75' })).toHaveLength(1);
    expect(findOutputsEqualToInputs({ tool: '4567890.75' }, { total: '4567890.76' })).toEqual([]);
  });

  it('does not count an output too short to be a sentinel, which would match inside any number', () => {
    expect(findOutputsEqualToInputs({ cutting: '960.5' }, { rejection: '0', one: '1' })).toEqual([]);
  });
});
