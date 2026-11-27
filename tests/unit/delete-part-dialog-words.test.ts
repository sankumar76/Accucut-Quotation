import { describe, expect, it } from 'vitest';

import { deleteDescription } from '@/components/features/estimate-workspace/delete-part-dialog';
import { FORM_NO_PART } from '@/components/features/estimate-workspace/estimate-texts';

/**
 * AQP-456 (DEF-099; SCR-05 "Delete part", UX spec section 0.9 row 3): the delete dialog names the row and every row under it, and says that the rest is renumbered; the empty Draft points at the control that exists.
 * Every name is invented.
 */

const UNDER = [
  { slNo: '1.1.1', name: 'Corner gusset' },
  { slNo: '1.1.2', name: 'Cross brace' },
  { slNo: '1.1.3', name: 'Hex bolt set M6' },
];

describe('the words of the delete dialog (DEF-099 [G])', () => {
  it('names every row under the row, says what goes with them, and that the rest is renumbered, as the mock-up reads', () => {
    expect(deleteDescription('1.1', 4, UNDER)).toBe(
      'This also deletes the 3 rows under it (1.1.1 Corner gusset, 1.1.2 Cross brace, 1.1.3 Hex bolt set M6) and everything entered for them. The remaining parts are renumbered. This cannot be undone.',
    );
  });

  it('says "it" for the one row under the row', () => {
    expect(deleteDescription('1', 2, [{ slNo: '1.1', name: 'Sub-Assembly' }])).toBe(
      'This also deletes the 1 row under it (1.1 Sub-Assembly) and everything entered for it. The remaining parts are renumbered. This cannot be undone.',
    );
  });

  it('keeps the shorter sentence for a row with nothing under it', () => {
    expect(deleteDescription('2', 1, [])).toBe('Row 2 and everything typed into it will be deleted. This cannot be undone.');
  });

  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ slNo: `1.${index + 1}`, name: 'Part' }));

  it('names 10 rows and 11 rows all, with no "more" (UX spec 0.31 item 7)', () => {
    for (const count of [10, 11]) {
      const text = deleteDescription('1', count + 1, rows(count));
      expect(text, String(count)).toContain(`1.${count} Part)`);
      expect(text, String(count)).not.toContain('more');
    }
  });

  it('names the first ten and says "and 2 more rows" at 12 rows, and counts the rest beyond that, never "and 1 more row"', () => {
    const twelve = deleteDescription('1', 13, rows(12));
    expect(twelve).toContain('the 12 rows under it (1.1 Part, 1.2 Part');
    expect(twelve).toContain('1.10 Part and 2 more rows)');
    expect(twelve).not.toContain('1.11 Part');
    const many = deleteDescription('1', 26, rows(25));
    expect(many).toContain('1.10 Part and 15 more rows)');
    for (const count of [1, 2, 10, 11, 12, 13, 25]) expect(deleteDescription('1', count + 1, rows(count)), String(count)).not.toContain('and 1 more row');
  });
});

describe('the empty Draft (DEF-099 [H])', () => {
  it('points at "Add main assembly", the control the tree offers, and not at a "New item" that no longer exists', () => {
    expect(FORM_NO_PART).toBe('Choose a part in the tree to fill in its form, or add the first one with "Add main assembly".');
    expect(FORM_NO_PART).not.toContain('New item');
  });
});
