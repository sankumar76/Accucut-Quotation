/**
 * The words of SCR-18 "Formula editor" (STORY-08.02; UX spec SCR-18 and its mock-up), in one place. The sentences of the live check (unknown name, syntax, loop, valid) are the server's, which sends them
 * under `text`; what is here is the screen's own: its labels, the preview, the password step and the states. A letter or a field name is never typed here: it is passed in from the registry.
 */

/** The tab title and the description of the page: no formula, no column and no rate name (architecture section 8). */
export const FORMULA_EDITOR_TITLE = 'Edit formula';
export const FORMULA_EDITOR_META_DESCRIPTION = 'Change how one field of the quotation is calculated, check it and try it on a sample row.';

export const FORMULA_EDITOR_HEADING = (letter: string, label: string): string => `Edit formula: ${letter} ${label}`;
/** The intro under the heading (the mock-up, AQP-479): what may be typed. It replaces the hint that was under the box, which said the same. */
export const FORMULA_EDITOR_DESCRIPTION = 'Type letters, rate names, numbers, + - * / and brackets. SUM, MIN, MAX, ROUND and IF are available. SUM(column) adds a column over every row of the estimate.';
export const BREADCRUMB_LABEL = 'Breadcrumb';
export const BREADCRUMB_PARENT = 'Fields and formulas';
export const CARD_TITLE = 'Formula';
export const OUTPUT_TAG = 'Output';
/** The read-only line under the check: the formula as typed, as the cost details will show it (the mock-up). Nothing is stored; "No formula" is for a screen reader while there is nothing to show. */
export const SHOWS_IN_COST_DETAILS = 'Shows in the cost details as';
export const NOTHING_TO_SHOW = 'No formula';

export const FORMULA_LABEL = 'Formula for';
export const SUGGESTIONS_LABEL = 'Suggestions';
export const SUGGESTION_KIND_LABELS = { field: 'field', rate: 'rate', value: 'value', function: 'function' } as const;

export const CHECKING_LINE = 'Checking the formula';
export const CHECK_FAILED_TITLE = 'The formula could not be checked';
export const CHECK_FAILED_LINE = 'The check did not answer. Try again in a moment; nothing was changed.';

export const SAVE_LABEL = 'Save formula';
export const SAVING_LABEL = 'Saving';
export const CANCEL_LABEL = 'Cancel';
export const BACK_LABEL = 'Back to Fields and formulas';
export const SAVE_HINT_UNCHANGED = 'Change the formula to save it.';

export const PASSWORD_TITLE = 'Confirm with your password';
export const PASSWORD_DESCRIPTION = 'Saving a formula changes every price calculated from now on, so the portal asks for your password each time.';
export const PASSWORD_FIELD_LABEL = 'Your password';
/** The server's sentence for a wrong password is "That password is not correct."; SCR-18 adds what to do. */
export const stepUpFailedLine = (serverSentence: string): string => `${serverSentence} Try again.`;
/** The server's sentence for a block is "Too many wrong passwords. Try again in 15 minutes."; SCR-18 adds that nothing was lost. */
export const stepUpLockedLine = (serverSentence: string): string => `${serverSentence} Your formula is kept.`;
export const SAVE_UNCONFIRMED = 'The portal did not answer, so it is not known whether the formula was saved. Check Fields and formulas before you try again.';

export const STALE_TITLE = 'The fields and formulas changed while you were editing';
export const STALE_ACTION = 'Open the editor again';

export const SAVED_TITLE = 'Saved';

export const PREVIEW_HEADING = 'Preview';
export const SAMPLE_ROW_LABEL = 'Try it on a sample row';
export const sampleRowsLine = (code: string): string => `Sample rows come from the latest calculated estimate, ${code}. The preview changes nothing.`;
export const NO_SAMPLE_TITLE = 'There is no calculated estimate to try this on yet.';
export const NO_SAMPLE_LINE = 'The check above still works. The preview appears after an estimate has been calculated.';
export const SAMPLE_FAILED_LINE = 'The sample rows could not be loaded, so there is no preview. The check above still works.';
export const PREVIEW_WAITING = 'The preview appears when the formula is valid.';
export const PREVIEW_RESULT_LABEL = 'Result';
export const WHOLE_ESTIMATE_LINE = 'This formula has one value for the whole estimate, so it is worked out over every row of the sample estimate.';
export const sampleRowOption = (slNo: string, name: string): string => (name === '' ? slNo : `${slNo} ${name}`);

export const USED_BY_HEADING = 'Used by';
export const USED_BY_NONE = 'No other field reads this column yet.';
export const USES_HEADING = 'Uses';

export const LOADING_LABEL = 'Loading the formula';
export const LOAD_ERROR_TITLE = 'We could not load this formula';
export const LOAD_RETRY = 'Try again';
export const NO_FORMULA_TITLE = 'This field has no formula to edit';
export const NO_FORMULA_LINE = 'A column that is typed in or looked up has no formula. Choose a calculated field in Fields and formulas.';
export const EDITOR_LOADING_LABEL = 'Loading the editor';
export const EDITOR_FAILED_TITLE = 'We could not load the editor';
