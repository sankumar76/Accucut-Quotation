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

/**
 * The mail feature flag (STORY-09.01 AC-6): `on` schedules the worker's mail jobs, `off` (the default, also when the line is absent or empty) does not. It is read by the worker only; the
 * Settings test e-mail does not depend on it, because it is how the IT person proves the mailbox before the flag is turned on. It is not a secret, so it is not in `ENV_VARIABLE_NAMES`.
 */
export const featureEnvSchema = z.object({ FEATURE_EMAIL: z.enum(['on', 'off']).default('off') });

/** The shortest and the longest time limit an export may be given, and the one that ships (ADR-017: 3.5 times the slowest measured run of 67.4 s). */
export const EXPORT_TIMEOUT_MIN_SECONDS = 120;
export const EXPORT_TIMEOUT_MAX_SECONDS = 300;
export const EXPORT_TIMEOUT_DEFAULT_SECONDS = 240;

/**
 * The export's time limit in seconds (ADR-017 decision 1, #575). Unlike the pool sizes it depends on the host, and the reading that sets it may come after the freeze, so it is one line in `.env`.
 * It is not a secret and is not in `ENV_VARIABLE_NAMES` (like `FEATURE_EMAIL`). Absent or empty gives 240; a value outside 120 to 300, or one that is not a whole number, stops the start.
 */
export const exportEnvSchema = z.object({
  EXPORT_TIMEOUT_SECONDS: z.coerce.number().int().min(EXPORT_TIMEOUT_MIN_SECONDS).max(EXPORT_TIMEOUT_MAX_SECONDS).default(EXPORT_TIMEOUT_DEFAULT_SECONDS),
});

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
/** The mail sign-in settings alone, one variant per `SMTP_AUTH_MODE` (the part of `AppEnv` that `src/server/mail/transport.ts` reads). */
export type SmtpEnv = z.infer<typeof smtpSchema>;
export type OriginEnv = z.infer<typeof originEnvSchema>;
export type ExportEnv = z.infer<typeof exportEnvSchema>;
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

/** True when `FEATURE_EMAIL=on`. A value other than `on` or `off` stops the process at start-up, like any other invalid setting. */
export function loadEmailFeature(source: EnvSource = process.env): boolean {
  return parseEnv(featureEnvSchema, source).FEATURE_EMAIL === 'on';
}

export function loadExportEnv(source: EnvSource = process.env): ExportEnv {
  return parseEnv(exportEnvSchema, source);
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
