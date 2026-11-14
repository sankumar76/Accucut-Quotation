import { Decimal } from '../../../src/lib/decimal';
import type { ConfigDocument } from '../../../src/lib/fields/schema';
import { seedConfig } from '../seed-config';

/**
 * The `tree500` fixture (test strategy section 4): 500 nodes, depth up to 6, every value invented (NFR-006, ADR-014). It is built from a
 * seed by a small generator (mulberry32), so the same seed always gives the same tree and a slow run can be rebuilt exactly (STORY-03.06 AC-3).
 *
 * The shape: the first six nodes are one chain, so the tree reaches the depth of 6 whatever the seed; then each node goes under a random earlier
 * node that is not yet at depth 6, or (one time in 25) becomes a new top-level item. Every number and flag input of the registry gets a value:
 * flags 0 or 1, QTY per Assy a whole number from 1 to 24, anything else a figure from 0 to 500 with two decimals.
 */

export const TREE500_NODE_COUNT = 500;
export const TREE500_MAX_DEPTH = 6;
export const DEFAULT_TREE500_SEED = 20261113;

/** One in this many nodes (after the first chain) starts a new top-level item. */
const TOP_LEVEL_ONE_IN = 25;
const MAX_QUANTITY = 24;
const MAX_FIGURE_CENTS = 50_000;
const FLAG_ONE_IN = 3;

export interface TreeNode {
  readonly index: number;
  /** The Sl. No in the tree, for example `2.1.3`. */
  readonly sl: string;
  /** 1 for a top-level item. */
  readonly depth: number;
  readonly parentIndex: number | null;
  /** The typed numbers and flags by field ID. */
  readonly inputs: ReadonlyMap<string, Decimal>;
}

export interface Tree500 {
  readonly seed: number;
  readonly nodes: ReadonlyArray<TreeNode>;
}

/** A small deterministic generator, so a tree can be rebuilt from its seed without a library. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueFor(next: () => number, dataType: string, key: string): Decimal {
  if (dataType === 'flag') return new Decimal(next() * FLAG_ONE_IN < 1 ? 1 : 0);
  if (key === 'qty-per-assy') return new Decimal(1 + Math.floor(next() * MAX_QUANTITY));
  return new Decimal(Math.floor(next() * MAX_FIGURE_CENTS)).div(100);
}

function inputsFor(next: () => number, document: ConfigDocument): Map<string, Decimal> {
  const inputs = new Map<string, Decimal>();
  for (const field of document.fields) {
    if (field.kind === 'input' && (field.dataType === 'number' || field.dataType === 'flag')) inputs.set(field.id, valueFor(next, field.dataType, field.key));
  }
  return inputs;
}

export function buildTree500(seed: number = DEFAULT_TREE500_SEED, document: ConfigDocument = seedConfig): Tree500 {
  const next = random(seed);
  const nodes: TreeNode[] = [];
  const children = new Map<number | null, number>();
  for (let index = 0; index < TREE500_NODE_COUNT; index += 1) {
    const eligible = nodes.filter((node) => node.depth < TREE500_MAX_DEPTH);
    const chained = index < TREE500_MAX_DEPTH;
    const startsItem = index === 0 || (!chained && next() * TOP_LEVEL_ONE_IN < 1);
    const parent = startsItem ? undefined : chained ? nodes[index - 1] : eligible[Math.floor(next() * eligible.length)];
    const parentIndex = parent?.index ?? null;
    const position = (children.get(parentIndex) ?? 0) + 1;
    children.set(parentIndex, position);
    nodes.push({
      index,
      sl: parent === undefined ? String(position) : `${parent.sl}.${position}`,
      depth: (parent?.depth ?? 0) + 1,
      parentIndex,
      inputs: inputsFor(next, document),
    });
  }
  return { seed, nodes };
}
