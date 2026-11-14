import { z } from 'zod';

import { FIELD_KINDS, SYSTEM_ROLES } from '../../../lib/fields/types';

/**
 * The contract of the Configuration read routes (STORY-08.01, architecture section 6 "Configuration": `GET /config/fields`, `GET /config/current`). Every answer is a
 * strict object, so a key that is not named is an error and never reaches a client.
 *
 * **Restricted, for the Admin and the Lead only.** `formula` is the stored formula in display form, and it holds rate names; nothing an Engineer may call has a schema like this
 * one (NFR-002, BR-003). The two routes are in the manifest for the Admin and the Lead alone, and `tests/security/strict-schema.test.ts` holds every Engineer route to a schema with
 * no formula, rate or cost key.
 */

/** A row of SCR-17: the letter and the label, where the field sits, its kind, its formula in display form and the two flags the Admin's actions are drawn from. */
export const configFieldSchema = z.strictObject({
  id: z.uuid(),
  letter: z.string().min(1),
  label: z.string().min(1),
  place: z.string().min(1).nullable(),
  kind: z.enum(FIELD_KINDS),
  formula: z.string().min(1).nullable(),
  systemRole: z.enum(SYSTEM_ROLES).nullable(),
  note: z.string().min(1).nullable(),
  canEditFormula: z.boolean(),
});

/** `GET /api/v1/config/fields` (AC-1): every field, in column order. */
export const configFieldsSchema = z.strictObject({ fields: z.array(configFieldSchema).readonly() });

/** `GET /api/v1/config/current` (AC-6): the number of the current version, who saved it, when (an ISO 8601 instant in UTC), and how many estimates use it. */
export const configCurrentSchema = z.strictObject({
  number: z.number().int().min(1),
  savedBy: z.string().min(1).nullable(),
  savedAt: z.iso.datetime(),
  estimatesInUse: z.number().int().min(0),
});
