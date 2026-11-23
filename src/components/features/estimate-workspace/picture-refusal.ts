import type { Outcome } from '@/lib/api-client';
import { PART_CHANGED_CODE } from '@/lib/estimates/form-client';
import type { PartPictureAnswer } from '@/lib/estimates/picture-client';
import { PICTURE_UPLOAD_FAILED_MESSAGE } from '@/lib/images/picture-rules';

import { ESTIMATE_IGNORED_CODE } from '../estimate-ignore/ignore-codes';
import { PICTURE_CHANGED_NOTICE } from './picture-texts';

/** What the picture control does for a refusal: the part changed under the person, or the estimate was ignored while they worked. */
export interface PictureRefusalHandlers {
  readonly onConflict: () => void;
  readonly onServerIgnored: () => void;
}

/**
 * The words under the picture for a change that did not go through: the server's own for a refusal of the picture, the sentence for a part that changed under the person, and none for an estimate that was ignored while the
 * Engineer worked (CR-01 item 7D, AQP-401 QLT-02): the page then turns read-only and says so in its one alert, as it does for a save, a Calculate and a tree change, and "Restore it first" is not said to a person who cannot restore.
 * An empty string is "no words".
 */
export function pictureRefusalWords(outcome: Outcome<PartPictureAnswer>, { onConflict, onServerIgnored }: PictureRefusalHandlers): string {
  if (outcome.status === 'ok') return '';
  if (outcome.status === 'failed') return PICTURE_UPLOAD_FAILED_MESSAGE;
  if (outcome.httpStatus === 409 && outcome.code === ESTIMATE_IGNORED_CODE) {
    onServerIgnored();
    return '';
  }
  if (outcome.code === PART_CHANGED_CODE) {
    onConflict();
    return PICTURE_CHANGED_NOTICE;
  }
  return outcome.title;
}
