import { describe, expect, it } from 'vitest';

import { toDisplayForm } from '@/lib/formula';

import { forbiddenStrings } from '../support/canary-masters';
import { displayFormOf } from '../support/formula-display';
import { seedConfig, SEED_PROCESS_ITEMS } from '../support/seed-config';

/**
 * STORY-01.03 QLT-05 (AC-3, "formula text"): the scan forbids a stored formula in the form a person would read it as well as in its
 * internal form. The engine's `toDisplayForm` is `server-only`, so the Playwright process that runs the scan uses the small copy in
 * `tests/support/formula-display.ts`; this test shows the copy equals the engine's output for every seed formula, so they cannot drift.
 */

const fields = seedConfig.fields;
const context = {
  positionOf: new Map(fields.map((field) => [field.id, field.position])),
  rateNameOf: new Map(SEED_PROCESS_ITEMS.map((item) => [item.id, item.name])),
};
const formulas = fields.flatMap((field) => (field.kind === 'output' && typeof field.formula === 'string' ? [field.formula] : []));

describe("the display form used by the scan equals the engine's (QLT-05)", () => {
  it('has the seed formulas to compare: 31 of the 32 outputs (the Approved Quote Price has none)', () => {
    expect(formulas).toHaveLength(31);
  });

  it.each(formulas)('%s', (formula) => {
    const expected = toDisplayForm(formula, { fieldIds: fields.map((field) => field.id), rates: SEED_PROCESS_ITEMS });
    expect(displayFormOf(formula, context)).toBe(expected);
  });

  it('shows what a careless view would print, with letters, rate names and the material and exchange operands', () => {
    const shown = formulas.map((formula) => displayFormOf(formula, context));
    expect(shown).toEqual(
      expect.arrayContaining(['P * Cutting-Rate-per-Sec', 'AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX', 'ExchangeRate-USD']),
    );
    expect(shown.some((text) => text.includes('Material-Specific-Gravity'))).toBe(true);
    expect(shown.some((text) => text.includes('{{'))).toBe(false);
  });

  it('leaves a reference it cannot resolve as it was, so the internal text stays findable', () => {
    expect(displayFormOf('{{f:unknown}} * {{rate:unknown}} * {{mat:unknown}}', context)).toBe('{{f:unknown}} * {{rate:unknown}} * {{mat:unknown}}');
  });
});

describe('the scan forbids both forms, and not a constant or a lone operand (QLT-05)', () => {
  const shown = formulas.map((formula) => displayFormOf(formula, context));
  const forbidden = forbiddenStrings([...formulas, ...shown]).map((entry) => entry.text);

  it('holds the internal form and the display form of a formula', () => {
    expect(forbidden).toContain('P * Cutting-Rate-per-Sec');
    expect(forbidden).toContain(formulas.find((formula) => formula.includes('{{rate:')) ?? '');
  });

  it('holds no constant and no one-token formula, which would match any digit or letter', () => {
    const lone = shown.filter((text) => !/\s/.test(text.trim()));
    expect(lone.length).toBeGreaterThan(0);
    for (const text of lone) expect(forbidden, text).not.toContain(text);
    expect(forbidden).not.toContain('0');
  });
});
