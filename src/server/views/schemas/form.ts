import { z } from 'zod';

import { MAX_INPUT_VALUE_LENGTH, partInputsSchema, revisionSchema } from './tree';

/**
 * The contract of the part form's two routes (STORY-05.03; architecture section 6 "Estimate form" and "Save inputs"; ADR-008). Every body, path parameter and answer is a
 * strict object: a key that is not named is an error, so a client cannot set a field the route does not offer and nothing leaves that is not meant to.
 *
 * `GET /estimates/{id}/form` is open to every role, an Engineer included (their own estimate), so it has **one response schema for every caller with no rate, cost or
 * formula in it** (NFR-002, ADR-008): sections and, for each field, its ID, its letter, its label, its unit, its hint, whether it is needed, whether a person types into it
 * and its rule. Nothing of a field's formula or cost stage can be named here, so it cannot be spread in.
 *
 * `PATCH /estimates/{id}/nodes/{nodeId}/inputs` takes the part's `revision` as the person saw it and **values by field ID**, each as the text typed (a blank clears the
 * value). Here only the size is bounded; which field IDs are fields a person may save, and whether each value is valid, are the service's, which answers 422 under the field.
 */

/** The most values one save may carry: far more than a form has fields (this story has 8), so a bound and not a rule. An assumption. */
export const MAX_VALUES_PER_SAVE = 64;

export const saveInputsBodySchema = z.strictObject({
  revision: revisionSchema,
  values: z
    .record(z.uuid(), z.string().max(MAX_INPUT_VALUE_LENGTH))
    .refine((values) => Object.keys(values).length <= MAX_VALUES_PER_SAVE, { message: `Send at most ${String(MAX_VALUES_PER_SAVE)} values at once.` }),
});

/** `PATCH .../inputs`: the part as it is now, with no figure: its ID, its new revision, how complete it is, and what is stored by field ID. */
export const savedInputsSchema = z.strictObject({
  id: z.string().min(1),
  revision: z.number().int(),
  completeness: z.enum(['EMPTY', 'PARTIAL', 'COMPLETE']),
  inputs: partInputsSchema,
});

const ruleSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('number'), decimals: z.number().int().min(0) }),
  z.strictObject({ type: z.literal('text'), maxLength: z.number().int().min(1), multiline: z.boolean() }),
  z.strictObject({ type: z.literal('select'), source: z.literal('materials') }),
  z.strictObject({ type: z.literal('derived'), from: z.uuid().nullable() }),
]);

const formFieldSchema = z.strictObject({
  id: z.uuid(),
  letter: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['input', 'auto']),
  unit: z.string().nullable(),
  hint: z.string().nullable(),
  required: z.boolean(),
  editable: z.boolean(),
  rule: ruleSchema,
});

const formSectionSchema = z.strictObject({
  id: z.uuid(),
  number: z.number().int().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  columnRange: z.string().min(1),
  fields: z.array(formFieldSchema).readonly(),
});

/** `GET /estimates/{id}/form`: the sections, and when a part was last written (ISO 8601, null while there is no part). */
export const formResponseSchema = z.strictObject({ sections: z.array(formSectionSchema).readonly(), lastSavedAt: z.iso.datetime().nullable() });
