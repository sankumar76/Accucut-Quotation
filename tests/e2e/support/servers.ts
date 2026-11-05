/**
 * Where the two E2E servers listen and where the signed-in state is saved. Kept apart from `auth.ts` so the
 * Playwright configuration can read it without loading the database driver. No tests here.
 *
 * The ports are 3100 and 3101 unless `E2E_DEV_PORT` and `E2E_PRODUCTION_PORT` name others. On a shared machine a second
 * run (another worktree, QA's series) would otherwise find the ports taken and, locally, quietly reuse the other run's
 * server with the other run's database. Give each run its own pair when another may be running.
 */

const FIRST_UNPRIVILEGED_PORT = 1024;
const LAST_PORT = 65_535;

function portFrom(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < FIRST_UNPRIVILEGED_PORT || port > LAST_PORT) {
    throw new Error(`${name} must be a port number from ${FIRST_UNPRIVILEGED_PORT} to ${LAST_PORT}.`);
  }
  return port;
}

export const DEV_PORT = portFrom('E2E_DEV_PORT', 3100);
export const PRODUCTION_PORT = portFrom('E2E_PRODUCTION_PORT', 3101);
/** The server built with `next build`: the sign-in spec runs here (deferred issue #17). */
export const PRODUCTION_URL = `http://localhost:${PRODUCTION_PORT}`;
/** The development server: the design-system and page-frame specs run here, signed in. */
export const DEVELOPMENT_URL = `http://localhost:${DEV_PORT}`;
/** Where the set-up project saves the signed-in browser state that the other specs start from. */
export const SIGNED_IN_STATE = 'test-results/auth/lead.json';
/** Where the set-up project saves the signed-in Admin's browser state, for the Users spec (STORY-01.04). */
export const ADMIN_STATE = 'test-results/auth/admin.json';
