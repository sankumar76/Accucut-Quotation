import { CUSTOMER_CANARIES } from './customer-canary';
import type { QueryableConnection } from './material-canary-loader';

/**
 * Writes the canary customers (`customer-canary.ts`) into the `customers` and `customer_rates` tables through any connection with a `query` method.
 * The E2E set-up (`ensureCanaryCustomers` in `tests/e2e/support/auth.ts`) calls it.
 *
 * It is safe when several loaders run at once (three screen sizes, four workers), on an empty table or a full one, and when other specs have added Process
 * Master items: every insert has no conflict target, so **every** unique index arbitrates (the ID, the two on the name, the one on customer and item), and
 * the loser of a race does nothing. The canary values are then set by an `UPDATE` by customer and item. No retry and no wait (DL-057). The numbers are
 * invented and this database is thrown away.
 */

const INSERT_CUSTOMER = 'INSERT INTO customers (id, name, phone) VALUES ($1::uuid, $2, $3) ON CONFLICT DO NOTHING';

/** One rate row for every Process Master item the customer does not have yet, at the item's default (SPEC section 4.2 rule 1). */
const INSERT_RATES = `INSERT INTO customer_rates (customer_id, process_item_id, value)
  SELECT $1::uuid, id, default_value FROM process_items ON CONFLICT DO NOTHING`;

const UPDATE_RATE = 'UPDATE customer_rates SET value = $3 WHERE customer_id = $1::uuid AND process_item_id = $2::uuid';

export async function loadCanaryCustomers(connection: QueryableConnection): Promise<void> {
  for (const customer of CUSTOMER_CANARIES) {
    await connection.query(INSERT_CUSTOMER, [customer.id, customer.name, customer.phone]);
    await connection.query(INSERT_RATES, [customer.id]);
    for (const rate of customer.rates) await connection.query(UPDATE_RATE, [customer.id, rate.processItemId, rate.value]);
  }
}
