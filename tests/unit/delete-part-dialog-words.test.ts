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

  it('names the first ten and counts the rest, so a branch of hundreds of rows is not a wall of text', () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ slNo: `1.${index + 1}`, name: 'Part' }));
    const text = deleteDescription('1', 26, many);
    expect(text).toContain('the 25 rows under it (1.1 Part, 1.2 Part');
    expect(text).toContain('1.10 Part and 15 more)');
    expect(text).not.toContain('1.11 Part');
  });
});

describe('the empty Draft (DEF-099 [H])', () => {
  it('points at "Add main assembly", the control the tree offers, and not at a "New item" that no longer exists', () => {
    expect(FORM_NO_PART).toBe('Choose a part in the tree to fill in its form, or add the first one with "Add main assembly".');
    expect(FORM_NO_PART).not.toContain('New item');
  });
});
