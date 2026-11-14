import { describe, expect, it } from 'vitest';

import {
  buildTree,
  canMove,
  changedPlacements,
  childCount,
  descendantIds,
  insertNode,
  moveNode,
  removeNodes,
  siblingIndex,
  slNumbers,
  type PlacedNode,
} from '@/lib/estimate/tree';

import { buildTree500 } from '../../support/builders/tree500';

/**
 * STORY-05.02 AC-1, AC-2, AC-4 (FR-043, FR-044; SPEC section 14.3): the parts tree as pure code. Sl. No is never stored: it is the path of 1-based positions
 * of a node among its siblings, so after an add, a move or a delete it is read again from the layout and cannot drift. The checks run over a hand-built tree (the
 * one of the story) and over generated ones, against an oracle that keeps the tree as nested lists and reads the number from them. Every ID is invented.
 */

/** A small deterministic generator (mulberry32), so a failing tree can be rebuilt from its seed. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const node = (id: string, parentId: string | null, sortIndex: number): PlacedNode => ({ id, parentId, sortIndex });

/** 1, 1.1, 1.1.1, 1.1.2, 1.2, 1.3, 1.4, 1.5, 2: the tree of SPEC section 14.3 with a second top-level item. */
const STORY_TREE: ReadonlyArray<PlacedNode> = [
  node('n1', null, 0),
  node('n1-1', 'n1', 0),
  node('n1-1-1', 'n1-1', 0),
  node('n1-1-2', 'n1-1', 1),
  node('n1-2', 'n1', 1),
  node('n1-3', 'n1', 2),
  node('n1-4', 'n1', 3),
  node('n1-5', 'n1', 4),
  node('n2', null, 1),
];

const numbers = (nodes: ReadonlyArray<PlacedNode>): Record<string, string> => Object.fromEntries(slNumbers(nodes));

describe('AC-1: the Sl. No is derived from the position, and depth is unlimited', () => {
  it('numbers the tree of the story 1, 1.1, 1.1.1, 1.1.2, 1.2 to 1.5, 2', () => {
    expect(numbers(STORY_TREE)).toEqual({ n1: '1', 'n1-1': '1.1', 'n1-1-1': '1.1.1', 'n1-1-2': '1.1.2', 'n1-2': '1.2', 'n1-3': '1.3', 'n1-4': '1.4', 'n1-5': '1.5', n2: '2' });
  });

  it('lists the nodes depth first, with the level of each, whatever the order they were read in', () => {
    const shuffled = [...STORY_TREE].reverse();
    expect(buildTree(shuffled).map((entry) => `${entry.slNo}@${entry.level}`)).toEqual(['1@1', '1.1@2', '1.1.1@3', '1.1.2@3', '1.2@2', '1.3@2', '1.4@2', '1.5@2', '2@1']);
  });

  it('reads a position from sortIndex alone, so gaps in it change nothing and a tie is broken by the ID', () => {
    const gappy = [node('b', null, 40), node('a', null, 7), node('d', null, 40), node('c', 'a', 900)];
    expect(numbers(gappy)).toEqual({ a: '1', b: '2', d: '3', c: '1.1' });
  });

  it('numbers a chain 200 levels deep without recursing (depth is unlimited)', () => {
    const chain = Array.from({ length: 200 }, (_, depth) => node(`d${depth}`, depth === 0 ? null : `d${depth - 1}`, 0));
    expect(slNumbers(chain).get('d199')).toBe(Array.from({ length: 200 }, () => '1').join('.'));
  });

  it('leaves out a node whose parent is not in the list (a broken link is never shown as a part)', () => {
    expect(numbers([node('a', null, 0), node('orphan', 'missing', 0)])).toEqual({ a: '1' });
  });

  it('adds a new item last at the top, a sub-part last under its parent and a part beside right after its sibling', () => {
    expect(slNumbers(insertNode(STORY_TREE, { id: 'new', parentId: null, index: 2 })).get('new')).toBe('3');
    expect(slNumbers(insertNode(STORY_TREE, { id: 'new', parentId: 'n1-2', index: 0 })).get('new')).toBe('1.2.1');

    const after = slNumbers(insertNode(STORY_TREE, { id: 'new', parentId: 'n1', index: 2 }));
    expect(after.get('n1-2')).toBe('1.2');
    expect(after.get('new')).toBe('1.3');
    expect(after.get('n1-3')).toBe('1.4');
    expect(after.get('n1-5')).toBe('1.6');
  });
});

describe('the places a request names', () => {
  it('gives the place of a node among its siblings, and -1 for one that is not there', () => {
    expect(siblingIndex(STORY_TREE, 'n1')).toBe(0);
    expect(siblingIndex(STORY_TREE, 'n2')).toBe(1);
    expect(siblingIndex(STORY_TREE, 'n1-4')).toBe(3);
    expect(siblingIndex(STORY_TREE, 'missing')).toBe(-1);
  });

  it('counts the children of a node and the items at the top', () => {
    expect(childCount(STORY_TREE, null)).toBe(2);
    expect(childCount(STORY_TREE, 'n1')).toBe(5);
    expect(childCount(STORY_TREE, 'n1-5')).toBe(0);
  });
});

describe('AC-2: Sl. No renumbers after every change', () => {
  it('a node moved up swaps places with the one before it: 1.3 up becomes 1.2 and the old 1.2 becomes 1.3', () => {
    const next = slNumbers(moveNode(STORY_TREE, 'n1-3', 'n1', 1));
    expect(next.get('n1-3')).toBe('1.2');
    expect(next.get('n1-2')).toBe('1.3');
  });

  it('a node moved down swaps places with the one after it', () => {
    const next = slNumbers(moveNode(STORY_TREE, 'n1-2', 'n1', 2));
    expect(next.get('n1-2')).toBe('1.3');
    expect(next.get('n1-3')).toBe('1.2');
  });

  it('a node moved to another parent leaves no gap behind and takes the place asked for, with its own sub-parts coming along', () => {
    const next = slNumbers(moveNode(STORY_TREE, 'n1-1', 'n2', 0));
    expect(next.get('n1-1')).toBe('2.1');
    expect(next.get('n1-1-2')).toBe('2.1.2');
    expect(next.get('n1-2')).toBe('1.1');
    expect(next.get('n1-5')).toBe('1.4');
  });

  it('a node moved to the top level takes a top-level number', () => {
    expect(slNumbers(moveNode(STORY_TREE, 'n1-1-2', null, 1)).get('n1-1-2')).toBe('2');
  });

  it('deleting a node closes the gap: the sub-parts go with it and the next sibling takes its number', () => {
    const next = slNumbers(removeNodes(STORY_TREE, ['n1-1', 'n1-1-1', 'n1-1-2']));
    expect(next.get('n1-2')).toBe('1.1');
    expect(next.get('n1-5')).toBe('1.4');
    expect(next.has('n1-1')).toBe(false);
  });

  it('an index past the end puts the node last, and one below 0 puts it first', () => {
    expect(slNumbers(moveNode(STORY_TREE, 'n1-2', 'n1', 99)).get('n1-2')).toBe('1.5');
    expect(slNumbers(moveNode(STORY_TREE, 'n1-4', 'n1', -3)).get('n1-4')).toBe('1.1');
  });

  it('returns contiguous sort indexes for every sibling group it touches, so the stored positions never drift apart', () => {
    const placements = moveNode(STORY_TREE, 'n1-1', 'n2', 0);
    for (const parent of ['n1', 'n2', null]) {
      const group = placements.filter((placement) => placement.parentId === parent).map((placement) => placement.sortIndex);
      expect(group).toEqual(group.map((_, position) => position));
    }
  });

  it('changedPlacements names only the rows that really differ, and nothing for a move to where the node already is', () => {
    expect(changedPlacements(STORY_TREE, moveNode(STORY_TREE, 'n1-2', 'n1', 1))).toEqual([]);
    const changed = changedPlacements(STORY_TREE, moveNode(STORY_TREE, 'n1-3', 'n1', 1)).map((placement) => placement.id);
    expect(changed.sort()).toEqual(['n1-2', 'n1-3']);
  });

  it('the numbering after random adds, moves and deletes always equals the path of positions of an independent nested model (generated trees)', () => {
    for (const seed of [1, 7, 42, 2026, 20261114]) {
      const next = random(seed);
      let nodes: PlacedNode[] = [];
      // The oracle: the tree as nested lists of IDs, numbered by walking them.
      const model = new Map<string | null, string[]>([[null, []]]);
      const oracle = (): Record<string, string> => {
        const out: Record<string, string> = {};
        const walk = (parent: string | null, prefix: string): void => {
          (model.get(parent) ?? []).forEach((id, position) => {
            const sl = prefix === '' ? `${position + 1}` : `${prefix}.${position + 1}`;
            out[id] = sl;
            walk(id, sl);
          });
        };
        walk(null, '');
        return out;
      };
      const parentOf = (id: string): string | null => [...model.entries()].find(([, ids]) => ids.includes(id))?.[0] ?? null;
      const pick = <T>(list: ReadonlyArray<T>): T => list[Math.floor(next() * list.length)] as T;
      for (let step = 0; step < 150; step += 1) {
        const ids = nodes.map((entry) => entry.id);
        const roll = next();
        if (ids.length === 0 || roll < 0.45) {
          const parentId = ids.length === 0 || next() < 0.2 ? null : pick(ids);
          const siblings = model.get(parentId) ?? [];
          const index = Math.floor(next() * (siblings.length + 1));
          const id = `g${seed}-${step}`;
          nodes = [...insertNode(nodes, { id, parentId, index })];
          siblings.splice(index, 0, id);
          model.set(parentId, siblings);
          model.set(id, []);
        } else if (roll < 0.85) {
          const id = pick(ids);
          const target = pick([null, ...ids]);
          if (!canMove(nodes, id, target)) continue;
          const siblings = (model.get(target) ?? []).filter((candidate) => candidate !== id);
          const index = Math.floor(next() * (siblings.length + 1));
          model.set(parentOf(id), (model.get(parentOf(id)) ?? []).filter((candidate) => candidate !== id));
          const kept = (model.get(target) ?? []).filter((candidate) => candidate !== id);
          kept.splice(index, 0, id);
          model.set(target, kept);
          nodes = [...moveNode(nodes, id, target, index)];
        } else {
          const id = pick(ids);
          const gone = [id, ...descendantIds(nodes, id)];
          model.set(parentOf(id), (model.get(parentOf(id)) ?? []).filter((candidate) => candidate !== id));
          for (const dead of gone) model.delete(dead);
          nodes = [...removeNodes(nodes, gone)];
        }
        expect(numbers(nodes), `seed ${seed}, step ${step}`).toEqual(oracle());
      }
    }
  });

  it('numbers the 500-node tree the same as the independent builder (NFR-008)', () => {
    const { nodes: built } = buildTree500();
    const counts = new Map<number | null, number>();
    const flat: PlacedNode[] = built.map((entry) => {
      const position = counts.get(entry.parentIndex) ?? 0;
      counts.set(entry.parentIndex, position + 1);
      return node(`t${entry.index}`, entry.parentIndex === null ? null : `t${entry.parentIndex}`, position);
    });
    expect(flat).toHaveLength(500);
    const result = slNumbers(flat);
    for (const entry of built) expect(result.get(`t${entry.index}`)).toBe(entry.sl);
  });
});

describe('AC-4: a node cannot move under itself or its own descendants', () => {
  it('names every descendant of a node, to any depth, and none of the others', () => {
    expect(descendantIds(STORY_TREE, 'n1').sort()).toEqual(['n1-1', 'n1-1-1', 'n1-1-2', 'n1-2', 'n1-3', 'n1-4', 'n1-5']);
    expect(descendantIds(STORY_TREE, 'n1-1').sort()).toEqual(['n1-1-1', 'n1-1-2']);
    expect(descendantIds(STORY_TREE, 'n1-5')).toEqual([]);
    expect(descendantIds(STORY_TREE, 'missing')).toEqual([]);
  });

  it('refuses itself, a child and a deep descendant, and allows a sibling, an uncle, the top level and a node outside its own branch', () => {
    expect(canMove(STORY_TREE, 'n1', 'n1')).toBe(false);
    expect(canMove(STORY_TREE, 'n1', 'n1-1')).toBe(false);
    expect(canMove(STORY_TREE, 'n1', 'n1-1-2')).toBe(false);
    expect(canMove(STORY_TREE, 'n1-1', 'n1-2')).toBe(true);
    expect(canMove(STORY_TREE, 'n1-1-1', 'n1')).toBe(true);
    expect(canMove(STORY_TREE, 'n1-1', null)).toBe(true);
    expect(canMove(STORY_TREE, 'n1', 'n2')).toBe(true);
  });

  it('refuses a node or a parent that is not in the tree', () => {
    expect(canMove(STORY_TREE, 'missing', 'n1')).toBe(false);
    expect(canMove(STORY_TREE, 'n1', 'missing')).toBe(false);
  });

  it('a move changes no node but its place: the IDs and their number are the same before and after', () => {
    const after = moveNode(STORY_TREE, 'n1-1', 'n2', 0);
    expect(after.map((entry) => entry.id).sort()).toEqual(STORY_TREE.map((entry) => entry.id).sort());
  });
});
