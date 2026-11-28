import { describe, expect, it } from 'vitest';

import { rowNamedByAddress } from '@/lib/estimates/review-tree-edit';

/**
 * QLT-811-01 (STORY-05.08 AC-4): the island opens the row the address names (a link the leave guard took, Back, Forward), except **while something is typed and not saved**: opening another row unmounts the form that holds
 * the text, so Back from the guard's extra entry (which restores the page's own, older row in the address) must not move a dirty island. The rule is a table; the browser cases are in
 * estimate-review-row-return.spec.ts. Invented rows only.
 */

const ITEMS = [
  { id: 'a', slNo: '1' },
  { id: 'b', slNo: '1.1' },
  { id: 'c', slNo: '1.2' },
];

describe('rowNamedByAddress', () => {
  it('opens the row the address names when nothing is typed and not saved', () => {
    expect(rowNamedByAddress('1.1', ITEMS, 'a', false)).toBe('b');
    expect(rowNamedByAddress('1', ITEMS, 'c', false)).toBe('a');
  });

  it('stays where it is while something is typed and not saved: the open row keeps its form and its text', () => {
    expect(rowNamedByAddress('1.1', ITEMS, 'c', true)).toBeNull();
    expect(rowNamedByAddress('1', ITEMS, 'b', true)).toBeNull();
  });

  it('stays where it is when the address names the open row, no row, or a row the tree does not hold', () => {
    expect(rowNamedByAddress('1.1', ITEMS, 'b', false)).toBeNull();
    expect(rowNamedByAddress(null, ITEMS, 'b', false)).toBeNull();
    expect(rowNamedByAddress('9.9', ITEMS, 'b', false)).toBeNull();
    expect(rowNamedByAddress('1.1', [], null, false)).toBeNull();
  });
});
