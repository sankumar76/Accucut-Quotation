/**
 * The words only the Lead's and the Admin's read-only view of the part form uses (AQP-488, DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md`). In a module of its own, with the code that
 * draws them: the form's fields are fetched after the page is up, so none of these words is in the first load of the estimate page (NFR-009).
 */

/** What an empty field says in the review look: in the box in `--ink-2`, italic, and as a hidden description a screen reader reads after the label. Never `0` or a dash: `0` is a value the Engineer typed. */
export const NOT_ENTERED = 'Not entered';

/**
 * The words of the editable block (DEF-131 stage 2; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.2, 4.3). The line said once, politely, when a save takes the figures from current to cleared; and the notice of a block
 * that turned read-only because the server says the estimate was ignored while the person typed (the page's own words for an ignored estimate).
 */
export const SAVED_CLEARED_LINE = 'Saved. Every calculated figure is cleared. Press Recalculate to see them again.';
export const REVIEW_IGNORED_NOTICE = 'Read-only while this RFQ is ignored. Restore it to change an input.';
