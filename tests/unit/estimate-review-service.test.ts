import { describe, expect, it } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { ConfigDocument } from '@/lib/fields/schema';
import type { SystemRole } from '@/lib/fields/types';
import { createEstimateReviewService } from '@/server/services/estimate-review-service';
import { costsSchema } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { CALCULATION_REVISION, createReviewWorld, REVIEW_CALCULATED_AT, REVIEW_CONFIGURATION_NUMBER, REVIEW_ESTIMATE_ID, REVIEW_FIELDS } from '../support/review-world';
import { seedConfig } from '../support/seed-config';

import { QUANTITY_CASES, type QuantityCase } from './quantity/quantity-cases';

/**
 * STORY-06.02 AC-1 to AC-4 and AC-7 (FR-024, FR-025, FR-029, FR-030; architecture sections 4.3, 4.8 and 6 "Cost"; NFR-002): the review service over in-memory parts and an in-memory calculation record,
 * with the constructed quantity cases CE-1, CE-2, CE-4 and CE-12 as the data, so the figures of the answer are compared with numbers worked by hand and not with the code's own. Who may call it, and
 * the strict schema, are `estimate-review-route.test.ts` and `tests/security/*`. Every name, ID and number is invented.
 */

const LEAD = { id: '00000000-0000-4000-8000-0000000001ed', role: 'LEAD' } as const;
const ADMIN = { id: '00000000-0000-4000-8000-0000000ad314', role: 'ADMIN' } as const;
const ENGINEER = { id: '00000000-0000-4000-8000-0000000e9142', role: 'ENGINEER' } as const;

const caseOf = (id: string): QuantityCase => defined(QUANTITY_CASES.find((candidate) => candidate.id === id));

/** The cases the story names. CE-12 is its variants A to D (a childless item), CE-4 its parent and child. */
const STORY_CASES = ['CE-1', 'CE-2 A', 'CE-12 A', 'CE-12 B', 'CE-12 D'] as const;

describe('AC-1, AC-2, AC-3: a current calculation gives each row its own figure and BL its stated value', () => {
  it.each(STORY_CASES)('%s: every row has its own stated BG and its typed count, and BL is the stated total', async (id) => {
    const quantityCase = caseOf(id);
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('current');
    expect(costs.nodes.map((node) => [node.slNo, node.count, node.figures?.unitPrice])).toEqual(quantityCase.rows.map((row) => [row.sl, row.h, row.bg]));
    expect(costs.totals?.totalPrice).toBe(quantityCase.bl);
  });

  it('CE-1 (0, 6, 24): the BG column adds up to BL, 30', async () => {
    const quantityCase = caseOf('CE-1');
    const costs = await createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    const column = costs.nodes.map((node) => Number(node.figures?.unitPrice));
    expect(column).toEqual([0, 6, 24]);
    expect(column.reduce((sum, figure) => sum + figure, 0)).toBe(30);
    expect(costs.totals?.totalPrice).toBe('30');
  });

  it('CE-4: a parent shows only its own row: no sum of its children, no item total, no multiplier (rows 10 and 5, BL 15)', async () => {
    const rows = [
      { sl: '1', h: '1', cost: '0', bg: '0' },
      { sl: '1.1', h: '1', cost: '10', bg: '10' },
      { sl: '1.1.1', h: '1', cost: '5', bg: '5' },
    ];
    const costs = await createReviewWorld({ rows, bl: '15' }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.nodes.map((node) => node.figures?.unitPrice)).toEqual(['0', '10', '5']);
    expect(costs.totals?.totalPrice).toBe('15');
    // The parent's own row is 10, never 15 (the sum of itself and its child), and the item's is 0, never 15.
    expect(costs.nodes.some((node) => node.figures?.unitPrice === '15')).toBe(false);
  });

  it('gives each row its BJ and BK as well, and the product its BN and total Tool Cost, as full-precision text', async () => {
    const world = createReviewWorld({ rows: [{ sl: '1', h: '5', cost: '200', bg: '1000' }], bl: '1000', toolCostTotal: '250', pricePerToolCost: '4' });
    const costs = await world.service.getCosts(ADMIN, REVIEW_ESTIMATE_ID);
    expect(costs.nodes[0]?.figures).toEqual({ unitPrice: '1000', unitPriceUsd: '12.5', unitPriceEur: '11.11111111111111' });
    expect(costs.totals).toEqual({ totalPrice: '1000', pricePerToolCost: '4', toolCostTotal: '250' });
  });

  it('BN is null (a dash on the screen) when no Tool Cost was entered', async () => {
    const world = createReviewWorld({ rows: [{ sl: '1', h: '1', cost: '5', bg: '5' }], bl: '5', toolCostTotal: '0', pricePerToolCost: null });
    expect((await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).totals).toEqual({ totalPrice: '5', pricePerToolCost: null, toolCostTotal: '0' });
  });

  it('puts the parts in reading order with the Sl. No read from the tree, a part under its parent', async () => {
    const quantityCase = caseOf('CE-1');
    const costs = await createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.nodes.map((node) => [node.slNo, node.parentId === null])).toEqual([
      ['1', true],
      ['1.1', false],
      ['1.1.1', false],
    ]);
    expect(costs.nodes[1]?.parentId).toBe(costs.nodes[0]?.id);
  });
});

describe('AC-4: the state, when, and with which configuration', () => {
  it('a current calculation carries its time as an ISO instant, the number of the version it used and the derived column letters', async () => {
    const quantityCase = caseOf('CE-1');
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.calculatedAt).toBe(REVIEW_CALCULATED_AT.toISOString());
    // The version the calculation was made with (9), not the one in force now (10).
    expect(costs.configurationNumber).toBe(REVIEW_CONFIGURATION_NUMBER);
    expect(costs.letters).toEqual({ count: 'H', unitPrice: 'BG', unitPriceUsd: 'BJ', unitPriceEur: 'BK', totalPrice: 'BL', pricePerToolCost: 'BN', approvedPrice: 'BO' });
  });

  it('the answer is exactly what the strict schema allows (it is parsed before it leaves)', async () => {
    const quantityCase = caseOf('CE-1');
    const costs = await createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costsSchema.parse(costs)).toEqual(costs);
  });

  it('a part is named by its Description, else its Part No., else by nothing', async () => {
    const rows = [
      { sl: '1', h: '1', cost: '1', bg: '1' },
      { sl: '2', h: '1', cost: '1', bg: '1' },
      { sl: '3', h: '1', cost: '1', bg: '1' },
    ];
    const world = createReviewWorld({ rows, bl: '3', names: { '1': 'Invented Bracket' } });
    const second = defined(world.nodes[1]);
    world.nodes[1] = { ...second, inputs: { ...second.inputs, [REVIEW_FIELDS.partNo]: 'INV-0002' } };
    const third = defined(world.nodes[2]);
    world.nodes[2] = { ...third, inputs: { ...third.inputs, [REVIEW_FIELDS.description]: '   ' } };
    expect((await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).nodes.map((node) => node.name)).toEqual(['Invented Bracket', 'INV-0002', '']);
  });

  it('a part with no count typed has a null count, and a count that is no number is left out', async () => {
    const world = createReviewWorld({ rows: [{ sl: '1', h: '1', cost: '1', bg: '1' }, { sl: '2', h: '1', cost: '1', bg: '1' }], bl: '2' });
    world.nodes[0] = { ...defined(world.nodes[0]), inputs: {} };
    world.nodes[1] = { ...defined(world.nodes[1]), inputs: { [REVIEW_FIELDS.count]: 'many' } };
    expect((await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).nodes.map((node) => node.count)).toEqual([null, null]);
  });

  it('a row of the tree with no row in the record has no figure, a dash, and not a wrong one', async () => {
    const world = createReviewWorld({ rows: [{ sl: '1', h: '1', cost: '1', bg: '1' }, { sl: '2', h: '1', cost: '1', bg: '1' }], bl: '2' });
    world.nodes.push({ id: '00000000-0000-4000-8000-0000000000aa', parentId: null, sortIndex: 2, revision: 1, inputs: {} });
    expect((await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).nodes.map((node) => node.figures === null)).toEqual([false, false, true]);
  });

  it('a figure of the record that is no decimal is shown as no figure and never passed on', async () => {
    const world = createReviewWorld({ rows: [{ sl: '1', h: '1', cost: '1', bg: 'oops' }], bl: '1' });
    expect((await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).nodes[0]?.figures).toEqual({ unitPrice: null, unitPriceUsd: null, unitPriceEur: null });
  });
});

describe('AC-6, AC-7: figures only while current; no figure is even read otherwise', () => {
  const quantityCase = caseOf('CE-1');

  it('NONE: no calculation is linked. No node has a figure, there are no totals, no time and no version number, and the record is never read', async () => {
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl, calculated: false });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('none');
    expect(costs.nodes.every((node) => node.figures === null)).toBe(true);
    expect(costs).toMatchObject({ totals: null, calculatedAt: null, configurationNumber: null });
    expect(world.reads.figures.calls).toEqual([]);
    // The count is an input, so it stays.
    expect(costs.nodes.map((node) => node.count)).toEqual(['2', '6', '24']);
  });

  it('OUT OF DATE: an input changed since. The figures of the record are not read and not in the answer, in any form, and the count stays', async () => {
    const world = createReviewWorld({ rows: quantityCase.rows, bl: '1234567.89', inputsRevision: CALCULATION_REVISION + 1 });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('out-of-date');
    expect(costs.nodes.every((node) => node.figures === null)).toBe(true);
    expect(costs.totals).toBeNull();
    expect(world.reads.figures.calls).toEqual([]);
    expect(JSON.stringify(costs)).not.toContain('1234567.89');
    expect(costs.nodes.map((node) => node.count)).toEqual(['2', '6', '24']);
    // The time and the version are not figures, and say which calculation went out of date.
    expect(costs.calculatedAt).toBe(REVIEW_CALCULATED_AT.toISOString());
    expect(costs.configurationNumber).toBe(REVIEW_CONFIGURATION_NUMBER);
  });

  it('a calculation that is somehow ahead of its estimate is out of date, never current', async () => {
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl, inputsRevision: CALCULATION_REVISION - 1 });
    expect((await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).state).toBe('out-of-date');
    expect(world.reads.figures.calls).toEqual([]);
  });

  it('CURRENT: the record is read once, by the ID of the linked calculation', async () => {
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(world.reads.figures.calls).toHaveLength(1);
    expect(world.reads.basis.calls).toEqual([[REVIEW_ESTIMATE_ID]]);
  });

  it('a current calculation whose record cannot be read is a fault (a plain error), never a screen of dashes shown as the answer', async () => {
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    const broken = createReviewWorldWithoutRecord(world);
    await expect(broken.getCosts(LEAD, REVIEW_ESTIMATE_ID)).rejects.toThrow('The calculation linked to the estimate could not be read.');
  });

  it('a configuration version without the field of the count is a fault in the data, said in plain words', async () => {
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    const withoutCount = { ...world.dependencies, configuration: { ...world.dependencies.configuration, byId: async () => ({ ...(await world.dependencies.configuration.current()), document: stripRole('quantity') }) } };
    await expect(createEstimateReviewService(withoutCount).getCosts(LEAD, REVIEW_ESTIMATE_ID)).rejects.toThrow('The configuration version has no field for the count of a part.');
  });
});

describe('AC-5: an Engineer is refused before anything is read', () => {
  it.each([REVIEW_ESTIMATE_ID, '00000000-0000-4000-8000-00000000dead', 'not-an-id'])('refuses an Engineer asking for %s with no read at all', async (id) => {
    const quantityCase = caseOf('CE-1');
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    await expect(world.service.getCosts(ENGINEER, id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(world.reads.basis.calls).toEqual([]);
    expect(world.reads.nodes.calls).toEqual([]);
    expect(world.reads.figures.calls).toEqual([]);
  });

  it('an estimate that does not exist is a 404 for a Lead and reads nothing more', async () => {
    const quantityCase = caseOf('CE-1');
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    await expect(world.service.getCosts(LEAD, '00000000-0000-4000-8000-00000000dead')).rejects.toBeInstanceOf(NotFoundError);
    expect(world.reads.nodes.calls).toEqual([]);
    expect(world.reads.figures.calls).toEqual([]);
  });
});

describe('AC-8 (shape): a tree of 500 parts is answered in full, with one read of the record', () => {
  it('lists every part with its own figure', async () => {
    const rows = Array.from({ length: 500 }, (_, index) => ({ sl: String(index + 1), h: '1', cost: '2', bg: String(index + 1) }));
    const world = createReviewWorld({ rows, bl: '125250' });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.nodes).toHaveLength(500);
    expect(costs.nodes[499]?.figures?.unitPrice).toBe('500');
    expect(world.reads.figures.calls).toHaveLength(1);
    expect(world.reads.nodes.calls).toHaveLength(1);
  });
});

/** The same dependencies, but the record of the linked calculation is not there. */
function createReviewWorldWithoutRecord(world: ReturnType<typeof createReviewWorld>) {
  return createEstimateReviewService({ ...world.dependencies, calculations: { ...world.dependencies.calculations, findReviewFigures: () => Promise.resolve(null) } });
}

/** The seed registry with one system role taken away, so the review cannot find the field it needs. */
function stripRole(role: SystemRole): ConfigDocument {
  return { ...seedConfig, fields: seedConfig.fields.map((field) => (field.systemRole === role ? { ...field, systemRole: null } : field)) };
}
