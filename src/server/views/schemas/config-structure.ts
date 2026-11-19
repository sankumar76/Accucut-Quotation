import { z } from 'zod';

import { INSERTABLE_DATA_TYPES } from '../../../lib/config/field-insert-check';
import { FIELD_KINDS } from '../../../lib/fields/types';

/**
 * The contract of the insert wizard's routes (STORY-08.03; architecture section 6 "Insert preview" and "Insert field"; SCR-19). Every body and answer is a strict object, so a key that is not named is an error
 * and never reaches a client. **Restricted, for the Admin alone** (NFR-001, NFR-002): the answers speak of formulas and column labels, and nothing an Engineer may call has a schema like these. The manifest
 * rows are for the Admin only, and `tests/security/strict-schema.test.ts` holds every Engineer route to a schema with no formula, rate or cost key.
 *
 * The bodies bound only the size of what is read. The rules for what is typed (a label, a default, a width, a formula) and their words are the pure insert's (`lib/config/field-insert.ts`), which runs again on the
 * server whatever the browser did.
 */

const MAX_ID_LENGTH = 64;
const MAX_TYPED_TEXT_LENGTH = 2_000;
const MAX_FORMULA_TEXT_LENGTH = 8_000;
const MAX_FORMAT_LENGTH = 100;

const id = z.string().max(MAX_ID_LENGTH);
const typed = z.string().max(MAX_TYPED_TEXT_LENGTH);

const newInputSchema = z.strictObject({
  label: typed,
  dataType: z.enum(INSERTABLE_DATA_TYPES),
  defaultValue: typed,
  sectionId: id,
  unit: typed,
  hint: typed,
  width: z.number(),
  numFmt: z.string().max(MAX_FORMAT_LENGTH),
  watchFieldId: id.nullable(),
});

const outputShape = {
  label: typed,
  formula: z.string().max(MAX_FORMULA_TEXT_LENGTH),
  stageId: id,
  group: typed.nullable(),
  width: z.number(),
  numFmt: z.string().max(MAX_FORMAT_LENGTH),
};

/** What the Admin chose to insert and where: one input, one output, or an input and its cost column. */
export const insertSpecSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('input'), afterFieldId: id, input: newInputSchema }),
  z.strictObject({ kind: z.literal('output'), afterFieldId: id, output: z.strictObject({ ...outputShape, hideWhenZeroFieldId: id.nullable() }) }),
  z.strictObject({
    kind: z.literal('pair'),
    afterFieldId: id,
    input: newInputSchema,
    cost: z.strictObject({ ...outputShape, afterFieldId: id.nullable(), hideWhenInputIsZero: z.boolean() }),
  }),
]);

/** `POST /api/v1/config/fields/preview`. `lettersOnly` asks for the letters alone, from the places chosen, while the details of step 2 are still being typed (the live list "Letters after this insert"). */
export const insertPreviewBodySchema = z.strictObject({ spec: insertSpecSchema, lettersOnly: z.boolean().optional() });

/** `POST /api/v1/config/fields`: the same spec, and the number of the version the wizard was opened on. */
export const insertFieldBodySchema = z.strictObject({ spec: insertSpecSchema, baseVersion: z.number().int().min(1) });

const movedSchema = z.strictObject({ label: z.string().min(1), from: z.string().min(1), to: z.string().min(1) });

/** The preview: where the new fields go, every column whose letter changes (the product's cells with their row: `BL2 → BM2`), and the formula of a new output with its final letters. */
export const insertPreviewAnswerSchema = z.strictObject({
  baseVersion: z.number().int().min(1),
  inserted: z.array(z.strictObject({ letter: z.string().min(1), label: z.string().min(1), kind: z.enum(['input', 'output']), followsLetter: z.string().min(1).nullable() })),
  moved: z.array(movedSchema),
  productCells: z.array(movedSchema),
  formulas: z.array(z.strictObject({ letter: z.string().min(1), label: z.string().min(1), formula: z.string().min(1) })),
});

/** The save: the number of the version that holds the new fields, their letters, and the sentence to show. */
export const insertFieldAnswerSchema = z.strictObject({
  version: z.number().int().min(1),
  letters: z.array(z.string().min(1)).min(1),
  message: z.string().min(1),
});

/** `GET /api/v1/config/insert-options`: what the wizard offers, and the version it is opened on. Names and structure only: no formula, rate or figure. */
export const insertOptionsAnswerSchema = z.strictObject({
  version: z.number().int().min(1),
  columns: z.array(z.strictObject({ id: z.string().min(1), letter: z.string().min(1), label: z.string().min(1), kind: z.enum(FIELD_KINDS), watchable: z.boolean() })),
  sections: z.array(z.strictObject({ id: z.string().min(1), number: z.number().int(), name: z.string().min(1) })),
  stages: z.array(z.strictObject({ id: z.string().min(1), number: z.number().int(), name: z.string().min(1), subHeadings: z.array(z.string().min(1)) })),
  numberFormats: z.array(z.string().min(1)),
});
