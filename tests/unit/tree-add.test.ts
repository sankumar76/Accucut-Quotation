import { describe, expect, it } from 'vitest';

import { isAllowedChild, NODE_KINDS, type NodeKind } from '@/lib/estimate/node-kinds';
import { addRequestOf } from '@/lib/estimates/tree-add';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * AQP-403 AC-8: the interim mapping of the three Add buttons of the existing screen to the new body, until the "+" menu of CR-01 3C replaces them. It picks what to ask for from the same
 * table the server checks (`ALLOWED_CHILDREN`); the server still decides. Every ID is invented.
 */

const row = (nodeKind: NodeKind, parentId: string | null = 'p'): PartItem => ({ id: 'row', parentId, slNo: '1', label: '', nodeKind, completeness: 'EMPTY', revision: 1 });

describe('addRequestOf', () => {
  it('"Add item" adds a Main Assembly at the top level, with or without a row selected', () => {
    expect(addRequestOf('item', null)).toEqual({ parentId: null, nodeKind: 'MAIN_ASSEMBLY' });
    expect(addRequestOf('item', row('PART'))).toEqual({ parentId: null, nodeKind: 'MAIN_ASSEMBLY' });
  });

  it('"Add sub-part" adds the first kind the selected row\'s kind allows, under it', () => {
    expect(addRequestOf('sub-part', row('MAIN_ASSEMBLY'))).toEqual({ parentId: 'row', nodeKind: 'SUB_ASSEMBLY' });
    expect(addRequestOf('sub-part', row('SUB_ASSEMBLY'))).toEqual({ parentId: 'row', nodeKind: 'PART' });
    expect(addRequestOf('sub-part', row('PART'))).toEqual({ parentId: 'row', nodeKind: 'FASTENER' });
  });

  it('"Add sub-part" on a Fastener asks for nothing: it holds nothing, and no request is sent', () => {
    expect(addRequestOf('sub-part', row('FASTENER'))).toBeNull();
  });

  it('"beside" adds a row of the selected row\'s own kind under the selected row\'s parent (at the top level for a Main Assembly)', () => {
    expect(addRequestOf('beside', row('PART', 'main'))).toEqual({ parentId: 'main', nodeKind: 'PART' });
    expect(addRequestOf('beside', row('FASTENER', 'part'))).toEqual({ parentId: 'part', nodeKind: 'FASTENER' });
    expect(addRequestOf('beside', row('MAIN_ASSEMBLY', null))).toEqual({ parentId: null, nodeKind: 'MAIN_ASSEMBLY' });
  });

  it('"Add sub-part" and "beside" with no row selected ask for nothing', () => {
    expect(addRequestOf('sub-part', null)).toBeNull();
    expect(addRequestOf('beside', null)).toBeNull();
  });

  it('what it asks for is always allowed by the table for a row in a tree that follows it (every selected kind, in its own place)', () => {
    for (const kind of NODE_KINDS) {
      const sub = addRequestOf('sub-part', row(kind));
      if (sub !== null) expect(isAllowedChild(kind, sub.nodeKind)).toBe(true);
    }
  });
});
