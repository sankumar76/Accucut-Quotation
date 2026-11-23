import { formatIstTime } from '@/lib/time';

/**
 * The words of saving a draft, leaving with unsaved changes, and a part that changed somewhere else (STORY-05.08; UX spec SCR-05 states "Saved" and "Unsaved changes"). They are here and not in
 * `estimate-texts.ts`, which the page's first load carries whole: everything that uses them is fetched after the page is up (NFR-009, ADR-016). None of them names a rate, a price or a formula
 * (UX-24), and none holds a figure.
 */

export const SAVE_DRAFT_LABEL = 'Save draft';
export const SAVING_LABEL = 'Saving';
export const draftSavedText = (time: string): string => `Draft saved at ${time}.`;
export const DRAFT_NOT_SAVED_TITLE = 'The draft was not saved.';
export const DRAFT_NOT_SAVED_BODY = 'A field has a value that is not saved. Fix the field that shows a message, or check your connection, then press Save draft again. What you typed is kept.';

/** "Leave without saving?" (UX spec SCR-05 state "Unsaved changes"): the title and the two buttons are the spec's; "Keep editing" is the way to stay, which Escape also does. */
export const LEAVE_TITLE = 'Leave without saving?';
export const LEAVE_BODY = 'You have changes that are not saved. If you leave now, they are lost.';
export const LEAVE_KEEP = 'Keep editing';
export const LEAVE_ANYWAY = 'Leave without saving';
export const LEAVE_SAVE = 'Save draft and leave';
export const LEAVE_SAVE_FAILED_TITLE = 'The draft was not saved, so you are still here.';
export const LEAVE_SAVE_FAILED_BODY = 'A field has a value that is not saved. Fix it, or choose Leave without saving.';

/** A save was refused because the part was changed somewhere else (a second tab, or another person): what the person typed stays, and they choose. */
export const CONFLICT_TITLE = 'This part was changed somewhere else.';
export const CONFLICT_BODY = 'What you typed is kept. The fields marked below hold a newer value. Choose which one to keep.';
export const CONFLICT_KEEP_MINE = 'Keep what I typed';
export const CONFLICT_USE_NEWER = 'Use the newer values';
/** The part changed somewhere else again and again while it was read and sent, so the change was not saved. */
export const CONFLICT_RETRY_FAILED = 'This part keeps changing somewhere else, so your change was not saved. What you typed is kept. Press Save draft to try again.';

/** The message under a field with a newer value. A number or a text shows it; a choice or a treatment does not, because what is stored for it is not words. */
export function conflictFieldMessage(newer: string | null): string {
  if (newer === null) return 'Changed somewhere else.';
  return newer === '' ? 'Changed somewhere else. The newer value is blank.' : `Changed somewhere else. The newer value is "${newer}".`;
}

/**
 * The 30-second save (STORY-05.10; UX spec SCR-05 "Last saved 10:41 IST. Auto-save every 30 s"). The status line under the part form's title is one line: when something was last saved, and that the form saves
 * on its own. The failure sentence is a proposal that the ux-expert rules on at the end review (OQ-1); it is a polite status, not an alert, and it says what happened to what was typed and what to do.
 */
export const AUTOSAVE_NOTE = 'Auto-save every 30 s.';
export const autosaveFailedText = (time: string): string => `Auto-save could not save at ${time}. What you typed is kept. Press Save draft to try again.`;

/**
 * The words of the status line under the part form's title: `lastSaved` ("Last saved 20 Nov 2026, 10:41 IST" or "Nothing saved yet"), then "Auto-save every 30 s." while the person may edit (nothing saves a
 * prepared estimate), then, once, the failure of the automatic save with its time.
 */
export function saveStatusText(lastSaved: string, editable: boolean, failedAt: Date | null): string {
  const parts = editable ? [`${lastSaved}.`, AUTOSAVE_NOTE] : [lastSaved];
  if (editable && failedAt !== null) parts.push(autosaveFailedText(formatIstTime(failedAt)));
  return parts.join(' ');
}
