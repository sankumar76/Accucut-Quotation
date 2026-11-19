import { describe, expect, it } from 'vitest';

import { exportRowsOf, type StoredExportRow, type StoredMaterial } from '@/server/export/rows';

import { seedConfig, seedFieldAt } from '../../support/seed-config';

/**
 * The node rows of the file (STORY-07.02 AC-1 to AC-3, AC-6, AC-7; FR-067, FR-068; SPEC sections 10 and 14.5): a pure function from the stored rows of one calculation to the cells of each row, in depth-first
 * order. Every value is invented. A letter is written here only because this is a test (coding standards section 10); the code under test reads the registry.
 */

const id = (letter: string): string => seedFieldAt(letter).id;
const NODE = (n: number): string => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const STEEL = { materialInDrawing: 'Invented steel', pricePerKg: '82.5' } satisfies StoredMaterial;

/** A stored row: the words and numbers typed, and the outputs the calculation made. */
function row(n: number, parent: number | null, sortIndex: number, slNo: string, over: Partial<StoredExportRow> = {}): StoredExportRow {
  return {
    nodeId: NODE(n),
    parentId: parent === null ? null : NODE(parent),
    sortIndex,
    slNo,
    imageId: null,
    outputs: { [id('BG')]: '100.125', [id('BJ')]: '1.2', [id('BK')]: null },
    ...over,
    // What a test names is added to what every row has (its words, its material and its count), so a row that changes one value still has a material.
    inputs: { [id('D')]: `Part ${slNo}`, [id('E')]: STEEL.materialInDrawing, [id('F')]: 'Invented grade', [id('H')]: '2', ...over.inputs },
  };
}

const build = (rows: ReadonlyArray<StoredExportRow>, materials: ReadonlyArray<StoredMaterial> = [STEEL], pictureIndexOf: (imageId: string) => number | undefined = () => undefined) =>
  exportRowsOf({ document: seedConfig, rows, materials, pictureIndexOf });

describe('AC-1: one row per node, in depth-first order, Sl. No as text', () => {
  const tree = [row(6, null, 1, '2'), row(5, 1, 1, '1.2'), row(4, 2, 1, '1.1.2'), row(3, 2, 0, '1.1.1'), row(2, 1, 0, '1.1'), row(1, null, 0, '1')];

  it('lists 1, 1.1, 1.1.1, 1.1.2, 1.2, 2 whatever order the rows are read in', () => {
    expect(build(tree).map((entry) => entry.cells['A'])).toEqual(['1', '1.1', '1.1.1', '1.1.2', '1.2', '2']);
    expect(build([...tree].reverse()).map((entry) => entry.cells['A'])).toEqual(['1', '1.1', '1.1.1', '1.1.2', '1.2', '2']);
  });

  it('keeps the Sl. No as the text it was stored as: "1.10" keeps its zero and "1.1" is not turned into a number', () => {
    const rows = build([row(1, null, 0, '1'), row(2, 1, 0, '1.1'), row(3, 1, 9, '1.10')]);
    expect(rows.map((entry) => entry.cells['A'])).toEqual(['1', '1.1', '1.10']);
    for (const entry of rows) expect(typeof entry.cells['A']).toBe('string');
  });

  it("takes each row's own values from that row's record: the typed count as a number, the calculated figures at full precision, the typed words as text", () => {
    const [only] = build([row(1, null, 0, '1', { outputs: { [id('BG')]: '1234.56789012345', [id('BJ')]: '0.0000000001' } })]);
    expect(only?.cells['H']).toBe(2);
    expect(only?.cells['BG']).toBe(1234.56789012345);
    expect(only?.cells['BJ']).toBe(1e-10);
    expect(only?.cells['D']).toBe('Part 1');
  });

  it('refuses a node that cannot be reached from the top rather than leaving it out of the file', () => {
    expect(() => build([row(1, null, 0, '1'), row(2, 9, 0, '1.1')])).toThrow('The calculation holds a part that cannot be reached from the top of its tree.');
  });

  it('is no rows for no nodes', () => {
    expect(build([])).toEqual([]);
  });
});

describe('AC-2: hidden lines are present, as 0', () => {
  it('writes 0 for a number or a flag nobody typed (Fasteners Qty and Cost T and U, an unselected treatment flag), and the stored 0 of an unselected treatment cost', () => {
    const [only] = build([row(1, null, 0, '1', { outputs: { [id('AQ')]: '0', [id('AX')]: '0', [id('AY')]: '12.5' } })]);
    for (const letter of ['T', 'U', 'Z', 'AA', 'AG', 'AP', 'AU', 'BM']) expect(only?.cells[letter], letter).toBe(0);
    for (const letter of ['AQ', 'AX']) expect(only?.cells[letter], letter).toBe(0);
    expect(only?.cells['AY']).toBe(12.5);
  });

  it('writes a number that was typed, and the registry default of a text that was not (Fasteners is "None")', () => {
    const [typed, untyped] = build([row(1, null, 0, '1', { inputs: { [id('S')]: 'M6 bolts', [id('T')]: '4.5', [id('U')]: '12' } }), row(2, null, 1, '2')]);
    expect(typed?.cells['S']).toBe('M6 bolts');
    expect(typed?.cells['T']).toBe(4.5);
    expect(typed?.cells['U']).toBe(12);
    expect(untyped?.cells['S']).toBe('None');
  });
});

describe('AC-3: a figure that could not be worked out is an empty cell', () => {
  it('writes null (an empty cell) for a stored null and for a figure the record does not hold, never Infinity, NaN or text', () => {
    const [only] = build([row(1, null, 0, '1')]);
    expect(only?.cells['BK']).toBeNull();
    expect(only?.cells['BN']).toBeNull();
    for (const cell of Object.values(only?.cells ?? {})) {
      expect(cell === null || typeof cell === 'string' || Number.isFinite(cell)).toBe(true);
      if (typeof cell === 'string') expect(cell).not.toMatch(/^(Infinity|-Infinity|NaN|#DIV\/0!|—)$/);
    }
  });

  it('refuses a stored figure that is not a plain decimal, naming nothing of it, instead of writing a wrong cell', () => {
    const attempt = () => build([row(1, null, 0, '1', { outputs: { [id('BG')]: '1e400' } })]);
    expect(attempt).toThrow('A stored figure is not a number.');
    expect(attempt).not.toThrow(/1e400/);
  });

  it('refuses a typed number that is not a plain decimal', () => {
    expect(() => build([row(1, null, 0, '1', { inputs: { [id('J')]: 'abc' } })])).toThrow('A stored number is not a number.');
  });
});

describe('AC-6: "Not applicable" material and treatment', () => {
  const notApplicable = row(1, null, 0, '1', { inputs: { [id('D')]: 'Plate', [id('E')]: 'Not applicable', [id('F')]: null, [id('G')]: 'Not applicable' } });

  it('shows the words in E and G, and leaves F and I blank', () => {
    const [only] = build([notApplicable], [{ materialInDrawing: 'Not applicable', pricePerKg: '0' }]);
    expect(only?.cells['E']).toBe('Not applicable');
    expect(only?.cells['G']).toBe('Not applicable');
    expect(only?.cells['F']).toBeNull();
    expect(only?.cells['I']).toBeNull();
  });

  it('puts the price of the real material, from the calculation\'s own snapshot, in I', () => {
    const [only] = build([row(1, null, 0, '1')]);
    expect(only?.cells['E']).toBe('Invented steel');
    expect(only?.cells['I']).toBe(82.5);
  });

  it('refuses a row whose material the record does not hold, which a record made by Calculate always does', () => {
    expect(() => build([row(1, null, 0, '1')], [])).toThrow('The calculation record holds no material for a row.');
  });
});

describe('AC-7: text that starts like a formula stays text', () => {
  it.each(['=1+1', '+SUM(A1)', '-2', '@x', '\t=1+1', '\r=1+1', '\n=1+1'])('keeps %j as the string it is, in a typed text, a drop-down word and the Sl. No', (payload) => {
    const [only] = build([row(1, null, 0, payload, { inputs: { [id('D')]: payload, [id('G')]: payload, [id('AJ')]: payload, [id('E')]: STEEL.materialInDrawing } })]);
    for (const letter of ['A', 'D', 'G', 'AJ']) expect(only?.cells[letter], letter).toBe(payload);
  });
});

describe('the picture of a row', () => {
  it('names the place of the row\'s picture in the model\'s list, and none for a row without one or whose picture was not embedded', () => {
    const rows = build(
      [row(1, null, 0, '1', { imageId: 'image-a' }), row(2, null, 1, '2'), row(3, null, 2, '3', { imageId: 'image-b' }), row(4, null, 3, '4', { imageId: 'image-a' })],
      [STEEL],
      (imageId) => ({ 'image-a': 0 })[imageId],
    );
    expect(rows.map((entry) => entry.picture)).toEqual([0, null, null, 0]);
  });

  it('leaves the picture column an empty cell: the picture is embedded over it, never written as a value', () => {
    const [only] = build([row(1, null, 0, '1', { imageId: 'image-a' })], [STEEL], () => 0);
    expect(only?.cells['C']).toBeNull();
  });
});

describe('the product-level columns are not a node row\'s', () => {
  it('leaves BL, BN and BO empty on every row: row 2 and the footer are STORY-07.03\'s', () => {
    const rows = build([row(1, null, 0, '1', { outputs: { [id('BL')]: '999', [id('BN')]: '3' } }), row(2, null, 1, '2')]);
    for (const entry of rows) for (const letter of ['BL', 'BN', 'BO']) expect(entry.cells[letter], letter).toBeNull();
  });
});
