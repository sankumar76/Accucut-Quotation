/**
 * The invented Admin that the performance checks sign in as (STORY-10.10; G6 STD-01, STD-02, QLT-45).
 *
 * Two rules live here so a unit test can hold them:
 *   - the database must be one that is thrown away: the same machine, the Compose service or the CI service. Not staging,
 *     which the test guard also allows, because this user has a cheap password hash and no forced password change;
 *   - the portal allows one active Admin. If another Admin is already there (the one `bootstrap-admin` made), this user
 *     cannot be added, and the message says what to do instead of failing with a database error.
 * Nothing here prints a password.
 */
import type { PasswordHasher } from '../../src/server/auth/password-hasher';
import type { UserRepository } from '../../src/server/repositories/user-repository';

/** Hosts of a database that exists only for a run or for one developer's machine. No staging host, whatever `STAGING_DB_HOST` says. */
export const THROWAWAY_DATABASE_HOSTS: ReadonlyArray<string> = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'];
const POSTGRES_PROTOCOLS: ReadonlyArray<string> = ['postgresql:', 'postgres:'];

export class MeasurementUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeasurementUserError';
  }
}

/** Throws unless `url` is a PostgreSQL address on a throwaway host (every `host=` override in the query counts too). The URL is never printed. */
export function assertThrowawayDatabase(url: string, nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') throw new MeasurementUserError('NODE_ENV is "production"; this script makes a test user and runs only against a throwaway database');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MeasurementUserError('DATABASE_URL is not a readable connection URL');
  }
  if (!POSTGRES_PROTOCOLS.includes(parsed.protocol)) throw new MeasurementUserError('DATABASE_URL is not a PostgreSQL URL');
  const hosts = [parsed.hostname, ...parsed.searchParams.getAll('host')].map((host) => (host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host).toLowerCase());
  for (const host of hosts) {
    if (!THROWAWAY_DATABASE_HOSTS.includes(host)) {
      throw new MeasurementUserError(`DATABASE_URL points at host "${host === '' ? '(none)' : host}", which is not a throwaway database (allowed: ${THROWAWAY_DATABASE_HOSTS.join(', ')}). Staging is never allowed`);
    }
  }
}

export const ADMIN_EXISTS_MESSAGE =
  'another Admin already exists in this database and the portal allows one active Admin, so the measurement user cannot be added. ' +
  'Use a fresh throwaway database, or leave this script out and set MEASUREMENT_ADMIN_EMAIL and MEASUREMENT_ADMIN_PASSWORD to that Admin\'s own sign-in (it must not be forced to change its password).';

export type EnsureOutcome = 'created' | 'exists';

/** Makes the measurement Admin unless that e-mail already has a user. Fails with a clear message when another Admin holds the one place. */
export async function ensureMeasurementUser(
  users: Pick<UserRepository, 'findCredentialsByEmail' | 'hasAnyAdmin' | 'create'>,
  hasher: Pick<PasswordHasher, 'hash'>,
  input: { readonly email: string; readonly password: string },
): Promise<EnsureOutcome> {
  if ((await users.findCredentialsByEmail(input.email)) !== null) return 'exists';
  if (await users.hasAnyAdmin()) throw new MeasurementUserError(ADMIN_EXISTS_MESSAGE);
  await users.create({
    name: 'Measurement Admin',
    email: input.email,
    passwordHash: await hasher.hash(input.password),
    role: 'ADMIN',
    mustChangePassword: false,
  });
  return 'created';
}
