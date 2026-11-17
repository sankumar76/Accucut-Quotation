import { describe, expect, it } from 'vitest';

import {
  approveWarningLine,
  goAheadLabel,
  LEAD_WARNING_NOTE,
  QUANTITY_TAG,
  QUANTITY_WARNING_TITLE,
  quantityWarningMeaning,
  quantityWarningWhen,
  warnedRowsList,
} from '@/lib/estimate/lead-warning-copy';

/**
 * STORY-06.10 AC-1, AC-3, AC-5 (UX spec v0.30 SCR-06 "Warning on this calculation", SCR-08 UX-48): the words of the Lead's quantity warning, written out here and not imported, so a changed sentence fails a
 * test. Every name is invented.
 */

const ARM = { slNo: '2.2', label: 'Support arm' };
const SPACER = { slNo: '2.3', label: 'Spacer' };

describe('the notice above the tiles (AC-3)', () => {
  it('is the sentence of the UX spec for two rows, word for word', () => {
    expect(QUANTITY_WARNING_TITLE).toBe('Quantity warning on this calculation.');
    expect(quantityWarningWhen('Priya Nair', '05 Nov 2026, 10:42 IST', [ARM, SPACER])).toBe(
      'Priya Nair went ahead on 05 Nov 2026, 10:42 IST with 0 in QTY per Assy on 2 rows: 2.2 Support arm and 2.3 Spacer.',
    );
    expect(quantityWarningMeaning(2)).toBe('Each of these rows costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant.');
    expect(QUANTITY_TAG).toBe('Quantity 0');
  });

  it('says "row" and "This row costs" for one row', () => {
    expect(quantityWarningWhen('Priya Nair', '05 Nov 2026, 10:42 IST', [ARM])).toBe('Priya Nair went ahead on 05 Nov 2026, 10:42 IST with 0 in QTY per Assy on 1 row: 2.2 Support arm.');
    expect(quantityWarningMeaning(1)).toBe('This row costs 0 in this estimate. Approving is not stopped. Check that the zeros are meant.');
  });

  it('lists three rows with commas and "and", names a part with no name by its Sl. No alone, and counts the rows past the tenth', () => {
    expect(warnedRowsList([ARM, SPACER, { slNo: '3', label: '' }])).toBe('2.2 Support arm, 2.3 Spacer and 3');
    const many = Array.from({ length: 13 }, (_, index) => ({ slNo: String(index + 1), label: '' }));
    expect(warnedRowsList(many)).toBe('1, 2, 3, 4, 5, 6, 7, 8, 9, 10 and 3 more rows');
    expect(warnedRowsList(many.slice(0, 11))).toBe('1, 2, 3, 4, 5, 6, 7, 8, 9, 10 and 1 more row');
    expect(quantityWarningWhen('Priya Nair', '05 Nov 2026, 10:42 IST', many)).toContain('on 13 rows: 1, 2');
  });
});

describe('the dialog of Recalculate (AC-1)', () => {
  it('adds the sentence of A-26 and labels the way on by the button that was pressed', () => {
    expect(LEAD_WARNING_NOTE).toBe('You are asked each time you press Calculate or Recalculate, even if the Engineer already went ahead.');
    expect(goAheadLabel('Recalculate')).toBe('Recalculate anyway');
    expect(goAheadLabel('Calculate')).toBe('Calculate anyway');
  });
});

describe('the line of the approval dialog (AC-5)', () => {
  it('names the rows and says approving is not stopped and there is no box to tick', () => {
    expect(approveWarningLine([ARM, SPACER])).toBe(
      'This calculation has a quantity warning. 2.2 Support arm and 2.3 Spacer cost 0 in this estimate. Approving is not stopped, and there is no box to tick.',
    );
    expect(approveWarningLine([ARM])).toBe('This calculation has a quantity warning. 2.2 Support arm costs 0 in this estimate. Approving is not stopped, and there is no box to tick.');
  });
});
