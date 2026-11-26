import type { FieldDefinition, InputFieldDefinition, SectionDefinition } from '../fields/field-schema';
import { fieldLetter, fieldsInFormOrder, findFieldById, findFieldByKey, sectionColumnRange } from '../fields/registry';
import type { ConfigDocument } from '../fields/schema';
import { isEngineerVisibleAllowed } from '../fields/visibility';
import type { ShownRule } from '../fields/visible-when';
import { MATERIAL_CONSIDERED_KEY, MATERIAL_IN_DRAWING_KEY } from '../fields/types';
import { RUPEE } from '../masters/master-rules';

import { isPartNameKey, type PartNameKey } from './part-name-keys';
import { QTY_PER_ASSY_HINT } from './quantity-hint';
import { MAX_LONG_TEXT_LENGTH, MAX_OTHER_TREATMENT_LENGTH, MAX_PART_TEXT_LENGTH } from './text-limits';

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

/**
 * **The sections of the form are the registry's** (STORY-08.08 AC-4): 01 Part Details to 08 Other Costs and Remarks as seeded (STORY-05.03 built 01 and 02, STORY-05.04 the rest, STORY-05.06 the treatments of 07 and
 * Treatment / Color of 01), and every section an Admin adds after them, in the order of its `number`. There is no fixed list of numbers any more: a field is on the form because of what it is (the allow-list below),
 * not because of the number of its section.
 */

/**
 * The input types the form can draw and save: numbers and texts, Treatment / Color (`select_other`: a listed treatment, or "Other" with words), the eight surface treatments (`flag`: chosen or
 * not; STORY-05.06) and a choice from a list the Admin gave (`select` with `options`, STORY-08.08; Material in Drawing is the `select` of the Material Master and has its own rule). The picture (`image`, Part Model,
 * STORY-05.07) is on the form too, with its own rule (`picture`): it is added, replaced and removed by its own routes and is never a typed value.
 */
const TYPED_DATA_TYPES: ReadonlyArray<FieldDefinition['dataType']> = ['number', 'text', 'image', 'select_other', 'flag', 'select'];

/** The decimals a typed number may have (SPEC section 7.3). */
export const NUMBER_DECIMALS = 2;

/** The hint under every input that is a cost the Engineer types (U, AP, AU, BM; STORY-05.04 AC-2). */
export const COST_INPUT_HINT = 'Enter 0 if there is none.';
export const FASTENERS_HINT = 'Type "None" if the part has no fasteners.';
export const REMARKS_HINT = 'Write "None" if there is nothing to add.';
/** The hint under Description (UX ruling `parts-tree-scr05-conformance-2026-11-26.md` item 2, AQP-447, DEF-090): the Description is the row's name in the parts tree, and there is no other name field. */
export const DESCRIPTION_HINT = 'Names this row in the parts tree.';
/** The hint under the picture field (UX spec SCR-05): what is accepted. The limit is the one of `lib/images` (200 KB). */
export const PICTURE_HINT = 'PNG, JPG, GIF or WebP, under 200 KB.';

/**
 * What the form adds to a field the registry does not describe (STORY-05.04 AC-2 to AC-4), by the field's **key**, which is stable (a label or a column can be changed, a key is the
 * field's name). The registry's own unit or hint comes first and is never replaced: this is only the fallback, so an install seeded before this story, whose stored version is
 * immutable (NFR-026) and holds no hint for these fields, shows the same words as a new one.
 */
const FORM_PRESENTATION: ReadonlyMap<string, { readonly unit?: string; readonly hint?: string }> = new Map([
  ['part-model', { hint: PICTURE_HINT }],
  ['fasteners', { hint: FASTENERS_HINT }],
  ['fasteners-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['machining-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['plating-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['tool-cost', { unit: RUPEE, hint: COST_INPUT_HINT }],
  ['remarks', { hint: REMARKS_HINT }],
  ['description', { hint: DESCRIPTION_HINT }],
]);

/** The hint under QTY per Assy (FR-029, D-34): given to the field by its system role (`quantity`), never by its letter or its text. It lives in its own small file (`quantity-hint.ts`) so the browser can read it. */
export { QTY_PER_ASSY_HINT };

/** How a field is filled: typed as a number or a text, chosen from the Material Master, or shown from somewhere else and never saved. */
export type FormRule =
  | { readonly type: 'number'; readonly decimals: number }
  | { readonly type: 'text'; readonly maxLength: number; readonly multiline: boolean }
  | { readonly type: 'select'; readonly source: 'materials' }
  /** A choice from the list the Admin gave (`options`, one or more, in their stored order): saved as the option's text (`choice-value.ts`, STORY-08.08). */
  | { readonly type: 'choice'; readonly options: ReadonlyArray<string> }
  /** Treatment / Color (G): one of the listed treatments, or "Other" with words of up to `maxLength` characters. Saved as `{ id, text }` (`treatment-value.ts`). */
  | { readonly type: 'treatment'; readonly maxLength: number }
  /** One of the surface treatments (Z to AG): chosen (`1`) or not (`0`). The form draws the flags of a section as one multi-select (SCR-05 section 07). */
  | { readonly type: 'flag' }
  /** `from` is the field this one follows (Material Considered follows Material in Drawing); null for the Sl. No., which follows the tree. */
  | { readonly type: 'derived'; readonly from: string | null }
  /** A picture (Part Model, STORY-05.07): drawn as the picture control, changed by its own routes, optional (D-31) and never saved as a value. */
  | { readonly type: 'picture' };

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
  /** Set on the two fields that name a part, Description and Part No. (`PART_NAME_KEYS`), and absent on every other: the screen builds a row's name from them when the person leaves one, and puts the focus in Description after an add. */
  readonly nameKey?: PartNameKey;
  /**
   * When the registry hides this field (STORY-05.05; Fasteners Qty and Cost): the field it watches and the values that hide it, or null for a field that always shows. It is the registry's own
   * `visibleWhen` (the operator is always "not in"), read by `isShownByRule` in the browser and by `isFieldShown` on the server: the rule is written once, in the registry.
   */
  readonly visibleWhen: ShownRule | null;
  readonly rule: FormRule;
}

export interface FormSectionView {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly shortName: string;
  /** The column tag of the section, from the letters of the fields shown here, so it names what the card holds (`E, F, J–L, N`). */
  readonly columnRange: string;
  readonly fields: ReadonlyArray<FormFieldView>;
}

const hasSection = (document: ConfigDocument, field: FieldDefinition): boolean => field.sectionId !== null && document.sections.some((section) => section.id === field.sectionId);

/** A `select` other than Material in Drawing is drawn only with a list to choose from: one with none has nothing to offer and is not on the form. */
const hasOptions = (field: InputFieldDefinition): boolean => field.options !== null && field.options.length > 0;

function isOnForm(document: ConfigDocument, field: FieldDefinition): boolean {
  if (!hasSection(document, field)) return false;
  if (field.systemRole === 'sl-no') return true;
  // Every one of these is still asked, in a new section as in an old one: the flag, the allow-list (a rate or a calculated field can never be on the form) and the kind (an output or an auto field is never drawn).
  if (!field.engineerVisible || !isEngineerVisibleAllowed(field)) return false;
  if (field.kind === 'input') {
    if (field.key === MATERIAL_IN_DRAWING_KEY) return true;
    return field.dataType === 'select' ? hasOptions(field) : TYPED_DATA_TYPES.includes(field.dataType);
  }
  return field.key === MATERIAL_CONSIDERED_KEY;
}

/** A text is as long as its field allows: 200 characters, or 1,000 for a multi-line one (Remarks; assumption A-1). */
function textRuleOf(multiline: boolean): FormRule {
  return { type: 'text', maxLength: multiline ? MAX_LONG_TEXT_LENGTH : MAX_PART_TEXT_LENGTH, multiline };
}

function ruleOf(document: ConfigDocument, field: FieldDefinition): FormRule {
  if (field.kind !== 'input') return { type: 'derived', from: field.key === MATERIAL_CONSIDERED_KEY ? (findFieldByKey(document, MATERIAL_IN_DRAWING_KEY)?.id ?? null) : null };
  if (field.key === MATERIAL_IN_DRAWING_KEY) return { type: 'select', source: 'materials' };
  if (field.dataType === 'image') return { type: 'picture' };
  if (field.dataType === 'select') return { type: 'choice', options: [...(field.options ?? [])] };
  if (field.dataType === 'select_other') return { type: 'treatment', maxLength: MAX_OTHER_TREATMENT_LENGTH };
  if (field.dataType === 'flag') return { type: 'flag' };
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
    // A derived field is shown and never typed; a picture is changed by its own routes, so no save of values may name it either.
    editable: rule.type !== 'derived' && rule.type !== 'picture',
    ...(isPartNameKey(field.key) ? { nameKey: field.key } : {}),
    visibleWhen: field.kind === 'input' && field.visibleWhen !== null ? { fieldId: field.visibleWhen.fieldId, values: [...field.visibleWhen.values] } : null,
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
    columnRange: sectionColumnRange(document, section, (field) => isOnForm(document, field)),
    fields: inOrder.filter((field) => isOnForm(document, field)).map((field) => viewOf(document, field)),
  };
}

/** The sections of the form, in the order of their `number`, each with the fields it shows. A section with none is left out. */
export function buildFormSections(document: ConfigDocument): ReadonlyArray<FormSectionView> {
  return [...document.sections]
    .sort((a, b) => a.number - b.number)
    .map((section) => sectionOf(document, section))
    .filter((section) => section.fields.length > 0);
}

/** The form field with this ID, or `undefined` when the registry has none or it is not on the form. A save accepts only a field found here with `editable` true. */
export function formFieldById(document: ConfigDocument, id: string): FormFieldView | undefined {
  const field = findFieldById(document, id);
  return field === undefined || !isOnForm(document, field) ? undefined : viewOf(document, field);
}
