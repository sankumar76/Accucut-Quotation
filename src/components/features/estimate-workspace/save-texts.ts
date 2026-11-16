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
