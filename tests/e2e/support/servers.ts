/**
 * Where the two E2E servers listen and where the signed-in state is saved. Kept apart from `auth.ts` so the
 * Playwright configuration can read it without loading the database driver. No tests here.
 */

export const DEV_PORT = 3100;
export const PRODUCTION_PORT = 3101;
/** The server built with `next build`: the sign-in spec runs here (deferred issue #17). */
export const PRODUCTION_URL = `http://localhost:${PRODUCTION_PORT}`;
/** The development server: the design-system and page-frame specs run here, signed in. */
export const DEVELOPMENT_URL = `http://localhost:${DEV_PORT}`;
/** Where the set-up project saves the signed-in browser state that the other specs start from. */
export const SIGNED_IN_STATE = 'test-results/auth/lead.json';
