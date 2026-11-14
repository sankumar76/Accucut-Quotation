/**
 * The words of SCR-17 "Fields and formulas" (UX spec section 6, "SCR-17"; the mock-ups `docs/03-ux/screens/SCR-17.html` and `SCR-17-lead.html`; STORY-08.01 AC-4, AC-7).
 * The kind words and the filter's options are in `src/lib/config/fields-list.ts`, and the sentence under the estimate total is made on the server
 * (`src/lib/config/field-notes.ts`), because it names a column and a column letter is never typed into a screen.
 */

export const FIELDS_TITLE = 'Fields and formulas';
export const FIELDS_DESCRIPTION = 'Every field of the worksheet in column order, with the formula that calculates it.';
export const FIELDS_META_DESCRIPTION = 'The fields of the quotation worksheet and the formulas that calculate them.';

/** The Lead's banner (AC-4): a bold first sentence and the reason the formulas are shown. */
export const VIEW_ONLY_TITLE = 'View only.';
export const VIEW_ONLY_TEXT = 'Formulas are shown so you can check the arithmetic.';

export const SEARCH_LABEL = 'Search';
export const SEARCH_PLACEHOLDER = 'Letter, name or formula';
export const KIND_FILTER_LABEL = 'Show';

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
