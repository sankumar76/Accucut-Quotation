import { describe, expect, it } from 'vitest';

import { indexToColumnLetter } from '@/lib/columns';
import { MAX_RATE_NAME_LENGTH, rateNameIssues, toInternalForm, type ReferenceContext } from '@/lib/formula';

import { FIELD_IDS } from '../../support/formula-fixtures';
import { SEED_PROCESS_ITEMS } from '../../support/seed-config';

/**
 * GitHub #35, QLT-05, and AC-6 ("a rate name cannot be a valid column letter"): a rate name that a formula
 * could read some other way is refused when the rate is created or renamed, so a stored formula can never change
 * its price because of a name.
 */

const codes = (name: string, others: ReadonlyArray<string> = []): string[] => rateNameIssues(name, others).map((issue) => issue.code);

describe('rate names that are safe (QLT-05)', () => {
  it('QLT-05: accepts all 15 seed names, which include spaces, percent signs, an ampersand and a name that begins with column OH', () => {
    for (const item of SEED_PROCESS_ITEMS) {
      const others = SEED_PROCESS_ITEMS.filter((other) => other.id !== item.id).map((other) => other.name);
      expect(rateNameIssues(item.name, others), item.name).toEqual([]);
    }
  });

  it.each(['A1', 'a', 'Rate A', 'AB Rate', 'Foam Cost', 'OH Profit %', 'X%', 'A&B', 'Test Share %', 'Plating-rate-per-sqin', 'x'.repeat(MAX_RATE_NAME_LENGTH)])(
    'QLT-05: accepts "%s"',
    (name) => {
      expect(rateNameIssues(name)).toEqual([]);
    },
  );
});

describe('rate names that a formula would read another way (QLT-05, AC-6)', () => {
  it('AC-6: refuses every valid column letter, from A to ZZZ, whatever the registry holds today', () => {
    for (let position = 1; position <= 26 + 26 * 26 + 26 * 26 * 26; position += 1) {
      const letters = indexToColumnLetter(position);
      if (codes(letters)[0] !== 'RATE_NAME_IS_COLUMN_LETTER') throw new Error(`${letters} was not refused as a column letter`);
    }
  });

  it.each([
    ['a column letter', 'BB'],
    ['a column letter that the seed registry has', 'AL'],
    ['two columns and a minus sign', 'A-B'],
    ['two columns', 'A B'],
    ['a column and a number', 'AB 2'],
    ['a number', '5'],
    ['a decimal number', '1.5'],
    ['a leading point', '.5'],
    ['a function name', 'SUM'],
    ['IF', 'IF'],
    ['a minus sign', '-'],
    ['a Material-* name followed by a number', 'Material-Scrap-Rate 2'],
    ['an exchange rate name followed by a column', 'ExchangeRate-USD A'],
  ])('QLT-05: refuses %s ("%s") because a formula would take it for something else', (_what, name) => {
    expect(codes(name)).toEqual(['RATE_NAME_IS_COLUMN_LETTER']);
  });

  it.each(['Material-Price-per-kg', 'Material-Specific-Gravity', 'Material-Scrap-Rate', 'ExchangeRate-USD', 'ExchangeRate-EUR'])(
    'QLT-05: refuses the operand name %s',
    (name) => {
      expect(codes(name)).toEqual(['RATE_NAME_IS_OPERAND']);
    },
  );

  it('QLT-05: refuses a name another rate has already, exactly', () => {
    expect(codes('Foam Cost', ['Foam Cost'])).toEqual(['RATE_NAME_DUPLICATE']);
    expect(codes('Foam Cost', ['foam cost'])).toEqual([]);
  });

  it('QLT-05: the collision it prevents is real: with such a rate present, a name wins over a column and the formula changes meaning', () => {
    const colliding: ReferenceContext = { fieldIds: FIELD_IDS, rates: [{ id: FIELD_IDS[0] ?? '', name: 'AB' }] };
    // The converter resolves it the same way every time (names before letters) ...
    expect(toInternalForm('AB * 2', colliding)).toBe(`{{rate:${FIELD_IDS[0]}}} * 2`);
    // ... but that is not column AB, so the name must never reach the list.
    expect(codes('AB')).toEqual(['RATE_NAME_IS_COLUMN_LETTER']);
  });
});

describe('rate names that cannot be formula text at all', () => {
  it.each([
    ['empty', ''],
    ['led by a space', ' Foam'],
    ['ended by a space', 'Foam '],
    ['holding a bracket', 'Rate (old)'],
    ['holding a comma', 'Rate, old'],
    ['holding a plus', 'Rate+'],
    ['holding a slash', 'Rate/kg'],
    ['holding a star', 'Rate*2'],
    ['holding a comparison sign', 'Rate>1'],
    ['holding an equals sign', 'Rate=1'],
    ['holding a brace', 'Rate{1}'],
    ['holding a line break', 'Rate\nTwo'],
    ['holding a tab', 'Rate\tTwo'],
    ['longer than the limit', 'x'.repeat(MAX_RATE_NAME_LENGTH + 1)],
  ])('refuses a name that is %s', (_what, name) => {
    expect(codes(name)).toEqual(['RATE_NAME_INVALID']);
  });

  it('STD-05: no message repeats the name', () => {
    for (const name of ['Zebra42 (old)', 'ZZZ', 'Material-Scrap-Rate', 'Wombat Rate', 'Wombat Rate']) {
      const messages = rateNameIssues(name, ['Wombat Rate']).map((issue) => issue.message);
      for (const message of messages) expect(message).not.toContain(name);
    }
  });
});
