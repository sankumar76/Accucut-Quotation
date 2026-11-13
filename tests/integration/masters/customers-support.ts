import { trimDecimalText } from '@/server/repositories/decimal-text';

import type { AuditDatabase } from '../../support/audit-database';
import { SEED_PROCESS_ITEMS } from '../../support/seed-config';

/**
 * What the two integration files of STORY-02.02 share (`customers.test.ts`, `customers-sync.test.ts`): the 15 seed items in the order of the Process
 * Master, a known default for each, and the clean-up between tests. The customers cannot be deleted by the runtime role, so the owner clears the tables.
 * Every number is invented (`n.37`, ADR-014).
 */

/** A customer's rate row as the database holds it: the item and the value as text. */
export interface CustomerRateRow {
  readonly processItemId: string;
  readonly value: string;
}

/** The seed items' IDs, in the order of the Process Master and so of the SCR-12 table. */
export function itemIds(): ReadonlyArray<string> {
  return SEED_PROCESS_ITEMS.map((item) => item.id);
}

/** The three percent items are whole numbers (11, 12, 13); every other item is `n.37` for its place n. */
function defaultFor(index: number, unit: string): string {
  return unit === '%' ? String(index - 1) : `${index + 1}.37`;
}

/** Removes every customer and every item a test added, and gives the 15 seed items a known default. */
export async function resetCustomerTables(db: AuditDatabase): Promise<void> {
  await db.owner.query('DELETE FROM customer_rates');
  await db.owner.query('DELETE FROM customers');
  await db.owner.query('DELETE FROM process_items WHERE id <> ALL($1::uuid[])', [itemIds()]);
}

export async function openCustomerDefaults(db: AuditDatabase): Promise<void> {
  await resetCustomerTables(db);
  for (const [index, item] of SEED_PROCESS_ITEMS.entries()) {
    await db.owner.query('UPDATE process_items SET default_value = $2 WHERE id = $1::uuid', [item.id, defaultFor(index, item.unit)]);
  }
}

/** The current default of each seed item as decimal text with two decimals, by item ID. */
export async function seedDefaultValue(db: AuditDatabase): Promise<ReadonlyMap<string, string>> {
  const { rows } = await db.owner.query<{ id: string; value: string }>('SELECT id::text AS id, default_value::text AS value FROM process_items WHERE id = ANY($1::uuid[])', [itemIds()]);
  return new Map(rows.map((row) => [row.id, trimDecimalText(row.value)]));
}
