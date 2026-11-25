import { describe, expect, it } from 'vitest';

import { CUSTOMER_CANARIES } from '../support/customer-canary';
import { loadCanaryCustomers } from '../support/customer-canary-loader';

/**
 * DEF-082 (AQP-425, DL-375): the canary customer loader runs its three statements in one transaction that takes the Process Master lock first, the same
 * lock the product takes before the same insert (`lockProcessItems`), so a concurrent delete of an item cannot land between the insert's `SELECT` and its
 * foreign-key check. These tests record what the loader sends; the race itself is proved by the E2E runs (no `fk_customer_rates_process_item_id` line).
 */

const LOCK = 'LOCK TABLE process_items IN SHARE ROW EXCLUSIVE MODE';
const INSERT_CUSTOMER = 'INSERT INTO customers (id, name, short_name, phone) VALUES ($1::uuid, $2, left(md5($2), 10), $3) ON CONFLICT DO NOTHING';
const INSERT_RATES = `INSERT INTO customer_rates (customer_id, process_item_id, value)
  SELECT $1::uuid, id, default_value FROM process_items ON CONFLICT DO NOTHING`;
const UPDATE_RATE = 'UPDATE customer_rates SET value = $3 WHERE customer_id = $1::uuid AND process_item_id = $2::uuid';

interface Call {
  readonly text: string;
  readonly values: ReadonlyArray<string> | undefined;
}

/** A connection that records every statement; it rejects the one at `failAt` (an index into the calls), if given. */
function recordingConnection(failAt?: number) {
  const calls: Call[] = [];
  return {
    calls,
    query(text: string, values?: ReadonlyArray<string>): Promise<unknown> {
      calls.push({ text, values });
      return calls.length - 1 === failAt ? Promise.reject(new Error('statement failed')) : Promise.resolve({});
    },
  };
}

/** The statements one run sends: for each canary customer the insert, the rates insert and one update per canary rate. */
function expectedStatements(): Call[] {
  return CUSTOMER_CANARIES.flatMap((customer) => [
    { text: INSERT_CUSTOMER, values: [customer.id, customer.name, customer.phone] },
    { text: INSERT_RATES, values: [customer.id] },
    ...customer.rates.map((rate) => ({ text: UPDATE_RATE, values: [customer.id, rate.processItemId, rate.value] })),
  ]);
}

describe('loadCanaryCustomers, one transaction behind the Process Master lock (DEF-082)', () => {
  it('sends BEGIN, the lock, the three statements unchanged, then COMMIT, in that order', async () => {
    const connection = recordingConnection();
    await loadCanaryCustomers(connection);
    expect(connection.calls).toEqual([
      { text: 'BEGIN', values: undefined },
      { text: LOCK, values: undefined },
      ...expectedStatements(),
      { text: 'COMMIT', values: undefined },
    ]);
  });

  it('takes the lock before any statement that reads or writes a canary row', async () => {
    const connection = recordingConnection();
    await loadCanaryCustomers(connection);
    const texts = connection.calls.map((call) => call.text);
    expect(texts[0]).toBe('BEGIN');
    expect(texts[1]).toBe(LOCK);
    expect(texts.indexOf(INSERT_RATES)).toBeGreaterThan(texts.indexOf(LOCK));
    expect(texts.filter((text) => text === LOCK)).toHaveLength(1);
  });

  it('rolls back and rethrows the same error when a statement fails, and never commits', async () => {
    // Index 3 is the rates insert: the statement the race broke.
    const connection = recordingConnection(3);
    await expect(loadCanaryCustomers(connection)).rejects.toThrow('statement failed');
    const texts = connection.calls.map((call) => call.text);
    expect(texts).toEqual(['BEGIN', LOCK, INSERT_CUSTOMER, INSERT_RATES, 'ROLLBACK']);
    expect(texts).not.toContain('COMMIT');
  });

  it('rolls back and rethrows when the lock itself fails', async () => {
    const connection = recordingConnection(1);
    await expect(loadCanaryCustomers(connection)).rejects.toThrow('statement failed');
    expect(connection.calls.map((call) => call.text)).toEqual(['BEGIN', LOCK, 'ROLLBACK']);
  });

  it('rolls back and rethrows when COMMIT fails', async () => {
    const connection = recordingConnection(2 + expectedStatements().length);
    await expect(loadCanaryCustomers(connection)).rejects.toThrow('statement failed');
    expect(connection.calls.map((call) => call.text).slice(-2)).toEqual(['COMMIT', 'ROLLBACK']);
  });

  it('swallows neither error when the rollback fails too: it throws both, the statement error first', async () => {
    const calls: string[] = [];
    const connection = {
      query(text: string): Promise<unknown> {
        calls.push(text);
        if (text === INSERT_RATES) return Promise.reject(new Error('original'));
        if (text === 'ROLLBACK') return Promise.reject(new Error('rollback failed'));
        return Promise.resolve({});
      },
    };
    const thrown: unknown = await loadCanaryCustomers(connection).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors.map((error: Error) => error.message)).toEqual(['original', 'rollback failed']);
    expect(calls.at(-1)).toBe('ROLLBACK');
  });
});
