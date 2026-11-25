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
 *
 * The statements run in one transaction whose first statement is the lock the product takes before the same insert (`lockProcessItems`,
 * `master-repository.ts`): `LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE`. It guards against concurrent **deletes** of Process Master items as much
 * as additions: under READ COMMITTED the `SELECT` of `INSERT_RATES` can hold an item that another case's `cleanUp` deletes before the foreign-key check,
 * and the insert then fails on `fk_customer_rates_process_item_id` (DEF-082). The lock is taken first, as in the product, so no new lock-order cycle exists;
 * loaders queue on each other for milliseconds (the mode conflicts with itself). The connection must be a single client (`pg.Client`), never a pool, or
 * `BEGIN` and the statements could run on different connections. No retry and no wait (DL-057, DL-375).
 */

const INSERT_CUSTOMER = 'INSERT INTO customers (id, name, short_name, phone) VALUES ($1::uuid, $2, left(md5($2), 10), $3) ON CONFLICT DO NOTHING';

/** One rate row for every Process Master item the customer does not have yet, at the item's default (SPEC section 4.2 rule 1). */
const INSERT_RATES = `INSERT INTO customer_rates (customer_id, process_item_id, value)
  SELECT $1::uuid, id, default_value FROM process_items ON CONFLICT DO NOTHING`;

const UPDATE_RATE = 'UPDATE customer_rates SET value = $3 WHERE customer_id = $1::uuid AND process_item_id = $2::uuid';

const LOCK_PROCESS_ITEMS = 'LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE';

export async function loadCanaryCustomers(connection: QueryableConnection): Promise<void> {
  await connection.query('BEGIN');
  try {
    await connection.query(LOCK_PROCESS_ITEMS);
    for (const customer of CUSTOMER_CANARIES) {
      await connection.query(INSERT_CUSTOMER, [customer.id, customer.name, customer.phone]);
      await connection.query(INSERT_RATES, [customer.id]);
      for (const rate of customer.rates) await connection.query(UPDATE_RATE, [customer.id, rate.processItemId, rate.value]);
    }
    await connection.query('COMMIT');
  } catch (error) {
    // The statement's error is the one to read; if the rollback fails too (a broken connection), neither is hidden.
    await connection.query('ROLLBACK').catch((rollbackError: unknown) => {
      throw new AggregateError([error, rollbackError], 'The canary customer load failed and its rollback failed too.');
    });
    throw error;
  }
}
