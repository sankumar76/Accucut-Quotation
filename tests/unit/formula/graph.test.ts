import { describe, expect, it } from 'vitest';

import { columnLetterToIndex } from '@/lib/columns';
import { analyzeFormulas, type GraphField, type OrderedFormula } from '@/lib/formula';
import type { RowScope } from '@/lib/fields/types';

import { fieldAt, parseDisplay } from '../../support/formula-fixtures';

/**
 * AC-4 (evaluation order, scope rule) and AC-5 (cycles named). Formulas are written with letters, as a Lead
 * would, and parsed against the test registry; the letters in the messages come from the fields' positions.
 */

type Spec = readonly [letter: string, scope: RowScope, formula: string | null];

function fields(specs: ReadonlyArray<Spec>): GraphField[] {
  return specs.map(([letter, rowScope, formula]) => ({
    id: fieldAt(letter),
    position: columnLetterToIndex(letter),
    rowScope,
    expression: formula === null ? null : parseDisplay(formula),
  }));
}

const idsOf = (letters: ReadonlyArray<string>): string[] => letters.map(fieldAt);
const orderIds = (list: ReadonlyArray<OrderedFormula> | undefined): string[] => (list ?? []).map((formula) => formula.fieldId);

describe('evaluation order (AC-4)', () => {
  it('AC-4: puts every field after the fields it reads, even when its position is earlier', () => {
    // C reads D, and D reads A and B (inputs): D must be calculated first although C sits before it.
    const { order, issues } = analyzeFormulas(
      fields([
        ['A', 'row', null],
        ['B', 'row', null],
        ['C', 'row', 'D * 2'],
        ['D', 'row', 'A + B'],
      ]),
    );
    expect(issues).toEqual([]);
    expect(orderIds(order?.rowOrder)).toEqual(idsOf(['D', 'C']));
  });

  it('AC-4: a chain is ordered end to end', () => {
    const { order } = analyzeFormulas(
      fields([
        ['A', 'row', null],
        ['B', 'row', 'C + 1'],
        ['C', 'row', 'D + 1'],
        ['D', 'row', 'E + 1'],
        ['E', 'row', 'A + 1'],
      ]),
    );
    expect(orderIds(order?.rowOrder)).toEqual(idsOf(['E', 'D', 'C', 'B']));
  });

  it('AC-4: a diamond is not a cycle', () => {
    const { order, issues } = analyzeFormulas(
      fields([
        ['A', 'row', null],
        ['B', 'row', 'A * 2'],
        ['C', 'row', 'A * 3'],
        ['D', 'row', 'B + C'],
      ]),
    );
    expect(issues).toEqual([]);
    expect(orderIds(order?.rowOrder)).toEqual(idsOf(['B', 'C', 'D']));
  });

  it('AC-4: fields that do not depend on each other keep position order, so the order is the same every time', () => {
    const specs: Spec[] = [
      ['A', 'row', null],
      ['B', 'row', 'A + 1'],
      ['C', 'row', 'A + 2'],
      ['D', 'row', 'A + 3'],
    ];
    const forward = analyzeFormulas(fields(specs)).order;
    const shuffled = analyzeFormulas(fields([...specs].reverse())).order;
    expect(orderIds(forward?.rowOrder)).toEqual(idsOf(['B', 'C', 'D']));
    expect(orderIds(shuffled?.rowOrder)).toEqual(orderIds(forward?.rowOrder));
  });

  it('AC-4: row-scope formulas are listed apart from product-scope ones, and the product ones read the row ones through SUM', () => {
    const { order, issues } = analyzeFormulas(
      fields([
        ['B', 'row', null],
        ['C', 'row', 'B * 2'],
        ['D', 'product', 'SUM(C)'],
        ['E', 'product', 'D / SUM(B)'],
      ]),
    );
    expect(issues).toEqual([]);
    expect(orderIds(order?.rowOrder)).toEqual(idsOf(['C']));
    expect(orderIds(order?.productOrder)).toEqual(idsOf(['D', 'E']));
  });

  it('AC-4: a product formula that reads another product field comes after it', () => {
    const { order } = analyzeFormulas(
      fields([
        ['B', 'row', null],
        ['C', 'product', 'D + 1'],
        ['D', 'product', 'SUM(B)'],
      ]),
    );
    expect(orderIds(order?.productOrder)).toEqual(idsOf(['D', 'C']));
  });

  it('a field with no formula is a leaf, and a reference to a field outside the list is left to validate.ts', () => {
    const { order, issues } = analyzeFormulas(fields([['B', 'row', 'CA * 1']]));
    expect(issues).toEqual([]);
    expect(orderIds(order?.rowOrder)).toEqual(idsOf(['B']));
  });
});

describe('the scope rule (AC-4)', () => {
  it('AC-4: a row-scope formula that reads a product-scope field is refused, naming both letters', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', null],
        ['C', 'product', 'SUM(B)'],
        ['D', 'row', 'C + 1'],
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'ROW_FORMULA_USES_PRODUCT_FIELD', fieldId: fieldAt('D') });
    expect(issues[0]?.message).toContain('D');
    expect(issues[0]?.message).toContain('C');
  });

  it('AC-4: a row-scope formula cannot use SUM, which needs every row', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', null],
        ['C', 'row', 'B / SUM(B)'],
      ]),
    );
    expect(issues.map((issue) => issue.code)).toEqual(['SUM_IN_ROW_FORMULA']);
  });

  it('AC-4: a product-scope formula reads a row-scope field only through SUM', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', null],
        ['C', 'product', 'B + 1'],
      ]),
    );
    expect(issues.map((issue) => issue.code)).toEqual(['PRODUCT_FORMULA_USES_ROW_FIELD']);
  });

  it('AC-4: SUM adds up row values, so its column must be row-scope', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', null],
        ['C', 'product', 'SUM(B)'],
        ['D', 'product', 'SUM(C)'],
      ]),
    );
    expect(issues.map((issue) => issue.code)).toEqual(['SUM_OF_PRODUCT_FIELD']);
  });

  it('AC-4: the seed shapes pass: BL = SUM(BG) and BN = BL / SUM(BM)', () => {
    const { issues, order } = analyzeFormulas(
      fields([
        ['BG', 'row', null],
        ['BL', 'product', 'SUM(BG)'],
        ['BM', 'row', null],
        ['BN', 'product', 'BL / SUM(BM)'],
      ]),
    );
    expect(issues).toEqual([]);
    expect(orderIds(order?.productOrder)).toEqual(idsOf(['BL', 'BN']));
  });
});

describe('cycles (AC-5)', () => {
  it('AC-5: names the loop with the letters of its fields: AL -> AY -> AL', () => {
    const { issues, order } = analyzeFormulas(
      fields([
        ['P', 'row', null],
        ['AL', 'row', 'AY + 1'],
        ['AY', 'row', 'AL * P'],
      ]),
    );
    expect(order).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'CYCLE',
      message: 'These fields refer to each other in a loop: AL → AY → AL.',
      fieldId: fieldAt('AL'),
      cycle: idsOf(['AL', 'AY', 'AL']),
    });
  });

  it('AC-5: finds a field that refers to itself', () => {
    const { issues } = analyzeFormulas(fields([['AL', 'row', 'AL + 1']]));
    expect(issues[0]).toMatchObject({ code: 'CYCLE', message: 'These fields refer to each other in a loop: AL → AL.' });
  });

  it('AC-5: finds a longer loop and starts it at the field where it closes, not at the field that led into it', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', 'C + 1'],
        ['C', 'row', 'D + 1'],
        ['D', 'row', 'E + 1'],
        ['E', 'row', 'C + 1'],
      ]),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe('These fields refer to each other in a loop: C → D → E → C.');
  });

  it('AC-5: reports two separate loops', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', 'C'],
        ['C', 'row', 'B'],
        ['E', 'row', 'F'],
        ['F', 'row', 'E'],
      ]),
    );
    expect(issues.map((issue) => issue.message)).toEqual([
      'These fields refer to each other in a loop: B → C → B.',
      'These fields refer to each other in a loop: E → F → E.',
    ]);
  });

  it('AC-5: finds a loop that crosses the two scopes, along with the scope breach', () => {
    const { issues, order } = analyzeFormulas(
      fields([
        ['B', 'row', 'C + 1'],
        ['C', 'product', 'SUM(B)'],
      ]),
    );
    expect(order).toBeNull();
    expect(issues.map((issue) => issue.code).sort()).toEqual(['CYCLE', 'ROW_FORMULA_USES_PRODUCT_FIELD']);
  });

  it('AC-5: a loop through an input is not a loop, because an input has no formula', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', null],
        ['C', 'row', 'B + 1'],
      ]),
    );
    expect(issues).toEqual([]);
  });

  it('STD-05: a loop message holds column letters and nothing else from a formula', () => {
    const { issues } = analyzeFormulas(
      fields([
        ['B', 'row', 'C * 7.31 + Test-Rate-per-kg'],
        ['C', 'row', 'B'],
      ]),
    );
    expect(issues[0]?.message).not.toMatch(/7\.31|Test-Rate/);
  });
});
