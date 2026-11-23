import { beforeAll, describe, expect, it } from 'vitest';

/**
 * DEF-042 (AQP-345): the seeded queue tasks of the E2E specs get a code that cannot repeat. The running number is the next one after the highest `Q-9998-` code, read inside
 * one transaction that holds an advisory lock, so these tests check the number rule and the order of the statements with a stand-in connection. That two workers
 * really queue up on the lock is read from a real PostgreSQL (the PR's Dev Record), not from a stand-in.
 *
 * The helper imports the set-up code of the E2E specs, a long module graph, so it is loaded once in `beforeAll` (the 5 s limit of a test is not for a cold load).
 */

type QueueModule = typeof import('../e2e/support/queue');
let queue: QueueModule;

beforeAll(async () => {
  queue = await import('../e2e/support/queue');
});

const PRODUCT_CODE_FORMAT = /^Q-\d{4}-\d{4,}$/;

describe('the code of a seeded queue task (DEF-042)', () => {
  it('is Q-9998- and six digits, which the product accepts as a task code', () => {
    expect(queue.queueTaskCode(100_000)).toBe('Q-9998-100000');
    expect(queue.queueTaskCode(999_999)).toBe('Q-9998-999999');
    expect(queue.queueTaskCode(123_456)).toMatch(PRODUCT_CODE_FORMAT);
  });

  it('refuses a running number that has not six digits, so no code is a part of another', () => {
    for (const bad of [99_999, 1_000_000, 1.5, Number.NaN, -1]) {
      expect(() => queue.queueTaskCode(bad), String(bad)).toThrow(/outside 100000 to 999999/);
    }
  });
});

describe('the running number after the highest one', () => {
  it('starts at 100000 in a database that has no seeded code, and goes up by one', () => {
    expect(queue.nextRunningNumber(null)).toBe(100_000);
    expect(queue.nextRunningNumber(100_000)).toBe(100_001);
    expect(queue.nextRunningNumber(250_041)).toBe(250_042);
    expect(queue.nextRunningNumber(999_998)).toBe(999_999);
  });

  it('says so when the numbers are used up, and does not repeat one', () => {
    expect(() => queue.nextRunningNumber(999_999)).toThrow(/used up/);
  });

  it('refuses a highest number that this helper could not have made', () => {
    for (const bad of [5, 99_998, 1.5, Number.NaN]) {
      expect(() => queue.nextRunningNumber(bad), String(bad)).toThrow(/not one this helper made/);
    }
  });
});

/** A stand-in for the connection: a table of codes, a log of the statements, and the answers the helper reads. */
function fakeDatabase(options: { readonly assignerExists?: boolean; readonly failOn?: RegExp } = {}) {
  const log: string[] = [];
  const codes: string[] = [];
  const client: import('../e2e/support/queue').QueueSeedClient = {
    query: <R extends object>(text: string, values?: readonly unknown[]) => {
      const statement = text.trim().split(/\s+/).slice(0, 2).join(' ');
      log.push(statement);
      if (options.failOn?.test(text) === true) return Promise.reject(new Error('the database refused it'));
      let rows: unknown[] = [];
      if (/^SELECT max\(/.test(text.trim())) {
        const numbers = codes.map((code) => Number(code.slice('Q-9998-'.length)));
        rows = [{ highest: numbers.length === 0 ? null : Math.max(...numbers) }];
      } else if (/^INSERT INTO tasks/.test(text.trim())) {
        if (options.assignerExists === false) rows = [];
        else {
          const code = String(values?.[0]);
          if (codes.includes(code)) return Promise.reject(Object.assign(new Error('duplicate key value violates unique constraint "uq_tasks_code"'), { code: '23505' }));
          codes.push(code);
          rows = [{ id: `task-${codes.length}` }];
        }
      }
      return Promise.resolve({ rows: rows as R[] });
    },
  };
  return { client, log, codes };
}

describe('inserting a queue task', () => {
  const insert = (client: import('../e2e/support/queue').QueueSeedClient) => queue.insertQueueTask(client, '00000000-0000-4000-8000-000000000001', '2100-01-01T00:00:00Z', 'Invented title', 'e2e.lead@example.test');

  it('takes the lock after BEGIN and before it reads the highest code, and commits last', async () => {
    const db = fakeDatabase();
    const task = await insert(db.client);
    expect(task).toEqual({ id: 'task-1', code: 'Q-9998-100000' });
    expect(db.log).toEqual(['BEGIN', 'SELECT pg_advisory_xact_lock($1::bigint)', 'SELECT max(substr(code,', 'INSERT INTO', 'COMMIT']);
  });

  it('gives every task another code, over a thousand seeds in a row, with no collision', async () => {
    const db = fakeDatabase();
    const made: string[] = [];
    for (let seed = 0; seed < 1_000; seed += 1) made.push((await insert(db.client))?.code ?? 'none');
    expect(new Set(made).size).toBe(1_000);
    expect(made.every((code) => /^Q-9998-\d{6}$/.test(code))).toBe(true);
    expect(db.log.filter((statement) => statement === 'COMMIT')).toHaveLength(1_000);
  });

  it('continues after the codes an earlier run left in the database', async () => {
    const db = fakeDatabase();
    db.codes.push('Q-9998-100000', 'Q-9998-100007', 'Q-9998-100003');
    expect((await insert(db.client))?.code).toBe('Q-9998-100008');
  });

  it('rolls back and answers undefined when the person who assigns the task does not exist', async () => {
    const db = fakeDatabase({ assignerExists: false });
    expect(await insert(db.client)).toBeUndefined();
    expect(db.log.at(-1)).toBe('ROLLBACK');
    expect(db.log).not.toContain('COMMIT');
  });

  it('rolls back and throws the error as it is when a statement fails, whatever it is', async () => {
    const db = fakeDatabase({ failOn: /^INSERT INTO tasks/ });
    await expect(insert(db.client)).rejects.toThrow('the database refused it');
    expect(db.log.at(-1)).toBe('ROLLBACK');
    expect(db.log).not.toContain('COMMIT');
  });
});
