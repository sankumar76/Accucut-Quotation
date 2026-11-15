import { describe, expect, it } from 'vitest';

import {
  ACK_REQUIRED_TITLE,
  CALCULATE_ACK_REQUIRED_CODE,
  QTY_ZERO_CODE,
  WARNING_CHANGED_NOTICE,
  WARNING_DIALOG_DESCRIPTION,
  WARNING_GO_AHEAD,
  WARNING_GO_BACK,
  WARNING_LIST_LABEL,
  warningDialogTitle,
  warningLine,
} from '@/lib/estimate/warning-copy';

/**
 * STORY-05.12 AC-6 and AC-7 (UX-24, NFR-002): the words of the quantity warning are one file's, they are the UX spec's, and none of them uses "rate", "price" or "formula". Every name is invented.
 */

describe('AC-6: the words', () => {
  it('the title counts the rows: "Check the quantity on 2 rows", and "1 row" for one', () => {
    expect(warningDialogTitle(2)).toBe('Check the quantity on 2 rows');
    expect(warningDialogTitle(1)).toBe('Check the quantity on 1 row');
    expect(warningDialogTitle(12)).toBe('Check the quantity on 12 rows');
  });

  it('the description, the two buttons and the changed-list notice are the UX spec\'s', () => {
    expect(WARNING_DIALOG_DESCRIPTION).toBe('You can go back and change the count, or go ahead.');
    expect(WARNING_GO_BACK).toBe('Go back');
    expect(WARNING_GO_AHEAD).toBe('Calculate anyway');
    expect(WARNING_CHANGED_NOTICE).toBe('The list changed. Something changed after you pressed Calculate, so this is the new list. Check it again.');
  });

  it('a row line names the Sl. No and the part and says that row will cost 0', () => {
    expect(warningLine('1.4', 'Top cover')).toBe('QTY per Assy is 0 on 1.4 Top cover. That row will cost 0 in this estimate.');
  });

  it('the codes are the ones the architecture names', () => {
    expect(CALCULATE_ACK_REQUIRED_CODE).toBe('CALCULATE_ACK_REQUIRED');
    expect(QTY_ZERO_CODE).toBe('QTY_ZERO');
  });
});

describe('AC-6 (UX-24): no word of the warning says "rate", "price" or "formula"', () => {
  const WORDS: ReadonlyArray<[string, string]> = [
    ['title of the 409', ACK_REQUIRED_TITLE],
    ['dialog title, one row', warningDialogTitle(1)],
    ['dialog title, many rows', warningDialogTitle(40)],
    ['description', WARNING_DIALOG_DESCRIPTION],
    ['list label', WARNING_LIST_LABEL],
    ['changed notice', WARNING_CHANGED_NOTICE],
    ['go back', WARNING_GO_BACK],
    ['go ahead', WARNING_GO_AHEAD],
    ['row line with a name', warningLine('1.4', 'Top cover')],
    ['row line with no name', warningLine('1.4', '')],
  ];

  it.each(WORDS)('%s', (_name, text) => {
    expect(text).not.toMatch(/rate|price|formula/i);
  });
});
