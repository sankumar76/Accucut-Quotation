import { describe, expect, it } from 'vitest';

import { NODE_COST_LINE_KINDS, NODE_COST_STATES, nodeCostsSchema } from '@/server/views/schemas/node-costs';

/**
 * STORY-06.03 AC-1, AC-7, AC-8 (NFR-002; architecture sections 4.8, 4.9 and 6 "Cost details"): the strict schema of `GET /api/v1/estimates/{id}/nodes/{nodeId}/costs`. A key that is not named is an
 * error at every level, so nothing can be added to the answer by mistake (no other row, no master, no customer, no sum); a value is decimal text and never a number; the state is one of three words;
 * and the answer of a state with nothing current holds the row's place and `details: null`, so no stage can be in it. Every figure is invented.
 */

const line = { letter: 'AK', name: 'Material Cost', kind: 'calculated', group: null, unit: null, formula: '(M * I) - (O * Material-Scrap-Rate)', working: '(2.8260 × 58.00) - (0.4260 × 22.00)', value: '154.54', blank: false, hidden: false };
const stage = { number: 2, name: 'Material Cost', subHeadings: [], lines: [line], total: { letters: ['AK'], value: '154.54', shownLinesSum: null } };
const row = { nodeId: 'node-1', slNo: '1.2', name: 'Invented bracket' };
const details = { calculatedAt: '2026-11-05T05:12:00.000Z', configurationNumber: 9, letters: { count: 'H', unitPrice: 'BG' }, count: '2', notApplicable: false, hiddenLineCount: 0, stages: [stage] };
const current = { state: 'current', row, details };

describe('the answer, and exactly what it may hold', () => {
  it('accepts a current answer, and the answer of a state with nothing current', () => {
    expect(nodeCostsSchema.safeParse(current).success).toBe(true);
    for (const state of ['none', 'out-of-date']) expect(nodeCostsSchema.safeParse({ state, row, details: null }).success, state).toBe(true);
  });

  it('the states are none, current and out-of-date, and nothing else; a line is calculated, typed or looked up', () => {
    expect([...NODE_COST_STATES]).toEqual(['none', 'current', 'out-of-date']);
    expect([...NODE_COST_LINE_KINDS]).toEqual(['calculated', 'typed', 'lookup']);
    expect(nodeCostsSchema.safeParse({ ...current, state: 'cleared' }).success).toBe(false);
    expect(nodeCostsSchema.safeParse({ ...current, details: { ...details, stages: [{ ...stage, lines: [{ ...line, kind: 'rate' }] }] } }).success).toBe(false);
  });

  it('holds these keys and no others, at every level', () => {
    expect(Object.keys(nodeCostsSchema.shape).sort()).toEqual(['details', 'row', 'state']);
    expect(Object.keys(nodeCostsSchema.shape.row.shape).sort()).toEqual(['name', 'nodeId', 'slNo']);
    const detailsShape = nodeCostsSchema.shape.details.unwrap().shape;
    expect(Object.keys(detailsShape).sort()).toEqual(['calculatedAt', 'configurationNumber', 'count', 'hiddenLineCount', 'letters', 'notApplicable', 'stages']);
    expect(Object.keys(detailsShape.letters.shape).sort()).toEqual(['count', 'unitPrice']);
    const stageShape = detailsShape.stages.unwrap().element.shape;
    expect(Object.keys(stageShape).sort()).toEqual(['lines', 'name', 'number', 'subHeadings', 'total']);
    expect(Object.keys(stageShape.total.unwrap().shape).sort()).toEqual(['letters', 'shownLinesSum', 'value']);
    expect(Object.keys(stageShape.lines.unwrap().element.shape).sort()).toEqual(['blank', 'formula', 'group', 'hidden', 'kind', 'letter', 'name', 'unit', 'value', 'working']);
  });
});

describe('an extra key is refused wherever it is planted: no other row, no master, no customer and no sum can ride along', () => {
  it.each([
    ['at the top', { ...current, customer: 'Invented Customer' }],
    ['on the row', { ...current, row: { ...row, parentTotal: '30' } }],
    ['beside the stages', { ...current, details: { ...details, masterSnapshot: { rates: [] } } }],
    ['a sum over rows in the details', { ...current, details: { ...details, rowsTotal: '30' } }],
    ['on a letters object', { ...current, details: { ...details, letters: { ...details.letters, totalPrice: 'BL' } } }],
    ['on a stage', { ...current, details: { ...details, stages: [{ ...stage, operands: [] }] } }],
    ['on a stage total', { ...current, details: { ...details, stages: [{ ...stage, total: { ...stage.total, sumOfRows: '1' } }] } }],
    ['on a line', { ...current, details: { ...details, stages: [{ ...stage, lines: [{ ...line, rate: '58.00' }] }] } }],
    ['in a state with nothing current', { state: 'none', row, details: null, figures: { unitPrice: '1' } }],
  ])('%s fails the schema', (_name, planted) => {
    expect(nodeCostsSchema.safeParse(planted).success).toBe(false);
  });

  it('the stages are in the answer exactly when the state is current: a stage beside `none` or `out-of-date` fails, and so does a current answer with no stage (FR-100)', () => {
    expect(nodeCostsSchema.safeParse({ state: 'none', row, details }).success).toBe(false);
    expect(nodeCostsSchema.safeParse({ state: 'out-of-date', row, details }).success).toBe(false);
    expect(nodeCostsSchema.safeParse({ state: 'current', row, details: null }).success).toBe(false);
    const answer = nodeCostsSchema.parse({ state: 'out-of-date', row, details: null });
    expect(Object.keys(answer).sort()).toEqual(['details', 'row', 'state']);
  });
});

describe('a value is decimal text, never a number (ADR-005)', () => {
  it.each([
    ['a JavaScript number as a value', { ...current, details: { ...details, stages: [{ ...stage, lines: [{ ...line, value: 154.54 }] }] } }],
    ['text that is no decimal', { ...current, details: { ...details, stages: [{ ...stage, lines: [{ ...line, value: 'about 154' }] }] } }],
    ['an exponent', { ...current, details: { ...details, stages: [{ ...stage, lines: [{ ...line, value: '1.5e2' }] }] } }],
    ['a thousands separator', { ...current, details: { ...details, stages: [{ ...stage, lines: [{ ...line, value: '1,154.54' }] }] } }],
    ['a count that is a number', { ...current, details: { ...details, count: 2 } }],
    ['a stage total that is a number', { ...current, details: { ...details, stages: [{ ...stage, total: { ...stage.total, value: 154.54 } }] } }],
  ])('%s fails the schema', (_name, planted) => {
    expect(nodeCostsSchema.safeParse(planted).success).toBe(false);
  });

  it('accepts no figure (null) for a division by zero, a blank value, and a negative figure as text', () => {
    const answer = (value: string | null, blank = false) => ({ ...current, details: { ...details, stages: [{ ...stage, lines: [{ ...line, value, blank }] }] } });
    expect(nodeCostsSchema.safeParse(answer(null)).success).toBe(true);
    expect(nodeCostsSchema.safeParse(answer(null, true)).success).toBe(true);
    expect(nodeCostsSchema.safeParse(answer('-12.345678901234567890')).success).toBe(true);
  });
});
