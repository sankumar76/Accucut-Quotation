import { describe, expect, it } from 'vitest';

import { rateUsesOf } from '@/lib/fields/rate-usage';

import { defined } from '../support/defined';
import { cloneSeedConfig, SEED_PROCESS_ITEMS, seedConfig } from '../support/seed-config';

/**
 * STORY-02.01 (AC-1, AC-4): which formulas use which rate, read from the stored text of the current configuration version. Pure; the
 * letter is derived from the field's position and the rate is the ID in `{{rate:<id>}}`.
 */

const idOf = (name: string): string => defined(SEED_PROCESS_ITEMS.find((item) => item.name === name)).id;

describe('rateUsesOf', () => {
  it('finds the formula of each seed rate that a seed formula uses, with its letter and label, and nothing for the one no formula uses', () => {
    const uses = rateUsesOf(seedConfig);
    expect(uses.get(idOf('Cutting-Rate-per-Sec'))).toEqual([{ letter: 'AL', label: 'Cutting Cost' }]);
    expect(uses.get(idOf('OH Profit %'))).toEqual([{ letter: 'BD', label: 'OH Profit' }]);
    expect(uses.get(idOf('Inspection & Packing %'))).toEqual([{ letter: 'BE', label: 'Inspection & Packing' }]);
    expect(uses.get(idOf('Plating-rate-per-sqin'))).toBeUndefined();
    // 14 of the 15 are used, each by exactly one formula.
    expect([...uses.values()].map((list) => list.length)).toEqual(new Array<number>(14).fill(1));
  });

  it('lists every formula that uses a rate, in column order, and a formula that uses it twice once', () => {
    const document = cloneSeedConfig();
    const cutting = idOf('Cutting-Rate-per-Sec');
    const fields = document.fields.map((field) => {
      if (field.kind !== 'output' || field.formula === null) return field;
      if (field.label === 'Bending Cost') return { ...field, formula: `${field.formula} + {{rate:${cutting}}} * {{rate:${cutting}}}` };
      return field;
    });
    expect(rateUsesOf({ ...document, fields }).get(cutting)).toEqual([
      { letter: 'AL', label: 'Cutting Cost' },
      { letter: 'AM', label: 'Bending Cost' },
    ]);
  });

  it('reads an ID written in capitals as the same rate, and ignores a field with no formula and a text that is not a rate reference', () => {
    const document = cloneSeedConfig();
    const capitals = 'ABCDEF00-0000-4000-8000-00000000000A';
    const fields = document.fields.map((field) => {
      if (field.kind !== 'output') return field;
      if (field.label === 'Bending Cost') return { ...field, formula: `{{rate:${capitals}}}` };
      if (field.label === 'Cutting Cost') return { ...field, formula: '{{f:00000000-0000-4000-8000-000000000001}} * {{rate:not-an-id}}' };
      return field;
    });
    const uses = rateUsesOf({ ...document, fields });
    expect(uses.get(capitals.toLowerCase())).toEqual([{ letter: 'AM', label: 'Bending Cost' }]);
    expect(uses.get(idOf('Cutting-Rate-per-Sec'))).toBeUndefined();
    // Approved Quote Price is entered, not calculated: it has no formula and so no use.
    expect([...uses.values()].flat().some((use) => use.label === 'Approved Quote Price')).toBe(false);
  });

  it('is derived from position: inserting a field before a formula moves its letter and nothing is stored', () => {
    const document = cloneSeedConfig();
    const moved = document.fields.map((field) => ({ ...field, position: field.position + 1 }));
    expect(rateUsesOf({ ...document, fields: moved }).get(idOf('Cutting-Rate-per-Sec'))).toEqual([{ letter: 'AM', label: 'Cutting Cost' }]);
  });
});
