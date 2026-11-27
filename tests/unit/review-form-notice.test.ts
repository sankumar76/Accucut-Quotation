import { describe, expect, it } from 'vitest';

import { FORM_LOCKED } from '@/components/features/estimate-workspace/estimate-texts';
import { reviewNotice } from '@/components/features/estimate-workspace/review-form';
import { REVIEW_IGNORED_NOTICE } from '@/components/features/estimate-workspace/review-look-texts';

/**
 * QLT-806-03, ED-12: the one notice of the Lead's and the Admin's inputs block. While the estimate can be corrected it is the page's own words (`inputsNotice`, by status and by the state of the figures); once a save is
 * refused because it can no longer be corrected the block turns read-only with the server's reason: "This estimate can no longer be changed." for an approved or not-editable estimate (409 `ESTIMATE_APPROVED_IS_LOCKED`,
 * `ESTIMATE_NOT_EDITABLE`, which reach the form as `onLocked`), and the ignored words for an ignored one (`onServerIgnored`, a branch of its own).
 */

const OWN = 'You can correct inputs.';

describe('reviewNotice', () => {
  it('is the page\'s own while nothing was refused', () => {
    expect(reviewNotice(null, OWN)).toBe(OWN);
  });

  it('is "This estimate can no longer be changed." after the estimate was approved or taken out of the editable states', () => {
    expect(reviewNotice('locked', OWN)).toBe(FORM_LOCKED);
    expect(FORM_LOCKED).toBe('This estimate can no longer be changed.');
  });

  it('is the ignored words after the estimate was ignored', () => {
    expect(reviewNotice('ignored', OWN)).toBe(REVIEW_IGNORED_NOTICE);
  });
});
