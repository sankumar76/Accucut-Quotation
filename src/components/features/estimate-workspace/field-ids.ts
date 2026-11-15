/**
 * The names a part form's controls are found by, in a module of its own with no import. The first load of `/estimates/[code]` reaches the focus helpers (`focus-field.ts`), and they must find a field
 * by these names without importing the form's fields: putting these in `field-renderer.tsx` or `part-fields.tsx` would bring both back into the first load (NFR-009, ADR-016 E1).
 */

/** Marks the part form's `<form>`; `data-part-id` on it names the part. */
export const PART_FORM_ATTRIBUTE = 'data-part-form';

/** Marks a control that Enter moves on from: the form's key handler finds the next one by this, and skips a read-only or disabled one (STORY-05.03 AC-6). */
export const FIELD_MARK = 'data-part-field';

/** The selector of a control that can be typed into. */
export const NEXT_FIELD = `[${FIELD_MARK}="true"]`;

/** The id of the control of the field with this ID: the registry's field ID, which is unique on the page. Calculate's list of missing fields links to it. */
export const controlIdFor = (fieldId: string): string => `part-field-${fieldId}`;
