import { describe, expect, it } from 'vitest';

import {
  EnvValidationError,
  loadAdminBootstrapEnv,
  loadAppEnv,
  loadMigrateEnv,
  type EnvSource,
} from '@/lib/env';

/** AC-3: validation at start-up, naming the variable, never printing a value. All values are invented. */

const SECRET_VALUE = 'invented-secret-value-that-must-not-be-printed-0123456789';

const validNone: EnvSource = {
  DATABASE_URL: 'postgresql://accucut_app:invented-db-password@localhost:55432/accucut',
  AUTH_SECRET: SECRET_VALUE,
  APP_ORIGIN: 'http://localhost:3000',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_AUTH_MODE: 'none',
};

function problemsOf(action: () => unknown): EnvValidationError {
  try {
    action();
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error('Expected EnvValidationError, but nothing was thrown.');
}

describe('loadAppEnv (AC-3)', () => {
  it('accepts a complete environment and converts the port to a number', () => {
    const env = loadAppEnv(validNone);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.APP_ORIGIN).toBe('http://localhost:3000');
  });

  it('AC-3: fails fast naming the missing variable', () => {
    const rest = Object.fromEntries(Object.entries(validNone).filter(([name]) => name !== 'DATABASE_URL'));
    const error = problemsOf(() => loadAppEnv(rest));
    expect(error.problems).toEqual([{ name: 'DATABASE_URL', reason: 'missing' }]);
    expect(error.message).toContain('DATABASE_URL (missing)');
  });

  it('AC-3: treats an empty value as missing', () => {
    const error = problemsOf(() => loadAppEnv({ ...validNone, AUTH_SECRET: '' }));
    expect(error.problems).toEqual([{ name: 'AUTH_SECRET', reason: 'missing' }]);
  });

  it('AC-3: never prints a value, including the value of an invalid secret', () => {
    const error = problemsOf(() => loadAppEnv({ ...validNone, AUTH_SECRET: 'short-invented-secret' }));
    expect(error.problems).toEqual([{ name: 'AUTH_SECRET', reason: 'invalid' }]);
    expect(error.message).not.toContain('short-invented-secret');
    const badUrl = problemsOf(() => loadAppEnv({ ...validNone, DATABASE_URL: 'mysql://user:invented-db-password@host/x' }));
    expect(badUrl.message).not.toContain('invented-db-password');
  });

  it('AC-3: refuses a template value that was never replaced', () => {
    const error = problemsOf(() => loadAppEnv({ ...validNone, AUTH_SECRET: `CHANGE_ME_${'x'.repeat(40)}` }));
    expect(error.problems).toEqual([{ name: 'AUTH_SECRET', reason: 'invalid' }]);
    const url = problemsOf(() => loadAppEnv({ ...validNone, DATABASE_URL: 'postgresql://a:CHANGE_ME_APP_PASSWORD@localhost/x' }));
    expect(url.problems).toEqual([{ name: 'DATABASE_URL', reason: 'invalid' }]);
  });

  it('reports every problem once, in one error', () => {
    const error = problemsOf(() => loadAppEnv({ SMTP_AUTH_MODE: 'none' }));
    const names = error.problems.map((problem) => problem.name);
    expect(names).toEqual(expect.arrayContaining(['DATABASE_URL', 'AUTH_SECRET', 'APP_ORIGIN', 'SMTP_HOST', 'SMTP_PORT']));
    expect(new Set(names).size).toBe(names.length);
  });

  it.each([
    ['a path on the origin', 'http://localhost:3000/app'],
    ['a trailing slash', 'http://localhost:3000/'],
    ['a non-http scheme', 'ftp://localhost'],
    ['text', 'not-a-url'],
  ])('rejects APP_ORIGIN with %s', (_name, origin) => {
    const error = problemsOf(() => loadAppEnv({ ...validNone, APP_ORIGIN: origin }));
    expect(error.problems).toEqual([{ name: 'APP_ORIGIN', reason: 'invalid' }]);
  });

  it('rejects an SMTP port outside 1 to 65535', () => {
    expect(problemsOf(() => loadAppEnv({ ...validNone, SMTP_PORT: '70000' })).problems[0]?.name).toBe('SMTP_PORT');
  });

  it('rejects an unknown mail mode', () => {
    expect(problemsOf(() => loadAppEnv({ ...validNone, SMTP_AUTH_MODE: 'basic' })).problems[0]?.name).toBe('SMTP_AUTH_MODE');
  });

  it('password mode needs the user and the password', () => {
    const base = { ...validNone, SMTP_AUTH_MODE: 'password' };
    const error = problemsOf(() => loadAppEnv(base));
    expect(error.problems.map((problem) => problem.name)).toEqual(['SMTP_USER', 'SMTP_PASSWORD']);
    expect(() => loadAppEnv({ ...base, SMTP_USER: 'mailer', SMTP_PASSWORD: 'invented-mail-password' })).not.toThrow();
  });

  it('oauth2-client-credentials mode needs the tenant, client and secret', () => {
    const base = { ...validNone, SMTP_AUTH_MODE: 'oauth2-client-credentials', SMTP_USER: 'mailer' };
    const error = problemsOf(() => loadAppEnv(base));
    expect(error.problems.map((problem) => problem.name)).toEqual([
      'SMTP_OAUTH_TENANT_ID',
      'SMTP_OAUTH_CLIENT_ID',
      'SMTP_OAUTH_CLIENT_SECRET',
    ]);
    const complete = {
      ...base,
      SMTP_OAUTH_TENANT_ID: 'tenant-1',
      SMTP_OAUTH_CLIENT_ID: 'client-1',
      SMTP_OAUTH_CLIENT_SECRET: 'invented-client-secret',
    };
    expect(() => loadAppEnv(complete)).not.toThrow();
  });
});

describe('loadMigrateEnv and loadAdminBootstrapEnv (AC-3)', () => {
  it('reads the owner URL separately from the runtime URL', () => {
    expect(() => loadMigrateEnv({})).toThrow(EnvValidationError);
    const env = loadMigrateEnv({ MIGRATE_DATABASE_URL: 'postgresql://accucut_owner:invented@localhost:55432/accucut' });
    expect(env.MIGRATE_DATABASE_URL).toContain('accucut_owner');
  });

  it('needs a valid admin e-mail and a replaced password', () => {
    const error = problemsOf(() => loadAdminBootstrapEnv({ ADMIN_EMAIL: 'not-an-email', ADMIN_INITIAL_PASSWORD: 'CHANGE_ME_ADMIN_PASSWORD' }));
    expect(error.problems.map((problem) => problem.name)).toEqual(['ADMIN_EMAIL', 'ADMIN_INITIAL_PASSWORD']);
    expect(() => loadAdminBootstrapEnv({ ADMIN_EMAIL: 'admin@example.test', ADMIN_INITIAL_PASSWORD: 'invented-admin-password' })).not.toThrow();
  });
});

describe('default environment source', () => {
  it('reads process.env when no source is given', () => {
    const before = process.env['MIGRATE_DATABASE_URL'];
    process.env['MIGRATE_DATABASE_URL'] = 'postgresql://accucut_owner:invented@localhost:55432/accucut';
    try {
      expect(loadMigrateEnv().MIGRATE_DATABASE_URL).toContain('localhost');
      expect(() => loadAppEnv()).toThrow(EnvValidationError);
      expect(() => loadAdminBootstrapEnv()).toThrow(EnvValidationError);
    } finally {
      if (before === undefined) delete process.env['MIGRATE_DATABASE_URL'];
      else process.env['MIGRATE_DATABASE_URL'] = before;
    }
  });
});
