import { describe, expect, it } from 'vitest';

import { ALLOWED_CHILDREN, firstAllowedChild, isAllowedChild, NODE_KIND_NAMES, NODE_KINDS, nodeKindLabel, type NodeKind } from '@/lib/estimate/node-kinds';

/**
 * AQP-403 (CR-01 item 3A; SPEC section 6.1, tests 14.30 and 14.31; ADR-020 K1): the kinds of a parts-tree row and which kind may sit under which. One table is read by the
 * server (the add rule) and the browser (the "+" menu of 3C), so every pair is checked here against the written rule and not against the table itself.
 */

/** The rule of SPEC 6.1 written out pair by pair, so a change to the table is a change to a test. */
const RULE: Readonly<Record<NodeKind | 'TOP', ReadonlyArray<NodeKind>>> = {
  TOP: ['MAIN_ASSEMBLY'],
  MAIN_ASSEMBLY: ['SUB_ASSEMBLY', 'PART', 'FASTENER'],
  SUB_ASSEMBLY: ['PART', 'FASTENER'],
  PART: ['FASTENER'],
  FASTENER: [],
};

describe('ALLOWED_CHILDREN (AC-2, 14.30)', () => {
  it('names the four stored kinds, and Sub-part is not one of them', () => {
    expect([...NODE_KINDS]).toEqual(['MAIN_ASSEMBLY', 'SUB_ASSEMBLY', 'PART', 'FASTENER']);
  });

  it('holds exactly the written rule for the top level and for every parent kind', () => {
    expect(ALLOWED_CHILDREN).toEqual(RULE);
  });

  it.each(Object.entries(RULE).flatMap(([parent, allowed]) => NODE_KINDS.map((child) => ({ parent, child, allowed: allowed.includes(child) }))))(
    'isAllowedChild($parent, $child) is $allowed',
    ({ parent, child, allowed }) => {
      expect(isAllowedChild(parent === 'TOP' ? null : (parent as NodeKind), child)).toBe(allowed);
    },
  );

  it('is frozen, so no caller can change the rule at run time', () => {
    expect(Object.isFrozen(ALLOWED_CHILDREN)).toBe(true);
    for (const children of Object.values(ALLOWED_CHILDREN)) expect(Object.isFrozen(children)).toBe(true);
  });
});

describe('firstAllowedChild (AC-8, the interim "Add sub-part")', () => {
  it('is the first kind the table allows, and null for a Fastener', () => {
    expect(firstAllowedChild('MAIN_ASSEMBLY')).toBe('SUB_ASSEMBLY');
    expect(firstAllowedChild('SUB_ASSEMBLY')).toBe('PART');
    expect(firstAllowedChild('PART')).toBe('FASTENER');
    expect(firstAllowedChild('FASTENER')).toBeNull();
  });
});

describe('nodeKindLabel (AC-4, 14.31)', () => {
  const row = (id: string, parentId: string | null, nodeKind: NodeKind) => ({ id, parentId, nodeKind });

  it('names the kinds that are not Part by their own names', () => {
    expect(NODE_KIND_NAMES).toEqual({ MAIN_ASSEMBLY: 'Main Assembly', SUB_ASSEMBLY: 'Sub-Assembly', PART: 'Part', FASTENER: 'Fastener' });
    const main = row('m', null, 'MAIN_ASSEMBLY');
    expect(nodeKindLabel(main, [main])).toBe('Main Assembly');
    const sub = row('s', 'm', 'SUB_ASSEMBLY');
    expect(nodeKindLabel(sub, [sub])).toBe('Sub-Assembly');
    const fastener = row('f', 'm', 'FASTENER');
    expect(nodeKindLabel(fastener, [fastener])).toBe('Fastener');
  });

  it('says "Part" for the only PART under its parent, "Sub-part" for two or more, and "Part" again when one is deleted', () => {
    const first = row('p1', 'm', 'PART');
    expect(nodeKindLabel(first, [first])).toBe('Part');

    const second = row('p2', 'm', 'PART');
    const two = [first, second];
    expect(nodeKindLabel(first, two)).toBe('Sub-part');
    expect(nodeKindLabel(second, two)).toBe('Sub-part');

    expect(nodeKindLabel(first, [first])).toBe('Part');
  });

  it('does not count a sibling that is not a PART, or a PART under another parent, and gives the same answer whether or not the row is in the list', () => {
    const part = row('p1', 'm', 'PART');
    const siblings = [row('s', 'm', 'SUB_ASSEMBLY'), row('f', 'm', 'FASTENER'), row('other', 'x', 'PART')];
    expect(nodeKindLabel(part, siblings)).toBe('Part');
    expect(nodeKindLabel(part, [part, ...siblings])).toBe('Part');
    expect(nodeKindLabel(part, [...siblings, row('p2', 'm', 'PART')])).toBe('Sub-part');
  });

  it('names a PART under a Sub-Assembly and a PART at the top of a legacy tree the same way', () => {
    const lone = row('p', 's', 'PART');
    expect(nodeKindLabel(lone, [lone])).toBe('Part');
    const topA = row('a', null, 'PART');
    const topB = row('b', null, 'PART');
    expect(nodeKindLabel(topA, [topA, topB])).toBe('Sub-part');
  });
});
