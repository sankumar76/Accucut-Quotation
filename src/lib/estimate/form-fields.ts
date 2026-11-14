import type { FieldDefinition, SectionDefinition } from '../fields/field-schema';
import { fieldLetter, fieldsInFormOrder, findFieldById, findFieldByKey, sectionColumnRange } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import { isEngineerVisibleAllowed } from '../fields/visibility';
import { MATERIAL_CONSIDERED_KEY, MATERIAL_IN_DRAWING_KEY } from '../fields/types';
import { RUPEE } from '../masters/master-rules';

import { MAX_LONG_TEXT_LENGTH, MAX_PART_TEXT_LENGTH } from './validation';

/**
 * What the part form offers, worked out from the field registry and nothing else (STORY-05.03 AC-1, AC-3, AC-8; architecture sections 4.5 and 6 "Estimate form";
 * ADR-008). Pure and without the formula engine, so the page carries it and the server and the browser read one list.
 *
 * **The allow-list.** A field is on the form only if it is an input an Engineer may be shown, Material Considered (F), or the Sl. No. (A, a position in the tree, not a
 * figure). The registry's `engineerVisible` flag is read, and so is `isEngineerVisibleAllowed`, which refuses the flag on Material Rate (I) and on every calculated
 * field, so a wrong flag in a stored version cannot put a rate on the form. What is built is a view of the field (ID, letter, label, unit, hint, rule): the field
 * itself, with its formula or its place in a cost stage, is never copied across. **A save names only fields of this list that a person types or chooses**
 * (`formFieldById`), so a value for Material Rate or any calculated field has no place to go.
 */

/** The sections of the form: 01 Part Details to 08 Other Costs and Remarks (STORY-05.03 built 01 and 02, STORY-05.04 the rest). Section 07 is a placeholder until STORY-05.06. */
export const FORM_SECTION_NUMBERS: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 7, 8];

/** The input types the form can draw and save so far. Treatment / Color (`select_other`) and the flags (`flag`) are placeholders until STORY-05.06; the picture (`image`, 05.07) follows. */
const TYPED_DATA_TYPES: ReadonlyArray<FieldDefinition['dataType']> = ['number', 'text'];

/** The input types the form shows as a labelled placeholder, because STORY-05.06 builds their control (AC-6). The picture is not one: it is shown by STORY-05.07 alone. */
const PLACEHOLDER_DATA_TYPES: ReadonlyArray<FieldDefinition['dataType']> = ['select_other', 'flag'];

/** The decimals a typed number may have (SPEC section 7.3). */
export const NUMBER_DECIMALS = 2;

/** The hint under every input that is a cost the Engineer types (U, AP, AU, BM; STORY-05.04 AC-2). */
export const COST_INPUT_HINT = 'Enter 0 if there is none.';
export const FASTENERS_HINT = 'Type "None" if the part has no fasteners.';
export const REMARKS_HINT = 'Write "None" if there is nothing to add.';

/**
 * What the form adds to a field the registry does not describe (STORY-05.04 AC-2 to AC-4), by the field's **key**, which is stable (a label or a column can be changed, a key is the
 * field's name). The registry's own unit or hint comes first and is never replaced: this is only the fallback, so an install seeded before this story, whose stored version is
 * immutable (NFR-026) and holds no hint for these fields, shows the same words as a new one.
 */
const FORM_PRESENTATION: ReadonlyMap<string, { readonly unit?: string; readonly hint?: string }> = new Map([
  ['fasteners', { hint: FASTENERS_HINT }],
  ['fasteners-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['machining-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['plating-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['tool-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['remarks', { hint: REMARKS_HINT }],
]);

/**
 * The hint under QTY per Assy (FR-029, D-34; UX spec UX-52). It is here and not in the registry because a stored registry version is immutable (NFR-026) and an
 * install that was seeded earlier holds the older hint. The field is found by its system role (`quantity`), never by its letter or its text.
 */
export const QTY_PER_ASSY_HINT = 'Enter the count for the whole order, not per assembly. For example, 24 lids in all, even if each pipe has 4.';

/** How a field is filled: typed as a number or a text, chosen from the Material Master, or shown from somewhere else and never saved. */
export type FormRule =
  | { readonly type: 'number'; readonly decimals: number }
  | { readonly type: 'text'; readonly maxLength: number; readonly multiline: boolean }
  | { readonly type: 'select'; readonly source: 'materials' }
  /** `from` is the field this one follows (Material Considered follows Material in Drawing); null for the Sl. No., which follows the tree. */
  | { readonly type: 'derived'; readonly from: string | null };

/** One field of the form as the browser and the server read it. Letters are derived from the registry; none is typed. */
export interface FormFieldView {
  readonly id: string;
  readonly letter: string;
  readonly label: string;
  /** `input` is typed or chosen, `auto` is shown and read-only (the column tag is drawn differently). */
  readonly kind: 'input' | 'auto';
  readonly unit: string | null;
  readonly hint: string | null;
  /** The text a field shows while nothing is stored for it (the registry's `defaultValue`: Fasteners shows "None"); null for a field with none. Nothing is stored until it is changed. */
  readonly defaultValue: string | null;
  /** Needed at Calculate (STORY-05.09). A save never refuses a blank. */
  readonly required: boolean;
  /** False for a field that is shown and never typed into. */
  readonly editable: boolean;
  readonly rule: FormRule;
}

/** A field whose control a later story builds (STORY-05.06): the form shows its letter and label in a labelled placeholder and offers nothing to type or save. */
export interface PlaceholderFieldView {
  readonly id: string;
  readonly letter: string;
  readonly label: string;
}

export interface FormSectionView {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly shortName: string;
  /** The column tag of the section, from the letters of the fields shown here and of its placeholders, so it names what the card holds (`E, F, J–L, N`). */
  readonly columnRange: string;
  readonly fields: ReadonlyArray<FormFieldView>;
  /** The fields of the section that are not built yet (Treatment / Color in 01, the eight surface treatments in 07). The counts of "n of m" leave them out (AC-6). */
  readonly reserved: ReadonlyArray<PlaceholderFieldView>;
}

const sectionNumberOf = (document: ConfigDocument, field: FieldDefinition): number => document.sections.find((section) => section.id === field.sectionId)?.number ?? 0;

function isOnForm(document: ConfigDocument, field: FieldDefinition): boolean {
  if (field.sectionId === null || !FORM_SECTION_NUMBERS.includes(sectionNumberOf(document, field))) return false;
  if (field.systemRole === 'sl-no') return true;
  if (!field.engineerVisible || !isEngineerVisibleAllowed(field)) return false;
  if (field.kind === 'input') return field.key === MATERIAL_IN_DRAWING_KEY || TYPED_DATA_TYPES.includes(field.dataType);
  return field.key === MATERIAL_CONSIDERED_KEY;
}

/**
 * An input the form shows as a labelled placeholder (AC-6): the same allow-list as `isOnForm` (an Engineer-visible input, in a section of the form), but of a type whose control a later
 * story builds. Only its ID, letter and label leave the server, and a save cannot name it (`formFieldById` does not find it).
 */
function isPlaceholder(document: ConfigDocument, field: FieldDefinition): boolean {
  if (field.kind !== 'input' || field.sectionId === null || !FORM_SECTION_NUMBERS.includes(sectionNumberOf(document, field))) return false;
  return field.engineerVisible && isEngineerVisibleAllowed(field) && PLACEHOLDER_DATA_TYPES.includes(field.dataType);
}

/** A text is as long as its field allows: 200 characters, or 1,000 for a multi-line one (Remarks; assumption A-1). */
function textRuleOf(multiline: boolean): FormRule {
  return { type: 'text', maxLength: multiline ? MAX_LONG_TEXT_LENGTH : MAX_PART_TEXT_LENGTH, multiline };
}

function ruleOf(document: ConfigDocument, field: FieldDefinition): FormRule {
  if (field.kind !== 'input') return { type: 'derived', from: field.key === MATERIAL_CONSIDERED_KEY ? (findFieldByKey(document, MATERIAL_IN_DRAWING_KEY)?.id ?? null) : null };
  if (field.key === MATERIAL_IN_DRAWING_KEY) return { type: 'select', source: 'materials' };
  if (field.dataType === 'number') return { type: 'number', decimals: NUMBER_DECIMALS };
  return textRuleOf(field.multiline === true);
}

function viewOf(document: ConfigDocument, field: FieldDefinition): FormFieldView {
  const rule = ruleOf(document, field);
  const presentation = FORM_PRESENTATION.get(field.key);
  return {
    id: field.id,
    letter: fieldLetter(field),
    label: field.label,
    kind: field.kind === 'input' ? 'input' : 'auto',
    unit: field.unit ?? presentation?.unit ?? null,
    hint: field.systemRole === 'quantity' ? QTY_PER_ASSY_HINT : (field.hint ?? presentation?.hint ?? null),
    defaultValue: field.kind === 'input' ? field.defaultValue : null,
    required: field.mandatory,
    editable: rule.type !== 'derived',
    rule,
  };
}

function sectionOf(document: ConfigDocument, section: SectionDefinition): FormSectionView {
  const inOrder = fieldsInFormOrder(document, section);
  return {
    id: section.id,
    number: section.number,
    name: section.name,
    shortName: section.shortName,
    columnRange: sectionColumnRange(document, section, (field) => isOnForm(document, field) || isPlaceholder(document, field)),
    fields: inOrder.filter((field) => isOnForm(document, field)).map((field) => viewOf(document, field)),
    reserved: inOrder.filter((field) => isPlaceholder(document, field)).map((field) => ({ id: field.id, letter: fieldLetter(field), label: field.label })),
  };
}

/** The sections of the form, in order, each with the fields it shows and its placeholders. A section with neither is left out. */
export function buildFormSections(document: ConfigDocument): ReadonlyArray<FormSectionView> {
  return document.sections
    .filter((section) => FORM_SECTION_NUMBERS.includes(section.number))
    .sort((a, b) => a.number - b.number)
    .map((section) => sectionOf(document, section))
    .filter((section) => section.fields.length > 0 || section.reserved.length > 0);
}

/** The form field with this ID, or `undefined` when the registry has none or it is not on the form. A save accepts only a field found here with `editable` true. */
export function formFieldById(document: ConfigDocument, id: string): FormFieldView | undefined {
  const field = findFieldById(document, id);
  return field === undefined || !isOnForm(document, field) ? undefined : viewOf(document, field);
}
