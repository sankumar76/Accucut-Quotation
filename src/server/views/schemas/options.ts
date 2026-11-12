import { z } from 'zod';

/**
 * The lists the estimate form chooses from (STORY-02.03 AC-4; architecture section 6 "Safe options", ARCH-R2). Every role may call
 * them, an Engineer included, so each has exactly one strict schema that names **no rate of any kind**: an ID, a name and, for a material,
 * Material Considered. A key that is not named is an error, so a price, a specific gravity or a scrap rate cannot reach a client by being
 * spread into an answer (NFR-002, BR-003). This file is separate from the Admin's schemas (`schemas/materials.ts`) on purpose: an
 * Engineer-reachable route imports only a file that has no rate field in it. `tests/security/strict-schema.test.ts` and the cost scan hold
 * every such route to it.
 *
 * The story for customers adds its list here (treatments joined in STORY-02.05). The "Not applicable" entry joins the materials list in story 02.06, with
 * `materialConsidered` null, which is why the field may be null.
 */

const materialOptionSchema = z.strictObject({
  id: z.string().min(1),
  /** Material in Drawing. */
  name: z.string().min(1),
  /** Null only for the "Not applicable" entry (architecture section 4.9). */
  materialConsidered: z.string().min(1).nullable(),
});

export const materialOptionsResponseSchema = z.strictObject({ options: z.array(materialOptionSchema).readonly() });

/** A treatment as a choice (STORY-02.05 AC-5): an ID and a name, "Other" included, and nothing else. The table has no rate of any kind, and the schema is strict. */
export const treatmentOptionSchema = z.strictObject({ id: z.string().min(1), name: z.string().min(1) });

export const treatmentOptionsResponseSchema = z.strictObject({ options: z.array(treatmentOptionSchema).readonly() });
