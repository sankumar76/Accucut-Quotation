import { z } from 'zod';

import { NAME_REQUIRED_MESSAGE, NAME_TOO_LONG_MESSAGE } from '../../../lib/masters/master-rules';
import { NOTHING_TO_CHANGE_TREATMENT_MESSAGE, TREATMENT_NAME_MAX_LENGTH } from '../../../lib/masters/treatments';

/**
 * The contract of the Treatment routes (STORY-02.05, architecture section 6 "Treatments"). Every body, path parameter and answer is a strict
 * object: a key that is not named is an error, so nothing is sent that is not meant to be, and a client cannot set a field the route does not
 * offer (NFR-002). The limit and the messages are the ones the screen uses (`src/lib/masters/treatments.ts`, `master-rules.ts`) and are shown
 * under the field they name. Whether a name is free, and whether it is one the system keeps (422 `NAME_RESERVED`), is the service's: a schema
 * cannot see the other treatments, and the reserved names belong on the server only.
 *
 * These are the Admin's schemas. The estimate form's list is `schemas/options.ts`, which carries an ID and a name and nothing else.
 */

const name = z.string({ error: NAME_REQUIRED_MESSAGE }).trim().min(1, NAME_REQUIRED_MESSAGE).max(TREATMENT_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE);

/** A row of SCR-13's Treatment / Color tab: the treatment, and whether it is the locked "Other" entry. */
export const treatmentSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  locked: z.boolean(),
});

export const treatmentsResponseSchema = z.strictObject({ treatments: z.array(treatmentSchema).readonly() });

/** `POST /api/v1/treatments` (AC-2): the name is required. */
export const createTreatmentBodySchema = z.strictObject({ name });

/** `PATCH /api/v1/treatments/{id}` (AC-2): the new name; at least one field. */
export const updateTreatmentBodySchema = z
  .strictObject({ name })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: NOTHING_TO_CHANGE_TREATMENT_MESSAGE });

/**
 * The path parameter of `/api/v1/treatments/{id}`: a UUID, or the request is refused as invalid before anything is looked up. It is written in
 * lower case, the way PostgreSQL returns an ID.
 */
export const treatmentIdParamsSchema = z.strictObject({ id: z.uuid('Not a treatment ID.').transform((id) => id.toLowerCase()) });
