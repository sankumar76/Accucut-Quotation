import { describe, expect, it } from 'vitest';

import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { ConfigDocument } from '@/lib/fields/schema';
import type { SystemRole } from '@/lib/fields/types';
import { createEstimateReviewService } from '@/server/services/estimate-review-service';
import { costsSchema } from '@/server/views/schemas/costs';

import { defined } from '../support/defined';
import { CALCULATION_REVISION, createReviewWorld, INVENTED_CALCULATION_ID, nodeIdOfRow, REVIEW_CALCULATED_AT, REVIEW_CONFIGURATION_NUMBER, REVIEW_ESTIMATE_ID, REVIEW_FIELDS } from '../support/review-world';
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
    world.nodes.push({ id: '00000000-0000-4000-8000-0000000000aa', parentId: null, sortIndex: 2, revision: 1, imageId: null, inputs: {} });
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

  it('review SQR-01: the roles let through are exactly the Lead and the Admin, by name', async () => {
    const quantityCase = caseOf('CE-1');
    const allowed: string[] = [];
    for (const role of ['ADMIN', 'LEAD', 'ENGINEER'] as const) {
      const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
      const outcome = await world.service.getCosts({ id: ENGINEER.id, role }, REVIEW_ESTIMATE_ID).then(
        () => 'allowed',
        () => 'refused',
      );
      if (outcome === 'allowed') allowed.push(role);
    }
    expect(allowed).toEqual(['ADMIN', 'LEAD']);
  });

  it('review SQR-01: a role that is none of the three (a fourth, added later) is refused before anything is read', async () => {
    const quantityCase = caseOf('CE-1');
    const world = createReviewWorld({ rows: quantityCase.rows, bl: quantityCase.bl });
    const fourth = { id: ENGINEER.id, role: 'INVENTED_VIEWER' } as unknown as Parameters<typeof world.service.getCosts>[0];
    await expect(world.service.getCosts(fourth, REVIEW_ESTIMATE_ID)).rejects.toThrow('Unhandled role.');
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

describe('STORY-06.06 AC-9 (AQP-321 AC-4): BO is read from the approvals row, never through the figure state', () => {
  const CE1 = caseOf('CE-1');
  const approval = { price: '12600.00', approverName: 'Invented Kiran' };

  it('AQP-321 AC-4: with an approval, clearing the calculated figures leaves BO as it was and clears BL', async () => {
    const approved = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, approval });
    const before = await approved.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(before.state).toBe('current');
    expect(before.totals?.totalPrice).toBe(CE1.bl);
    // The same estimate with an input changed since: the figures are cleared, the approval is not.
    const cleared = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, approval, inputsRevision: CALCULATION_REVISION + 1 });
    const after = await cleared.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(after.state).toBe('out-of-date');
    expect(after.totals).toBeNull();
    expect(after.approval).toEqual(before.approval);
    expect(after.approval).toEqual({ price: '12600.00', approvedAt: '2026-11-05T05:50:00.000Z', approverName: 'Invented Kiran' });
    // BL is cleared, and no calculated figure was read to say so.
    expect(cleared.reads.figures.calls).toEqual([]);
    expect(cleared.reads.approvals.calls).toEqual([[REVIEW_ESTIMATE_ID]]);
  });

  it('BO is there when no calculation is linked at all, and is null before any approval, in every state', async () => {
    const neverCalculated = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, calculated: false, approval });
    expect((await neverCalculated.service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).approval?.price).toBe('12600.00');
    for (const options of [{}, { inputsRevision: CALCULATION_REVISION + 1 }, { calculated: false }]) {
      expect((await createReviewWorld({ rows: CE1.rows, bl: CE1.bl, ...options }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).approval).toBeNull();
    }
  });

  it('the calculation ID is in the answer only while the figures are current', async () => {
    const current = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(current.calculationId).toBe(INVENTED_CALCULATION_ID);
    for (const options of [{ inputsRevision: CALCULATION_REVISION + 1 }, { calculated: false }]) {
      expect((await createReviewWorld({ rows: CE1.rows, bl: CE1.bl, ...options }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).calculationId).toBeNull();
    }
  });

  it('an Engineer is refused before the approvals are read, as before everything else', async () => {
    const world = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, approval });
    await expect(world.service.getCosts(ENGINEER, REVIEW_ESTIMATE_ID)).rejects.toBeInstanceOf(ForbiddenError);
    expect(world.reads.approvals.calls).toEqual([]);
  });
});

describe('STORY-06.10 AC-3, AC-4, AC-6: the quantity warning of the calculation in view', () => {
  // CE-1: rows 1 (H 0), 1.1 (H 6) and 1.1.1 (H 24): the item's own 0 is the one warned row.
  const CE1 = caseOf('CE-1');
  const warned = [{ code: 'QTY_ZERO', nodeId: nodeIdOfRow(CE1.rows, '1'), slNo: '1', label: 'Invented frame' }];

  it('AC-3: a current calculation with warnings gives who went ahead and each warned row (part, Sl. No and name as text), and the calculation\'s own time', async () => {
    const costs = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl, warnings: warned, madeBy: 'Invented Priya' }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('current');
    expect(costs.warning).toEqual({ madeBy: 'Invented Priya', rows: [{ nodeId: nodeIdOfRow(CE1.rows, '1'), slNo: '1', label: 'Invented frame' }] });
    expect(costs.calculatedAt).toBe(REVIEW_CALCULATED_AT.toISOString());
  });

  it('AC-3: the code of a warning is not passed on, and a calculation made without warnings has none', async () => {
    const costs = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl, warnings: warned }).service.getCosts(ADMIN, REVIEW_ESTIMATE_ID);
    expect(JSON.stringify(costs.warning)).not.toContain('QTY_ZERO');
    expect((await createReviewWorld({ rows: CE1.rows, bl: CE1.bl }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID)).warning).toBeNull();
  });

  it('AC-4: while the figures are cleared (`out-of-date`) there is no warning, and the record is not read to say so', async () => {
    const world = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, warnings: warned, inputsRevision: CALCULATION_REVISION + 1 });
    const costs = await world.service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('out-of-date');
    expect(costs.warning).toBeNull();
    expect(world.reads.figures.calls).toEqual([]);
  });

  it('AC-4: while nothing was calculated (`none`) there is no warning either', async () => {
    const costs = await createReviewWorld({ rows: CE1.rows, bl: CE1.bl, warnings: warned, calculated: false }).service.getCosts(LEAD, REVIEW_ESTIMATE_ID);
    expect(costs.state).toBe('none');
    expect(costs.warning).toBeNull();
  });

  it('AC-6 (NFR-002): an Engineer is refused before the record, and so its warnings, is read', async () => {
    const world = createReviewWorld({ rows: CE1.rows, bl: CE1.bl, warnings: warned });
    await expect(world.service.getCosts(ENGINEER, REVIEW_ESTIMATE_ID)).rejects.toBeInstanceOf(ForbiddenError);
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
