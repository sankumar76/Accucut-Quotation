/**
 * The words of SCR-17 "Fields and formulas" (UX spec section 6, "SCR-17"; the mock-ups `docs/03-ux/screens/SCR-17.html` and `SCR-17-lead.html`; STORY-08.01 AC-4, AC-7).
 * The kind words and the filter's options are in `src/lib/config/fields-list.ts`, and the sentence under the estimate total is made on the server
 * (`src/lib/config/field-notes.ts`), because it names a column and a column letter is never typed into a screen.
 */

export const FIELDS_TITLE = 'Fields and formulas';
/** The sentence under the title (the mock-ups, AQP-473): the Admin's, who inserts and deletes, and the Lead's, who only reads. */
export const FIELDS_DESCRIPTION = 'The worksheet as a column list. Letters follow the column order and update when you insert or delete a field.';
export const FIELDS_DESCRIPTION_LEAD = 'The worksheet as a column list. You can read every formula; only the Admin can change them.';
/** The Admin's two buttons in the head of the page (the mock-up): the checkpoints page, and the wizard that inserts a field (at the end when no column is chosen). */
export const CHECKPOINTS_BUTTON = 'Checkpoints';
export const INSERT_FIELD_BUTTON = 'Insert field';
export const CHECKPOINTS_PATH = '/config/checkpoints';
export const INSERT_FIELD_PATH = '/config/fields/new';
/** The hidden heading of the column of row actions. */
export const ACTIONS_HEAD = 'Actions';
export const FIELDS_META_DESCRIPTION = 'The fields of the quotation worksheet and the formulas that calculate them.';

/** The Lead's banner (AC-4): a bold first sentence and the reason the formulas are shown. */
export const VIEW_ONLY_TITLE = 'View only.';
export const VIEW_ONLY_TEXT = 'Formulas are shown so you can check the arithmetic.';

export const SEARCH_LABEL = 'Search';
export const SEARCH_PLACEHOLDER = 'Letter, name or formula';
export const KIND_FILTER_LABEL = 'Show';

/** The Admin's action on a field that has a formula (STORY-08.02): it opens SCR-18. The field's letter and name follow it for a screen reader. */
export const EDIT_FORMULA = 'Edit formula';

/** The Admin's action on every column (STORY-08.03): it opens SCR-19 with this column chosen as the one to insert after. */
export const INSERT_AFTER = 'Insert after';

export const SYSTEM_TAG = 'System';
export const SYSTEM_TAG_HINT = 'A System field cannot be deleted: the portal depends on it.';
export const NO_FORMULA = 'No formula';
export const NO_PLACE = 'Not placed';

export const TABLE_REGION_LABEL = 'Fields and formulas, scrollable';
export const TABLE_CAPTION = 'Fields and formulas in column order';
export const CARDS_LABEL = 'Fields and formulas';

export const LOADING_LABEL = 'Loading the fields and formulas';
export const ERROR_TITLE = 'We could not load the fields and formulas';
export const ERROR_RETRY = 'Try again';

export const CLEAR_FILTERS = 'Clear filters';
export const NO_MATCH_DESCRIPTION = 'Check the spelling, or clear the search and the filter.';
/** The title of "no match": it quotes the search when there is one, and says "these filters" when only the kind filter is set. */
export const noMatchTitle = (query: string): string => (query.trim() === '' ? 'No field matches this filter' : `No field matches "${query.trim()}"`);
