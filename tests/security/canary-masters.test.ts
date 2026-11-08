import { describe, expect, it } from 'vitest';

import { PROCESS_MASTER_CANARIES, PROCESS_MASTER_CANARY_VALUES } from '../support/process-master-canary';
import { SEED_PROCESS_ITEMS } from '../support/seed-config';
import {
  canaryMasters,
  forbiddenStrings,
  indianGrouping,
  PROCESS_CANARY_RATES,
  SEED_RATE_SENTINELS,
  SENTINEL_PATTERN,
  variantsOf,
  westernGrouping,
  type RestrictedKind,
} from '../support/canary-masters';

/**
 * STORY-01.03 T1 (AC-3, AC-6; SPEC section 14.1): `canaryMasters` gives every Restricted value of the product a unique,
 * invented sentinel with a rare digit pattern, and the forbidden list holds each in the three forms a screen can print (plain
 * digits, Indian grouping, two decimals) plus the rate names and formula markers.
 */

const RESTRICTED_KINDS: ReadonlyArray<RestrictedKind> = ['process-rate', 'customer-rate', 'material-price', 'specific-gravity', 'scrap-rate', 'exchange-rate'];

describe('canaryMasters (AC-3)', () => {
  it('has a sentinel for every kind of Restricted value: process rate, customer rate, material price, specific gravity, scrap rate, exchange rate', () => {
    for (const kind of RESTRICTED_KINDS) expect(canaryMasters.filter((sentinel) => sentinel.kind === kind).length, kind).toBeGreaterThan(0);
  });

  it('makes every sentinel unique, so finding one says which value leaked', () => {
    const values = canaryMasters.map((sentinel) => sentinel.value);
    expect(new Set(values).size).toBe(values.length);
    const labels = canaryMasters.map((sentinel) => sentinel.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every sentinel the rare pattern: three or more digits, then .37 or .73', () => {
    for (const sentinel of canaryMasters) expect(sentinel.value, sentinel.label).toMatch(SENTINEL_PATTERN);
  });

  it('gives every one of the 15 seed process rates a sentinel of its own, Plating-rate-per-sqin included', () => {
    expect(SEED_RATE_SENTINELS.map((rate) => rate.name)).toEqual(SEED_PROCESS_ITEMS.map((item) => item.name));
    expect(SEED_RATE_SENTINELS.map((rate) => rate.name)).toContain('Plating-rate-per-sqin');
    for (const rate of SEED_RATE_SENTINELS) expect(canaryMasters.map((sentinel) => sentinel.value)).toContain(rate.value);
  });

  it('keeps every sentinel large enough not to be a small number a screen prints for another reason', () => {
    for (const sentinel of canaryMasters) expect(Number(sentinel.value), sentinel.label).toBeGreaterThanOrEqual(100);
  });

  it("takes the Process Master values from STORY-02.01's one definition, not a second copy (AQP-57 comment 11141)", () => {
    const processValues = canaryMasters.filter((sentinel) => sentinel.kind === 'process-rate').map((sentinel) => sentinel.value);
    expect(processValues).toEqual(expect.arrayContaining([...PROCESS_MASTER_CANARY_VALUES]));
    // The name and values of that file are all forbidden here, verbatim.
    const forbidden = forbiddenStrings().map((entry) => entry.text);
    for (const canary of PROCESS_MASTER_CANARIES) expect(forbidden).toContain(canary);
  });

  it('names three Process Master canary rates, the first with the name STORY-02.01 defines, and every name starts with it', () => {
    expect(PROCESS_CANARY_RATES).toHaveLength(PROCESS_MASTER_CANARY_VALUES.length);
    const names = PROCESS_CANARY_RATES.map((rate) => rate.name);
    expect(new Set(names).size).toBe(names.length);
    const prefix = PROCESS_MASTER_CANARIES[0] ?? '';
    for (const name of names) expect(name.startsWith(prefix)).toBe(true);
  });
});

describe('the forms a number takes (AC-3)', () => {
  it('Indian grouping: the last three digits, then pairs', () => {
    expect(indianGrouping('9173737.73')).toBe('91,73,737.73');
    expect(indianGrouping('917373.37')).toBe('9,17,373.37');
    expect(indianGrouping('91737.37')).toBe('91,737.37');
    expect(indianGrouping('771.37')).toBe('771.37');
    expect(indianGrouping('123456789.37')).toBe('12,34,56,789.37');
  });

  it('grouping of three, for a number printed the usual way', () => {
    expect(westernGrouping('9173737.73')).toBe('9,173,737.73');
    expect(westernGrouping('771.37')).toBe('771.37');
  });

  it('lists plain digits, two decimals and both groupings once each', () => {
    const forms = variantsOf('9173737.73');
    expect(forms.map((entry) => entry.text)).toEqual(['9173737.73', '91,73,737.73', '9,173,737.73']);
    expect(forms.map((entry) => entry.form)).toEqual(['plain digits', 'Indian grouping', 'grouping of three']);
    // A value with one decimal is also found as the two-decimal form a screen prints.
    expect(variantsOf('771.3').map((entry) => entry.text)).toContain('771.30');
  });
});

describe('the forbidden list (AC-3)', () => {
  const forbidden = forbiddenStrings().map((entry) => entry.text);

  it('holds every sentinel in plain digits, in Indian grouping and in two-decimal form', () => {
    for (const sentinel of canaryMasters) {
      for (const form of variantsOf(sentinel.value)) expect(forbidden, `${sentinel.label}: ${form.form}`).toContain(form.text);
    }
    expect(forbidden).toContain('91,73,737.73');
  });

  it('holds the 15 seed rate names, Material-Price, the formula markers, and the other operand names', () => {
    for (const item of SEED_PROCESS_ITEMS) expect(forbidden).toContain(item.name);
    for (const text of ['Plating-rate-per-sqin', 'Material-Price', 'Material-Specific-Gravity', 'Material-Scrap-Rate', '{{f:', '{{rate:', '{{mat:']) {
      expect(forbidden).toContain(text);
    }
  });

  it('holds the formula text it is given, and no empty string and no repeat', () => {
    const withFormula = forbiddenStrings(['{{f:aaaaaaaa-0000-4000-8000-000000000001}}*{{rate:bbbbbbbb-0000-4000-8000-000000000002}}']).map(
      (entry) => entry.text,
    );
    expect(withFormula).toContain('{{f:aaaaaaaa-0000-4000-8000-000000000001}}*{{rate:bbbbbbbb-0000-4000-8000-000000000002}}');
    expect(withFormula).not.toContain('');
    expect(new Set(withFormula).size).toBe(withFormula.length);
  });

  it('does not hold plain words such as "cost", which the About page may say (SCR-24, FR-010)', () => {
    for (const word of ['cost', 'Cost', 'rate', 'price', 'Machining Cost', 'Plating Cost', 'Tool Cost']) expect(forbidden).not.toContain(word);
  });

  it('forbids nothing an Engineer types: no typed value of the canary estimate is on the list (FR-008)', async () => {
    const { canaryEstimateInputs } = await import('../support/canary-estimate-builder');
    for (const typed of Object.values(canaryEstimateInputs())) expect(forbidden, typed).not.toContain(typed);
  });
});
