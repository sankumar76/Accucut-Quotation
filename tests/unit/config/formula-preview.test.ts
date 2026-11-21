import { describe, expect, it } from 'vitest';

import { checkFormulaEdit } from '@/lib/config/formula-edit';
import { previewFormula, type PreviewRow, type PreviewSnapshot } from '@/lib/config/formula-preview';

import { seedConfig, seedFieldAt, SEED_PROCESS_ITEMS } from '../../support/seed-config';

/**
 * STORY-08.02 AC-1, AC-3 and AC-8: the preview of an edited formula on a stored row. It works the formula out once from the values the calculation stored, at full precision and as two decimals, says what it
 * read, shows the dash for a division by zero or a missing figure, and writes nothing. Every figure is invented.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
const rateId = (name: string): string => {
  const found = SEED_PROCESS_ITEMS.find((item) => item.name === name);
  if (found === undefined) throw new Error(`No seed rate ${name}`);
  return found.id;
};
const P = seedFieldAt('P');
const Q = seedFieldAt('Q');
const E = seedFieldAt('E');
const AK = seedFieldAt('AK');
const BG = seedFieldAt('BG');

const SNAPSHOT: PreviewSnapshot = {
  rates: [{ id: rateId('Cutting-Rate-per-Sec'), name: 'Cutting-Rate-per-Sec', value: '0.47' }],
  materials: [{ materialInDrawing: 'Invented plate', pricePerKg: '82.5', specificGravity: '7.85', scrapRate: '35' }],
  exchangeRates: { usd: '83.1', eur: '90.2' },
};

const row = (slNo: string, inputs: Record<string, string | null>, outputs: Record<string, string | null> = {}): PreviewRow => ({ nodeId: `00000000-0000-4000-8000-0000000000${slNo.padStart(2, '0')}`, slNo, inputs, outputs });
const ROW_ONE = row('1', { [P.id]: '96', [Q.id]: '0', [E.id]: 'Invented plate' }, { [BG.id]: '10.00', [AK.id]: '10.00' });
const ROW_TWO = row('2', { [P.id]: '12.5', [Q.id]: '4' }, { [BG.id]: '20.50' });

function previewOf(text: string, fieldLetter: string, rowChosen: PreviewRow | null, rows: ReadonlyArray<PreviewRow> = [ROW_ONE, ROW_TWO]) {
  const field = seedFieldAt(fieldLetter);
  const checked = checkFormulaEdit({ document: seedConfig, rates: RATES, fieldId: field.id, text });
  if (!checked.ok) throw new Error(checked.message);
  return previewFormula({
    document: checked.edited,
    rates: RATES,
    fieldId: field.id,
    expression: checked.expression,
    snapshot: SNAPSHOT,
    product: { totalPrice: '1234.5678', toolCostTotal: '50' },
    rows,
    row: rowChosen,
  });
}

describe('AC-3: the result on the sample row, at full precision and as two decimals', () => {
  it('works P * Cutting-Rate-per-Sec out as 45.12 on a row with P 96 and the rate 0.47, and lists what it read', () => {
    const preview = previewOf('P * Cutting-Rate-per-Sec', 'AL', ROW_ONE);
    expect(preview).toEqual({
      slNo: '1',
      value: '45.12',
      shown: '45.12',
      operands: [
        { name: 'P Cutting Time', value: '96' },
        { name: 'Cutting-Rate-per-Sec', value: '0.47' },
      ],
    });
  });

  it('keeps every digit in the value and rounds only what is shown', () => {
    const preview = previewOf('P / 7', 'AL', ROW_ONE);
    expect(preview.value?.startsWith('13.7142857142857142857')).toBe(true);
    expect(preview.shown).toBe('13.71');
  });

  it('reads another row when another is chosen', () => {
    expect(previewOf('P * Cutting-Rate-per-Sec', 'AL', ROW_TWO).shown).toBe('5.88');
  });

  it('reads the Material and Exchange operands of the row from the stored snapshot', () => {
    expect(previewOf('Material-Price-per-kg + ExchangeRate-USD', 'AL', ROW_ONE).shown).toBe('165.60');
  });

  it('reads the stored output of another field, not a value worked out again', () => {
    expect(previewOf('AK * 2', 'AL', ROW_ONE).value).toBe('20');
  });
});

describe('AC-8 (BR-039): a division by zero is the dash, never a crash', () => {
  it('shows the dash and no value for P / Q when Q is 0', () => {
    expect(previewOf('P / Q', 'AL', ROW_ONE)).toMatchObject({ value: null, shown: '—' });
  });

  it('shows the dash for a field the row has no figure for, and for a material the snapshot does not hold', () => {
    expect(previewOf('AK * 2', 'AL', row('3', {}, {}))).toMatchObject({ value: null, shown: '—' });
    expect(previewOf('Material-Price-per-kg', 'AL', ROW_TWO)).toMatchObject({ value: null, shown: '—' });
  });

  it('shows the dash when a rate was never in the calculation', () => {
    expect(previewOf('P * Plating-rate-per-sqin', 'AL', ROW_ONE)).toMatchObject({ value: null, shown: '—' });
  });
});

describe('a formula with one value for the whole estimate', () => {
  it('works SUM(BG) over every row of the sample estimate, and names the sum', () => {
    const preview = previewOf('SUM(BG)', 'BL', null);
    expect(preview).toEqual({ slNo: null, value: '30.5', shown: '30.50', operands: [{ name: 'SUM(BG)', value: '30.5' }] });
  });

  it('reads the product figures of the total and the tool cost only', () => {
    expect(previewOf('SUM(BG) + BL', 'BN', null).shown).toBe('1265.07');
  });
});
