import { describe, expect, it } from 'vitest';

import type { PartItem } from '@/lib/estimates/tree-client';
import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { deleteGuardOf, partsRemoved, rowsOf, siblingsOf, stepOf } from '@/lib/estimates/tree-moves';

/** STORY-05.02 AC-2, AC-3: what the screen works out from its tree to ask for a move or a delete. Every ID is invented. */

const part = (id: string, parentId: string | null, slNo: string): PartItem => ({ id, parentId, slNo, label: '', completeness: 'EMPTY', revision: 1 });

/** 1, 1.1, 1.1.1, 1.1.2, 1.2, 2 in reading order. */
const TREE: ReadonlyArray<PartItem> = [part('a', null, '1'), part('b', 'a', '1.1'), part('c', 'b', '1.1.1'), part('d', 'b', '1.1.2'), part('e', 'a', '1.2'), part('f', null, '2')];
const byId = (id: string): PartItem => TREE.find((node) => node.id === id) ?? part('missing', null, '0');

describe('stepOf', () => {
  it('gives the place one up or one down among the siblings', () => {
    expect(stepOf(TREE, byId('e'), 'up')).toBe(0);
    expect(stepOf(TREE, byId('b'), 'down')).toBe(1);
    expect(stepOf(TREE, byId('f'), 'up')).toBe(0);
  });

  it('is null where the part cannot go further: the first cannot go up and the last cannot go down', () => {
    expect(stepOf(TREE, byId('a'), 'up')).toBeNull();
    expect(stepOf(TREE, byId('f'), 'down')).toBeNull();
    expect(stepOf(TREE, byId('d'), 'down')).toBeNull();
  });
});

describe('partsRemoved and deleteGuardOf', () => {
  it('lists the part and every sub-part to any depth: 1 for a part with none, 3 for one with two', () => {
    expect(partsRemoved(TREE, 'f').map((node) => node.id)).toEqual(['f']);
    expect(partsRemoved(TREE, 'b').map((node) => node.id)).toEqual(['b', 'c', 'd']);
    expect(partsRemoved(TREE, 'a')).toHaveLength(5);
  });

  it('gives the count the dialog names and the fingerprint the server checks: it changes when a member or a revision does', () => {
    const guard = deleteGuardOf(TREE, 'b');
    expect(guard.parts).toBe(3);
    expect(guard.subtree).toBe(subtreeFingerprint(partsRemoved(TREE, 'b')));
    const replaced = TREE.map((node) => (node.id === 'd' ? { ...node, id: 'x' } : node));
    expect(deleteGuardOf(replaced, 'b').subtree).not.toBe(guard.subtree);
    const typed = TREE.map((node) => (node.id === 'c' ? { ...node, revision: 2 } : node));
    expect(deleteGuardOf(typed, 'b').subtree).not.toBe(guard.subtree);
  });
});

describe('siblingsOf', () => {
  it('lists the parts under a parent in order, and the top level for null', () => {
    expect(siblingsOf(TREE, null).map((node) => node.slNo)).toEqual(['1', '2']);
    expect(siblingsOf(TREE, 'a').map((node) => node.slNo)).toEqual(['1.1', '1.2']);
    expect(siblingsOf(TREE, 'f')).toEqual([]);
  });
});

describe('rowsOf', () => {
  it('gives each part its level, its place and the number of its siblings, for the tree roles', () => {
    expect(rowsOf(TREE).map((row) => `${row.part.slNo}: level ${row.level}, ${row.position} of ${row.size}`)).toEqual([
      '1: level 1, 1 of 2',
      '1.1: level 2, 1 of 2',
      '1.1.1: level 3, 1 of 2',
      '1.1.2: level 3, 2 of 2',
      '1.2: level 2, 2 of 2',
      '2: level 1, 2 of 2',
    ]);
  });
});
