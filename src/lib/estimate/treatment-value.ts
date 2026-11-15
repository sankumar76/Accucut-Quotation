import { OTHER_TREATMENT_ID } from '../masters/system-entries';

import { MAX_OTHER_TREATMENT_LENGTH } from './text-limits';
import { validateTextInput, type InputCheck } from './validation';

/**
 * The value of Treatment / Color (G) and of the eight surface treatments (Z to AG) of the part form (STORY-05.06; FR-049, FR-050; architecture section 5.1 "A treatment on an estimate"). Pure, so the
 * browser (the part form) and the server (the save) read one rule and one shape. It names no rate: a treatment is an ID and words.
 *
 *   - **G is stored as `{ id, text }`** in the part's `inputs`: the treatment's ID, which only tells the form which option to select and whether to show the "Other" box, and the words, which every
 *     screen, the calculation's copy and the export read. The part keeps its words, so a treatment that is renamed or deleted later changes no estimate (A-38; there is no foreign key).
 *   - **On the wire G is one text**, as every other typed value is (`values` of a save and `inputs` of an answer are texts by field ID): the object as JSON, `{"id":"...","text":"..."}`
 *     (`encodeTreatment`). A blank clears it. The server never trusts the `text` of a listed entry: it writes the row's name (`estimate-inputs.ts`); only "Other" keeps what was typed.
 *   - **A flag** (Z to AG) is `"1"` when the treatment is chosen and `"0"` when it is not (`readFlagInput`); a part that never chose any stores none, and every reader reads that as 0.
 */

/** What a part holds for Treatment / Color: the treatment's ID (lower case) and its words. */
export interface TreatmentChoice {
  readonly id: string;
  readonly text: string;
}

/** The words under G when it is not one of the shapes above, and under the box of "Other" when it is empty. UX owns the final words (assumption of the story). */
export const CHOOSE_TREATMENT_MESSAGE = 'Choose a treatment or colour from the list.';
export const OTHER_TREATMENT_REQUIRED_MESSAGE = 'Enter the treatment or colour.';

/** Whether this is the locked "Other" entry, whatever the letter case of its ID. */
export const isOtherTreatment = (id: string): boolean => id.toLowerCase() === OTHER_TREATMENT_ID;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A treatment as stored or as sent: an object with an ID and words and nothing else, or `null`. The ID is lower-cased and the words are kept as they are. */
export function treatmentChoiceOf(value: unknown): TreatmentChoice | null {
  if (!isRecord(value) || Object.keys(value).length !== 2) return null;
  const { id, text } = value;
  return typeof id === 'string' && id.trim() !== '' && typeof text === 'string' ? { id: id.trim().toLowerCase(), text } : null;
}

/** The text a choice travels as: the same two keys in the same order, so one choice is one text. */
export const encodeTreatment = (choice: TreatmentChoice): string => JSON.stringify({ id: choice.id, text: choice.text });

/** The choice a text carries, or `null` for a blank or a text that is not one. */
export function decodeTreatment(text: string): TreatmentChoice | null {
  if (text.trim() === '') return null;
  try {
    return treatmentChoiceOf(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * One typed value of Treatment / Color, read by its shape (the server then looks the ID up). A blank clears it. "Other" needs words: trimmed, not blank, at most `OTHER_TREATMENT_MAX_LENGTH`, with no
 * control character. Any other entry is read as its ID alone: its words are the row's name, written by the server. What is returned is the text to send or store, normalised.
 */
export function readTreatmentInput(typed: string): InputCheck {
  if (typed.trim() === '') return { ok: true, value: null };
  const choice = decodeTreatment(typed);
  if (choice === null) return { ok: false, message: CHOOSE_TREATMENT_MESSAGE };
  if (!isOtherTreatment(choice.id)) return { ok: true, value: encodeTreatment({ id: choice.id, text: choice.text.trim() }) };
  const words = validateTextInput(choice.text, { multiline: false, maxLength: MAX_OTHER_TREATMENT_LENGTH });
  if (!words.ok) return words;
  return words.value === null ? { ok: false, message: OTHER_TREATMENT_REQUIRED_MESSAGE } : { ok: true, value: encodeTreatment({ id: OTHER_TREATMENT_ID, text: words.value }) };
}

/** The words of the Treatment / Color a part holds (the stored `{ id, text }`): what every screen, the calculation and the export read. Empty for no value, or a value that is not a choice. */
export function treatmentWordsOf(stored: unknown): string {
  return treatmentChoiceOf(stored)?.text.trim() ?? '';
}

/** The one text of a flag that is chosen and of one that is not. */
export const FLAG_ON = '1';
export const FLAG_OFF = '0';

export const FLAG_MESSAGE = 'Choose it or leave it.';

/** One typed flag: blank clears, `1` is chosen and `0` is not (a person never types it; the control sends one of the two). */
export function readFlagInput(typed: string): InputCheck {
  const text = typed.trim();
  if (text === '') return { ok: true, value: null };
  return text === FLAG_ON || text === FLAG_OFF ? { ok: true, value: text } : { ok: false, message: FLAG_MESSAGE };
}

/** Whether a flag's text is chosen. Anything but `1` is not. */
export const isFlagOn = (text: string): boolean => text.trim() === FLAG_ON;
