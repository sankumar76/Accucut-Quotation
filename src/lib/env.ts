import { z } from 'zod';

import { ConfigurationError } from './errors';

/**
 * Environment validation (architecture section 8 "Secrets", NFR-006).
 *
 * Settings come from environment variables only. A process validates the group it needs when it
 * starts and stops at once if one is missing or invalid. The error names the variable and the kind of
 * problem; it never prints a value, because a value may be a secret and logs of a public repository's
 * CI are public.
 */

/** A template value that must be replaced before use (see `.env.example`). */
export const PLACEHOLDER_PREFIX = 'CHANGE_ME';

/** Every variable of architecture section 8 "Secrets". `.env.example` lists exactly these. */
export const ENV_VARIABLE_NAMES = [
  'DATABASE_URL',
  'MIGRATE_DATABASE_URL',
  'AUTH_SECRET',
  'APP_ORIGIN',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_AUTH_MODE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_OAUTH_TENANT_ID',
  'SMTP_OAUTH_CLIENT_ID',
  'SMTP_OAUTH_CLIENT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_INITIAL_PASSWORD',
] as const;

export type EnvVariableName = (typeof ENV_VARIABLE_NAMES)[number];

/**
 * The settings that carry a credential or a connection string with one. The logger redacts these by
 * name, so a configuration object that is logged by mistake does not print them (STD-04).
 */
export const SECRET_ENV_VARIABLE_NAMES = [
  'DATABASE_URL',
  'MIGRATE_DATABASE_URL',
  'AUTH_SECRET',
  'SMTP_PASSWORD',
  'SMTP_OAUTH_CLIENT_SECRET',
  'ADMIN_INITIAL_PASSWORD',
] as const satisfies ReadonlyArray<EnvVariableName>;

/** Minimum length of `AUTH_SECRET`, in characters. */
export const AUTH_SECRET_MIN_LENGTH = 32;

/** The highest TCP port number. */
export const MAX_TCP_PORT = 65_535;

const notPlaceholder = (value: string): boolean => !value.startsWith(PLACEHOLDER_PREFIX);

const secret = (minLength = 1) => z.string().min(minLength).refine(notPlaceholder);

function isPostgresUrl(value: string): boolean {
  if (value.includes(PLACEHOLDER_PREFIX)) return false;
  try {
    const { protocol, hostname } = new URL(value);
    return (protocol === 'postgresql:' || protocol === 'postgres:') && hostname.length > 0;
  } catch {
    return false;
  }
}

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

const postgresUrl = z.string().refine(isPostgresUrl);

const smtpBase = { SMTP_HOST: z.string().min(1), SMTP_PORT: z.coerce.number().int().min(1).max(MAX_TCP_PORT) };

/** Mail sign-in modes (architecture section 4.7): one variant per mode, so a mode cannot lack its fields. */
const smtpSchema = z.discriminatedUnion('SMTP_AUTH_MODE', [
  z.object({ SMTP_AUTH_MODE: z.literal('none'), ...smtpBase }),
  z.object({
    SMTP_AUTH_MODE: z.literal('password'),
    ...smtpBase,
    SMTP_USER: z.string().min(1),
    SMTP_PASSWORD: secret(),
  }),
  z.object({
    SMTP_AUTH_MODE: z.literal('oauth2-client-credentials'),
    ...smtpBase,
    SMTP_USER: z.string().min(1),
    SMTP_OAUTH_TENANT_ID: z.string().min(1),
    SMTP_OAUTH_CLIENT_ID: z.string().min(1),
    SMTP_OAUTH_CLIENT_SECRET: secret(),
  }),
]);

/** Needed by `app` and `worker`. */
export const appEnvSchema = z.intersection(
  z.object({
    DATABASE_URL: postgresUrl,
    AUTH_SECRET: secret(AUTH_SECRET_MIN_LENGTH),
    APP_ORIGIN: z.string().refine(isOrigin),
  }),
  smtpSchema,
);

/** The portal's own origin alone, for the proxy (G6 STD-03): redirects are built from it, never from a request header. */
export const originEnvSchema = z.object({ APP_ORIGIN: z.string().refine(isOrigin) });

/** Needed by anything that opens the runtime database client: the database URL alone (`getPrismaClient`, scripts). */
export const databaseEnvSchema = z.object({ DATABASE_URL: postgresUrl });

/** Needed by the `migrate` step only. The owner role never reaches `app` or `worker`. */
export const migrateEnvSchema = z.object({ MIGRATE_DATABASE_URL: postgresUrl });

/** Read once by `bootstrap:admin`. */
export const adminBootstrapEnvSchema = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_INITIAL_PASSWORD: secret(),
});

export type AppEnv = z.infer<typeof appEnvSchema>;
export type OriginEnv = z.infer<typeof originEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type MigrateEnv = z.infer<typeof migrateEnvSchema>;
export type AdminBootstrapEnv = z.infer<typeof adminBootstrapEnvSchema>;

export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface EnvProblem {
  readonly name: string;
  readonly reason: 'missing' | 'invalid';
}

export class EnvValidationError extends ConfigurationError {
  readonly problems: ReadonlyArray<EnvProblem>;

  constructor(problems: ReadonlyArray<EnvProblem>) {
    const list = problems.map((problem) => `${problem.name} (${problem.reason})`).join(', ');
    super(`Invalid environment: ${list}. Check .env against .env.example.`, { code: 'ENV_INVALID' });
    this.problems = problems;
  }
}

/** An empty value counts as not set, so `SMTP_USER=` in a template behaves like an absent line. */
function withoutEmptyValues(source: EnvSource): Record<string, string> {
  const entries = Object.entries(source).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '',
  );
  return Object.fromEntries(entries);
}

/**
 * Validates `source` against `schema`. On failure throws `EnvValidationError`, which lists variable
 * names and `missing` or `invalid`, never a value (zod's own messages are deliberately not used).
 */
export function parseEnv<Schema extends z.ZodType>(schema: Schema, source: EnvSource): z.output<Schema> {
  const cleaned = withoutEmptyValues(source);
  const result = schema.safeParse(cleaned);
  if (result.success) return result.data;

  const seen = new Map<string, EnvProblem>();
  for (const issue of result.error.issues) {
    const name = String(issue.path[0] ?? 'environment');
    if (seen.has(name)) continue;
    seen.set(name, { name, reason: cleaned[name] === undefined ? 'missing' : 'invalid' });
  }
  throw new EnvValidationError([...seen.values()]);
}

export function loadAppEnv(source: EnvSource = process.env): AppEnv {
  return parseEnv(appEnvSchema, source);
}

export function loadOriginEnv(source: EnvSource = process.env): OriginEnv {
  return parseEnv(originEnvSchema, source);
}

export function loadDatabaseEnv(source: EnvSource = process.env): DatabaseEnv {
  return parseEnv(databaseEnvSchema, source);
}

export function loadMigrateEnv(source: EnvSource = process.env): MigrateEnv {
  return parseEnv(migrateEnvSchema, source);
}

export function loadAdminBootstrapEnv(source: EnvSource = process.env): AdminBootstrapEnv {
  return parseEnv(adminBootstrapEnvSchema, source);
}
