import { z } from 'zod';

import {
  DECIMAL_TEXT_MESSAGE,
  DECIMAL_TEXT_PATTERN,
  MASTER_NAME_MAX_LENGTH,
  NAME_REQUIRED_MESSAGE,
  NAME_TOO_LONG_MESSAGE,
} from '../../../lib/masters/master-rules';
import { NOTHING_TO_CHANGE_MESSAGE, PROCESS_UNITS, UNIT_REQUIRED_MESSAGE } from '../../../lib/masters/process-items';

/**
 * The contract of the Process Master routes (STORY-02.01, architecture section 6 "Process items"). Every body, path parameter and
 * answer is a strict object: a key that is not named is an error, so nothing is sent that is not meant to be, and a client cannot
 * set a field the route does not offer (NFR-002). The limits and the messages are the ones the screen uses
 * (`src/lib/masters/process-items.ts`); the messages are the UX spec's words for SCR-11 and are shown under the field they name.
 * Whether a name is free, or safe to use in a formula, is the service's: a schema cannot see the other rates.
 */

const name = z
  .string({ error: NAME_REQUIRED_MESSAGE })
  .trim()
  .min(1, NAME_REQUIRED_MESSAGE)
  .max(MASTER_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE);

const unit = z.enum(PROCESS_UNITS, { error: UNIT_REQUIRED_MESSAGE });

/** Decimal text, never a JSON number: a rate is not a floating-point value (coding standards section 10). */
const defaultValue = z.string({ error: DECIMAL_TEXT_MESSAGE }).trim().regex(DECIMAL_TEXT_PATTERN, DECIMAL_TEXT_MESSAGE);

const formulaUse = z.strictObject({ letter: z.string().min(1), label: z.string().min(1) });

/** A row of SCR-11: the rate, and the formulas that use it (letter and label), derived from the current configuration. */
export const processItemSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  defaultValue: z.string().min(1),
  usedBy: z.array(formulaUse).readonly(),
});

export const processItemsResponseSchema = z.strictObject({ processItems: z.array(processItemSchema).readonly() });

/** `POST /api/v1/process-items` (AC-2). */
export const createProcessItemBodySchema = z.strictObject({ name, unit, defaultValue });

/** `PATCH /api/v1/process-items/{id}` (AC-3): name, unit or default value; at least one. */
export const updateProcessItemBodySchema = z
  .strictObject({ name, unit, defaultValue })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: NOTHING_TO_CHANGE_MESSAGE });

/**
 * The path parameter of `/api/v1/process-items/{id}`: a UUID, or the request is refused as invalid before anything is looked
 * up. It is written in lower case, the way PostgreSQL returns an ID, because the database ignores case and a formula holds the ID.
 */
export const processItemIdParamsSchema = z.strictObject({ id: z.uuid('Not a rate ID.').transform((id) => id.toLowerCase()) });
