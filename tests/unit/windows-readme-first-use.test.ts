import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * G-MD-1 (architecture 5.6 "One limit" and `master-defaults-on-install-2026-11-27.md` section 8): the install guide for the Windows package has a first-use row in "At install, before go-live". It tells the Admin to enter the Process Master
 * rates, the materials with their three figures and the two exchange rates before anyone calculates, and a second person to read each value back against the source. A rate left at 0 prices at 0 and no check in the portal can tell, so
 * this row is the control and a test holds it. It names no value: the guide must stay free of rates, prices and material names.
 */

const README = fileURLToPath(new URL('../../deploy/windows/README.md', import.meta.url));

/** The row 10 of the install list, with line breaks and runs of spaces made into single spaces. */
function firstUseRow(): string {
  const text = readFileSync(README, 'utf8').replace(/\r\n/g, '\n');
  const start = text.indexOf('\n| 10 | **First use');
  expect(start, 'the install list has the first-use row').toBeGreaterThanOrEqual(0);
  const end = text.indexOf('\n', start + 1);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

describe('G-MD-1: the first-use row of the Windows install list', () => {
  it('sits in "At install, before go-live", after the nine rows that were there', () => {
    const text = readFileSync(README, 'utf8').replace(/\r\n/g, '\n');
    const section = text.slice(text.indexOf('\n## At install, before go-live'), text.indexOf('\n## After go-live'));
    expect(section).toContain('\n| 9 | **A forgotten password');
    expect(section.indexOf('\n| 10 | **First use')).toBeGreaterThan(section.indexOf('\n| 9 | **A forgotten password'));
  });

  it('says what a fresh install holds and why the values matter: a rate left at 0 prices at 0', () => {
    const row = firstUseRow();
    expect(row).toContain('every Process Master rate at 0, an empty Material Master and no exchange rates');
    expect(row).toContain('a rate left at 0 prices at 0');
  });

  it('names the three things to enter, where, and that it is done before the first task is assigned', () => {
    const row = firstUseRow();
    expect(row).toContain('every Process Master rate, on **Process master**');
    expect(row).toContain('price per kg, specific gravity and scrap rate, on **Materials and lists**');
    expect(row).toContain('the two exchange rates');
    expect(row).toContain('before the first task is assigned');
    expect(row).toContain('Nobody opens an estimate for calculation until this is done');
  });

  it('asks a second person to read each value back against the source, and records who and when, never the values', () => {
    const row = firstUseRow();
    expect(row).toContain('A second person reads each value on the screen back against the source');
    expect(row).toContain('who entered, who checked and the date');
    expect(row).toContain('never the values');
  });

  it('holds no number: no rate, price or figure is written in the row', () => {
    // The only digits are the row number, the reference "(G-MD-1; architecture 5.6 ...)", the 0 of "at 0", and the currency pairs "1 USD to INR" and "1 EUR to INR".
    const digits = firstUseRow()
      .replace('| 10 |', '')
      .replace(/\(G-MD-1[^)]*\)/, '')
      .replace(/at 0|1 USD to INR|1 EUR to INR/g, '')
      .match(/\d+/g);
    expect(digits).toBeNull();
  });
});
