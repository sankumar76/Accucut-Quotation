import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MAX_ROWS_PER_STATEMENT, type AuditRepository, type NewAuditRow } from '@/server/repositories/audit-repository';
import { createAuditService } from '@/server/services/audit-service';

import { contextOf, entryCount, insertPersonAsOwner, openAuditDatabase, type AuditDatabase } from '../../support/audit-database';
import { defined } from '../../support/defined';

import { itemIds, openCustomerDefaults, resetCustomerTables } from './customers-support';

/**
 * ADR-018 (GitHub #568): the audit entries of a default propagation are written as a batch. Against real PostgreSQL in a throwaway database: the rate's own entry is one `append` and the customers'
 * are one `appendMany` (a save and Save choices alike, never one call per customer); a batch that holds an entry the audit service refuses writes nothing and takes the rate's change and every customer
 * back; and the repository's multi-row statement keeps `before` SQL NULL for a creation, carries up to 1,000 rows, puts more in a further statement of the same transaction, and rolls back with it.
 * Every name and number is invented.
 */

const ITEM = defined(itemIds()[0]);
const OLD = '1.37';
const NEW = '1.52';

let db: AuditDatabase;
let adminId: string;

const by = (requestId: string) => ({ ...contextOf(adminId), requestId });

beforeAll(async () => {
  db = await openAuditDatabase();
  adminId = await insertPersonAsOwner(db, 'Admin', 'ADMIN');
  await db.users.list();
});

afterAll(async () => {
  await db.close();
});

beforeEach(() => openCustomerDefaults(db));
afterEach(() => resetCustomerTables(db));

/** How the entries reached the repository: the `append` calls, and the size of each `appendMany` call. The real repository does the writing. */
function countingAudit() {
  const calls = { single: 0, batches: [] as number[] };
  const repository: AuditRepository = {
    ...db.auditRepository,
    append(row, tx) {
      calls.single += 1;
      return db.auditRepository.append(row, tx);
    },
    appendMany(rows, tx) {
      calls.batches.push(rows.length);
      return db.auditRepository.appendMany(rows, tx);
    },
  };
  return { calls, service: createAuditService({ audit: repository }) };
}

/** `count` customers at every default, made by the owner in two statements, and their IDs. */
async function bulkCustomers(count: number): Promise<ReadonlyArray<string>> {
  const { rows } = await db.owner.query<{ id: string }>(`INSERT INTO customers (name) SELECT 'Batch ' || lpad(n::text, 4, '0') || ' Works' FROM generate_series(1, ${String(count)}) AS n RETURNING id::text`);
  const ids = rows.map((row) => row.id);
  await db.owner.query('INSERT INTO customer_rates (customer_id, process_item_id, value) SELECT c.id, pi.id, pi.default_value FROM customers c CROSS JOIN process_items pi WHERE c.id = ANY($1::uuid[])', [ids]);
  return ids;
}

async function valueOf(customerId: string): Promise<string> {
  const { rows } = await db.owner.query<{ value: string }>('SELECT value::text AS value FROM customer_rates WHERE customer_id = $1::uuid AND process_item_id = $2::uuid', [customerId, ITEM]);
  return Number(defined(rows[0]).value).toFixed(2);
}

async function defaultOf(): Promise<string> {
  const { rows } = await db.owner.query<{ value: string }>('SELECT default_value::text AS value FROM process_items WHERE id = $1::uuid', [ITEM]);
  return Number(defined(rows[0]).value).toFixed(2);
}

describe('how the propagation writes its entries (ADR-018)', () => {
  const CUSTOMERS = 12;

  it('the save writes the rate\'s entry with one append and the customers\' entries with one appendMany of the same size', async () => {
    const ids = await bulkCustomers(CUSTOMERS);
    const { calls, service } = countingAudit();
    const answer = await db.buildMastersService({ audit: service }).updateProcessItem(by('req-batch-save'), ITEM, { defaultValue: NEW });
    expect(answer.propagation).toMatchObject({ moved: CUSTOMERS });
    for (const id of ids) expect(await valueOf(id)).toBe(NEW);
    expect(calls).toEqual({ single: 1, batches: [CUSTOMERS] });
    const { rows } = await db.owner.query<{ entries: string }>("SELECT count(*) AS entries FROM audit_log WHERE request_id = $1 AND object_type = 'customer'", ['req-batch-save']);
    expect(Number(defined(rows[0]).entries)).toBe(CUSTOMERS);
  });

  it('Save choices writes the customers\' entries with one appendMany and no append at all', async () => {
    const ids = await bulkCustomers(CUSTOMERS);
    await db.owner.query('UPDATE customer_rates SET value = 1.50 WHERE process_item_id = $1::uuid', [ITEM]);
    await db.owner.query('UPDATE process_items SET default_value = $2 WHERE id = $1::uuid', [ITEM, NEW]);
    const { calls, service } = countingAudit();
    // The shown value is sent with a leading zero, which the request's pattern allows: the entry's before must be the value the statement matched ('1.50', the number's own text), not this spelling of it (SQR-02 of the review of PR 564).
    const choices = ids.map((customerId) => ({ customerId, choice: 'apply' as const, shownValue: '01.50' }));
    const counts = await db.buildMastersService({ audit: service }).applyPropagation(by('req-batch-choices'), ITEM, { newDefault: NEW, choices });
    expect(counts).toEqual({ applied: CUSTOMERS, kept: 0, skipped: 0 });
    expect(calls).toEqual({ single: 0, batches: [CUSTOMERS] });
    // The value each entry says the customer held came from the statement that changed it, not from the request's text.
    const { rows } = await db.owner.query<{ before: { rates: ReadonlyArray<{ value: string }> } }>("SELECT before FROM audit_log WHERE request_id = $1 AND object_type = 'customer'", ['req-batch-choices']);
    expect(rows).toHaveLength(CUSTOMERS);
    expect(new Set(rows.map((row) => defined(row.before.rates[0]).value))).toEqual(new Set(['1.50']));
  });

  it('an entry the audit service refuses in the batch writes nothing and takes the rate and every customer back', async () => {
    const ids = await bulkCustomers(3);
    // The label of an entry is the customer's name: one over the 200 the log keeps is refused, whichever place it has in the batch.
    await db.owner.query("UPDATE customers SET name = repeat('x', 201) WHERE id = $1::uuid", [defined(ids[1])]);
    const entries = await entryCount(db);
    await expect(db.mastersService.updateProcessItem(by('req-batch-refused'), ITEM, { defaultValue: NEW })).rejects.toMatchObject({ reason: 'shape', where: 'object.label' });
    expect(await defaultOf()).toBe(OLD);
    for (const id of ids) expect(await valueOf(id)).toBe(OLD);
    expect(await entryCount(db)).toBe(entries);
  });
});

describe('the repository\'s multi-row statement (appendMany)', () => {
  function rowsOf(count: number, requestId: string): NewAuditRow[] {
    return Array.from({ length: count }, (_, index) => ({
      actorId: adminId,
      actorLabel: 'Invented Admin',
      event: 'master.edited',
      objectType: 'customer',
      objectId: randomUUID(),
      objectLabel: `Invented customer ${String(index)}`,
      before: index % 2 === 0 ? null : { name: 'x', note: "it's \"quoted\" \\ and $1" },
      after: { name: 'y', index },
      requestId,
    }));
  }

  /** The statements an insert took, as the transaction numbers its commands: one group for each statement, with its row count. */
  async function statementsOf(requestId: string): Promise<ReadonlyArray<number>> {
    const { rows } = await db.owner.query<{ rows: string }>('SELECT count(*) AS rows FROM audit_log WHERE request_id = $1 GROUP BY cmin::text::int ORDER BY cmin::text::int', [requestId]);
    return rows.map((row) => Number(row.rows));
  }

  it('puts 1,001 rows in two statements of the same transaction, all present', async () => {
    expect(MAX_ROWS_PER_STATEMENT).toBe(1_000);
    await db.transactions.run((tx) => db.auditRepository.appendMany(rowsOf(1_001, 'req-batch-1001'), tx));
    expect(await statementsOf('req-batch-1001')).toEqual([1_000, 1]);
  });

  it('puts exactly 1,000 rows in one statement', async () => {
    await db.transactions.run((tx) => db.auditRepository.appendMany(rowsOf(1_000, 'req-batch-1000'), tx));
    expect(await statementsOf('req-batch-1000')).toEqual([1_000]);
  });

  it('stores before as SQL NULL for a creation and keeps text with quotes, backslashes and dollar signs as it was', async () => {
    await db.transactions.run((tx) => db.auditRepository.appendMany(rowsOf(4, 'req-batch-json'), tx));
    const { rows } = await db.owner.query<{ nulls: string; kept: string }>(
      "SELECT count(*) FILTER (WHERE before IS NULL) AS nulls, count(*) FILTER (WHERE before ->> 'note' = 'it''s \"quoted\" \\ and $1') AS kept FROM audit_log WHERE request_id = 'req-batch-json'",
    );
    expect(rows[0]).toEqual({ nulls: '2', kept: '2' });
  });

  it('sends no statement for an empty list', async () => {
    await db.transactions.run((tx) => db.auditRepository.appendMany([], tx));
    expect(await statementsOf('req-batch-none')).toEqual([]);
  });

  it('rolls every row back with the transaction, the first statement\'s too', async () => {
    const failure = new Error('the change failed after the batch was written');
    await expect(
      db.transactions.run(async (tx) => {
        await db.auditRepository.appendMany(rowsOf(1_001, 'req-batch-rollback'), tx);
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(await statementsOf('req-batch-rollback')).toEqual([]);
  });
});
