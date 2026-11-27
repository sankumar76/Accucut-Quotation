/**
 * The words only the Lead's and the Admin's read-only view of the part form uses (AQP-488, DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md`). In a module of its own, with the code that
 * draws them: the form's fields are fetched after the page is up, so none of these words is in the first load of the estimate page (NFR-009).
 */

/** What an empty field says in the review look: in the box in `--ink-2`, italic, and as a hidden description a screen reader reads after the label. Never `0` or a dash: `0` is a value the Engineer typed. */
export const NOT_ENTERED = 'Not entered';
