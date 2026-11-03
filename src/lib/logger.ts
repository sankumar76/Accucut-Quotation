import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

import { type EnvVariableName, SECRET_ENV_VARIABLE_NAMES } from './env';

/**
 * Structured JSON logs to stdout (architecture section 9.4, NFR-024).
 *
 * Redaction is by field name, one level deep for the wildcard forms. Log shallow objects: put a
 * request's headers under `req.headers`, not deeper. Never log an estimate's `inputs`, `outputs` or a
 * rate on purpose; the redaction is the safety net, not the plan.
 *
 * Redaction costs about 190 microseconds for a line that carries every redacted key (measured in review,
 * PRF-05). Rule: no per-node or per-row logging at info. A 500-node recalculation would spend about
 * 5 percent of its 2 second budget on it.
 */

export const REDACTED_VALUE = '[Redacted]';

/**
 * Settings that identify a person or a tenant rather than carry a credential (coding standards section 4,
 * STD-23). They are redacted by their own names, as the secret settings are, so a logged configuration
 * object does not print an address or a tenant.
 */
export const PERSONAL_SETTING_NAMES = [
  'ADMIN_EMAIL',
  'SMTP_USER',
  'SMTP_OAUTH_TENANT_ID',
  'SMTP_OAUTH_CLIENT_ID',
] as const satisfies ReadonlyArray<EnvVariableName>;

export const REDACTED_PATHS: ReadonlyArray<string> = [
  // Request and response secrets.
  'cookie',
  'authorization',
  'headers.cookie',
  'headers.authorization',
  'req.headers.cookie',
  'req.headers.authorization',
  'headers["set-cookie"]',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',
  // Credentials.
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'apiKey',
  '*.apiKey',
  'clientSecret',
  '*.clientSecret',
  // This project's own secret settings, by name: a logged config object must not print them.
  ...SECRET_ENV_VARIABLE_NAMES,
  ...SECRET_ENV_VARIABLE_NAMES.map((name) => `*.${name}`),
  // Personal data (coding standards section 4).
  'email',
  '*.email',
  ...PERSONAL_SETTING_NAMES,
  ...PERSONAL_SETTING_NAMES.map((name) => `*.${name}`),
  // Estimate data that Engineers must never receive (NFR-002).
  'inputs',
  '*.inputs',
  'outputs',
  '*.outputs',
  // Rates are Restricted.
  'rate',
  '*.rate',
  'rates',
  '*.rates',
];

export function createLogger(options: LoggerOptions = {}, destination?: DestinationStream): Logger {
  const settings: LoggerOptions = {
    level: 'info',
    ...options,
    redact: { paths: [...REDACTED_PATHS], censor: REDACTED_VALUE },
  };
  return destination === undefined ? pino(settings) : pino(settings, destination);
}

/** The shared logger. Use this instead of `console.log`. */
export const logger: Logger = createLogger();
