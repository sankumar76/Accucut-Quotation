import { choicesNotice, dismissedNotice, movedNotice, savedTitle, type PropagationCounts } from '@/lib/masters/default-propagation';
import type { ProcessItemSavedRow } from '@/lib/masters/process-items-client';

import type { PageNotice } from './master-texts';
import type { SyncRequest } from './process-sync-dialog';
import { savedNotice } from './process-texts';

/**
 * The page notices of a changed default (STORY-02.08 AC-1, AC-3, AC-5; SCR-11 "Saved" and "Customers differ"). They are read only by the dialogs, so they are fetched with
 * them and not with the first load of the page (NFR-009); the words themselves are `src/lib/masters/default-propagation.ts`, which the tests read.
 */

/**
 * The notice after an add or a save with nothing to ask (AC-1): a save that changed the default says how many customers moved by themselves, and that the audit log has
 * the change. The audit log keeps the customers by name, so the notice does not.
 */
export function savedNoticeFor(saved: ProcessItemSavedRow, kind: 'added' | 'edited'): PageNotice {
  const { propagation } = saved;
  if (kind === 'added') return savedNotice(saved.name, 'added');
  if (propagation === null) return savedNotice(saved.name, 'saved');
  return { tone: 'success', text: movedNotice(saved.name, propagation.moved, saved.unit, propagation.previousDefault, saved.defaultValue) };
}

/** The page's notice once "Customers differ" has been answered: what the save moved on its own, and then the answer's sentence. */
function answeredNotice({ item, propagation }: SyncRequest, text: string): PageNotice {
  return { tone: 'success', title: savedTitle(item.name, propagation.moved, item.unit, propagation.previousDefault, item.defaultValue), text };
}

/** Save choices was accepted (AC-3): the counts, in the notice, because no toast carries them. */
export const choicesSavedNotice = (request: SyncRequest, counts: PropagationCounts): PageNotice =>
  answeredNotice(request, choicesNotice(counts, request.item.unit, request.item.defaultValue));

/** The window was closed without Save choices (AC-5): the same as Keep all. */
export const syncDismissedNotice = (request: SyncRequest): PageNotice => answeredNotice(request, dismissedNotice(request.propagation.differing.length));

/** Save choices found the default changed again (409, AC-4): nothing was changed. */
export const defaultChangedNotice = (request: SyncRequest): PageNotice => ({
  tone: 'warn',
  title: `${request.item.name} changed again.`,
  text: 'Its default changed after that window opened, so none of your choices were saved. The list shows the current value.',
});
