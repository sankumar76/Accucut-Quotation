import { prepareTestEnvironment } from './dotenv';

/**
 * Vitest `globalSetup`: runs once before any suite, so a wrong database is refused before a test can
 * connect to it (AC-10). It loads `.env` first, so the guard judges the settings Prisma will use. The
 * decision itself lives in `db-guard.ts` so it can be tested directly; tests/unit/global-setup-wiring
 * proves this file is the one Vitest runs.
 */
export default function setup(): void {
  prepareTestEnvironment(process.env);
}
