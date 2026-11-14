import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { Decimal } from '@/lib/decimal';
import { displayStoredValue, NO_FIGURE_TEXT, storeRowOutputs, type RowOutputs } from '@/lib/estimate/row-outputs';

/**
 * STORY-03.03 AC-4 (FR-027): how a row's outputs are stored (full-precision decimal text) and shown (2 decimals, "—" for no figure),
 * and that the two Restricted modules of `src/lib/estimate` are server-only (AC-7, NFR-002). Invented numbers.
 */

describe('storeRowOutputs (AC-4)', () => {
  const outputs: RowOutputs = {
    values: new Map([
      ['a', new Decimal('1.5')],
      ['b', null],
      ['c', new Decimal('0.0000000001')],
      ['d', new Decimal('-0')],
      ['e', new Decimal(1).div(3)],
    ]),
  };

  it('keeps every field, a figure as plain decimal text and no figure as null', () => {
    const stored = storeRowOutputs(outputs);
    expect(stored['a']).toBe('1.5');
    expect(stored['b']).toBeNull();
    expect(Object.keys(stored)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('never writes an exponent or a negative zero', () => {
    const stored = storeRowOutputs(outputs);
    expect(stored['c']).toBe('0.0000000001');
    expect(stored['d']).toBe('0');
  });

  it('keeps 34 significant digits, not a JavaScript number', () => {
    expect(storeRowOutputs(outputs)['e']).toBe('0.3333333333333333333333333333333333');
  });
});

describe('displayStoredValue (AC-4)', () => {
  it.each([
    ['62.01550387596899224806201550387597', '62.02'],
    ['1234567.891', '1234567.89'],
    ['0', '0.00'],
    ['12', '12.00'],
    ['0.005', '0.01'],
    ['0.004', '0.00'],
    ['-0.005', '-0.01'],
    ['-12.345', '-12.35'],
    ['0.0000000001', '0.00'],
  ])('shows %s as %s', (stored, shown) => {
    expect(displayStoredValue(stored)).toBe(shown);
  });

  it('shows a dash for no figure (the screen; the export leaves the cell empty)', () => {
    expect(NO_FIGURE_TEXT).toBe('—');
    expect(displayStoredValue(null)).toBe(NO_FIGURE_TEXT);
  });
});

describe('the Restricted modules are server-only (AC-7, NFR-002, ADR-008)', () => {
  const root = fileURLToPath(new URL('../../../src/lib/estimate/', import.meta.url));

  it.each(['row-outputs.ts', 'row-calculator.ts', 'product-totals.ts'])('%s starts with import \'server-only\'', (file) => {
    const code = readFileSync(`${root}${file}`, 'utf8');
    const firstCode = code.split(/\r?\n/).find((line) => line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !line.trim().startsWith('*'));
    expect(firstCode).toBe("import 'server-only';");
  });
});
