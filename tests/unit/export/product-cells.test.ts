import { describe, expect, it } from 'vitest';

import { exportColumnsOf } from '@/server/export/export-columns';
import { exportModelSchema, type ExportRow } from '@/server/export/export-model';
import { approvedPriceOf, footerOf, productCellAddresses, TOTAL_TOOL_COST_LABEL, withProductCells } from '@/server/export/product-cells';

import { cloneSeedConfig, seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * The cells of row 2 and the footer (STORY-07.03 AC-1 to AC-6; FR-069, FR-103, FR-107/108; D-05, D-16, D-29; SPEC section 10; architecture sections 4.6 and 4.10): one pure module decides them, from the
 * registry and four figures, so a test calls it with no database. A letter is written here only because this is a test (coding standards section 10); the code under test finds the cells by role.
 */

const FIGURES = { totalPrice: '12629.987654321', pricePerToolCost: '2.577', toolCostTotal: '4900', approvedPrice: '12600.00' };

/** `count` node rows holding only their Sl. No and their own Tool Cost (BM), as `exportRowsOf` leaves them: BL, BN and BO empty. */
const rowsOf = (count: number): ExportRow[] =>
  Array.from({ length: count }, (_, index) => ({ cells: { A: String(index + 1), BM: index + 1, BL: null, BN: null, BO: null }, picture: null }));

describe('AC-1 (D-16): BL2, BN2 and BO2 once, in row 2, and no per-item totals', () => {
  it('puts the three figures in the BL, BN and BO cells of the first row and nowhere else', () => {
    const rows = withProductCells(seedConfig, rowsOf(10), FIGURES);
    expect(rows).toHaveLength(10);
    expect([rows[0]?.cells['BL'], rows[0]?.cells['BN'], rows[0]?.cells['BO']]).toEqual([12629.987654321, 2.577, 12600]);
    for (const row of rows.slice(1)) for (const letter of ['BL', 'BN', 'BO']) expect(row.cells[letter], letter).toBeNull();
  });

  it("leaves every other cell of every row as it was, row 2's own Tool Cost (BM) included", () => {
    const before = rowsOf(3);
    const rows = withProductCells(seedConfig, before, FIGURES);
    expect(rows.map((row) => [row.cells['A'], row.cells['BM']])).toEqual([['1', 1], ['2', 2], ['3', 3]]);
  });

  it('does not change the rows it is given', () => {
    const before = rowsOf(2);
    const copy = structuredClone(before);
    withProductCells(seedConfig, before, FIGURES);
    expect(before).toEqual(copy);
  });

  it('finds the cells by the field, so they follow their columns when a field is inserted before them and the letters move', () => {
    const moved = cloneSeedConfig();
    const template = seedFieldAt('AJ');
    // A new field at position 60 pushes BL, BM, BN and BO one column to the right (BM, BN, BO, BP).
    const shifted = moved.fields.map((field) => (field.position >= 60 ? { ...field, position: field.position + 1 } : field));
    const inserted = { ...template, id: '00000000-0000-4000-8000-00000000f060', key: 'inserted-for-the-test', label: 'Inserted', position: 60 };
    const document = { ...moved, fields: [...shifted, inserted] };
    const rows = withProductCells(document, [{ cells: { A: '1' }, picture: null }], FIGURES);
    expect(rows[0]?.cells['BM']).toBe(12629.987654321);
    expect(rows[0]?.cells['BO']).toBe(2.577);
    expect(rows[0]?.cells['BP']).toBe(12600);
    expect(rows[0]?.cells['BL']).toBeUndefined();
    expect(productCellAddresses(document, 1)).toEqual({ bl: 'BM2', bn: 'BO2', bo: 'BP2', toolCostTotal: 'BN4' });
  });

  it('has no row to put the figures in when there are no node rows, and says nothing then', () => {
    expect(withProductCells(seedConfig, [], FIGURES)).toEqual([]);
  });
});

describe('AC-3 (D-05): the footer at lastNodeRow + 2, the label to the left of the Tool Cost column', () => {
  it('10 parts in rows 2 to 11 give row 13, with "Total Tool Cost" in BL13 and the sum (no quantity applied) in BM13', () => {
    const footer = footerOf(seedConfig, 10, '5');
    expect(footer.row).toBe(13);
    expect(footer.cells).toEqual({ BL: TOTAL_TOOL_COST_LABEL, BM: 5 });
    expect(TOTAL_TOOL_COST_LABEL).toBe('Total Tool Cost');
  });

  it('one part gives row 4, one empty row (3) below its own row (2)', () => {
    expect(footerOf(seedConfig, 1, '5').row).toBe(4);
  });

  it('with no Tool Cost the footer shows 0, whether the stored total is null or "0"', () => {
    expect(footerOf(seedConfig, 3, null).cells['BM']).toBe(0);
    expect(footerOf(seedConfig, 3, '0').cells['BM']).toBe(0);
  });

  it('holds the sum at full precision as a number, and the label as a string, so nothing is a formula', () => {
    const { cells } = footerOf(seedConfig, 2, '12.3456789012');
    expect(cells['BM']).toBe(12.3456789012);
    expect(typeof cells['BL']).toBe('string');
  });

  it('refuses a stored total that is not a plain decimal, with words that hold none of it', () => {
    expect(() => footerOf(seedConfig, 2, '1e9')).toThrow('A stored figure is not a number.');
  });

  it('is in the cell to the left of the Tool Cost column whatever the letters are', () => {
    const moved = cloneSeedConfig();
    const shifted = moved.fields.map((field) => (field.position >= 60 ? { ...field, position: field.position + 1 } : field));
    const inserted = { ...seedFieldAt('AJ'), id: '00000000-0000-4000-8000-00000000f060', key: 'inserted-for-the-test', label: 'Inserted', position: 60 };
    const footer = footerOf({ ...moved, fields: [...shifted, inserted] }, 10, '5');
    expect(footer.cells).toEqual({ BM: TOTAL_TOOL_COST_LABEL, BN: 5 });
    expect(footer.row).toBe(13);
  });

  it('is a footer the model accepts, below the last node row, and one on a node row or on the header is refused', () => {
    const columns = exportColumnsOf(seedConfig).slice(0, 3).map((column) => ({ ...column }));
    const base = { sheetName: 'Quotation', columns, rows: [{ cells: { A: '1' } }, { cells: { A: '2' } }] };
    expect(exportModelSchema.safeParse({ ...base, footer: { row: 5, cells: { A: 'Total Tool Cost', B: 5 } } }).success).toBe(true);
    expect(exportModelSchema.safeParse({ ...base, footer: { row: 3, cells: { A: 'x' } } }).success).toBe(false);
    expect(exportModelSchema.safeParse({ ...base, footer: { row: 1, cells: { A: 'x' } } }).success).toBe(false);
    expect(exportModelSchema.safeParse({ ...base, footer: { row: 5, cells: { A: 'x' }, extra: 1 } }).success).toBe(false);
  });
});

const WHEN = new Date('2026-11-05T05:50:00.000Z');
const CANCEL = { cancelledAt: WHEN, byName: 'Invented Admin', reason: 'Customer withdrew', engineerName: 'Invented Engineer' };

describe('AC-4 (D-29): BO is the latest approval\'s price unless it was cancelled, or removed (there is then no latest approval)', () => {
  it('is empty with no approval, which is also what `findLatestApproval` answers once the price was removed', () => {
    expect(approvedPriceOf(null)).toBeNull();
  });

  it('is the approved price of an approval that stands, and of one that was only unlocked (the unlock is stored in columns of its own: the price approved earlier stays)', () => {
    expect(approvedPriceOf({ approvedPrice: '12600.00', cancel: null })).toBe('12600.00');
  });

  it('is empty once the Admin cancelled the approval', () => {
    expect(approvedPriceOf({ approvedPrice: '12600.00', cancel: CANCEL })).toBeNull();
  });

  it('puts the price in BO2 as a number, and an empty BO2 when there is none', () => {
    expect(withProductCells(seedConfig, rowsOf(1), { ...FIGURES, approvedPrice: '4321.50' })[0]?.cells['BO']).toBe(4321.5);
    expect(withProductCells(seedConfig, rowsOf(1), { ...FIGURES, approvedPrice: null })[0]?.cells['BO']).toBeNull();
  });
});

describe('AC-6: BL2 and BN2 are numbers at full precision, and no figure (a division by zero) is an empty cell', () => {
  it('writes BL2 and BN2 as the stored text\'s number, with the registry\'s own two-decimal format on the column', () => {
    const [first] = withProductCells(seedConfig, rowsOf(1), FIGURES);
    expect(first?.cells['BL']).toBe(Number('12629.987654321'));
    expect(first?.cells['BN']).toBe(Number('2.577'));
    const formats = new Map(exportColumnsOf(seedConfig).map((column) => [column.letter, column.numFmt]));
    for (const letter of ['BL', 'BN', 'BO']) expect(formats.get(letter), letter).toMatch(/0\.00$/);
  });

  it('leaves BN2 empty when the stored BN is null (no Tool Cost), and BL2 empty when there is no total', () => {
    const [first] = withProductCells(seedConfig, rowsOf(1), { ...FIGURES, pricePerToolCost: null, totalPrice: null });
    expect(first?.cells['BN']).toBeNull();
    expect(first?.cells['BL']).toBeNull();
  });

  it('refuses a stored figure that is not a plain decimal rather than write a wrong cell', () => {
    expect(() => withProductCells(seedConfig, rowsOf(1), { ...FIGURES, totalPrice: 'Infinity' })).toThrow('A stored figure is not a number.');
    expect(() => withProductCells(seedConfig, rowsOf(1), { ...FIGURES, approvedPrice: '12,600.00' })).toThrow('A stored figure is not a number.');
  });
});

describe('the addresses SCR-10 names, from the same registry', () => {
  it('are BL2, BN2, BO2 and the Tool Cost cell of the footer row, for 10 parts BM13', () => {
    expect(productCellAddresses(seedConfig, 10)).toEqual({ bl: 'BL2', bn: 'BN2', bo: 'BO2', toolCostTotal: 'BM13' });
  });
});
