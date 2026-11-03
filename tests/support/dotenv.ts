import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { assertSafeDatabaseTarget, type GuardEnvironment } from './db-guard';

/**
 * The tests and the wrong-database guard must see the same settings as `.env`, because Prisma reads
 * `.env` (prisma.config.ts) and the README tells a developer to copy `.env.example` to it (STD-06).
 * A variable that is already set is never overridden, so the shell and CI keep their values.
 */

export type MutableEnvironment = Record<string, string | undefined>;

/** Adds the variables of an env file that are not set yet. A missing file is not an error. */
export function loadDotEnvFile(path: string, target: MutableEnvironment): void {
  if (!existsSync(path)) return;
  for (const [name, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
    if (target[name] === undefined && value !== undefined) target[name] = value;
  }
}

/** Loads `.env` into `env`, then refuses a run that would touch the wrong database. */
export function prepareTestEnvironment(env: MutableEnvironment & GuardEnvironment, dotEnvPath = '.env'): void {
  loadDotEnvFile(dotEnvPath, env);
  assertSafeDatabaseTarget(env);
}
