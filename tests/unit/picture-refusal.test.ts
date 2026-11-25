import { describe, expect, it, vi } from 'vitest';

import { pictureRefusalWords } from '@/components/features/estimate-workspace/picture-refusal';
import type { Outcome } from '@/lib/api-client';
import type { PartPictureAnswer } from '@/lib/estimates/picture-client';
import { PICTURE_UPLOAD_FAILED_MESSAGE } from '@/lib/images/picture-rules';

/**
 * CR-01 item 7D, AQP-401 AC-8 and review finding QLT-02: a picture added, replaced or removed on an estimate that was ignored while the Engineer worked is refused 409 `ESTIMATE_IGNORED`. The page's one alert says so
 * (as for a save, a Calculate and a tree change) and the control says nothing under the picture; "Restore it first" is not said to a person who cannot restore.
 */

const refused = (httpStatus: number, code: string, title: string): Outcome<PartPictureAnswer> => ({ status: 'refused', httpStatus, code, title, fields: {}, body: {} });
const handlers = () => ({ onConflict: vi.fn(), onServerIgnored: vi.fn() });

describe('what the picture control says for a change that did not go through', () => {
  it('tells the page and says nothing for a 409 ESTIMATE_IGNORED', () => {
    const on = handlers();
    expect(pictureRefusalWords(refused(409, 'ESTIMATE_IGNORED', 'This estimate is ignored. Restore it first.'), on)).toBe('');
    expect(on.onServerIgnored).toHaveBeenCalledTimes(1);
    expect(on.onConflict).not.toHaveBeenCalled();
  });

  it('keeps the part-changed sentence and reads the tree again for a part that changed', () => {
    const on = handlers();
    expect(pictureRefusalWords(refused(409, 'PART_CHANGED', 'The part changed.'), on)).toMatch(/changed by someone else/);
    expect(on.onConflict).toHaveBeenCalledTimes(1);
    expect(on.onServerIgnored).not.toHaveBeenCalled();
  });

  it("keeps the server's own words for another refusal, and the failure sentence for no answer", () => {
    const on = handlers();
    expect(pictureRefusalWords(refused(422, 'VALIDATION_FAILED', 'That picture is too large.'), on)).toBe('That picture is too large.');
    expect(pictureRefusalWords({ status: 'failed' }, on)).toBe(PICTURE_UPLOAD_FAILED_MESSAGE);
    expect(on.onServerIgnored).not.toHaveBeenCalled();
    expect(on.onConflict).not.toHaveBeenCalled();
  });
});
