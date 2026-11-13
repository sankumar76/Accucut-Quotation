import { describe, expect, it } from 'vitest';

import { buildTree500, DEFAULT_TREE500_SEED, TREE500_MAX_DEPTH, TREE500_NODE_COUNT, type Tree500 } from '../support/builders/tree500';
import { seedConfig } from '../support/seed-config';

/**
 * STORY-03.06 AC-3 (test strategy section 4, `tree500`): the fixture is deterministic and has the shape the timing test needs. No timing here,
 * so this runs on every pull request.
 */

/** The tree as plain text, so two builds are compared by value, digit for digit. */
const asText = (tree: Tree500): string =>
  JSON.stringify(tree.nodes.map((node) => [node.index, node.sl, node.depth, node.parentIndex, [...node.inputs].map(([id, value]) => [id, value.toString()])]));

describe('tree500 (AC-3)', () => {
  const tree = buildTree500();

  it('built twice with the same seed gives the same tree', () => {
    expect(asText(buildTree500(DEFAULT_TREE500_SEED))).toBe(asText(tree));
    expect(asText(buildTree500(7))).toBe(asText(buildTree500(7)));
  });

  it('another seed gives another tree', () => {
    expect(asText(buildTree500(DEFAULT_TREE500_SEED + 1))).not.toBe(asText(tree));
  });

  it('has 500 nodes, up to a depth of 6, and reaches it', () => {
    expect(tree.nodes).toHaveLength(TREE500_NODE_COUNT);
    expect(Math.max(...tree.nodes.map((node) => node.depth))).toBe(TREE500_MAX_DEPTH);
    expect(Math.min(...tree.nodes.map((node) => node.depth))).toBe(1);
  });

  it.each([1, 2, 3, 99])('reaches a depth of 6 for seed %i too', (seed) => {
    expect(Math.max(...buildTree500(seed).nodes.map((node) => node.depth))).toBe(TREE500_MAX_DEPTH);
  });

  it('is a tree: a parent comes before its children, one level up, and Sl. No is the parent\'s plus a position', () => {
    for (const node of tree.nodes) {
      if (node.parentIndex === null) {
        expect(node.depth).toBe(1);
        expect(node.sl).toMatch(/^\d+$/);
        continue;
      }
      const parent = tree.nodes[node.parentIndex];
      expect(parent?.index).toBeLessThan(node.index);
      expect(node.depth).toBe((parent?.depth ?? 0) + 1);
      expect(node.sl.startsWith(`${parent?.sl}.`)).toBe(true);
    }
  });

  it('has several top-level items, and no two nodes share a Sl. No', () => {
    expect(tree.nodes.filter((node) => node.parentIndex === null).length).toBeGreaterThan(1);
    expect(new Set(tree.nodes.map((node) => node.sl)).size).toBe(TREE500_NODE_COUNT);
  });

  it('gives every number and flag input of the registry a value, flags 0 or 1, and nothing else', () => {
    const typed = seedConfig.fields.filter((field) => field.kind === 'input' && (field.dataType === 'number' || field.dataType === 'flag'));
    for (const node of tree.nodes) {
      expect(node.inputs.size).toBe(typed.length);
      for (const field of typed) {
        const value = node.inputs.get(field.id);
        expect(value, field.key).toBeDefined();
        if (field.kind === 'input' && field.dataType === 'flag') expect(['0', '1']).toContain(value?.toString());
      }
    }
  });
});
