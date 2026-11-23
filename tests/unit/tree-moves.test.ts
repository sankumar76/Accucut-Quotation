import { describe, expect, it } from 'vitest';

import type { PartItem } from '@/lib/estimates/tree-client';
import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { branchesOf, deleteGuardOf, partsRemoved, siblingsOf, stepOf, type Branch } from '@/lib/estimates/tree-moves';

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
