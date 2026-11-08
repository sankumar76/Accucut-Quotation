import { MATERIAL_CANARIES } from './material-master-canary';

/**
 * Writes the canary materials (`material-master-canary.ts`) into the `materials` table through any connection with a `query` method.
 * The E2E set-up (`ensureCanaryMaterials` in `tests/e2e/support/auth.ts`) and the test of the loader under concurrency
 * (`tests/integration/masters/materials.test.ts`) call this one function, so the test exercises the statements the scan runs.
 *
 * It is safe when several loaders run at once (three screen sizes, four workers), on an empty table or a full one: the insert has no
 * conflict target, so **every** unique index arbitrates (the ID, and the two on the name), and the loser of a race does nothing. An
 * `ON CONFLICT (id)` target would name the ID only, and a second loader inserting the same new name would fail on a name index
 * (QLT-01 of the G6 of AQP-122: 32 of 40 rounds). The values are then set by an `UPDATE` by ID. No retry and no wait: a retry would hide
 * a race, and the statements do not need one (DL-057). The numbers are invented and this database is thrown away.
 */

export interface QueryableConnection {
  query(text: string, values?: ReadonlyArray<string>): Promise<unknown>;
}

const INSERT = `INSERT INTO materials (id, material_in_drawing, material_considered, price_per_kg, specific_gravity, scrap_rate)
  VALUES ($1::uuid, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`;

const UPDATE = `UPDATE materials SET material_considered = $2, price_per_kg = $3, specific_gravity = $4, scrap_rate = $5 WHERE id = $1::uuid`;

export async function loadCanaryMaterials(connection: QueryableConnection): Promise<void> {
  for (const { id, materialInDrawing, materialConsidered, pricePerKg, specificGravity, scrapRate } of MATERIAL_CANARIES) {
    await connection.query(INSERT, [id, materialInDrawing, materialConsidered, pricePerKg, specificGravity, scrapRate]);
    await connection.query(UPDATE, [id, materialConsidered, pricePerKg, specificGravity, scrapRate]);
  }
}
