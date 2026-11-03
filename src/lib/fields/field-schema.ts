import { z } from 'zod';

import { DATA_TYPES, DISPLAY_MODES, ROW_SCOPES, SYSTEM_ROLES } from './types';

/**
 * The shape of one registry element (SPEC section 8.1 plus the properties architecture section 4.5 adds).
 *
 * Every schema is `strict`: an unknown property is an error. That is how the rule "no `letter` property
 * anywhere" holds: a letter is derived from `position`, never stored (FR-021).
 *
 * **Evolution rule: a property added after version 1 must parse when it is absent.** Stored versions are
 * immutable (NFR-026) and `getCurrentVersion` validates the stored document on every read, so a new
 * required key would make every earlier version, version 1 included, unreadable on a live install. A new
 * property is therefore `.optional()` or `.default(...)`, and absent means the old behaviour (see
 * `multiline`). The keys of version 1 are required and are pinned by
 * `tests/unit/fields/schema-evolution.test.ts`, which fails if one is added. Within version 1's own keys, a
 * value that does not apply is `null`, so the shape of the original keys never varies.
 *
 * `kind` is a discriminated union, so a property that only one kind has (a formula on an output, a
 * default on an input) cannot appear on another. Rules that look across fields are in `document-rules.ts`.
 */

const MAX_TEXT = 200;
const MAX_FORMULA = 2_000;
const MAX_KEY = 60;
/** Excel's widest column, in characters. */
const MAX_EXCEL_WIDTH = 255;

const id = z.uuid();
const shortText = z.string().min(1).max(MAX_TEXT);
const optionalText = shortText.nullable();
const positiveInteger = z.number().int().min(1);

/** Kebab-case, so a key reads the same in a URL, a log and a test: `unit-price`. */
export const fieldKeySchema = z
  .string()
  .max(MAX_KEY)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'A key is lower-case words joined by hyphens.');

/** Shown only while the field it names holds none of `values` (SPEC section 7.1 T and U: `S not in ['None','']`). */
export const visibleWhenSchema = z.strictObject({
  fieldId: id,
  operator: z.literal('not-in'),
  values: z.array(z.string().max(MAX_TEXT)).min(1),
});

const INPUT_DATA_TYPES = ['number', 'text', 'select', 'select_other', 'flag', 'image'] as const satisfies ReadonlyArray<
  (typeof DATA_TYPES)[number]
>;
const AUTO_DATA_TYPES = ['text', 'auto_lookup'] as const satisfies ReadonlyArray<(typeof DATA_TYPES)[number]>;

const sharedShape = {
  id,
  key: fieldKeySchema,
  label: shortText,
  /** 1-based place in the registry. The column letter is derived from it and is never stored. */
  position: positiveInteger,
  sectionId: id.nullable(),
  width: z.number().positive().max(MAX_EXCEL_WIDTH),
  numFmt: shortText,
  rowScope: z.enum(ROW_SCOPES),
  systemRole: z.enum(SYSTEM_ROLES).nullable(),
  unit: optionalText,
  hint: optionalText,
  displayUnit: optionalText,
  /** Place in the cost view: a stage, and one of that stage's sub-headings. */
  stageId: id.nullable(),
  group: optionalText,
  /** Place on the Engineer's form. Differs from `position` (section 08 shows AP, AU, BM, then AJ). */
  formOrder: positiveInteger.nullable(),
  mandatory: z.boolean(),
  /** Allow-list for the Engineer's projection. Only input fields and Material Considered may be true. */
  engineerVisible: z.boolean(),
};

export const inputFieldSchema = z.strictObject({
  ...sharedShape,
  kind: z.literal('input'),
  dataType: z.enum(INPUT_DATA_TYPES),
  /** Taken when the key is absent from a node's inputs (architecture section 4.5, A-15). */
  defaultValue: z.string().max(MAX_TEXT).nullable(),
  visibleWhen: visibleWhenSchema.nullable(),
  options: z.array(shortText).min(1).nullable(),
  /**
   * The text is entered and shown over several lines (Remarks, AJ). Added after the first design (ruling
   * R2), so it is optional: absent means false. Only a text input may carry it (`document-rules.ts`).
   */
  multiline: z.boolean().optional(),
});

export const autoFieldSchema = z.strictObject({
  ...sharedShape,
  kind: z.literal('auto'),
  dataType: z.enum(AUTO_DATA_TYPES),
});

export const outputFieldSchema = z.strictObject({
  ...sharedShape,
  kind: z.literal('output'),
  dataType: z.literal('number'),
  /** Internal form (`{{f:<id>}}` ...). `null` only for the Approved Quote Price, which is entered. */
  formula: z.string().min(1).max(MAX_FORMULA).nullable(),
  /** The treatment flag that hides this line in the cost view while it is 0 (SPEC section 7.4). */
  hideWhenZero: id.nullable(),
});

export const fieldSchema = z.discriminatedUnion('kind', [inputFieldSchema, autoFieldSchema, outputFieldSchema]);

export const sectionSchema = z.strictObject({
  id,
  number: positiveInteger,
  name: shortText,
  /** The label on the jump strip of the Engineer's form. */
  shortName: shortText,
  displayMode: z.enum(DISPLAY_MODES),
});

export const stageSchema = z.strictObject({
  id,
  number: positiveInteger,
  name: shortText,
  shortName: shortText,
  /** Sub-headings inside the stage, in order. A field's `group` is one of them. */
  subHeadings: z.array(shortText),
  /** Fields whose sum is the total on the stage heading. Empty: the stage shows no total. */
  totalFieldIds: z.array(id),
});

export type InputFieldDefinition = z.infer<typeof inputFieldSchema>;
export type AutoFieldDefinition = z.infer<typeof autoFieldSchema>;
export type OutputFieldDefinition = z.infer<typeof outputFieldSchema>;
export type FieldDefinition = z.infer<typeof fieldSchema>;
export type SectionDefinition = z.infer<typeof sectionSchema>;
export type StageDefinition = z.infer<typeof stageSchema>;
export type VisibleWhen = z.infer<typeof visibleWhenSchema>;
