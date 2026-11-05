import { describe, expect, it } from 'vitest';

import {
  ADMIN_EXISTS_MESSAGE,
  MeasurementUserError,
  THROWAWAY_DATABASE_HOSTS,
  assertThrowawayDatabase,
  ensureMeasurementUser,
} from '../../scripts/lib/measurement-user';
import { createFakeUserRepository } from '../support/fake-auth-repositories';

/**
 * G6 STD-01 (only a throwaway database) and QLT-45 (one active Admin: a clear message, not a database error) for the
 * invented user that the performance checks sign in as. Invented values only.
 */

const INPUT = { email: 'perf-admin@example.test', password: 'invented-measurement-password' };
const hasher = { hash: async (password: string): Promise<string> => `hashed:${password.length}` };
const user = (role: 'ADMIN' | 'LEAD', email: string) => ({ name: 'Invented', email, passwordHash: 'x', role, mustChangePassword: false });

describe('assertThrowawayDatabase (STD-01)', () => {
  it.each(THROWAWAY_DATABASE_HOSTS.map((host) => (host.includes(':') ? `[${host}]` : host)))('accepts a database on %s', (host) => {
    expect(() => assertThrowawayDatabase(`postgresql://app:invented@${host}:5432/accucut`, undefined)).not.toThrow();
  });

  it('refuses a staging host, an address on the internet, and a libpq host override to either', () => {
    for (const url of [
      'postgresql://app:invented@staging-db.example.test:5432/accucut',
      'postgresql://app:invented@203.0.113.9:5432/accucut',
      'postgresql://app:invented@localhost:5432/accucut?host=staging-db.example.test',
      'postgresql://app:invented@localhost:5432/accucut?host=localhost&host=203.0.113.9',
    ]) {
      expect(() => assertThrowawayDatabase(url, undefined), url).toThrow(MeasurementUserError);
    }
  });

  it('does not let a staging host setting widen the list, and never prints the connection string', () => {
    process.env['STAGING_DB_HOST'] = 'staging-db.example.test';
    try {
      expect(() => assertThrowawayDatabase('postgresql://app:invented-secret@staging-db.example.test:5432/accucut', undefined)).toThrow('Staging is never allowed');
      expect(() => assertThrowawayDatabase('postgresql://app:invented-secret@staging-db.example.test:5432/accucut', undefined)).not.toThrow(/invented-secret/);
    } finally {
      delete process.env['STAGING_DB_HOST'];
    }
  });

  it('refuses production mode, a URL that cannot be read, and a database that is not PostgreSQL', () => {
    expect(() => assertThrowawayDatabase('postgresql://app:invented@localhost:5432/accucut', 'production')).toThrow('NODE_ENV is "production"');
    expect(() => assertThrowawayDatabase('not a url', undefined)).toThrow('not a readable connection URL');
    expect(() => assertThrowawayDatabase('mysql://app:invented@localhost:3306/accucut', undefined)).toThrow('not a PostgreSQL URL');
  });
});

describe('ensureMeasurementUser (QLT-45)', () => {
  it('creates one active Admin with no forced password change, from the hash and not the password', async () => {
    const users = createFakeUserRepository();
    expect(await ensureMeasurementUser(users, hasher, INPUT)).toBe('created');
    expect(users.records).toHaveLength(1);
    expect(users.records[0]).toMatchObject({ email: INPUT.email, role: 'ADMIN', mustChangePassword: false, isActive: true, passwordHash: `hashed:${INPUT.password.length}` });
    expect(JSON.stringify(users.records)).not.toContain(INPUT.password);
  });

  it('leaves a user with that e-mail as it is, even when it is the one Admin', async () => {
    const users = createFakeUserRepository([user('ADMIN', INPUT.email)]);
    expect(await ensureMeasurementUser(users, hasher, INPUT)).toBe('exists');
    expect(users.records).toHaveLength(1);
  });

  it('stops with a message that says what to do when another Admin holds the one place, and changes nothing', async () => {
    const users = createFakeUserRepository([user('ADMIN', 'first.admin@example.test')]);
    const error = await ensureMeasurementUser(users, hasher, INPUT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MeasurementUserError);
    expect(error instanceof Error ? error.message : '').toBe(ADMIN_EXISTS_MESSAGE);
    expect(ADMIN_EXISTS_MESSAGE).toContain('fresh throwaway database');
    expect(ADMIN_EXISTS_MESSAGE).toContain('MEASUREMENT_ADMIN_EMAIL');
    expect(users.records).toHaveLength(1);
  });

  it('adds the Admin when the database holds only people who are not Admins', async () => {
    const users = createFakeUserRepository([user('LEAD', 'a.lead@example.test')]);
    expect(await ensureMeasurementUser(users, hasher, INPUT)).toBe('created');
    expect(users.records).toHaveLength(2);
  });
});
