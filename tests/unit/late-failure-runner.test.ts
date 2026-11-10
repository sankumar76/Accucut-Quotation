import { describe, expect, it } from 'vitest';

import { createTransactionHandle, type Transaction, type TransactionRunner } from '../../src/server/repositories/transaction';
import { createLateFailingRunner } from '../support/late-failure-runner';

/**
 * Tech-debt #130 (OBS-1 of the AQP-122 G7 report): the shared late-failure runner fails the outermost transaction only. These tests use
 * an in-memory runner with the same commit rule as the real one (what a `run` wrote is kept only if its callback resolves; a `run` opened
 * inside another is a transaction of its own), so the depth rule is proved without a database. The same rule over real PostgreSQL is
 * `tests/integration/audit/late-failure-runner.test.ts`.
 */

const LATE = new TypeError('a failure after the last step');

interface Store {
  readonly runner: TransactionRunner;
  /** What committed, in commit order. */
  readonly committed: string[];
  /** How many times the wrapped runner was asked to open a transaction. */
  readonly opened: () => number;
  write(tx: Transaction, value: string): void;
}

function createStore(): Store {
  const committed: string[] = [];
  const pending = new Map<Transaction, string[]>();
  let opened = 0;
  return {
    committed,
    opened: () => opened,
    write(tx, value) {
      const list = pending.get(tx);
      if (list === undefined) throw new Error('write outside an open transaction');
      list.push(value);
    },
    runner: {
      async run(work) {
        opened += 1;
        const tx = createTransactionHandle();
        const list: string[] = [];
        pending.set(tx, list);
        try {
          const result = await work(tx);
          committed.push(...list);
          return result;
        } finally {
          pending.delete(tx);
        }
      },
    },
  };
}

describe('the outermost transaction fails after its work', () => {
  it('rejects with the very error object given, and keeps nothing the work wrote (AC: no swallowed errors)', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    const error: unknown = await runner.run((tx) => Promise.resolve(store.write(tx, 'change'))).catch((caught: unknown) => caught);
    expect(error).toBe(LATE);
    expect(error).toBeInstanceOf(TypeError);
    expect(error).toHaveProperty('message', 'a failure after the last step');
    expect(store.committed).toEqual([]);
  });

  it('lets the work finish first: the failure comes after the last step, not before it', async () => {
    const steps: string[] = [];
    const runner = createLateFailingRunner(createStore().runner, LATE);
    await expect(
      runner.run(async () => {
        steps.push('first');
        await Promise.resolve();
        steps.push('last');
      }),
    ).rejects.toBe(LATE);
    expect(steps).toEqual(['first', 'last']);
  });

  it('fails each of two top-level calls in turn (the depth is restored after a failure)', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    await expect(runner.run((tx) => Promise.resolve(store.write(tx, 'one')))).rejects.toBe(LATE);
    await expect(runner.run((tx) => Promise.resolve(store.write(tx, 'two')))).rejects.toBe(LATE);
    expect(store.committed).toEqual([]);
  });

  it('fails two top-level calls running at the same time (one call is not "inside" the other)', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    const settled = await Promise.allSettled([
      runner.run(async (tx) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        store.write(tx, 'slow');
      }),
      runner.run((tx) => Promise.resolve(store.write(tx, 'fast'))),
    ]);
    expect(settled.map((result) => (result.status === 'rejected' ? result.reason : 'resolved'))).toEqual([LATE, LATE]);
    expect(store.committed).toEqual([]);
  });

  it('keeps two overlapping outer calls apart: each nested call belongs to its own outer one (QLT-02)', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    const first = runner.run(async (outer) => {
      store.write(outer, 'o1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await runner.run((inner) => Promise.resolve(store.write(inner, 'i1')));
    });
    const second = runner.run(async (outer) => {
      store.write(outer, 'o2');
      await runner.run((inner) => Promise.resolve(store.write(inner, 'i2')));
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
    const settled = await Promise.allSettled([first, second]);
    expect(settled.map((result) => (result.status === 'rejected' ? result.reason : 'resolved'))).toEqual([LATE, LATE]);
    // Both nested calls committed on their own and neither outer call did: no call was taken for another's nested one.
    expect([...store.committed].sort()).toEqual(['i1', 'i2']);
  });

  it('opens one transaction on the wrapped runner and never retries (DL-057)', async () => {
    const store = createStore();
    await expect(createLateFailingRunner(store.runner, LATE).run(() => Promise.resolve())).rejects.toBe(LATE);
    expect(store.opened()).toBe(1);
  });
});

describe('a transaction opened inside another is a transaction of its own and is not failed', () => {
  it('commits the nested one once, returns its result, and rolls back only the outer one', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    let nestedResult: string | undefined;
    await expect(
      runner.run(async (outer) => {
        store.write(outer, 'change');
        nestedResult = await runner.run(async (inner) => {
          store.write(inner, 'entry in a second transaction');
          return 'nested value';
        });
      }),
    ).rejects.toBe(LATE);
    expect(nestedResult).toBe('nested value');
    // The bypass shape: the entry survives with no change. This is what the masters tests must now see.
    expect(store.committed).toEqual(['entry in a second transaction']);
    expect(store.opened()).toBe(2);
  });

  it('does not fail a nested call made after an await inside the work', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    await expect(
      runner.run(async (outer) => {
        store.write(outer, 'change');
        await new Promise((resolve) => setTimeout(resolve, 5));
        await runner.run((inner) => Promise.resolve(store.write(inner, 'after the wait')));
      }),
    ).rejects.toBe(LATE);
    expect(store.committed).toEqual(['after the wait']);
  });

  it('treats every level below the outermost as nested', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    await expect(
      runner.run((outer) => {
        store.write(outer, 'outer');
        return runner.run((middle) => {
          store.write(middle, 'middle');
          return runner.run((inner) => Promise.resolve(store.write(inner, 'inner')));
        });
      }),
    ).rejects.toBe(LATE);
    expect(store.committed).toEqual(['inner', 'middle']);
  });
});

describe('an error from the work is kept', () => {
  it('rethrows an error of the outer work unchanged, without replacing it by the late failure', async () => {
    const store = createStore();
    const refusal = new RangeError('the change was refused');
    const error: unknown = await createLateFailingRunner(store.runner, LATE)
      .run((tx) => {
        store.write(tx, 'change');
        return Promise.reject(refusal);
      })
      .catch((caught: unknown) => caught);
    expect(error).toBe(refusal);
    expect(error).toBeInstanceOf(RangeError);
    expect(store.committed).toEqual([]);
  });

  it('rolls back the whole outer unit when a nested call fails, and reports the nested error', async () => {
    const store = createStore();
    const runner = createLateFailingRunner(store.runner, LATE);
    const refusal = new SyntaxError('the second transaction failed');
    const error: unknown = await runner
      .run(async (outer) => {
        store.write(outer, 'change');
        await runner.run((inner) => {
          store.write(inner, 'entry');
          return Promise.reject(refusal);
        });
      })
      .catch((caught: unknown) => caught);
    expect(error).toBe(refusal);
    expect(store.committed).toEqual([]);
  });
});
