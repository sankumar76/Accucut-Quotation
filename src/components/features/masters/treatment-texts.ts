import type { PageNotice } from './process-texts';

/**
 * The words of SCR-13 "Materials and lists", Treatment / Color tab (UX spec section 6, "SCR-13"; ux-spec v0.21 section 6.0 for the shared rules; the
 * mock-up `docs/03-ux/screens/SCR-13.html`). The limit and the messages under the field are in `src/lib/masters/treatments.ts`, where the server's
 * schema reads them too. The words that SCR-11 says for every master (the Try again button, the long-name class) are SCR-11's, imported where used.
 *
 * The ux-spec fixes the tab name, the columns (Name, then Actions), the buttons (Rename, Delete) and the locked row's reason. The sentences of the
 * Add, Rename and Delete states are the developer's proposal from the patterns of SCR-11 and the Materials tab, for the ux-expert to rule on; they
 * follow the shared rule of v0.21 that a failed write never says "Nothing was changed.": a failed Add or Rename says what is still true (what was
 * typed is in the form), and a failed Delete says only to try again.
 */

export const TREATMENT_TAB = 'Treatment / Color';

export const TREATMENT_REGION_LABEL = 'Treatment / Color, scrollable';
export const TREATMENT_LIST_LABEL = 'Treatment / Color';
export const TREATMENT_NAME_HEADING = 'Name';
export const TREATMENT_NAME_FIELD_LABEL = 'Name';

/** The visible reason on the locked "Other" row (AC-1), words from the story: text, not colour alone. */
export const OTHER_LOCKED_REASON = 'Always offered; the Engineer types the text';

/** The labels of the row actions (the buttons are named for the row: `Rename <name>`, `Delete <name>`) and of the dialogs' two buttons. */
export const RENAME_ACTION = 'Rename';
export const DELETE_ACTION = 'Delete';
export const CANCEL_TREATMENT = 'Cancel';
export const SAVE_TREATMENT = 'Save';

/** The rows of the skeleton, in the slot that waits for the panel's code and in the panel that waits for the list. */
export const TREATMENT_SKELETON_ROWS = 4;

export const ADD_TREATMENT = 'Add treatment';
export const ADDING_TREATMENT = 'Adding treatment';
export const SAVING_TREATMENT = 'Saving';
export const DELETING_TREATMENT = 'Deleting';

export const TREATMENT_LOADING_LABEL = 'Loading the treatments';
export const TREATMENT_ERROR_TITLE = 'We could not load the treatments';
/** The load error's sentence while a success notice is on the page: the change happened, and the read after it failed (the DEF-020 case; ux-spec v0.21). */
export const TREATMENT_SAVED_NOT_SHOWN_BODY = 'The change was saved, but we could not show the list. Check your connection and try again.';

export const FAILED_ADD_TREATMENT_MESSAGE = 'We could not add the treatment.';
export const FAILED_RENAME_TREATMENT_MESSAGE = 'We could not save the changes.';
export const FAILED_DELETE_TREATMENT_MESSAGE = 'We could not delete the treatment.';
/** Under a failed Add or Rename: the shared sentence of ux-spec v0.21 section 6.0 for a write that keeps what the person typed. It never says "Nothing was changed.". */
export const FAILED_WRITE_KEEPS_FORM_BODY = 'Check your connection and try again. What you typed is still in the form.';
/** Under a failed Delete: the shared sentence of ux-spec v0.21 section 6.0 for a write with nothing typed. */
export const FAILED_WRITE_BODY = 'Check your connection and try again.';

export const renameTreatmentTitle = (name: string): string => `Rename ${name}`;
export const renameTreatmentLabel = renameTreatmentTitle;
export const deleteTreatmentLabel = (name: string): string => `Delete ${name}`;

export const DELETE_KEEP_TREATMENT = 'Keep treatment';
export const DELETE_CONFIRM_TREATMENT = 'Delete treatment';
export const deleteTreatmentTitle = (name: string): string => `Delete ${name}?`;
export const deleteTreatmentDescription = (name: string): string =>
  `${name} is removed from the Treatment / Color list. Estimates that are already calculated keep the treatment they show. To bring it back, add it again.`;

/** The sentence under the page after an add or a delete succeeded; each writes exactly one audit entry, so the clause is always true (ux-spec v0.22). */
export const treatmentNotice = (what: 'added' | 'deleted', name: string): PageNotice => ({
  tone: 'success',
  text: `${name} was ${what}. The change is in the audit log.`,
});

/**
 * After a rename: `<old name> was renamed to <new name>.` With no audit clause (ux-spec v0.22): a rename that finds the name already there answers 200 and
 * writes no entry, so the clause can be false. The old name is the one the Rename dialog opened with.
 */
export const treatmentRenamedNotice = (oldName: string, newName: string): PageNotice => ({ tone: 'success', text: `${oldName} was renamed to ${newName}.` });

/**
 * A treatment that was deleted elsewhere while its dialog was open (the pattern of ux-spec v0.17, QLT-06): nothing failed and nothing is at risk, so
 * these are not alerts. `name` is the treatment's name as it was when the dialog opened.
 */
export const treatmentGoneNotice = (name: string, what: 'rename' | 'delete'): PageNotice =>
  what === 'rename'
    ? {
        tone: 'warn',
        title: `${name} no longer exists.`,
        text: 'It was deleted after you opened this list, so your changes were not saved. If you still need it, press Add treatment.',
      }
    : { tone: 'info', title: `${name} was already deleted.`, text: 'It was deleted after you opened this list, so there was nothing to delete.' };
