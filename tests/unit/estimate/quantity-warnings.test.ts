import { describe, expect, it } from 'vitest';

import { quantityFieldIdOf, quantityWarnings, type WarningRow } from '@/lib/estimate/quantity-warnings';
import { warningLine } from '@/lib/estimate/warning-copy';
import type { RowOutputs } from '@/lib/estimate/row-outputs';
import type { ConfigDocument } from '@/lib/fields/schema';

import { fieldIdOf } from '../../support/complete-part';
import { defined } from '../../support/defined';
import { seedConfig, seedFieldAt } from '../../support/seed-config';
import { QUANTITY_CASES } from '../quantity/quantity-cases';

/**
 * STORY-05.12 AC-1 (FR-104; test strategy section 5.2, CE-9 "Unit, quantityWarnings"; architecture section 4.3): the rule of the quantity warning, pure. One warning for each row whose QTY per
 * Assy is 0 after normalising, wherever it sits; `0.00` is 0 and `0.01` is not; H is found by its system role, so re-lettering it changes nothing; a row that moves keeps its warning; the function
 * reads rows and inputs and nothing calculated. Every name is invented.
 */

const QUANTITY_ID = seedFieldAt('H').id;
const DESCRIPTION_ID = fieldIdOf('description');
const PART_NO_ID = fieldIdOf('part-no');

const row = (slNo: string, h: unknown, extra: Record<string, unknown> = {}): WarningRow => ({ id: `node-${slNo}`, slNo, inputs: { [QUANTITY_ID]: h, ...extra } });
const slNosOf = (rows: ReadonlyArray<WarningRow>, document: ConfigDocument = seedConfig): string[] => quantityWarnings(rows, document).map((warning) => warning.slNo);

describe('AC-1: CE-9 variants A to G warn on exactly the rows with H 0', () => {
  const EXPECTED: Readonly<Record<string, ReadonlyArray<string>>> = {
    'CE-9 A': ['1.1'],
    'CE-9 B': ['1.1'],
    'CE-9 C': ['1.1', '1.1.1'],
    'CE-9 D': ['1'],
    'CE-9 E': ['1.1'],
    'CE-9 F': ['1'],
    'CE-9 G': ['1.1', '1.1.1'],
  };

  it.each(Object.entries(EXPECTED))('%s warns on %j', (id, slNos) => {
    const found = defined(
      QUANTITY_CASES.find((quantityCase) => quantityCase.id === id),
      id,
    );
    const rows = found.rows.map((caseRow) => row(caseRow.sl, caseRow.h));
    expect(slNosOf(rows)).toEqual(slNos);
  });

  it('names the code QTY_ZERO, the node, the Sl. No and the label of each row, and nothing else', () => {
    const warnings = quantityWarnings([row('1', '2'), row('1.1', '0', { [DESCRIPTION_ID]: 'Invented top cover' })], seedConfig);
    expect(warnings).toEqual([{ code: 'QTY_ZERO', nodeId: 'node-1.1', slNo: '1.1', label: 'Invented top cover' }]);
  });

  it('every case of the table that has a 0 warns, and a case with no 0 warns nothing', () => {
    for (const quantityCase of QUANTITY_CASES) {
      const rows = quantityCase.rows.map((caseRow) => row(caseRow.sl, caseRow.h));
      const zeros = quantityCase.rows.filter((caseRow) => Number(caseRow.h) === 0).map((caseRow) => caseRow.sl);
      expect(slNosOf(rows), quantityCase.id).toEqual(zeros);
    }
  });
});

describe('AC-1: what counts as 0', () => {
  it.each([
    ['0', 1],
    ['0.00', 1],
    ['00', 1],
    ['0.0', 1],
    ['0.01', 0],
    ['1', 0],
    ['12.50', 0],
    ['', 0],
    ['   ', 0],
    [undefined, 0],
    [null, 0],
    [0, 0],
    ['abc', 0],
    ['-0', 0],
  ])('H of %j gives %i warning(s)', (h, count) => {
    expect(quantityWarnings([row('1', h)], seedConfig)).toHaveLength(count);
  });

  it('a row with no H key at all, and a row holding other fields only, warn nothing', () => {
    expect(quantityWarnings([{ id: 'a', slNo: '1', inputs: {} }], seedConfig)).toEqual([]);
    expect(quantityWarnings([{ id: 'a', slNo: '1', inputs: { [DESCRIPTION_ID]: 'Invented' } }], seedConfig)).toEqual([]);
  });

  it('a list of no rows warns nothing', () => {
    expect(quantityWarnings([], seedConfig)).toEqual([]);
  });
});

describe('AC-1: the label', () => {
  it('is the Description, else the Part No., else empty, trimmed', () => {
    const rows = [
      row('1', '0', { [DESCRIPTION_ID]: '  Invented lid  ', [PART_NO_ID]: 'INV-1' }),
      row('2', '0', { [PART_NO_ID]: ' INV-2 ' }),
      row('3', '0', { [DESCRIPTION_ID]: '   ', [PART_NO_ID]: '' }),
      row('4', '0', { [DESCRIPTION_ID]: 7 }),
    ];
    expect(quantityWarnings(rows, seedConfig).map((warning) => warning.label)).toEqual(['Invented lid', 'INV-2', '', '']);
  });

  it('is empty for every row when the registry has neither a Description nor a Part No. field to read it from', () => {
    const unnamed: ConfigDocument = { ...seedConfig, fields: seedConfig.fields.filter((field) => field.key !== 'description' && field.key !== 'part-no') };
    expect(quantityWarnings([row('1', '0', { [DESCRIPTION_ID]: 'Invented lid' })], unnamed).map((warning) => warning.label)).toEqual(['']);
  });

  it('reads into the dialog line: the Sl. No and the name, and the plain Sl. No for a part with no name', () => {
    expect(warningLine('1.4', 'Top cover')).toBe('QTY per Assy is 0 on 1.4 Top cover. That row will cost 0 in this estimate.');
    expect(warningLine('1.4', '')).toBe('QTY per Assy is 0 on 1.4. That row will cost 0 in this estimate.');
  });
});

describe('AC-1: H is found through its system role', () => {
  it('a re-lettered H (another position, another ID) still warns, and the old ID no longer does', () => {
    const quantity = defined(seedConfig.fields.find((field) => field.systemRole === 'quantity'));
    const movedId = '00000000-0000-4000-8000-00000000beef';
    const relettered: ConfigDocument = {
      ...seedConfig,
      fields: seedConfig.fields.map((field) => (field.id === quantity.id ? { ...field, id: movedId, position: field.position + 40 } : field)),
    };
    expect(quantityFieldIdOf(relettered)).toBe(movedId);
    expect(slNosOf([{ id: 'a', slNo: '1.1', inputs: { [movedId]: '0.00' } }], relettered)).toEqual(['1.1']);
    expect(slNosOf([{ id: 'a', slNo: '1.1', inputs: { [QUANTITY_ID]: '0.00' } }], relettered)).toEqual([]);
  });

  it('a registry with no quantity field warns nothing, and has no field to name', () => {
    const without: ConfigDocument = { ...seedConfig, fields: seedConfig.fields.filter((field) => field.systemRole !== 'quantity') };
    expect(quantityFieldIdOf(without)).toBeUndefined();
    expect(quantityWarnings([row('1', '0')], without)).toEqual([]);
  });
});

describe('AC-1: moving a row leaves its warning as it was', () => {
  it('the same node warns at its new place, with its new Sl. No', () => {
    const before = [row('1', '2'), { ...row('1.1', '0'), id: 'moved' }, row('1.2', '6')];
    const after = [row('1', '2'), row('1.1', '6'), { ...row('1.2', '0'), id: 'moved' }];
    expect(quantityWarnings(before, seedConfig).map(({ nodeId, slNo }) => [nodeId, slNo])).toEqual([['moved', '1.1']]);
    expect(quantityWarnings(after, seedConfig).map(({ nodeId, slNo }) => [nodeId, slNo])).toEqual([['moved', '1.2']]);
  });
});

describe('AC-1: the function takes rows and inputs only', () => {
  it('a RowOutputs cannot be passed to it (a type error the compiler shows)', () => {
    const outputs: RowOutputs = {} as RowOutputs;
    // @ts-expect-error A RowOutputs is a calculated row, not a row of inputs: it has no ID, Sl. No or inputs, so the warning can never read a figure.
    expect(() => quantityWarnings([outputs], seedConfig)).toThrow();
  });
});
