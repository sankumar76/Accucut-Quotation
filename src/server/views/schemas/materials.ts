import { z } from 'zod';

import {
  CONSIDERED_REQUIRED_MESSAGE,
  MATERIAL_NAME_REQUIRED_MESSAGE,
  MATERIAL_NAME_TOO_LONG_MESSAGE,
  MATERIAL_TEXT_MAX_LENGTH,
  NOTHING_TO_CHANGE_MATERIAL_MESSAGE,
  NUMBER_MESSAGE,
  SPECIFIC_GRAVITY_FORMAT_MESSAGE,
  specificGravityProblem,
} from '../../../lib/masters/materials';
import { DEFAULT_VALUE_PATTERN } from '../../../lib/masters/process-items';

/**
 * The contract of the Material Master routes (STORY-02.03, architecture section 6 "Materials"). Every body, path parameter and answer is
 * a strict object: a key that is not named is an error, so nothing is sent that is not meant to be, and a client cannot set a field the
 * route does not offer (NFR-002). The limits and the messages are the ones the screen uses (`src/lib/masters/materials.ts`); the messages
 * are the UX spec's words for SCR-13 and are shown under the field they name. Whether a name is free is the service's: a schema cannot
 * see the other materials. The rule that a specific gravity is above 0 is the schema's too (UX-37, AC-2, AC-3): `POST` and `PATCH` both
 * refuse 0 and below with 422 and name the field.
 *
 * These are the Admin's schemas, and they carry the three numbers. The estimate form's list is `schemas/options.ts`, which carries none.
 */

const materialInDrawing = z
  .string({ error: MATERIAL_NAME_REQUIRED_MESSAGE })
  .trim()
  .min(1, MATERIAL_NAME_REQUIRED_MESSAGE)
  .max(MATERIAL_TEXT_MAX_LENGTH, MATERIAL_NAME_TOO_LONG_MESSAGE);

const materialConsidered = z
  .string({ error: CONSIDERED_REQUIRED_MESSAGE })
  .trim()
  .min(1, CONSIDERED_REQUIRED_MESSAGE)
  .max(MATERIAL_TEXT_MAX_LENGTH, MATERIAL_NAME_TOO_LONG_MESSAGE);

/** Decimal text, never a JSON number: a price is not a floating-point value (coding standards section 10). Up to two decimals, 0 or more. */
const nonNegativeNumber = z.string({ error: NUMBER_MESSAGE }).trim().regex(DEFAULT_VALUE_PATTERN, NUMBER_MESSAGE);

/** Decimal text above 0, up to two decimals: the one check of the screen (`specificGravityProblem`), so 0, a negative and a bad shape each get their words. */
const specificGravity = z.string({ error: SPECIFIC_GRAVITY_FORMAT_MESSAGE }).superRefine((value, context) => {
  const problem = specificGravityProblem(value);
  if (problem !== null) context.addIssue({ code: 'custom', message: problem });
});

/** A row of SCR-13: the material and its numbers, as decimal text with at least two decimals. */
export const materialSchema = z.strictObject({
  id: z.string().min(1),
  materialInDrawing: z.string().min(1),
  materialConsidered: z.string().min(1),
  pricePerKg: z.string().min(1),
  specificGravity: z.string().min(1),
  scrapRate: z.string().min(1),
});

export const materialsResponseSchema = z.strictObject({ materials: z.array(materialSchema).readonly() });

const materialFields = { materialInDrawing, materialConsidered, pricePerKg: nonNegativeNumber, specificGravity, scrapRate: nonNegativeNumber };

/** `POST /api/v1/materials` (AC-2, AC-3): every field is required. */
export const createMaterialBodySchema = z.strictObject(materialFields);

/** `PATCH /api/v1/materials/{id}` (AC-2, AC-3): any of the fields; at least one. A specific gravity that is given must be above 0. */
export const updateMaterialBodySchema = z
  .strictObject(materialFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: NOTHING_TO_CHANGE_MATERIAL_MESSAGE });

/**
 * The path parameter of `/api/v1/materials/{id}`: a UUID, or the request is refused as invalid before anything is looked up. It is written
 * in lower case, the way PostgreSQL returns an ID.
 */
export const materialIdParamsSchema = z.strictObject({ id: z.uuid('Not a material ID.').transform((id) => id.toLowerCase()) });
