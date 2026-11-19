import { z } from 'zod';

import { stepUpPasswordSchema } from './step-up';

/**
 * The contract of the formula editor's routes (STORY-08.02; architecture section 6 "Formula check", "Sample rows" and "Save formula"; SCR-18). Every body and answer is a strict object, so a key that is not named is
 * an error and never reaches a client. **Restricted, for the Admin alone** (NFR-001, NFR-002): the answers speak of formulas, rate names and the figures of a stored calculation, and nothing an Engineer may call has
 * a schema like these. The manifest rows are for the Admin only, and `tests/security/strict-schema.test.ts` holds every Engineer route to a schema with no formula, rate or cost key.
 */

/** Only a bound on the size of what is read: the rules for a formula (its length, its names, its grammar) and their words are the check's (`checkFormulaEdit`). */
const MAX_BODY_TEXT_LENGTH = 8_000;
const MAX_ID_LENGTH = 64;

/** The path parameter of `/api/v1/config/fields/{id}/formula`. A value that is no field is the service's 404. */
export const fieldIdParamsSchema = z.strictObject({ id: z.string().max(MAX_ID_LENGTH) });

/** `POST /api/v1/config/formula-check`: the field, the formula as typed, and the row to try it on (the first row when left out). */
export const formulaCheckBodySchema = z.strictObject({
  fieldId: z.string().max(MAX_ID_LENGTH),
  text: z.string().max(MAX_BODY_TEXT_LENGTH),
  sampleRowId: z.string().max(MAX_ID_LENGTH).optional(),
});

const useSchema = z.strictObject({ kind: z.enum(['field', 'rate', 'value']), name: z.string().min(1) });
const fedFieldSchema = z.strictObject({ letter: z.string().min(1), label: z.string().min(1) });

/** The result of the formula on the sample row: full precision, the two decimals the screen prints, and the values it was worked out from. */
const previewSchema = z.strictObject({
  estimateCode: z.string().min(1),
  slNo: z.string().min(1).nullable(),
  value: z.string().nullable(),
  shown: z.string().min(1),
  operands: z.array(z.strictObject({ name: z.string().min(1), value: z.string().nullable() })),
});

/** The answer of a formula that can be saved. A formula that cannot is the 422 of the problem body, with the SCR-18 sentence under `text`. */
export const formulaCheckAnswerSchema = z.strictObject({
  valid: z.literal(true),
  message: z.string().min(1),
  uses: z.array(useSchema),
  feeds: z.array(fedFieldSchema),
  note: z.string().min(1).nullable(),
  preview: previewSchema.nullable(),
});

/** `GET /api/v1/config/sample-rows`: the latest calculated estimate and its rows (or no estimate and no rows), and the names of the fixed operands the suggestions offer. */
export const sampleRowsAnswerSchema = z.strictObject({
  estimate: z.strictObject({ code: z.string().min(1) }).nullable(),
  rows: z.array(z.strictObject({ id: z.string().min(1), slNo: z.string().min(1), name: z.string() })),
  operandNames: z.array(z.string().min(1)),
});

/** `PUT /api/v1/config/fields/{id}/formula`: the formula, the Admin's password for the step-up, and the version the editor was opened on. */
export const saveFormulaBodySchema = z.strictObject({
  text: z.string().max(MAX_BODY_TEXT_LENGTH),
  password: stepUpPasswordSchema,
  baseVersion: z.number().int().min(1),
});

/** The answer of a save: the number of the version that holds the formula, whether a new one was made, and the sentence to show. */
export const saveFormulaAnswerSchema = z.strictObject({
  version: z.number().int().min(1),
  changed: z.boolean(),
  message: z.string().min(1),
});
