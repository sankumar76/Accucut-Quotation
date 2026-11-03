import { describe, expect, it } from 'vitest';

import { dependenciesOf, referencesOf } from '@/lib/formula';
import { nodesOf } from '@/lib/formula/ast';

import { fieldAt, parseDisplay, RATE_PERCENT, RATE_PLAIN } from '../../support/formula-fixtures';

/** What a parsed formula reads (AC-4: the graph is built from this; AC-7: the working is built from the same references). */

describe('nodesOf', () => {
  it('lists every node, parent before children, left to right, for each kind of node', () => {
    const kinds = nodesOf(parseDisplay('-A + MIN(B, 2) * MAX(C, 3) - ROUND(D / 4, 2) + SUM(E) + IF(F > 1, G, 0)')).map((node) => node.kind);
    expect(kinds).toEqual([
      'binary', 'binary', 'binary', 'binary', 'negate', 'reference', 'binary', 'min', 'reference', 'number', 'max', 'reference', 'number',
      'round', 'binary', 'reference', 'number', 'sum', 'if', 'reference', 'number', 'reference', 'number',
    ]);
  });

  it('reaches every node of a very long chain without recursion', () => {
    const text = Array.from({ length: 900 }, () => 'A').join(' + ');
    expect(nodesOf(parseDisplay(text))).toHaveLength(900 + 899);
  });
});

describe('referencesOf', () => {
  it('lists the references in order of appearance, repeats included, and not the SUM column or the numbers', () => {
    const references = referencesOf(parseDisplay('A * Test-Rate-per-kg + SUM(B) + A / Test Share % - Material-Scrap-Rate * ExchangeRate-EUR'));
    expect(references).toEqual([
      { kind: 'field', id: fieldAt('A') },
      { kind: 'rate', id: RATE_PLAIN },
      { kind: 'field', id: fieldAt('A') },
      { kind: 'rate', id: RATE_PERCENT },
      { kind: 'material', key: 'scrapRate' },
      { kind: 'exchange', currency: 'EUR' },
    ]);
  });

  it('finds the references inside the condition and both results of IF, and inside ROUND, MIN and MAX', () => {
    expect(referencesOf(parseDisplay('IF(A > B, C, D)')).map((reference) => reference.kind === 'field' && reference.id)).toEqual(
      ['A', 'B', 'C', 'D'].map(fieldAt),
    );
    expect(referencesOf(parseDisplay('ROUND(MIN(A, MAX(B, C)), 1)')).map((reference) => reference.kind === 'field' && reference.id)).toEqual(
      ['A', 'B', 'C'].map(fieldAt),
    );
  });

  it('is empty for a formula of numbers only', () => {
    expect(referencesOf(parseDisplay('1 + 2 * 3'))).toEqual([]);
  });
});

describe('dependenciesOf', () => {
  it('lists each field once, apart for a field read in the same row and the same field summed over all rows', () => {
    expect(dependenciesOf(parseDisplay('A + A * B + SUM(A) + SUM(A) + Test-Rate-per-kg'))).toEqual([
      { fieldId: fieldAt('A'), aggregate: false },
      { fieldId: fieldAt('B'), aggregate: false },
      { fieldId: fieldAt('A'), aggregate: true },
    ]);
  });

  it('does not list rates, materials or exchange rates, which are not fields', () => {
    expect(dependenciesOf(parseDisplay('Material-Scrap-Rate + ExchangeRate-USD + Test Spaced Rate'))).toEqual([]);
  });
});
