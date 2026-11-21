/**
 * The words of the insert wizard, SCR-19 (STORY-08.03; UX spec SCR-19): every sentence the server's check and save say, written once. They are pure strings built from names the caller passes in, so a column
 * letter or a field name is never typed here (coding standards section 10). The success words are proposed (assumption A-4) and are the ux-expert's to rule on at the end review.
 */

/** `Enter a label.` The words SCR-19 and SCR-17 already use for an empty label (AC-7). */
export const LABEL_REQUIRED_MESSAGE = 'Enter a label.';

/** An input in no section: the Engineer's form would have nowhere to draw it (AC-7). */
export const SECTION_REQUIRED_MESSAGE = 'Choose a section.';

/** "Insert after" names no column of the current version (AC-7). */
export const AFTER_REQUIRED_MESSAGE = 'Choose the column to insert after.';

/** An output with no formula has nothing to calculate. */
export const FORMULA_REQUIRED_MESSAGE = 'Enter a formula.';

export const STAGE_REQUIRED_MESSAGE = 'Choose a stage.';

export const GROUP_UNKNOWN_MESSAGE = 'Choose one of the sub-headings of this stage.';

export const WATCH_FIELD_MESSAGE = 'Choose the field to watch.';

/** The line is hidden while its input is 0, so the input must hold a number (a Number or a flag): a text is never 0 and would hide the line for good. */
export const HIDE_FIELD_MESSAGE = 'Choose an input that holds a number.';

/** A pair whose new input is Text cannot hide its cost line when the input is 0. */
export const HIDE_PAIR_MESSAGE = 'Hide the line only for a Number input.';

export const VALUE_TYPE_MESSAGE = 'Choose Number, Text or Choice from a list.';

/**
 * A choice input and a new section (STORY-08.08 AC-6). The three sentences the story names are `CHOICES_REQUIRED_MESSAGE`, `CHOICES_DUPLICATE_MESSAGE` and `SECTION_NAME_REQUIRED_MESSAGE`; the others
 * say the same kind of thing for the limits and are proposed with them (open question OQ-1: the ux-expert rules on every word at the end review).
 */
export const CHOICES_REQUIRED_MESSAGE = 'Enter at least one choice.';
export const CHOICES_DUPLICATE_MESSAGE = 'Each choice must be different.';
export const SECTION_NAME_REQUIRED_MESSAGE = 'Enter a section name.';
export const SHORT_NAME_REQUIRED_MESSAGE = 'Enter a short name for the section strip.';

export function tooManyChoicesMessage(most: number): string {
  return `Enter at most ${String(most)} choices.`;
}

/** A default for a choice input must be one of its choices, so the form never opens on a value the list does not hold. */
export const DEFAULT_NOT_A_CHOICE_MESSAGE = 'The default must be one of the choices.';

export const FORMAT_MESSAGE = 'Choose one of the number formats the worksheet uses.';

/** The width of an Excel column, in characters (AC-2: "widths are 1 to 255"). */
export const WIDTH_MESSAGE = 'Enter a width from 1 to 255.';

/** The one sentence the registry's own last gate gives when the finished document would not be valid. It names no value (AC-7). */
export const DOCUMENT_REFUSED_MESSAGE = 'The field registry would not be valid with this field, so nothing was inserted.';

/** 409 `CONFIG_VERSION_CHANGED` for an insert: another save came first (AC-4; the same words as the formula save, with the insert's own last sentence). */
export function insertVersionChangedMessage(currentVersion: number): string {
  return `The fields and formulas were changed while you were inserting. They are now at configuration version ${String(currentVersion)}. Nothing was inserted; start again to see what changed.`;
}

function joinWithAnd(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/** `Section 09 Welding`: how a section is named in a sentence (its number as the form prints it, two digits). */
export function sectionWords(number: number, name: string): string {
  return `section ${String(number).padStart(2, '0')} ${name}`;
}

/** `Inserted as AY. Configuration version 10.` and, for the pair, `Inserted as AY and AZ. Configuration version 10.` */
export function insertedMessage(letters: ReadonlyArray<string>, versionNumber: number): string {
  return `Inserted as ${joinWithAnd(letters)}. Configuration version ${String(versionNumber)}.`;
}

/** The label of the button on step 3: `Insert` for one field, `Insert 2 fields` for the pair. */
export function insertButtonLabel(count: number): string {
  return count === 1 ? 'Insert' : `Insert ${String(count)} fields`;
}

const SHIFT_WORDS: Readonly<Record<number, string>> = { 1: 'one', 2: 'two' };

/** `one` and `two`, the shifts an insert makes; any other number as digits. */
export function shiftWords(by: number): string {
  return SHIFT_WORDS[by] ?? String(by);
}

/** One run of columns that moved by the same number of places, as the audit entry words it: `Columns AY to BO moved one to the right` (a single column: `Column BO moved one to the right`). */
export function movedRunWords(from: string, to: string, by: number): string {
  const places = `${shiftWords(by)} to the right`;
  return from === to ? `Column ${from} moved ${places}` : `Columns ${from} to ${to} moved ${places}`;
}
