/**
 * Guard against the wrong database (test plan sections 4.1 and 9.1, AC-10).
 *
 * A test run must never touch a live database. This pure function decides from the connection URL
 * and `NODE_ENV` alone, before any connection is opened, so a bad URL is refused without the host
 * being contacted. Allowed targets (assumption A-3):
 * - loopback (`localhost`, `127.0.0.1`, `::1`);
 * - the Compose service name of the development database (`db`);
 * - the CI Postgres service host (`postgres`);
 * - the staging project's host, given in `STAGING_DB_HOST`.
 *
 * Fail closed: a URL that cannot be read, or has no host, is refused. The refusal message names the
 * rule and the host. It never prints the URL, the user name or the password.
 */

/** Variables that may carry a test database connection. */
export const DATABASE_URL_VARIABLES = ['DATABASE_URL', 'MIGRATE_DATABASE_URL'] as const;

const LOOPBACK_HOSTS: ReadonlyArray<string> = ['localhost', '127.0.0.1', '::1'];
const COMPOSE_SERVICE_HOST = 'db';
const CI_SERVICE_HOST = 'postgres';
const POSTGRES_PROTOCOLS: ReadonlyArray<string> = ['postgresql:', 'postgres:'];

export class DatabaseGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseGuardError';
    // A refusal is a policy decision, not a bug, so it needs no stack trace. Dropping it also keeps
    // the runner from rewriting frames through source maps, which hid this message behind an
    // unrelated "code.charCodeAt is not a function" start-up error (Vitest 5, Windows).
    this.stack = `${this.name}: ${message}`;
  }
}

export interface GuardEnvironment {
  readonly NODE_ENV?: string | undefined;
  readonly STAGING_DB_HOST?: string | undefined;
  readonly DATABASE_URL?: string | undefined;
  readonly MIGRATE_DATABASE_URL?: string | undefined;
}

const RULE =
  'Tests may only use a local, CI or staging database and never NODE_ENV=production (test plan 4.1).';

function normaliseHost(hostname: string): string {
  const unbracketed = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  return unbracketed.toLowerCase();
}

/**
 * Every host the URL could connect to, including every libpq `host=` override in the query string.
 * `getAll`, not `get`: with `?host=a&host=b` the driver keeps the last one, so all must be checked.
 */
function hostsOf(url: URL): string[] {
  return [url.hostname, ...url.searchParams.getAll('host')].map(normaliseHost);
}

function allowedHosts(env: GuardEnvironment): ReadonlyArray<string> {
  const staging = env.STAGING_DB_HOST?.trim().toLowerCase();
  const fixed = [...LOOPBACK_HOSTS, COMPOSE_SERVICE_HOST, CI_SERVICE_HOST];
  return staging === undefined || staging === '' ? fixed : [...fixed, staging];
}

function assertAllowedUrl(name: string, value: string, allowed: ReadonlyArray<string>): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DatabaseGuardError(`Refusing to run: ${name} is not a readable connection URL. ${RULE}`);
  }
  if (!POSTGRES_PROTOCOLS.includes(url.protocol)) {
    throw new DatabaseGuardError(`Refusing to run: ${name} is not a PostgreSQL URL. ${RULE}`);
  }
  for (const host of hostsOf(url)) {
    if (host === '' || !allowed.includes(host)) {
      const shown = host === '' ? '(none)' : host;
      throw new DatabaseGuardError(
        `Refusing to run: ${name} points at host "${shown}", which is not local, CI or staging. ${RULE} The connection string was not printed.`,
      );
    }
  }
}

/**
 * Throws `DatabaseGuardError` unless it is safe to run tests. Call it before any suite connects.
 * A run with no database URL set (unit tests only) passes the host check but not the production check.
 */
export function assertSafeDatabaseTarget(env: GuardEnvironment): void {
  if (env.NODE_ENV === 'production') {
    throw new DatabaseGuardError(`Refusing to run: NODE_ENV is "production". ${RULE}`);
  }
  const allowed = allowedHosts(env);
  for (const name of DATABASE_URL_VARIABLES) {
    const value = env[name];
    if (value !== undefined && value !== '') assertAllowedUrl(name, value, allowed);
  }
}
