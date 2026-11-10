import { existsSync } from 'node:fs';

import { defineConfig } from '@playwright/test';

import { NEGATIVE_CONTROL_ENV_NAME } from './src/lib/negative-control-gate';
import { NEGATIVE_CONTROL_SENTINEL } from './tests/support/canary-masters';
import { DEV_PORT, PRODUCTION_PORT, SIGNED_IN_STATE } from './tests/e2e/support/servers';

/**
 * End-to-end configuration: Chromium at three screen sizes (test strategy sections 2 and 9, NFR-016).
 * Mobile 360x800, tablet 768x1024, desktop 1366x768. One retry, reported (test strategy section 10).
 * CI stage 12 runs this suite.
 *
 * Two servers, because two things must be true (deferred issue #17, DL-053):
 *   - the sign-in journey runs against the PRODUCTION build (`next start`), the artefact that ships, so its
 *     timings and its cookie flags mean something. `/design-system` is hidden in any production build by ruling, so
 *   - the design-system and page-frame specs keep running against the development server, signed in.
 * A spec chooses its server with `test.use({ baseURL })` (the sign-in spec uses `PRODUCTION_URL`).
 *
 * The database is a real one (the sign-in journey reads `users`): `DATABASE_URL` comes from the environment, CI sets
 * it to its throwaway database, and a developer's `.env` is read as `prisma.config.ts` reads it. Only when it is not
 * set at all is an invented URL used, and then the first test that needs the database fails with a clear message.
 * The set-up project refuses any database that is not local, CI or staging (`tests/support/db-guard.ts`).
 */

if (existsSync('.env')) process.loadEnvFile('.env');

const IN_CI = Boolean(process.env['CI']);
const CI_WORKERS = 4;
const LOCAL_WORKERS = 2;

// Tests that read no layout carry this tag and run at one width, in the desktop project only (test strategy section
// 10.5). Only four spec files may carry it; tests/unit/one-width-tag.test.ts fails if it appears anywhere else.
const ONE_WIDTH = /@one-width/;

// Specs whose tests set their own widths and skip unless the project is `desktop` (`test.skip(project.name !== 'desktop')`).
// They run once, in desktop. `mobile` and `tablet` do not list them: `--shard` divides LISTED tests, and the skipped entries
// filled shards 1 and 2 with work that never runs while shard 3, which holds the desktop block, did it (STORY-10.20, AQP-244;
// test strategy section 10.5 item 9). A file joins this list only after a ruling there; tests/unit/own-width-files.test.ts
// guards the list against the specs' own skip lines and against Playwright's listing.
const OWN_WIDTH_FILES = ['aqp-234-qa.spec.ts', 'masters-table-actions.spec.ts'];

// Invented values so the app's start-up check (src/lib/env.ts) passes. `DATABASE_URL` is the real one when it is set.
const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://accucut_app:invented-e2e-password@localhost:55432/accucut';
const serverEnvironment = (port: number) => ({
  DATABASE_URL,
  AUTH_SECRET: 'invented-e2e-auth-secret-0123456789-abcdef',
  APP_ORIGIN: `http://localhost:${port}`,
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_AUTH_MODE: 'none',
  // The sentinel of the scan's negative control (STORY-01.03 AC-4). `/api/test-only/leak` serves it only under NODE_ENV=test. Next.js
  // replaces `process.env.NODE_ENV` in the route's gate at build time, so in these servers' bundles the check is a constant and both
  // answer 404 (src/lib/negative-control-gate.ts). The sentinel is set anyway: the spec then shows that the build, not the lack of a
  // sentinel, is what keeps the route absent.
  [NEGATIVE_CONTROL_ENV_NAME]: NEGATIVE_CONTROL_SENTINEL,
});

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.{spec,setup}.ts',
  fullyParallel: true,
  forbidOnly: IN_CI,
  retries: 1,
  // Four workers in CI (a public repository's ubuntu-latest runner has 4 vCPU and 16 GB; test strategy section 10.5,
  // AQP-199), two everywhere else: the development server compiles on demand, and more workers than two made a slow
  // laptop exceed a test's 30 s on first requests (G6 PRF-06). The set-up project warms the dev-server routes first.
  // If four workers ever make a test flaky, lower this to 3; never widen a timeout.
  workers: IN_CI ? CI_WORKERS : LOCAL_WORKERS,
  // A sign-in hashes a password (about 250 ms of work) and three screen sizes run at once, so on a busy machine the
  // default 5 s for an expectation was too tight for a page change after "Sign in" (DEF-003 family: a wait for an event,
  // not a limit on speed; the tests assert what happened, not how fast).
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${DEV_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    // Creates the invented E2E users in the database and saves a signed-in Lead's browser state.
    { name: 'setup', testMatch: '**/auth.setup.ts', use: { browserName: 'chromium' } },
    {
      name: 'mobile',
      grepInvert: ONE_WIDTH,
      dependencies: ['setup'],
      testIgnore: ['**/auth.setup.ts', ...OWN_WIDTH_FILES.map((file) => `**/${file}`)],
      use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, hasTouch: true, storageState: SIGNED_IN_STATE },
    },
    {
      name: 'tablet',
      grepInvert: ONE_WIDTH,
      dependencies: ['setup'],
      testIgnore: ['**/auth.setup.ts', ...OWN_WIDTH_FILES.map((file) => `**/${file}`)],
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true, storageState: SIGNED_IN_STATE },
    },
    {
      name: 'desktop',
      dependencies: ['setup'],
      testIgnore: ['**/auth.setup.ts', '**/masters-table-actions.spec.ts'],
      use: { browserName: 'chromium', viewport: { width: 1366, height: 768 }, storageState: SIGNED_IN_STATE },
    },
  ],
  webServer: [
    {
      command: `npx next dev --port ${DEV_PORT}`,
      // Ready when the page the set-up project signs in on has compiled: the development server compiles a page on
      // its first request, which took longer than a test's 30 s when three projects asked at once on a slow machine.
      url: `http://localhost:${DEV_PORT}/sign-in`,
      reuseExistingServer: !IN_CI,
      timeout: 120_000,
      env: serverEnvironment(DEV_PORT),
    },
    {
      // CI stage 9 has built the sources already; a developer's run builds first, so it never tests a stale build.
      command: IN_CI ? `npx next start --port ${PRODUCTION_PORT}` : `npx next build && npx next start --port ${PRODUCTION_PORT}`,
      url: `http://localhost:${PRODUCTION_PORT}/sign-in`,
      reuseExistingServer: !IN_CI,
      timeout: 300_000,
      env: serverEnvironment(PRODUCTION_PORT),
    },
  ],
});
