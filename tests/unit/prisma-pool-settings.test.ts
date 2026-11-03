import type { PoolConfig } from 'pg';
import { describe, expect, it } from 'vitest';

import { DATABASE_CLIENT_KINDS, poolConfigFor, POOL_SETTINGS } from '@/server/repositories/prisma-client';

import { testPoolConfig } from '../support/test-prisma-client';

/** Architecture ruling R4 (PRF-01): fixed pool and timeout settings per kind of process, nothing from the environment. */

const URL_FOR_TEST = 'postgresql://user:invented@127.0.0.1:1/none';

describe('pool settings per kind (R4)', () => {
  it.each([
    ['app', { max: 10, connect: 5_000, idle: 30_000, statement: 10_000, idleTx: 30_000, name: 'accucut-app' }],
    ['worker', { max: 3, connect: 5_000, idle: 10_000, statement: 30_000, idleTx: 30_000, name: 'accucut-worker' }],
    ['script', { max: 2, connect: 5_000, idle: 10_000, statement: 30_000, idleTx: 30_000, name: 'accucut-script' }],
  ] as const)('%s reaches the pool with the ruled values', (kind, expected) => {
    expect(poolConfigFor(kind, URL_FOR_TEST)).toEqual({
      connectionString: URL_FOR_TEST,
      max: expected.max,
      connectionTimeoutMillis: expected.connect,
      idleTimeoutMillis: expected.idle,
      statement_timeout: expected.statement,
      idle_in_transaction_session_timeout: expected.idleTx,
      application_name: expected.name,
    });
  });

  it('covers every kind, and every connection has a connect timeout so none can wait for ever', () => {
    expect(Object.keys(POOL_SETTINGS).sort()).toEqual([...DATABASE_CLIENT_KINDS].sort());
    for (const kind of DATABASE_CLIENT_KINDS) {
      expect(POOL_SETTINGS[kind].connectionTimeoutMillis).toBeGreaterThan(0);
      expect(POOL_SETTINGS[kind].statementTimeoutMillis).toBeGreaterThan(0);
      expect(POOL_SETTINGS[kind].idleInTransactionTimeoutMillis).toBeGreaterThan(0);
    }
  });

  it('app and worker together hold 13 of PostgreSQL\'s 100 default connections, leaving room for the others', () => {
    expect(POOL_SETTINGS.app.max + POOL_SETTINGS.worker.max).toBe(13);
  });

  it('STD-15: production code cannot loosen the ruled values: an extra argument changes nothing', () => {
    // The signatures take no overrides. Passing one anyway (the types forbid it, so go around them) must not
    // switch a limit off: a statement_timeout of 0 means no limit in PostgreSQL.
    const config: PoolConfig = Reflect.apply(poolConfigFor, undefined, ['app', URL_FOR_TEST, { statementTimeoutMillis: 0, max: 1000 }]);
    expect(config.statement_timeout).toBe(10_000);
    expect(config.max).toBe(10);
  });

  it('test support can lower one setting on top of the ruled values, and only there', () => {
    const config = testPoolConfig('app', URL_FOR_TEST, { statement_timeout: 250 });
    expect(config.statement_timeout).toBe(250);
    expect(config.max).toBe(10);
    expect(config.application_name).toBe('accucut-app');
  });

  it('keeps pool settings out of the connection string', () => {
    expect(poolConfigFor('worker', URL_FOR_TEST).connectionString).toBe(URL_FOR_TEST);
  });
});
