import { describe, expect, it } from 'vitest';

import type { PartItem } from '@/lib/estimates/tree-client';
import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { branchesOf, deleteGuardOf, partsRemoved, siblingPlacesOf, siblingsOf, stepOf, stepsAt, type Branch } from '@/lib/estimates/tree-moves';

/** STORY-05.02 AC-2, AC-3: what the screen works out from its tree to ask for a move or a delete. Every ID is invented. */

const part = (id: string, parentId: string | null, slNo: string): PartItem => ({ id, parentId, slNo, label: '', nodeKind: parentId === null ? 'MAIN_ASSEMBLY' : 'PART', completeness: 'EMPTY', revision: 1 });

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

describe('stepOf for the move menu (AQP-406 AC-2, AC-3)', () => {
  it('counts only the siblings under the same parent: a row with a deep subtree moves past a sibling and everything under it as one step', () => {
    // 1.1 holds 1.1.1 and 1.1.2; 1.2 follows it. Down from 1.1 is the place of 1.2 (1), however many rows are under 1.1.
    expect(stepOf(TREE, byId('b'), 'down')).toBe(1);
    expect(stepOf(TREE, byId('e'), 'up')).toBe(0);
    // The two rows under 1.1 are 1.1.1 and 1.1.2: they swap, and nothing else is a place for them.
    expect(stepOf(TREE, byId('c'), 'down')).toBe(1);
    expect(stepOf(TREE, byId('d'), 'up')).toBe(0);
  });

  it('offers neither place to an only child, and never a place under another parent', () => {
    const only: ReadonlyArray<PartItem> = [part('a', null, '1'), part('b', 'a', '1.1')];
    expect(stepOf(only, only[1] as PartItem, 'up')).toBeNull();
    expect(stepOf(only, only[1] as PartItem, 'down')).toBeNull();
    expect(stepOf(only, only[0] as PartItem, 'down')).toBeNull();
  });

  it('is the first place for the first sibling going down and the last place for the last going up: the same indexes a drag ends at', () => {
    const three: ReadonlyArray<PartItem> = [part('a', null, '1'), part('b', null, '2'), part('c', null, '3')];
    expect(stepOf(three, three[0] as PartItem, 'up')).toBeNull();
    expect(stepOf(three, three[0] as PartItem, 'down')).toBe(1);
    expect(stepOf(three, three[2] as PartItem, 'up')).toBe(1);
    expect(stepOf(three, three[2] as PartItem, 'down')).toBeNull();
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

describe('siblingPlacesOf and stepsAt (AQP-406, PRF-C-01: every row of the tree has its place in one pass)', () => {
  it('gives each part its place among the parts with the same parent, and the number of them', () => {
    const places = siblingPlacesOf(TREE);
    expect(places.get('a')).toEqual({ index: 0, count: 2 });
    expect(places.get('f')).toEqual({ index: 1, count: 2 });
    expect(places.get('b')).toEqual({ index: 0, count: 2 });
    expect(places.get('e')).toEqual({ index: 1, count: 2 });
    expect(places.get('c')).toEqual({ index: 0, count: 2 });
    expect(places.get('d')).toEqual({ index: 1, count: 2 });
    expect(places.size).toBe(TREE.length);
  });

  it('gives Move up and Move down targets: none up on the first sibling, none down on the last, neither on an only child, both on a middle row', () => {
    const three: ReadonlyArray<PartItem> = [part('a', null, '1'), part('b', 'a', '1.1'), part('c', 'a', '1.2'), part('d', 'a', '1.3'), part('e', 'b', '1.1.1')];
    const places = siblingPlacesOf(three);
    const steps = (id: string) => stepsAt(places.get(id) ?? { index: -1, count: 0 });
    expect(steps('b')).toEqual({ upTo: null, downTo: 1 });
    expect(steps('c')).toEqual({ upTo: 0, downTo: 2 });
    expect(steps('d')).toEqual({ upTo: 1, downTo: null });
    expect(steps('a')).toEqual({ upTo: null, downTo: null });
    expect(steps('e')).toEqual({ upTo: null, downTo: null });
  });

  it('gives, for every part, exactly the targets stepOf gives (same parent only; a deep subtree is one step)', () => {
    const places = siblingPlacesOf(TREE);
    for (const node of TREE) {
      expect(stepsAt(places.get(node.id) ?? { index: -1, count: 0 }), node.id).toEqual({ upTo: stepOf(TREE, node, 'up'), downTo: stepOf(TREE, node, 'down') });
    }
  });

  it('keeps the rule of stepOf for a part whose parent is not in the list: it is placed among the parts with the same missing parent', () => {
    const odd: ReadonlyArray<PartItem> = [part('a', null, '1'), part('x', 'gone', '9'), part('y', 'gone', '10')];
    const places = siblingPlacesOf(odd);
    for (const node of odd) expect(stepsAt(places.get(node.id) ?? { index: -1, count: 0 }), node.id).toEqual({ upTo: stepOf(odd, node, 'up'), downTo: stepOf(odd, node, 'down') });
  });

  it('reads each part a fixed number of times, so 2,000 parts cost a few thousand reads and not 4,000,000 (a count, never a timing)', () => {
    let reads = 0;
    const counted = (id: string, parentId: string | null): PartItem =>
      Object.defineProperties(part(id, parentId, id), {
        id: { get: () => ((reads += 1), id), enumerable: true },
        parentId: { get: () => ((reads += 1), parentId), enumerable: true },
      });
    const nodes = [counted('top', null), ...Array.from({ length: 1999 }, (_, index) => counted(`c${String(index)}`, 'top'))];
    reads = 0;
    expect(siblingPlacesOf(nodes).size).toBe(2000);
    expect(reads).toBeLessThanOrEqual(nodes.length * 6);
  });
});

describe('siblingsOf', () => {
  it('lists the parts under a parent in order, and the top level for null', () => {
    expect(siblingsOf(TREE, null).map((node) => node.slNo)).toEqual(['1', '2']);
    expect(siblingsOf(TREE, 'a').map((node) => node.slNo)).toEqual(['1.1', '1.2']);
    expect(siblingsOf(TREE, 'f')).toEqual([]);
  });
});

describe('branchesOf (CR-01 3B: the tree is nesting, not aria counts)', () => {
  const shape = (branches: ReadonlyArray<Branch<PartItem>>): unknown[] => branches.map((branch) => [branch.node.slNo, shape(branch.children)]);

  it('nests every part under its parent, in reading order, so the level is told by the nesting and not by a count', () => {
    expect(shape(branchesOf(TREE))).toEqual([
      ['1', [['1.1', [['1.1.1', []], ['1.1.2', []]]], ['1.2', []]]],
      ['2', []],
    ]);
  });

  it('carries no level, place or size: a branch is the node and its children and nothing else', () => {
    for (const branch of branchesOf(TREE)) expect(Object.keys(branch).sort()).toEqual(['children', 'node']);
  });

  it('keeps a part whose parent is not in the list at the top, as an unknown parent was level 1 before, and an empty tree has no branches', () => {
    expect(shape(branchesOf([part('x', 'gone', '9')]))).toEqual([['9', []]]);
    expect(branchesOf([])).toEqual([]);
  });

  it('is built without recursion, so a deep legacy tree (200 levels) cannot overflow the stack', () => {
    const deep = Array.from({ length: 200 }, (_, index) => part(String(index), index === 0 ? null : String(index - 1), String(index + 1)));
    let depth = 0;
    for (let branches: ReadonlyArray<Branch<PartItem>> = branchesOf(deep); branches.length > 0; branches = branches[0]?.children ?? []) depth += 1;
    expect(depth).toBe(200);
  });
});
