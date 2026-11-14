import { findFieldById, findFieldByKey } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import { MATERIAL_IN_DRAWING_KEY } from '../fields/types';
import { isFieldShown } from '../fields/visibility';
import { DECIMAL_TEXT_PATTERN, normaliseDecimalText } from '../masters/master-rules';

import { buildFormSections, type FormFieldView } from './form-fields';
import { MAX_LONG_TEXT_LENGTH, MAX_PART_TEXT_LENGTH } from './text-limits';

/**
 * The rule of one value typed into the part form (STORY-05.03 AC-4; SPEC section 7.3; architecture sections 4.8 and 8), read by the browser (to show the message
 * under the field and keep the typed text) and by the server (the only place that decides). Pure, with no zod, so the page does not carry it (NFR-009).
 *
 *   - **A blank is allowed while saving.** It clears the value: a value that is not there is not stored, so a part with nothing typed is `EMPTY`. That every
 *     input is filled is a check of Calculate (STORY-05.09), not of a save.
 *   - **A number** is digits with up to two decimals and no sign, separator or exponent (the API takes plain decimals only). It is stored as text with exactly two
 *     decimals and no leading zeros (`12.5` is `12.50`, `003.37` is `3.37`), so two spellings of one number are one stored value and a repeated save changes
 *     nothing (architecture section 4.8). It is never a JavaScript number.
 *   - **A text** is trimmed, at most its field's length (`MAX_PART_TEXT_LENGTH`, or `MAX_LONG_TEXT_LENGTH` for the multi-line Remarks), and holds no control character (a line break only in a multi-line field).
 *     It is kept as typed otherwise: a text that starts with `=` is a value, and neutralising it for a spreadsheet is the export's job (STORY-08).
 */

/** The 422 and the field message of a number that is not 0 or more with up to 2 decimals (UX spec SCR-05 "Fields"). */
export const NUMBER_RULE_MESSAGE = 'Enter 0 or more, with up to 2 decimals.';

/** The most digits before the point (the shape of `DECIMAL_TEXT_PATTERN`, which keeps a value inside its column). */
export const MAX_NUMBER_DIGITS = 12;
export const NUMBER_TOO_LARGE_MESSAGE = `Use ${MAX_NUMBER_DIGITS} digits or fewer before the point.`;
const TOO_MANY_DIGITS = new RegExp(`^\\d{${MAX_NUMBER_DIGITS + 1},}(?:\\.\\d{1,2})?$`);

/** The longest typed texts are in `text-limits.ts` (so `form-fields.ts` need not import this file, which imports it); they are re-exported here for the callers that read them with the rule. */
export { MAX_LONG_TEXT_LENGTH, MAX_PART_TEXT_LENGTH };

/** The words under a text that is too long, with the limit of its field: "Use 1,000 characters or fewer." */
export const textTooLongMessage = (maxLength: number): string => `Use ${maxLength.toLocaleString('en-US')} characters or fewer.`;
export const TEXT_TOO_LONG_MESSAGE = textTooLongMessage(MAX_PART_TEXT_LENGTH);
export const TEXT_CHARACTERS_MESSAGE = 'Use letters, numbers and punctuation only.';

/** The result of reading one typed value: the text to store (`null`: nothing, the value is cleared), or the words to show under the field. */
export type InputCheck = { readonly ok: true; readonly value: string | null } | { readonly ok: false; readonly message: string };

/**
 * Every control character (Unicode category Cc: C0, DEL and C1), every **format** character (Cf: the zero-width characters U+200B to U+200F, U+061C, U+2060 to U+2064, U+FEFF,
 * the bidirectional overrides, embeddings and isolates, the soft hyphen) and the line and paragraph separators (Zl, Zp). They are invisible or reorder what is shown, so a part number
 * could display other than it is stored (reviews SQR-04 and the security review). There is **no exception**: the zero-width joiner and non-joiner (U+200D, U+200C), which some Indian
 * scripts need, are blocked too, as no source asks for them. **Assumption, to be confirmed by the product owner if a script needs them.** A line feed is let through by the
 * multi-line rule below, after a carriage return is folded into it. A **lone surrogate** (Cs: half of a pair, which JSON can carry as `\ud800`) is refused as well: PostgreSQL's
 * `jsonb` cannot store it, so it would be a 500 and not a 422 (review SQR-13); a valid pair, an emoji for one, is not Cs once read as one character.
 */
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Cs}]/u;
const LINE_BREAKS = /\r\n?/g;
const LINE_FEED = /\n/g;

/** One typed number: blank clears, a valid one is stored normalised, anything else is refused with the words of the rule. */
export function validateNumberInput(typed: string): InputCheck {
  const text = typed.trim();
  if (text === '') return { ok: true, value: null };
  if (DECIMAL_TEXT_PATTERN.test(text)) return { ok: true, value: normaliseDecimalText(text) };
  // A number that has the right shape but too many digits is told so, not that its decimals are wrong (review SQR-11).
  return { ok: false, message: TOO_MANY_DIGITS.test(text) ? NUMBER_TOO_LARGE_MESSAGE : NUMBER_RULE_MESSAGE };
}

export interface TextRule {
  /** The text is entered over several lines (Remarks): a line break is part of it. */
  readonly multiline: boolean;
  /** The longest text, in characters, from the field's rule. Absent means `MAX_PART_TEXT_LENGTH`. */
  readonly maxLength?: number;
}

/** One typed text: blank clears, too long or holding a control character is refused. The stored text is trimmed. */
export function validateTextInput(typed: string, rule: TextRule): InputCheck {
  const text = (rule.multiline ? typed.replace(LINE_BREAKS, '\n') : typed).trim();
  if (text === '') return { ok: true, value: null };
  const maxLength = rule.maxLength ?? MAX_PART_TEXT_LENGTH;
  if (text.length > maxLength) return { ok: false, message: textTooLongMessage(maxLength) };
  const withoutLineFeeds = rule.multiline ? text.replace(LINE_FEED, '') : text;
  return CONTROL_CHARACTERS.test(withoutLineFeeds) ? { ok: false, message: TEXT_CHARACTERS_MESSAGE } : { ok: true, value: text };
}

/**
 * The check that every part is complete before Calculate (STORY-05.09 AC-1 to AC-3, AC-5; FR-055; SPEC section 14.4; architecture sections 4.2 and 4.5). Pure, so the unit tests cover every case
 * without a database, and so the one rule of "what is visible and needed" is the form's own (`buildFormSections`) and the registry's own (`isFieldShown`), not a second copy.
 *
 *   - **Needed** is a field of the form that a person types or chooses and that the registry marks mandatory. It follows the form, so the "n of m" of a card and this check agree, and
 *     a field the form does not offer yet (Treatment / Color and the treatment flags, until STORY-05.06; the picture, never needed) is not needed. When a story moves a field onto the form, this
 *     check needs it with no edit here. Assumption A-1 of the story.
 *   - **Hidden** is a field the registry's `visibleWhen` hides for this part (Fasteners Qty and Cost while Fasteners is "None" or blank). It is not needed, and the calculation reads it as 0
 *     whatever is stored under it (a value typed before the rule hid it is not used). The rule is `isFieldShown`, the one copy.
 *   - **A value is read through its field's rule, and so is a default.** A stored value that is not text, or that the rule refuses (a blank, a negative number, a text too long), is blank; a field
 *     with a default (Fasteners: "None") takes it while nothing is stored, **after** the default has been read by the same rule: a default is data of the registry and is not trusted as valid
 *     (review SQR-03 of STORY-05.04). Zero is a value.
 *   - **What is named** is each part with its Sl. No and name and each missing field by its ID and label: nothing that depends on a rate, a material or a calculation.
 */

/** One part of the tree as Calculate reads it: its ID, its Sl. No (from the tree, in reading order) and what is stored in it by field ID. */
export interface PartToCheck {
  readonly id: string;
  readonly slNo: string;
  readonly inputs: Readonly<Record<string, unknown>>;
}

/** A needed field that shows no value. */
export interface MissingField {
  readonly fieldId: string;
  readonly label: string;
}

/** A part with at least one missing field: what the 422 `CALCULATE_BLOCKED` names. `name` is the Description, else the Part No., else null. */
export interface BlockedPart {
  readonly nodeId: string;
  readonly slNo: string;
  readonly name: string | null;
  readonly fields: ReadonlyArray<MissingField>;
}

/** A complete part: what the calculation takes from it. Numbers are plain decimal text (a hidden field is `0`); words are the typed texts, by field ID. */
export interface CheckedPart {
  readonly id: string;
  readonly slNo: string;
  /** The ID of the Material Master row for Material in Drawing (E), in lower case. */
  readonly materialId: string;
  readonly numbers: Readonly<Record<string, string>>;
  readonly texts: Readonly<Record<string, string>>;
}

export type CalculateCheck = { readonly ok: true; readonly parts: ReadonlyArray<CheckedPart> } | { readonly ok: false; readonly parts: ReadonlyArray<BlockedPart> };

/** The keys of the fields that name a part, in the order they are tried. */
const PART_NAME_KEYS: ReadonlyArray<string> = ['description', 'part-no'];

/** What a number the registry hides for a part is read as: 0, in the form every stored number has (two decimals). */
const HIDDEN_NUMBER = '0.00';

type Values = ReadonlyMap<string, string | null>;

/** The value of a field as the part holds it: the stored text if there is one, otherwise the field's default, read by the field's rule; `null` when there is none or the rule refuses it. */
function readField(field: FormFieldView, stored: unknown): string | null {
  const typed = typeof stored === 'string' ? stored : '';
  const raw = typed.trim() === '' ? (field.defaultValue ?? '') : typed;
  switch (field.rule.type) {
    case 'number': {
      const check = validateNumberInput(raw);
      return check.ok ? check.value : null;
    }
    case 'text': {
      const check = validateTextInput(raw, { multiline: field.rule.multiline, maxLength: field.rule.maxLength });
      return check.ok ? check.value : null;
    }
    case 'select':
      return raw.trim() === '' ? null : raw.trim().toLowerCase();
    case 'derived':
      return null;
  }
}

/** Every field of the form that a person types or chooses, in the order of the form. */
function typedFieldsOf(document: ConfigDocument): ReadonlyArray<FormFieldView> {
  return buildFormSections(document).flatMap((section) => section.fields.filter((field) => field.editable));
}

/** The registry's inputs that are not on the form but that the calculation or the record reads: the flags (numbers) and the words of Treatment / Color. */
function reservedInputs(document: ConfigDocument, dataType: 'flag' | 'select_other') {
  return document.fields.flatMap((field) => (field.kind === 'input' && field.dataType === dataType ? [field] : []));
}

/** The words of a part's name: the first of `PART_NAME_KEYS` that holds a value. */
function nameOf(document: ConfigDocument, values: Values): string | null {
  for (const key of PART_NAME_KEYS) {
    const field = findFieldByKey(document, key);
    const value = field === undefined ? null : (values.get(field.id) ?? null);
    if (value !== null) return value;
  }
  return null;
}

/** The values of every field of the form for one part, and whether the registry shows a field of it. */
function readPart(part: PartToCheck, document: ConfigDocument, fields: ReadonlyArray<FormFieldView>) {
  const values: Values = new Map(fields.map((field) => [field.id, readField(field, part.inputs[field.id])]));
  const shown = (fieldId: string): boolean => {
    const found = findFieldById(document, fieldId);
    return found === undefined || isFieldShown(found, (watched) => values.get(watched) ?? undefined);
  };
  return { values, shown };
}

function missingOf(fields: ReadonlyArray<FormFieldView>, values: Values, shown: (fieldId: string) => boolean): MissingField[] {
  return fields.filter((field) => field.required && shown(field.id) && values.get(field.id) === null).map((field) => ({ fieldId: field.id, label: field.label }));
}

/** The typed numbers: a shown one as read, a hidden one as 0, and the flags, which are not on the form yet and are read as numbers (an absent one is its default, 0). */
function numbersOf(part: PartToCheck, document: ConfigDocument, fields: ReadonlyArray<FormFieldView>, values: Values, shown: (fieldId: string) => boolean): Record<string, string> {
  const numbers: Record<string, string> = {};
  for (const field of fields.filter((candidate) => candidate.rule.type === 'number')) {
    const value = shown(field.id) ? values.get(field.id) : HIDDEN_NUMBER;
    if (value !== null && value !== undefined) numbers[field.id] = value;
  }
  for (const flag of reservedInputs(document, 'flag')) {
    const stored = part.inputs[flag.id];
    const check = validateNumberInput(typeof stored === 'string' && stored.trim() !== '' ? stored : (flag.defaultValue ?? ''));
    if (check.ok && check.value !== null) numbers[flag.id] = check.value;
  }
  return numbers;
}

/** The typed words, and the word kept for Treatment / Color once its story builds the control (until then nothing is stored for it, and nothing is made up). */
function textsOf(part: PartToCheck, document: ConfigDocument, fields: ReadonlyArray<FormFieldView>, values: Values): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const field of fields.filter((candidate) => candidate.rule.type === 'text')) {
    const value = values.get(field.id);
    if (value !== null && value !== undefined) texts[field.id] = value;
  }
  for (const treatment of reservedInputs(document, 'select_other')) {
    const stored = part.inputs[treatment.id];
    if (typeof stored === 'string' && stored.trim() !== '') texts[treatment.id] = stored.trim();
  }
  return texts;
}

/**
 * Checks every part, in the order given (the tree's reading order). Passes with the numbers and words of each part, or blocks with each part that has a missing field; it is never both. An
 * estimate with no part passes with nothing: that it must have one is the service's to say.
 */
export function validateForCalculate(parts: ReadonlyArray<PartToCheck>, document: ConfigDocument): CalculateCheck {
  const fields = typedFieldsOf(document);
  const material = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY);
  const blocked: BlockedPart[] = [];
  const checked: CheckedPart[] = [];
  for (const part of parts) {
    const { values, shown } = readPart(part, document, fields);
    const missing = missingOf(fields, values, shown);
    const materialId = material === undefined ? null : (values.get(material.id) ?? null);
    if (missing.length > 0 || materialId === null) {
      blocked.push({ nodeId: part.id, slNo: part.slNo, name: nameOf(document, values), fields: missing });
    } else {
      checked.push({ id: part.id, slNo: part.slNo, materialId, numbers: numbersOf(part, document, fields, values, shown), texts: textsOf(part, document, fields, values) });
    }
  }
  return blocked.length > 0 ? { ok: false, parts: blocked } : { ok: true, parts: checked };
}
