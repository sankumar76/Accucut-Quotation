import { assertSafeDatabaseTarget } from './db-guard';

/**
 * Vitest `globalSetup`: runs once before any suite, so a wrong database is refused before a test can
 * connect to it (AC-10). The decision itself lives in `db-guard.ts` so it can be tested directly.
 */
export default function setup(): void {
  assertSafeDatabaseTarget(process.env);
}
