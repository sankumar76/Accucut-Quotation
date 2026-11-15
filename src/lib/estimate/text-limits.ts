/**
 * The longest typed text of a part, in one place so `validation.ts` (which reads a typed value and, at Calculate, a whole part) and `form-fields.ts` (which builds the form's rules and is
 * read by `validation.ts`) do not import each other.
 */

/**
 * The longest typed text of a part (Part No., Description, and the texts of the sections after them). An assumption, as the registry's own limit for a label is
 * 200 and no source gives a longer one: it bounds the row of `estimate_nodes.inputs` and what a tree and an export carry.
 */
export const MAX_PART_TEXT_LENGTH = 200;
/**
 * The longest typed text of a multi-line field (Remarks, AJ; STORY-05.04 AC-4). Assumption A-1: no source gives a maximum, so 1,000 characters, which is about a paragraph and
 * still bounds the row; the product owner may change it. The field's own limit is in its rule (`FormRule.maxLength`), so the screen and the server read one number.
 */
export const MAX_LONG_TEXT_LENGTH = 1000;
/** The longest words typed beside "Other" in Treatment / Color (FR-050; STORY-05.06 AC-3). In the field's rule, so the screen and the server read one number. */
export const MAX_OTHER_TREATMENT_LENGTH = 100;
