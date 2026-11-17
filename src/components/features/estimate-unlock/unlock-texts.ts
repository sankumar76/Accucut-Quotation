/**
 * The words of SCR-09 "Unlock" (STORY-06.08; UX spec SCR-09 and its mock-up), written in the one place the dialog is built from. They are fetched with the dialog, on the first press of Unlock, and are **not** in
 * the first load of `/estimates/[code]` (NFR-009, ADR-016): nothing in the review's first-load files imports this file. No word here holds a figure, a rate or a formula (NFR-002): the preview carries counts and two
 * version numbers, and these functions only say them. A sentence of the server's (the 409s) is written once in `lib/estimate/unlock-words.ts` and is not repeated here.
 */

import type { UnlockPreviewView } from '@/lib/estimates/unlock-client';

export const unlockTitle = (code: string): string => `Unlock ${code}`;
/** The Engineer is named once the preview has said who it is (SCR-09 mock-up); until then, and when the preview did not come, the sentence says "the Engineer's". */
export const unlockIntro = (engineerName: string | null): string =>
  `Unlocking returns the estimate to Draft so inputs can be changed, and reopens the task in ${engineerName === null ? 'the Engineer' : engineerName}'s Open queue. The unlock is logged with your reason.`;

export const REASON_LABEL = 'Reason for unlocking';
export const REASON_HINT = 'Enter a reason. It is kept in the audit log.';
export const KEEP_LOCKED_LABEL = 'Keep it locked';
export const UNLOCK_LABEL = 'Unlock';
export const UNLOCKING_LABEL = 'Unlocking';

/** While the preview is on its way, and when it did not come (the unlock itself does not need it, so it stays on). Assumptions of STORY-06.08: the spec has no sentence for either. */
export const CHECKING_LINE = 'Checking what changed since the approval.';
export const CHECK_FAILED_LINE = 'We could not check what changed since the approval. You can still unlock.';

/**
 * No usable answer came (the network, a server fault, an answer of the wrong shape). It claims nothing about what was stored: the unlock may have gone through, so the page is drawn again and says what is true. It
 * follows the sentence ruled for the lost approval (ux-spec v0.31, SCR-08 ruling 1), with "unlocked" for "approved" (assumption of STORY-06.08).
 */
export const UNLOCK_UNCONFIRMED =
  'We could not confirm the unlock. It may have gone through, and the page is being updated to show it. If this window stays open, press Unlock again. An estimate can only be unlocked once, so pressing again cannot unlock it twice.';

const CHANGED_HEAD = 'Things have changed since this estimate was approved.';
const CHANGED_TAIL = 'If you recalculate after unlocking, the current values are used. Until then this estimate keeps its approved figures.';
export const NOTHING_CHANGED = 'Nothing has changed in the configuration or the rates since approval. Recalculating gives the same result unless you change an input.';

const counted = (count: number, one: string, other: string): string => `${String(count)} ${count === 1 ? one : other}`;

/** "a", "a and b", "a, b and c". */
function listed(items: ReadonlyArray<string>): string {
  const last = items.at(-1);
  if (last === undefined) return '';
  return items.length === 1 ? last : `${items.slice(0, -1).join(', ')} and ${last}`;
}

/**
 * What changed since the approval, in one paragraph (SCR-09 mock-up): the configuration versions when they differ, and the counts by kind when any rate, price or exchange rate changed; or the sentence that
 * nothing did. Counts only, by kind: no value, old or new, and no name.
 */
export function previewNotice(preview: Pick<UnlockPreviewView, 'configuration' | 'changed'>): string {
  const { configuration, changed } = preview;
  const parts: string[] = [];
  if (configuration.approved !== configuration.current) {
    parts.push(`Field and formula configuration: version ${String(configuration.approved)} at approval, version ${String(configuration.current)} now.`);
  }
  const kinds = [
    changed.processRates > 0 ? counted(changed.processRates, 'customer rate', 'customer rates') : null,
    changed.materialPrices > 0 ? counted(changed.materialPrices, 'material price', 'material prices') : null,
    changed.exchangeRates > 0 ? counted(changed.exchangeRates, 'exchange rate', 'exchange rates') : null,
  ].filter((kind): kind is string => kind !== null);
  if (kinds.length > 0) {
    const total = changed.processRates + changed.materialPrices + changed.exchangeRates;
    parts.push(`Rates: ${listed(kinds)} ${total === 1 ? 'has' : 'have'} changed.`);
  }
  return parts.length === 0 ? NOTHING_CHANGED : [CHANGED_HEAD, ...parts, CHANGED_TAIL].join(' ');
}
