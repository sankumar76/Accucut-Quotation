import { defined } from './defined';

/**
 * The invented Treatment / Color rows that STORY-02.05's tests share: the fixed "Other" row that the migration inserts on every environment, and two
 * treatments with fixed IDs, so a recipe in `route-calls.ts` can name a treatment that exists in the in-memory repository of the security tests.
 * A treatment holds a name and no rate of any kind (class Internal), so these are not canaries of a Restricted value; they are named like the
 * other masters' rows so a reader finds them together. Every name is invented (ADR-014).
 *
 * `OTHER_TREATMENT_ID` is the ID in `prisma/migrations/20261110120000_treatments/migration.sql`; the integration test compares the two.
 */

export interface TreatmentSeed {
  readonly id: string;
  readonly name: string;
  readonly locked: boolean;
}

/** The fixed ID of the locked "Other" entry. */
export const OTHER_TREATMENT_ID = '00000000-0000-4000-8000-000700000001';

export const OTHER_TREATMENT: TreatmentSeed = { id: OTHER_TREATMENT_ID, name: 'Other', locked: true };

/** What a fresh install holds after the migration: "Other", and nothing else. */
export const FRESH_TREATMENTS: ReadonlyArray<TreatmentSeed> = [OTHER_TREATMENT];

/** Two treatments the security tests find in the in-memory repository, after "Other". */
export const TREATMENT_CANARIES: ReadonlyArray<TreatmentSeed> = [
  { id: '00000000-0000-4000-8000-000700000c01', name: 'Canary-Treatment-Alpha', locked: false },
  { id: '00000000-0000-4000-8000-000700000c02', name: 'Canary-Treatment-Beta', locked: false },
];

/** The treatment a recipe for `PATCH` and `DELETE /api/v1/treatments/{id}` names: it exists wherever the canaries are loaded. */
export const TREATMENT_RECIPE_ID: string = defined(TREATMENT_CANARIES[0]).id;
