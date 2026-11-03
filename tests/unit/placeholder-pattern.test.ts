import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { placeholderMasters } from '../../prisma/seed/placeholders';
import { findNonConformingNumbers, PLACEHOLDER_NUMBER_PATTERN } from '../support/placeholder-pattern';

/** AC-7 / ADR-014: every number in the placeholder masters follows the invented pattern `n.37`. */

const PLACEHOLDER_DIRECTORY = fileURLToPath(new URL('../../prisma/seed/placeholders/', import.meta.url));

describe('placeholder pattern n.37 (AC-7)', () => {
  it('AC-7: the committed placeholder masters contain only conforming numbers', () => {
    expect(findNonConformingNumbers(placeholderMasters)).toEqual([]);
  });

  it('AC-7: only source and notes live in prisma/seed/placeholders (no data file)', () => {
    const names = readdirSync(PLACEHOLDER_DIRECTORY);
    expect(names.filter((name) => !/\.(ts|md)$/.test(name))).toEqual([]);
  });

  it('AC-7: passes with only conforming numbers', () => {
    const conforming = { processRates: [{ id: 'a', rate: 12.37 }], materials: [{ name: 'Invented', pricePerKg: '104.37' }] };
    expect(findNonConformingNumbers(conforming)).toEqual([]);
  });

  it('AC-7 (negative control): fails when a number that does not follow the pattern is planted', () => {
    const planted = { processRates: [{ id: 'a', rate: 12.5 }], materials: [{ name: 'Invented', pricePerKg: 100 }] };
    expect(findNonConformingNumbers(planted)).toEqual([
      '$.processRates[0].rate = 12.5',
      '$.materials[0].pricePerKg = 100',
    ]);
  });

  it('AC-7: a number written as text is still checked', () => {
    expect(findNonConformingNumbers({ price: '1,250.00' })).toEqual(['$.price = 1,250.00']);
  });

  it('AC-7: names and identifiers that are not numbers are left alone', () => {
    expect(findNonConformingNumbers({ id: 'rate-7', name: 'Placeholder cutting', currency: 'USD' })).toEqual([]);
  });

  it.each(['0.37', '12.37', '1043.37'])('accepts %s', (value) => {
    expect(PLACEHOLDER_NUMBER_PATTERN.test(value)).toBe(true);
  });

  it.each(['12', '12.3', '12.370', '12.38', '.37', '-12.37'])('rejects %s', (value) => {
    expect(PLACEHOLDER_NUMBER_PATTERN.test(value)).toBe(false);
  });
});
