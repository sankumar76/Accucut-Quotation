/**
 * The limits of what the Admin types for a choice input and a new section (STORY-08.08 AC-6, assumption A-3, confirmed by the product-owner on 2026-11-19). In a file of their own with no import, so the wizard's
 * words (`insert-field-texts.ts`, part of its lazy chunk, NFR-009) and the server's check (`field-insert-check.ts`) read one number and neither pulls in the other's code. The registry's own limit for any
 * text is 200 characters (`MAX_TEXT` of `field-schema.ts`); these are stricter on purpose, so a choice or a strip label stays readable on the Engineer's form.
 */

/** The most choices one input may offer. */
export const MAX_CHOICES = 50;

/** The longest single choice, in characters. */
export const MAX_CHOICE_LENGTH = 100;

/** The longest name of a new section. */
export const MAX_SECTION_NAME_LENGTH = 100;

/** The longest short name of a new section (the label on the section strip of the Engineer's form). */
export const MAX_SECTION_SHORT_NAME_LENGTH = 30;
