import { findFieldByKey } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import { MATERIAL_IN_DRAWING_KEY } from '../fields/types';

import { buildFormSections, type FormFieldView, type FormRule } from './form-fields';
import { hiddenFieldIds, HIDDEN_NUMBER } from './hidden-inputs';
import { treatmentWordsOf } from './treatment-value';
import { validateNumberInput, validateTextInput } from './validation';

/**
 * The check that every part is complete before Calculate (STORY-05.09 AC-1 to AC-3, AC-5; FR-055; SPEC section 14.4; architecture sections 4.2 and 4.5). Pure, so the unit tests cover every case
 * without a database, and so the one rule of "what is visible and needed" is the form's own (`buildFormSections`) and the registry's own (`isFieldShown`, through `hiddenFieldIds`), not a second copy.
 *
 *   - **Needed** is a field of the form that a person types or chooses and that the registry marks mandatory. It follows the form, so the "n of m" of a card and this check agree, and
 *     a field the form does not offer (the picture, never needed) is not needed. When a story moves a field onto the form, this check needs it with no edit here. Assumption A-1 of the story.
 *     Treatment / Color (G) is on the form since STORY-05.06, so a part is blocked until a treatment, "Not applicable" or "Other" with words is chosen; the eight surface treatments are never needed (none chosen is 0).
 *   - **Hidden** is a field the registry's `visibleWhen` hides for this part (Fasteners Qty and Cost while Fasteners is "None" or blank). It is not needed, and the calculation reads it as 0
 *     whatever is stored under it (a value typed before the rule hid it is not used). The rule is `isFieldShown`, the one copy.
 *   - **A value is read through its field's rule, and so is a default.** A stored value that is not text, or that the rule refuses (a blank, a negative number, a text too long), is blank; a field
 *     with a default (Fasteners: "None") takes it while nothing is stored, **after** the default has been read by the same rule: a default is data of the registry and is not trusted as valid
 *     (review SQR-03 of STORY-05.04). Zero is a value.
 *   - **Its own file.** The story names `validation.ts`; the check lives beside it because `validation.ts` is read by the browser (the part form), and the check pulls in the whole form definition and
 *     the registry, which only the server needs. In one file the page's first-load JavaScript went over its limit (NFR-009, `/estimates/[code]`, 201,840 of 200,000 bytes gzip). It is held to the
 *     same 95 % of `validation.ts` (`vitest.config.ts`).
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
export const PART_NAME_KEYS: ReadonlyArray<string> = ['description', 'part-no'];

/**
 * A field of the form that a person types or chooses: its rule is a number, a text or a choice, never "follows another field" and never the picture. Part Model (C, STORY-05.07) is
 * optional (D-31): Calculate does not read it, never lists it as missing and never refuses for it; the picture is recorded with the part by its own ID (`imageId`).
 */
type TypedField = FormFieldView & { readonly rule: Exclude<FormRule, { readonly type: 'derived' } | { readonly type: 'picture' }> };
const isTyped = (field: FormFieldView): field is TypedField => field.rule.type !== 'derived' && field.rule.type !== 'picture';

/** One field of the form as one part holds it: its value read by its rule (`null`: none, or refused). */
export interface FieldValue {
  readonly field: TypedField;
  readonly value: string | null;
}

/** The value of a field as the part holds it: the stored text if there is one, otherwise the field's default, read by the field's rule; `null` when there is none or the rule refuses it. */
function readField(field: TypedField, stored: unknown): string | null {
  // Treatment / Color is stored as `{ id, text }` and is read as its words: a listed entry, "Not applicable" and "Other" alike (STORY-05.06 AC-4, AC-5).
  if (field.rule.type === 'treatment') return treatmentWordsOf(stored) || null;
  const typed = typeof stored === 'string' ? stored : '';
  const raw = typed.trim() === '' ? (field.defaultValue ?? '') : typed;
  switch (field.rule.type) {
    case 'number':
    case 'flag': {
      const check = validateNumberInput(raw);
      return check.ok ? check.value : null;
    }
    case 'text': {
      const check = validateTextInput(raw, { multiline: field.rule.multiline, maxLength: field.rule.maxLength });
      return check.ok ? check.value : null;
    }
    case 'select':
      return raw.trim() === '' ? null : raw.trim().toLowerCase();
  }
}

/** Every field of the form that a person types or chooses, in the order of the form. */
const typedFieldsOf = (document: ConfigDocument): ReadonlyArray<TypedField> => buildFormSections(document).flatMap((section) => section.fields.filter(isTyped));

/** The registry's treatment flags (Z to AG): numbers that the calculation reads, 1 when the treatment is chosen and 0 when it is not. */
function flagInputs(document: ConfigDocument) {
  return document.fields.flatMap((field) => (field.kind === 'input' && field.dataType === 'flag' ? [field] : []));
}

/** The words of a part's name: the first of `PART_NAME_KEYS` that holds a value. */
function nameOf(document: ConfigDocument, read: ReadonlyArray<FieldValue>): string | null {
  for (const key of PART_NAME_KEYS) {
    const value = read.find(({ field }) => field.id === findFieldByKey(document, key)?.id)?.value ?? null;
    if (value !== null) return value;
  }
  return null;
}

/** Every field of the form, as one part holds it, and the IDs of the registry's inputs that the registry hides for it (`visibleWhen`, through `isFieldShown`, the one copy of the rule). */
function readPart(inputs: Readonly<Record<string, unknown>>, document: ConfigDocument, fields: ReadonlyArray<TypedField>) {
  const read: FieldValue[] = fields.map((field) => ({ field, value: readField(field, inputs[field.id]) }));
  const watched = new Map(read.map(({ field, value }) => [field.id, value]));
  const hidden = hiddenFieldIds(document, (fieldId) => watched.get(fieldId) ?? undefined);
  return { read, hidden };
}

/** What the check found in one part: every field read, the hidden ones, the needed fields that show no value, and the material (`null` when there is none). */
export interface PartReading {
  readonly read: ReadonlyArray<FieldValue>;
  readonly hidden: ReadonlySet<string>;
  readonly missing: ReadonlyArray<MissingField>;
  readonly material: string | null;
}

/**
 * The one rule of "what is needed and missing" (STORY-05.11 AC-3): the form's fields are worked out once for a configuration, and each part is read against them. Calculate (`validateForCalculate`) and the completeness of
 * a part (`part-completeness.ts`: the tree, a save, a picture change) both use it, so a part Calculate names is never `COMPLETE` and a part the tree calls `COMPLETE` is never named.
 */
export function createPartReader(document: ConfigDocument) {
  const fields = typedFieldsOf(document);
  const materialId = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY)?.id;
  return {
    /** The ID of every field of the form that a person types or chooses. */
    fieldIds: fields.map((field) => field.id),
    read(inputs: Readonly<Record<string, unknown>>): PartReading {
      const { read, hidden } = readPart(inputs, document, fields);
      const missing = read.filter(({ field, value }) => field.required && !hidden.has(field.id) && value === null).map(({ field }) => ({ fieldId: field.id, label: field.label }));
      const materialField = read.find(({ field }) => field.id === materialId);
      const material = materialField?.value ?? null;
      // A calculation needs a material whether or not the registry marks the field mandatory: a blank one is named, so the person has a field to go to (review SQR-04 of AQP-317).
      if (materialField !== undefined && material === null && !missing.some(({ fieldId }) => fieldId === materialField.field.id)) {
        missing.unshift({ fieldId: materialField.field.id, label: materialField.field.label });
      }
      return { read, hidden, missing, material };
    },
  };
}


/** The typed numbers: a shown one as read, a hidden one as 0, and the flags, which are read as numbers (an absent one is its default, 0). */
function numbersOf(part: PartToCheck, document: ConfigDocument, read: ReadonlyArray<FieldValue>, hidden: ReadonlySet<string>): Record<string, string> {
  const numbers: Record<string, string> = {};
  for (const { field, value } of read.filter(({ field: candidate }) => candidate.rule.type === 'number')) {
    const used = hidden.has(field.id) ? HIDDEN_NUMBER : value;
    if (used !== null) numbers[field.id] = used;
  }
  for (const flag of flagInputs(document)) {
    const stored = part.inputs[flag.id];
    const check = validateNumberInput(typeof stored === 'string' && stored.trim() !== '' ? stored : (flag.defaultValue ?? ''));
    if (check.ok && check.value !== null) numbers[flag.id] = check.value;
  }
  return numbers;
}

/** The typed words, and the words of Treatment / Color (G) as the part holds them (the row's name for a listed entry and for "Not applicable", the typed words for "Other"). */
function textsOf(read: ReadonlyArray<FieldValue>): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const { field, value } of read.filter(({ field: candidate }) => candidate.rule.type === 'text' || candidate.rule.type === 'treatment')) {
    if (value !== null) texts[field.id] = value;
  }
  return texts;
}

/**
 * Checks every part, in the order given (the tree's reading order). Passes with the numbers and words of each part, or blocks with each part that has a missing field; it is never both. An
 * estimate with no part passes with nothing: that it must have one is the service's to say. A registry with no Material in Drawing cannot be calculated, so every part is blocked, with
 * nothing named (fail closed: a calculation needs a material).
 */
export function validateForCalculate(parts: ReadonlyArray<PartToCheck>, document: ConfigDocument): CalculateCheck {
  const reader = createPartReader(document);
  const blocked: BlockedPart[] = [];
  const checked: CheckedPart[] = [];
  for (const part of parts) {
    const { read, hidden, missing, material } = reader.read(part.inputs);
    if (missing.length > 0 || material === null) {
      blocked.push({ nodeId: part.id, slNo: part.slNo, name: nameOf(document, read), fields: missing });
    } else {
      checked.push({ id: part.id, slNo: part.slNo, materialId: material, numbers: numbersOf(part, document, read, hidden), texts: textsOf(read) });
    }
  }
  return blocked.length > 0 ? { ok: false, parts: blocked } : { ok: true, parts: checked };
}
