import { describe, expect, it } from 'vitest';

import { costsSchema, FIGURE_STATES } from '@/server/views/schemas/costs';

/**
 * STORY-06.02 AC-4 (test strategy section 5.4, `no-rolled-up-figure`; architecture section 4.3): the strict schema of `GET /api/v1/estimates/{id}/costs` holds no sum over rows except BL, BN and the
 * total Tool Cost. A key that is not named is an error (so a rolled-up figure cannot be added by mistake, in any of the four places it could go), a figure is decimal text and never a number, and
 * the state is one of three words. Every figure is invented.
 */

const letters = { count: 'H', unitPrice: 'BG', unitPriceUsd: 'BJ', unitPriceEur: 'BK', totalPrice: 'BL', pricePerToolCost: 'BN', approvedPrice: 'BO' };
const node = { id: 'node-1', parentId: null, slNo: '1', name: 'Invented frame', count: '2', figures: { unitPrice: '0', unitPriceUsd: '0', unitPriceEur: '0' } };
const good = {
  state: 'current',
  calculatedAt: '2026-11-05T05:12:00.000Z',
  configurationNumber: 9,
  letters,
  nodes: [node],
  totals: { totalPrice: '30', pricePerToolCost: null, toolCostTotal: '0' },
};

describe('the answer, and exactly what it may hold', () => {
  it('accepts a good answer, and an answer of a state with no figure at all', () => {
    expect(costsSchema.safeParse(good).success).toBe(true);
    const none = { state: 'none', calculatedAt: null, configurationNumber: null, letters, nodes: [{ ...node, figures: null }], totals: null };
    expect(costsSchema.safeParse(none).success).toBe(true);
  });

  it('the states are none, current and out-of-date, and nothing else', () => {
    expect([...FIGURE_STATES]).toEqual(['none', 'current', 'out-of-date']);
    expect(costsSchema.safeParse({ ...good, state: 'cleared' }).success).toBe(false);
  });

  it('holds these keys and no others, at every level: the only sums are totalPrice (BL), pricePerToolCost (BN) and toolCostTotal', () => {
    expect(Object.keys(costsSchema.shape).sort()).toEqual(['calculatedAt', 'configurationNumber', 'letters', 'nodes', 'state', 'totals']);
    expect(Object.keys(costsSchema.shape.letters.shape).sort()).toEqual(['approvedPrice', 'count', 'pricePerToolCost', 'totalPrice', 'unitPrice', 'unitPriceEur', 'unitPriceUsd']);
    const nodeShape = costsSchema.shape.nodes.unwrap().element.shape;
    expect(Object.keys(nodeShape).sort()).toEqual(['count', 'figures', 'id', 'name', 'parentId', 'slNo']);
    const figuresShape = nodeShape.figures.unwrap().shape;
    expect(Object.keys(figuresShape).sort()).toEqual(['unitPrice', 'unitPriceEur', 'unitPriceUsd']);
    expect(Object.keys(costsSchema.shape.totals.unwrap().shape).sort()).toEqual(['pricePerToolCost', 'toolCostTotal', 'totalPrice']);
  });
});

describe('no-rolled-up-figure: a sum over rows is refused wherever it is planted', () => {
  it.each([
    ['an item total beside the totals', { ...good, itemTotals: ['30'] }],
    ['a roll-up at the top', { ...good, rollup: '30' }],
    ['a sum of the children on a part', { ...good, nodes: [{ ...node, childrenTotal: '30' }] }],
    ['an item total on a part', { ...good, nodes: [{ ...node, itemTotal: '30' }] }],
    ['a sum in a part\'s figures', { ...good, nodes: [{ ...node, figures: { ...node.figures, sumOfChildren: '30' } }] }],
    ['a roll-up in a part\'s figures', { ...good, nodes: [{ ...node, figures: { ...node.figures, rollup: '30' } }] }],
    ['an item total among the product figures', { ...good, totals: { ...good.totals, itemTotal: '30' } }],
    ['a per-item share among the product figures', { ...good, totals: { ...good.totals, itemShare: '30' } }],
  ])('%s fails the schema', (_name, planted) => {
    expect(costsSchema.safeParse(planted).success).toBe(false);
  });
});

describe('a figure is decimal text, never a number (ADR-005)', () => {
  it.each([
    ['a JavaScript number for BL', { ...good, totals: { ...good.totals, totalPrice: 30 } }],
    ['text that is no decimal for a row\'s figure', { ...good, nodes: [{ ...node, figures: { ...node.figures, unitPrice: 'thirty' } }] }],
    ['an exponent', { ...good, totals: { ...good.totals, totalPrice: '3e1' } }],
    ['a thousands separator', { ...good, totals: { ...good.totals, totalPrice: '1,234.50' } }],
    ['a count that is a number', { ...good, nodes: [{ ...node, count: 2 }] }],
  ])('%s fails the schema', (_name, planted) => {
    expect(costsSchema.safeParse(planted).success).toBe(false);
  });

  it('accepts a negative figure and a long fraction as text', () => {
    expect(costsSchema.safeParse({ ...good, totals: { ...good.totals, totalPrice: '-12.345678901234567890' } }).success).toBe(true);
  });
});
