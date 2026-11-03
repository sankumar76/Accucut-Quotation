import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';

import { SECRET_ENV_VARIABLE_NAMES } from './env';

/**
 * Structured JSON logs to stdout (architecture section 9.4, NFR-024).
 *
 * Redaction is by field name, one level deep for the wildcard forms. Log shallow objects: put a
 * request's headers under `req.headers`, not deeper. Never log an estimate's `inputs`, `outputs` or a
 * rate on purpose; the redaction is the safety net, not the plan.
 */

export const REDACTED_VALUE = '[Redacted]';

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
