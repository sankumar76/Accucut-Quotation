import { describe, expect, it } from 'vitest';

import { assertSafeDatabaseTarget, DatabaseGuardError } from '../support/db-guard';
import setup from '../support/global-setup';

/**
 * AC-10: the guard decides from the URL and NODE_ENV alone, so no test here opens a connection.
 * The bad host and the password below are made up.
 */

const INVENTED_PASSWORD = 'invented-test-only-secret';
const BAD_URL = `postgresql://app_user:${INVENTED_PASSWORD}@db.invented-remote.example:5432/accucut`;
const LOCAL_URL = `postgresql://app_user:${INVENTED_PASSWORD}@localhost:55432/accucut`;

function messageOf(action: () => void): string {
  try {
    action();
  } catch (error) {
    if (error instanceof DatabaseGuardError) return error.message;
    throw error;
  }
  throw new Error('Expected the guard to refuse, but it accepted.');
}

describe('assertSafeDatabaseTarget (AC-10)', () => {
  it('AC-10: refuses a remote host and names the rule', () => {
    const message = messageOf(() => assertSafeDatabaseTarget({ DATABASE_URL: BAD_URL }));
    expect(message).toContain('Refusing to run');
    expect(message).toContain('not local, CI or staging');
    expect(message).toContain('db.invented-remote.example');
  });

  it('AC-10: never prints the password or the connection string when it refuses', () => {
    const message = messageOf(() => assertSafeDatabaseTarget({ DATABASE_URL: BAD_URL }));
    expect(message).not.toContain(INVENTED_PASSWORD);
    expect(message).not.toContain('app_user');
    expect(message).not.toContain('postgresql://');
  });

  it('AC-10: the refusal reads plainly: its stack is the message, with no frames to rewrite', () => {
    try {
      assertSafeDatabaseTarget({ DATABASE_URL: BAD_URL });
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseGuardError);
      if (error instanceof DatabaseGuardError) expect(error.stack).toBe(`DatabaseGuardError: ${error.message}`);
      return;
    }
    throw new Error('Expected the guard to refuse.');
  });

  it('AC-10: refuses NODE_ENV=production even with a local database', () => {
    const message = messageOf(() => assertSafeDatabaseTarget({ NODE_ENV: 'production', DATABASE_URL: LOCAL_URL }));
    expect(message).toContain('NODE_ENV is "production"');
  });

  it('AC-10: accepts a local connection when NODE_ENV is not production', () => {
    expect(() => assertSafeDatabaseTarget({ NODE_ENV: 'test', DATABASE_URL: LOCAL_URL })).not.toThrow();
  });

  it.each([
    ['loopback address', 'postgresql://u:p@127.0.0.1:5432/x'],
    ['IPv6 loopback', 'postgresql://u:p@[::1]:5432/x'],
    ['Compose service name', 'postgresql://u:p@db:5432/x'],
    ['CI service host', 'postgres://u:p@postgres:5432/x'],
    ['upper-case local host', 'postgresql://u:p@LOCALHOST:5432/x'],
  ])('AC-10: accepts a %s', (_name, url) => {
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: url })).not.toThrow();
  });

  it('AC-10: accepts the staging host only when STAGING_DB_HOST names it', () => {
    const url = 'postgresql://u:p@staging-db.invented.example:5432/x';
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: url })).toThrow(DatabaseGuardError);
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: url, STAGING_DB_HOST: 'staging-db.invented.example' })).not.toThrow();
  });

  it('AC-10: checks the migration URL as well', () => {
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: LOCAL_URL, MIGRATE_DATABASE_URL: BAD_URL })).toThrow(
      DatabaseGuardError,
    );
  });

  it('AC-10: refuses a libpq host override that points elsewhere', () => {
    const url = 'postgresql://u:p@localhost:5432/x?host=db.invented-remote.example';
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: url })).toThrow(DatabaseGuardError);
  });

  it('AC-10: refuses a URL it cannot read, without echoing it', () => {
    const message = messageOf(() => assertSafeDatabaseTarget({ DATABASE_URL: `not a url ${INVENTED_PASSWORD}` }));
    expect(message).toContain('not a readable connection URL');
    expect(message).not.toContain(INVENTED_PASSWORD);
  });

  it('AC-10: refuses a URL that is not PostgreSQL', () => {
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: 'mysql://u:p@localhost/x' })).toThrow(DatabaseGuardError);
  });

  it('AC-10: refuses a PostgreSQL URL with no host', () => {
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: 'postgresql:///x' })).toThrow(DatabaseGuardError);
  });

  it('AC-10: passes when no database is configured and NODE_ENV is not production', () => {
    expect(() => assertSafeDatabaseTarget({})).not.toThrow();
  });
});

describe('global set-up (AC-10)', () => {
  it('AC-10: reads the real process environment through the guard', () => {
    const before = { ...process.env };
    try {
      process.env['DATABASE_URL'] = BAD_URL;
      expect(() => setup()).toThrow(DatabaseGuardError);
      process.env['DATABASE_URL'] = LOCAL_URL;
      expect(() => setup()).not.toThrow();
    } finally {
      for (const key of ['DATABASE_URL', 'MIGRATE_DATABASE_URL']) {
        const original = before[key];
        if (original === undefined) delete process.env[key];
        else process.env[key] = original;
      }
    }
  });
});
