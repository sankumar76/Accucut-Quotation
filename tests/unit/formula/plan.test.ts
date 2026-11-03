import { describe, expect, it } from 'vitest';

import { Decimal, type Value } from '@/lib/decimal';
import {
  compilePlan,
  createPlanCache,
  evaluateProductFormulas,
  evaluateRowFormulas,
  FormulaConfigurationError,
  parseFormula,
  referencesOf,
  type CompiledPlan,
  type Resolver,
  type ValidatableField,
} from '@/lib/formula';

import { defined } from '../../support/defined';
import { d, fieldAt, show } from '../../support/formula-fixtures';
import { seedConfig } from '../../support/seed-config';
import { thrownAs } from '../../support/thrown';

/**
 * AC-4 (order of evaluation), AC-3 (the other outputs of a row survive a division by zero) and AC-9 (a plan is
 * built once per configuration version and reused; a test counts parses). Invented fields and numbers.
 */

/** Stored formula text with the test fields' IDs: `[C]` stands for the ID of column C. */
function stored(text: string): string {
  return text.replace(/\[([A-Z]+)\]/g, (_match, letter: string) => `{{f:${fieldAt(letter)}}}`);
}

function output(letter: string, position: number, scope: 'row' | 'product', formula: string): ValidatableField {
  return { id: fieldAt(letter), position, rowScope: scope, kind: 'output', formula: stored(formula) };
}

function input(letter: string, position: number): ValidatableField {
  return { id: fieldAt(letter), position, rowScope: 'row', kind: 'input' };
}

/**
 * A, B and F are inputs. C reads D and D reads A and B, so D must be calculated first although C sits earlier.
 * E divides by F. G reads only A. H reads E. I sums D over the rows and J divides I by the sum of A.
 */
const SMALL: ReadonlyArray<ValidatableField> = [
  input('A', 1),
  input('B', 2),
  output('C', 3, 'row', '[D] * 2'),
  output('D', 4, 'row', '[A] + [B]'),
  output('E', 5, 'row', '[A] / [F]'),
  input('F', 6),
  output('G', 7, 'row', '[A] + 1'),
  output('H', 8, 'row', '[E] + 1'),
  output('I', 9, 'product', 'SUM([D])'),
  output('J', 10, 'product', '[I] / SUM([A])'),
];

/** One row's resolver: the typed values of A, B and F, with the product-level results added for the second phase. */
function rowResolver(typed: Readonly<Record<string, string>>, columns: Readonly<Record<string, ReadonlyArray<Value>>> = {}): Resolver {
  return {
    fieldValue: (fieldId) => {
      const entry = Object.entries(typed).find(([letter]) => fieldAt(letter) === fieldId);
      return entry === undefined ? null : d(entry[1]);
    },
    columnValues: (fieldId) => Object.entries(columns).find(([letter]) => fieldAt(letter) === fieldId)?.[1] ?? [],
    rate: () => null,
    material: () => null,
    exchangeRate: () => null,
  };
}

const idOfLetter = (letter: string): string => fieldAt(letter);

describe('the compiled plan (AC-4)', () => {
  it('AC-4: lists row formulas apart from product formulas, each after the fields it reads', () => {
    const plan = compilePlan(SMALL);
    expect(plan.rowFormulas.map((formula) => formula.fieldId)).toEqual(['D', 'C', 'E', 'G', 'H'].map(idOfLetter));
    expect(plan.productFormulas.map((formula) => formula.fieldId)).toEqual(['I', 'J'].map(idOfLetter));
  });

  it('AC-4: the seed plan has 29 row formulas and 2 product formulas, and every formula comes after what it reads', () => {
    const plan = compilePlan(seedConfig.fields);
    expect(plan.rowFormulas).toHaveLength(29);
    expect(plan.productFormulas).toHaveLength(2);
    const position = new Map(plan.rowFormulas.map((formula, index) => [formula.fieldId, index]));
    for (const formula of plan.rowFormulas) {
      for (const reference of referencesOf(formula.expression)) {
        if (reference.kind !== 'field') continue;
        const readAt = position.get(reference.id);
        if (readAt !== undefined) expect(readAt).toBeLessThan(defined(position.get(formula.fieldId)));
      }
    }
  });

  it('AC-4: refuses a configuration with a problem and lists the rules without any formula text', () => {
    const broken = [...SMALL, output('K', 11, 'row', '[K] + 1')];
    const error = thrownAs(() => compilePlan(broken), FormulaConfigurationError);
    expect(error).toMatchObject({ code: 'FORMULA_CONFIGURATION_INVALID', httpStatus: 422 });
    expect(error.issues.map((issue) => issue.code)).toEqual(['CYCLE']);
    expect(error.message).toContain('loop: K → K');
    expect(error.message).not.toContain('{{');
  });

  it('AC-4: counts the problems it does not list', () => {
    const many: ValidatableField[] = Array.from({ length: 8 }, (_unused, index) => output(String.fromCharCode(65 + index), index + 1, 'row', '1 +'));
    const error = thrownAs(() => compilePlan(many), FormulaConfigurationError);
    expect(error.issues).toHaveLength(8);
    expect(error.message).toMatch(/\(and 3 more\)$/);
  });
});

describe('evaluating a row (AC-3, AC-4)', () => {
  const plan = compilePlan(SMALL);

  it('AC-4: a formula that reads a later-listed field gets its value: C = D * 2 where D = A + B', () => {
    // A = 1, B = 2: D = 3 and C = 6, worked by hand.
    const results = evaluateRowFormulas(plan, rowResolver({ A: '1', B: '2', F: '4' }));
    expect(show(results.get(idOfLetter('D')) ?? null)).toBe('3');
    expect(show(results.get(idOfLetter('C')) ?? null)).toBe('6');
  });

  it('AC-3: a division by zero gives no figure for that output and for what reads it, and every other output is still there', () => {
    // F = 0: E = A / F has no figure and H = E + 1 follows it. C, D and G are unaffected.
    const results = evaluateRowFormulas(plan, rowResolver({ A: '5', B: '2', F: '0' }));
    expect(results.get(idOfLetter('E'))).toBeNull();
    expect(results.get(idOfLetter('H'))).toBeNull();
    expect(show(results.get(idOfLetter('D')) ?? null)).toBe('7');
    expect(show(results.get(idOfLetter('C')) ?? null)).toBe('14');
    expect(show(results.get(idOfLetter('G')) ?? null)).toBe('6');
    // Every output of the row has a result, present or not.
    expect([...results.keys()].sort()).toEqual(['C', 'D', 'E', 'G', 'H'].map(idOfLetter).sort());
  });

  it('AC-4: does not change the resolver it was given', () => {
    const resolver = rowResolver({ A: '1', B: '2', F: '4' });
    evaluateRowFormulas(plan, resolver);
    expect(resolver.fieldValue(idOfLetter('D'))).toBeNull();
  });
});

describe('evaluating the estimate (AC-3, AC-4)', () => {
  const plan = compilePlan(SMALL);

  it('AC-4: a product formula sums the rows and may read an earlier product formula', () => {
    // Three rows with A = 1, 2, 3.5 and B = 1: D = 2, 3, 4.5 so I = 9.5; the sum of A is 6.5 so J = 9.5 / 6.5.
    const rows = [
      { A: '1', B: '1', F: '1' },
      { A: '2', B: '1', F: '1' },
      { A: '3.5', B: '1', F: '1' },
    ];
    const dColumn = rows.map((row) => evaluateRowFormulas(plan, rowResolver(row)).get(idOfLetter('D')) ?? null);
    const aColumn = rows.map((row) => d(row.A));
    const results = evaluateProductFormulas(plan, rowResolver({}, { D: dColumn, A: aColumn }));
    expect(show(results.get(idOfLetter('I')) ?? null)).toBe('9.5');
    expect(show(results.get(idOfLetter('J')) ?? null)).toBe(show(d('9.5').div(d('6.5'))));
  });

  it('AC-3: a row with no figure makes the estimate\'s total no figure rather than a lower number', () => {
    const results = evaluateProductFormulas(plan, rowResolver({}, { D: [new Decimal(2), null, new Decimal(4)], A: [new Decimal(1)] }));
    expect(results.get(idOfLetter('I'))).toBeNull();
    expect(results.get(idOfLetter('J'))).toBeNull();
  });

  it('AC-3: an estimate with no rows totals 0, and a ratio of 0 to a sum of 0 has no figure', () => {
    const results = evaluateProductFormulas(plan, rowResolver({}));
    expect(show(results.get(idOfLetter('I')) ?? null)).toBe('0');
    expect(results.get(idOfLetter('J'))).toBeNull();
  });
});

describe('one plan per configuration version (AC-9)', () => {
  /** Counts how many formulas the engine reads, by wrapping the parser the plan is built with. */
  function countingCompile() {
    let formulasParsed = 0;
    let plansBuilt = 0;
    const compile = (fields: ReadonlyArray<ValidatableField>): CompiledPlan => {
      plansBuilt += 1;
      return compilePlan(fields, {
        parse: (text) => {
          formulasParsed += 1;
          return parseFormula(text, { form: 'internal' });
        },
      });
    };
    return { compile, parsed: () => formulasParsed, built: () => plansBuilt };
  }

  it('AC-9: building a plan reads each formula once', () => {
    const counter = countingCompile();
    counter.compile(seedConfig.fields);
    expect(counter.parsed()).toBe(31);
  });

  it('AC-9: asking again for the same version reuses the plan and parses nothing more', () => {
    const counter = countingCompile();
    const cache = createPlanCache(counter.compile);
    const first = cache.get('version-1', seedConfig.fields);
    const second = cache.get('version-1', seedConfig.fields);
    const third = cache.get('version-1', seedConfig.fields);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(counter.built()).toBe(1);
    expect(counter.parsed()).toBe(31);
  });

  it('AC-9: another version gets its own plan', () => {
    const counter = countingCompile();
    const cache = createPlanCache(counter.compile);
    const first = cache.get('version-1', seedConfig.fields);
    const other = cache.get('version-2', seedConfig.fields);
    expect(other).not.toBe(first);
    expect(counter.built()).toBe(2);
    expect(cache.size()).toBe(2);
  });

  it('AC-9: holds a bounded number of plans and drops the oldest first', () => {
    const counter = countingCompile();
    const cache = createPlanCache(counter.compile, 2);
    cache.get('v1', SMALL);
    cache.get('v2', SMALL);
    cache.get('v3', SMALL);
    expect(cache.size()).toBe(2);
    expect(counter.built()).toBe(3);
    cache.get('v3', SMALL);
    cache.get('v2', SMALL);
    expect(counter.built()).toBe(3);
    // v1 was dropped, so it is built again.
    cache.get('v1', SMALL);
    expect(counter.built()).toBe(4);
  });

  it('AC-9: the default cache builds a real plan', () => {
    const cache = createPlanCache();
    const plan = cache.get('version-1', SMALL);
    expect(plan.rowFormulas).toHaveLength(5);
    expect(cache.get('version-1', SMALL)).toBe(plan);
  });

  it('AC-9: a configuration that cannot be compiled is not cached', () => {
    const cache = createPlanCache();
    const broken = [output('A', 1, 'row', '[A] + 1')];
    expect(() => cache.get('version-1', broken)).toThrow(FormulaConfigurationError);
    expect(cache.size()).toBe(0);
  });
});
