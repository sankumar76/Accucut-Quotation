import { describe, expect, it } from 'vitest';

import { trimDecimalText } from '@/server/repositories/master-repository';

/**
 * STORY-02.01 T1: how the repository writes a stored `Decimal(18,4)` as text. A rate is carried as decimal text and never as a
 * JavaScript number (coding standards section 10), so the only arithmetic here is on characters: at least two decimals, and no
 * zero beyond them. The queries, the row lock and the constraints are tested against PostgreSQL in `tests/integration/masters`.
 */

describe('trimDecimalText', () => {
  it.each([
    ['0.0000', '0.00'],
    ['0.4700', '0.47'],
    ['12.5000', '12.50'],
    ['7.0000', '7.00'],
    ['21.3700', '21.37'],
    ['0.0100', '0.01'],
    ['0.0001', '0.0001'],
    ['3.1250', '3.125'],
    ['12345678901234.5678', '12345678901234.5678'],
  ])('writes %s as %s', (stored, shown) => {
    expect(trimDecimalText(stored)).toBe(shown);
  });

  it('adds the decimals a text without a point does not have, and keeps a long whole part exactly', () => {
    expect(trimDecimalText('15')).toBe('15.00');
    expect(trimDecimalText('999999999999999999')).toBe('999999999999999999.00');
  });
});
