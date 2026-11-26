/**
 * The words of SCR-05 "Estimate workspace" for the header and the customer (UX spec section 6, SCR-05; UX-15, UX-24), written once. None of them names a rate,
 * a price or a formula: the screen does not hint that any exist (UX-24).
 */

export const ESTIMATE_META_TITLE = 'Estimate';
export const ESTIMATE_META_DESCRIPTION = 'Open an estimate and enter the inputs of its parts.';

export const FOLDER_TITLE = 'Task folder';
export const NOTES_FROM_PREFIX = 'Notes from';
export const NO_LINK_NOTE = 'This path has no link. Select it and copy it yourself.';

/**
 * The customer, its short name and the subject on the header (CR-01 item 6, AQP-390): read-only labelled text for every role. The customer is set when the task is assigned and changed only by a Lead or an Admin
 * on SCR-06, so there is no "choose the customer first" step on this page any more. The sentence for an estimate made before that, which has no customer, is one constant: a neutral line for the
 * Engineer (who cannot set one), for the ux-expert to confirm. The refusal of Calculate keeps its words until that ruling (AC-11).
 */
export const IDENTITY_LABEL = 'Customer and subject';
export const CUSTOMER_NAME_LABEL = 'Customer Name';
export const CUSTOMER_SHORT_NAME_LABEL = 'Customer Short Name';
/** What the short name shows for an estimate that has no customer: a value, so the label is never bare. */
export const SHORT_NAME_NOT_SET = 'Not set';
export const SUBJECT_LABEL = 'Subject (project name)';

export const FAILED_BODY = 'Check your connection and try again. What you typed is kept.';
export const TRY_AGAIN = 'Try again';


export const FORM_AREA_TITLE = 'Parts and inputs';

/**
 * The part form (STORY-05.03; UX spec SCR-05 "Content and microcopy", "States"). The labels, letters, hints and ranges of the fields come from the server, from the registry, and are
 * not written here; these are the words around them. None of them names a rate, a price or a formula (UX-24).
 */
export const partFormTitle = (slNo: string): string => `Part ${slNo}`;
export const FORM_INTRO = 'Every field is needed to Calculate. Enter 0 where a part needs nothing. Numbers allow up to 2 decimals.';
export const FORM_LOADING = 'Loading the form';
export const FORM_LOAD_FAILED_TITLE = 'We could not load the form';
export const FORM_NO_PART = 'Choose a part in the tree to fill in its form, or add the first one with "New item".';
export const FORM_LOCKED = 'This estimate can no longer be changed.';
export const lastSavedText = (when: string): string => `Last saved ${when}`;
export const NOT_SAVED_YET = 'Nothing saved yet';
export const PART_SAVED = 'Saved';
export const PART_SAVE_FAILED_TITLE = 'The change was not saved';
export const PART_CHANGED_NOTICE = 'This part was changed by someone else. It has been reloaded. Check it and try again.';
export const PART_LOAD_FAILED_TITLE = 'We could not load this part';
export const MATERIAL_PLACEHOLDER = 'Choose a material';
export const MATERIAL_LOADING = 'Loading materials';
export const MATERIAL_LOAD_FAILED_TITLE = 'We could not load the materials';
export const sectionRegionLabel = (number: number, name: string): string => `${String(number).padStart(2, '0')} ${name}`;
export const columnRangeLabel = (range: string): string => `Excel columns ${range}`;

/**
 * The other sections of the form (STORY-05.04; UX spec SCR-05 "Layout rules": the section strip, "n of m" on every card). The sentences are about the form and name no rate, price or formula (UX-24).
 */
export const SECTION_STRIP_LABEL = 'Sections of the form';
export const sectionLinkText = (number: number, shortName: string): string => `${String(number).padStart(2, '0')} ${shortName}`;
export const SECTION_COMPLETE_TEXT = 'All filled in';
export const progressText = (complete: number, total: number): string => `${complete} of ${total} complete`;

/**
 * The completion line of the open part and the words around it (STORY-05.11; UX spec SCR-05 "Content": "24 of 25 inputs complete"). The wording is the wireframe's and is the ux-expert's to rule at the end review
 * (OQ-1). No word names a rate, a price or a formula (UX-24).
 */
export const inputsProgressText = (complete: number, total: number): string => `${complete} of ${total} inputs complete`;
export const inputsProgressLabel = (slNo: string): string => `Inputs complete for part ${slNo}`;
export const partCompleteText = (slNo: string): string => `Part ${slNo} is complete.`;

/** The parts tree (STORY-05.02; UX spec SCR-05 "Tree", "Delete part"). No word names a rate, a price or a formula (UX-24). */
export const TREE_TITLE = 'Parts tree';
/** The ID of the form area's title: the row links of the parts tree point at it (CR-01 item 3B), because a row opens the details that sit beside the tree. */
export const FORM_AREA_TITLE_ID = 'estimate-form-area-title';
export const TREE_CLOSE = 'Close parts tree';
export const TREE_HIDE = 'Hide parts tree';
export const TREE_EMPTY = 'No parts yet. Choose "Add main assembly" to add the first one.';
export const TREE_LOADING = 'Loading the parts';
export const TREE_LOAD_FAILED_TITLE = 'We could not load the parts';
export const TREE_MOVE_UP = 'Move up';
export const TREE_MOVE_DOWN = 'Move down';
export const TREE_NO_INPUTS = 'No inputs yet';
export const TREE_SOME_INPUTS = 'Some inputs entered';
export const TREE_ALL_INPUTS = 'All inputs entered';

export const TREE_CHANGED_NOTICE = 'The parts were changed by someone else. The tree has been refreshed. Check it and try again.';
export const TREE_FAILED_TITLE = 'The change was not made';
/** Shown above the tree, and spoken, while a change to the tree is still open after 300 ms (AQP-343, DL-340; ux-expert's words, AQP-343 comment 12880). The pattern of "Calculating. This takes a moment." */
export const TREE_CHANGING = 'Updating the parts. This takes a moment.';
/** The ID of the visible line above: the buttons that are `aria-disabled` while it shows point at it (`aria-describedby`). */
export const TREE_CHANGING_ID = 'parts-tree-changing';
/** The count on the right of the tree's head (DEF-081 ruling item 10; SCR-05 "12 rows"): every row, open or closed. */
export const treeRowsLabel = (rows: number): string => (rows === 1 ? '1 row' : `${rows} rows`);

export const renumberedMessage = (slNo: string): string => `Part renumbered to ${slNo}`;
export const deletedMessage = (parts: number): string => (parts === 1 ? 'Row deleted' : `${parts} rows deleted`);


/**
 * Calculate (STORY-05.09; UX spec SCR-05 "Calculate blocked", "Prepared"). The sentence an Engineer is told after a good Calculate is the server's (`CALCULATE_MESSAGE`, in the answer); the
 * summary of a blocked one is built from the same function the server uses (`blockedSummary`), so the page and the 422 say one thing. None of these words names a rate, a price or a formula
 * (UX-24), and none holds a figure.
 */
export const CALCULATE_PREPARED_TITLE = 'Prepared';
/** The state "Approved" of SCR-05 (STORY-06.06 AC-4; UX spec SCR-05 states and the G3 screen): read-only, and **no price** (NFR-002); a status is not a cost. */
export const APPROVED_LOCKED_TITLE = 'Approved and locked.';
/** The same notice on a Quoted estimate (QLT-C-02 of the final review; FR-102, FR-110): the word of the status the badge shows, so one status is never given two words. The body says nothing of a status and fits both. */
export const QUOTED_LOCKED_TITLE = 'Quoted and locked.';
/** The title of the locked notice by status: Quoted says Quoted, every other locked status is the Approved one. */
export const lockedNoticeTitle = (status: 'APPROVED' | 'QUOTED'): string => (status === 'QUOTED' ? QUOTED_LOCKED_TITLE : APPROVED_LOCKED_TITLE);
export const APPROVED_LOCKED_BODY = 'This estimate is closed and the task has moved to Closed. Inputs cannot be changed.';
export const CALCULATE_FAILED_TITLE = 'Calculate did not go through';
/** Nothing was sent because a field shows a value that is not saved (the form says which, under the field), and the button could not be loaded (the page needs a reload). */
export const CALCULATE_UNSAVED_TITLE = 'Nothing was submitted. A field has a value that is not saved. Fix the field that shows a message, then press Calculate again.';
export const CALCULATE_BAR_FAILED_TITLE = 'The Calculate button could not be loaded. Reload the page to try again.';
/** The warning before leaving with unsaved changes (STORY-05.08) could not be loaded: until the page is reloaded, leaving does not ask. */
export const LEAVE_GUARD_FAILED_TITLE = 'The warning before leaving could not be loaded, so leaving this page will not ask first. Save your work, or reload the page to try again.';
/** The words under a field that Calculate found blank (UX spec SCR-05 "Fields"): a number says what to do when a part needs nothing. */
export const MISSING_TEXT_MESSAGE = 'Enter this value.';
export const MISSING_NUMBER_MESSAGE = 'Enter this value. Use 0 if the part does not need it.';
export const MISSING_CHOICE_MESSAGE = 'Choose a material.';
/** A choice input the Admin added (STORY-08.08): the placeholder of its list and the words under it when Calculate found it blank. Proposed (OQ-1); the ux-expert rules at the end review. */
export const OPTION_PLACEHOLDER = 'Choose an option';
export const MISSING_OPTION_MESSAGE = 'Choose an option.';
/** Spoken after a part in the tree, a card and a link of the section strip that Calculate found a blank in, beside the triangle. */
export const TREE_MISSING_INPUTS = 'Missing inputs';

/** The picture field's code (a separate file, fetched when the form opens) did not arrive: said where the field would be (STORY-05.07). */
export const PICTURE_LOAD_FAILED_TITLE = 'We could not load the picture field';
