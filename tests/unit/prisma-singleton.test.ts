import { afterEach, describe, expect, it } from 'vitest';

import { loadDatabaseEnv } from '@/lib/env';
import { getPrismaClient } from '@/server/repositories/prisma-client';

/**
 * Deferred issue #18 (DL-054): the first caller in the web process gets one client per kind, kept on `globalThis`,
 * so a second bundle or a reload cannot open a second pool. The URL is invented and no query is sent, so nothing
 * connects.
 */

const URL_FOR_TEST = 'postgresql://user:invented@127.0.0.1:1/none';

afterEach(async () => {
  const clients = globalThis.accucutPrismaClients;
  if (clients !== undefined) await Promise.all([...clients.values()].map((client) => client.$disconnect()));
  globalThis.accucutPrismaClients = undefined;
});

describe('one client per kind of process', () => {
  it('returns the same client for the same kind, whatever the caller', () => {
    expect(getPrismaClient('app', URL_FOR_TEST)).toBe(getPrismaClient('app', URL_FOR_TEST));
  });

  it('keeps the client on globalThis, which every bundle and every reload shares', () => {
    const client = getPrismaClient('worker', URL_FOR_TEST);
    expect(globalThis.accucutPrismaClients?.get('worker')).toBe(client);
  });

  it('gives each kind its own client, because each kind has its own pool settings', () => {
    expect(getPrismaClient('app', URL_FOR_TEST)).not.toBe(getPrismaClient('worker', URL_FOR_TEST));
  });

  it('the first call decides the connection: a later call with another string still returns the first client', () => {
    const first = getPrismaClient('app', URL_FOR_TEST);
    expect(getPrismaClient('app', 'postgresql://user:invented@127.0.0.1:2/other')).toBe(first);
  });
});

describe('the database setting alone', () => {
  it('loadDatabaseEnv needs only DATABASE_URL, and names a bad one without printing it', () => {
    expect(loadDatabaseEnv({ DATABASE_URL: URL_FOR_TEST })).toEqual({ DATABASE_URL: URL_FOR_TEST });
    expect(() => loadDatabaseEnv({ DATABASE_URL: 'mysql://user:secret-value@host/db' })).toThrow('DATABASE_URL (invalid)');
    expect(() => loadDatabaseEnv({})).toThrow('DATABASE_URL (missing)');
    expect(() => loadDatabaseEnv({ DATABASE_URL: 'mysql://user:secret-value@host/db' })).not.toThrow(/secret-value/);
  });
});
