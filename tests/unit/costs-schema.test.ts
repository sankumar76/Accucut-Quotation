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
  calculationId: '00000000-0000-4000-8000-0000000ca1c0',
  calculatedAt: '2026-11-05T05:12:00.000Z',
  configurationNumber: 9,
  letters,
  nodes: [node],
  totals: { totalPrice: '30', pricePerToolCost: null, toolCostTotal: '0' },
  approval: null,
  warning: null,
};

describe('the answer, and exactly what it may hold', () => {
  it('accepts a good answer, and an answer of a state with no figure at all', () => {
    expect(costsSchema.safeParse(good).success).toBe(true);
    const none = { state: 'none', calculationId: null, calculatedAt: null, configurationNumber: null, letters, nodes: [{ ...node, figures: null }], totals: null, approval: null, warning: null };
    expect(costsSchema.safeParse(none).success).toBe(true);
  });

  it('STORY-06.06 AC-9, STORY-06.07 AC-3, STORY-06.08 AC-3: BO is the approval row, which is there whatever the state of the figures (cleared figures, no calculation id), and is the price, the time, the approver, the total it was set against, whether it is an override, the reason and its unlock (null until unlocked), and nothing else', () => {
    const approval = { price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', approverName: 'Invented Lead', calculatedTotal: '12629.99', isOverride: true, reason: 'Rounded down for the quote.', unlock: null };
    const cleared = { ...good, state: 'out-of-date', calculationId: null, totals: null, nodes: [{ ...node, figures: null }] };
    expect(costsSchema.safeParse({ ...cleared, approval }).success).toBe(true);
    expect(Object.keys(costsSchema.shape.approval.unwrap().shape).sort()).toEqual(['approvedAt', 'approverName', 'calculatedTotal', 'isOverride', 'price', 'reason', 'unlock']);
    // An override with no reason (the reason is optional) and an approval at the calculated total are both good.
    expect(costsSchema.safeParse({ ...good, approval: { ...approval, reason: null } }).success).toBe(true);
    expect(costsSchema.safeParse({ ...good, approval: { ...approval, price: '12629.99', isOverride: false, reason: null } }).success).toBe(true);
    // A price and a total are rupees with two decimals as text; a number, a missing name, a flag that is not a boolean, an empty reason (none is null), a missing key and an extra key are refused.
    for (const planted of [
      { ...approval, price: 12600 },
      { ...approval, price: '12600' },
      { ...approval, calculatedTotal: '12629.9876' },
      { ...approval, calculatedTotal: 12629.99 },
      { ...approval, approverName: '' },
      { ...approval, isOverride: 'yes' },
      { ...approval, reason: '' },
      { ...approval, reason: 7 },
      { ...approval, isOverride: false },
      { price: approval.price, approvedAt: approval.approvedAt, approverName: approval.approverName },
      { ...approval, rate: '0.37' },
    ]) {
      expect(costsSchema.safeParse({ ...good, approval: planted }).success, JSON.stringify(planted)).toBe(false);
    }
  });

  it('STORY-06.08 AC-3: the unlock of the approval is who, when, why and whose queue, as text and a time, and nothing else: no figure, no ID', () => {
    const unlock = { at: '2026-11-05T06:35:00.000Z', byName: 'Invented Kiran', reason: 'The customer asked for a thicker plate.', engineerName: 'Invented Priya' };
    const approval = { price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', approverName: 'Invented Lead', unlock };
    expect(costsSchema.safeParse({ ...good, approval }).success).toBe(true);
    expect(costsSchema.safeParse({ ...good, approval: { ...approval, unlock: { ...unlock, reason: null } } }).success).toBe(true);
    expect(Object.keys(costsSchema.shape.approval.unwrap().shape.unlock.unwrap().shape).sort()).toEqual(['at', 'byName', 'engineerName', 'reason']);
    for (const planted of [{ ...unlock, price: '1.00' }, { ...unlock, byName: '' }, { ...unlock, engineerName: '' }, { ...unlock, at: 'yesterday' }, { ...unlock, reason: 5 }]) {
      expect(costsSchema.safeParse({ ...good, approval: { ...approval, unlock: planted } }).success).toBe(false);
    }
  });

  it('STORY-06.10 AC-3: the warning is who went ahead and the rows (Sl. No and name as text), and nothing else: no figure, no ID of a calculation, no code, no time of its own', () => {
    const warning = { madeBy: 'Invented Lead', rows: [{ nodeId: 'node-1', slNo: '2.2', label: 'Invented arm' }] };
    expect(costsSchema.safeParse({ ...good, warning }).success).toBe(true);
    expect(Object.keys(costsSchema.shape.warning.unwrap().shape).sort()).toEqual(['madeBy', 'rows']);
    expect(Object.keys(costsSchema.shape.warning.unwrap().shape.rows.unwrap().element.shape).sort()).toEqual(['label', 'nodeId', 'slNo']);
    // A warning with no row, no name, a figure or a key that is not named is refused; the part's name may be empty (a part with no name).
    for (const planted of [
      { ...warning, rows: [] },
      { ...warning, madeBy: '' },
      { ...warning, total: '30' },
      { ...warning, rows: [{ ...warning.rows[0], unitPrice: '0' }] },
      { ...warning, rows: [{ ...warning.rows[0], slNo: '' }] },
    ]) {
      expect(costsSchema.safeParse({ ...good, warning: planted }).success).toBe(false);
    }
    expect(costsSchema.safeParse({ ...good, warning: { ...warning, rows: [{ ...warning.rows[0], label: '' }] } }).success).toBe(true);
    // The key is always there: `null` says "no warning", and an answer that leaves it out is a fault, not a clean estimate.
    expect(costsSchema.safeParse({ ...good, warning: undefined }).success).toBe(false);
  });

  it('the calculation ID is an ID or null, never any other text', () => {
    expect(costsSchema.safeParse({ ...good, calculationId: 'not-an-id' }).success).toBe(false);
  });

  it('the states are none, current and out-of-date, and nothing else', () => {
    expect([...FIGURE_STATES]).toEqual(['none', 'current', 'out-of-date']);
    expect(costsSchema.safeParse({ ...good, state: 'cleared' }).success).toBe(false);
  });

  it('holds these keys and no others, at every level: the only sums are totalPrice (BL), pricePerToolCost (BN) and toolCostTotal', () => {
    expect(Object.keys(costsSchema.shape).sort()).toEqual(['approval', 'calculatedAt', 'calculationId', 'configurationNumber', 'letters', 'nodes', 'state', 'totals', 'warning']);
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
