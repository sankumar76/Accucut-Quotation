/**
 * The entries the system keeps in the master lists (STORY-02.06; FR-017, FR-018; SPEC section 18 D-17; architecture sections 4.9 and 5.1): the hidden
 * "Not applicable" material and treatment, and the name rule that keeps anyone from imitating one. Pure and without zod, so a client component may import
 * it. It holds names and IDs only: no number of any kind, the rows themselves carry none that is ever served (they are all 0).
 *
 * The IDs are fixed, and are the ones `prisma/migrations/20261114140000_not_applicable_entries/migration.sql` inserts; an integration test compares the two.
 * An estimate holds the ID of its material and of its treatment, so these can never change.
 */

/** The words of the entry, as a part shows them to everyone (Q-36). The only place the words are written. */
export const NOT_APPLICABLE_NAME = 'Not applicable';

/** The hidden "Not applicable" row of `materials`. */
export const NOT_APPLICABLE_MATERIAL_ID = '00000000-0000-4000-8000-000500000001';

/** The locked "Other" row of `treatments` (inserted by the treatments migration; FR-017). A part that chooses it keeps the words typed beside it (STORY-05.06). */
export const OTHER_TREATMENT_ID = '00000000-0000-4000-8000-000700000001';

/** The hidden "Not applicable" row of `treatments`. */
export const NOT_APPLICABLE_TREATMENT_ID = '00000000-0000-4000-8000-000700000002';

/** The sentence for a name the system keeps, said under the name field. It names no entry (architecture section 4.9). */
export const RESERVED_NAME_MESSAGE = 'That name cannot be used.';

/**
 * Is this name "Not applicable"? Letter case, surrounding spaces, repeated white space and compatibility forms (full-width letters) do not matter, so
 * "NOT  APPLICABLE", " not applicable " and a full-width spelling are all refused. A different word (a diacritic or an added letter) is a different name.
 */
export function isNotApplicableName(name: string): boolean {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase() === NOT_APPLICABLE_NAME.toLowerCase();
}
