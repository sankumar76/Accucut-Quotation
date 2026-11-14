/**
 * The words of SCR-05 "Estimate workspace" for the header and the customer (UX spec section 6, SCR-05; UX-15, UX-24), written once. None of them names a rate,
 * a price or a formula: the screen does not hint that any exist (UX-24).
 */

export const ESTIMATE_META_TITLE = 'Estimate';
export const ESTIMATE_META_DESCRIPTION = 'Open an estimate and enter the inputs of its parts.';

export const STATUS_LABELS = { DRAFT: 'Draft', SUBMITTED: 'Submitted', APPROVED: 'Approved and locked' } as const;

export const FOLDER_TITLE = 'Task folder';
export const NOTES_FROM_PREFIX = 'Notes from';
export const NO_LINK_NOTE = 'This path has no link. Select it and copy it yourself.';

export const NO_CUSTOMER_TITLE = 'Choose the customer to start.';
export const NO_CUSTOMER_BODY = 'The form opens as soon as you pick one.';

export const CUSTOMER_LABEL = 'Customer';
export const CUSTOMER_TAG = 'Choose this first';
export const CUSTOMER_HINT = 'Choose the customer this estimate is for. Changing it later asks you to confirm.';
export const CUSTOMER_PLACEHOLDER = 'Choose the customer';
export const CUSTOMER_LOADING = 'Loading customers';
export const CUSTOMER_LOCKED_HINT = 'This estimate can no longer be changed.';
export const CUSTOMER_SAVED = 'Customer saved.';
export const CUSTOMER_SAVING = 'Saving';

export const LOAD_FAILED_TITLE = 'We could not load the customers';
export const SAVE_FAILED_TITLE = 'The customer was not saved';
export const FAILED_BODY = 'Check your connection and try again. What you typed is kept.';
export const TRY_AGAIN = 'Try again';

export const CHANGE_TITLE = 'Change the customer?';
export const CHANGE_CONFIRM = 'Change customer';
export const changeDescription = (from: string, to: string): string =>
  `You are changing the customer from ${from} to ${to}. Nothing you typed is lost. The new customer applies the next time the estimate is calculated.`;
export const keepLabel = (name: string): string => `Keep ${name}`;

export const FORM_AREA_TITLE = 'Parts and inputs';
export const FORM_AREA_LOCKED = 'The parts tree and the form open here once the customer is chosen.';

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

export const REVIEW_CUSTOMER_LABEL = 'Customer';
export const REVIEW_NO_CUSTOMER = 'Not chosen yet';

/** The parts tree (STORY-05.02; UX spec SCR-05 "Tree", "Delete part"). No word names a rate, a price or a formula (UX-24). */
export const TREE_TITLE = 'Parts tree';
export const TREE_CLOSE = 'Close parts tree';
export const TREE_HIDE = 'Hide parts tree';
export const TREE_EMPTY = 'No parts yet. Choose "New item" to add the first one.';
export const TREE_LOADING = 'Loading the parts';
export const TREE_LOAD_FAILED_TITLE = 'We could not load the parts';
export const TREE_NEW_ITEM = 'New item';
export const TREE_SUB_PART = 'Sub-part';
export const TREE_PART_BESIDE = 'Part beside';
export const TREE_MOVE_UP = 'Move up';
export const TREE_MOVE_DOWN = 'Move down';
export const TREE_DELETE = 'Delete';
export const TREE_PART_NAME = 'Part';
export const TREE_NO_INPUTS = 'No inputs yet';
export const TREE_SOME_INPUTS = 'Some inputs entered';
export const TREE_ALL_INPUTS = 'All inputs entered';

export const TREE_CHANGED_NOTICE = 'The parts were changed by someone else. The tree has been refreshed. Check it and try again.';
export const TREE_FAILED_TITLE = 'The change was not made';
export const treeButtonLabel = (slNo: string | null): string => (slNo === null ? TREE_TITLE : `${TREE_TITLE}, part ${slNo}`);

export const addedMessage = (slNo: string): string => `Part ${slNo} added`;
export const renumberedMessage = (slNo: string): string => `Part renumbered to ${slNo}`;
export const deletedMessage = (parts: number): string => (parts === 1 ? 'Part deleted' : `${parts} parts deleted`);

export const deleteTitle = (slNo: string): string => `Delete part ${slNo}?`;
export const subPartCount = (count: number): string => `${count} sub-part${count === 1 ? '' : 's'}`;
/** "This also deletes its 2 sub-parts and everything typed into them. This cannot be undone." for a part with sub-parts; a shorter one for a part with none. */
export const deleteDescription = (slNo: string, parts: number): string =>
  parts === 1
    ? `Part ${slNo} and everything typed into it will be deleted. This cannot be undone.`
    : `This also deletes its ${subPartCount(parts - 1)}, and everything typed into them. This cannot be undone.`;
export const deleteConfirm = (parts: number): string => (parts === 1 ? 'Delete part' : `Delete ${parts} parts`);
export const DELETE_CANCEL = 'Cancel';
