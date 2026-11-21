// First: the sweep's helpers address the portal over HTTPS (see the file), and `servers.ts` reads that when it is first loaded.
import './tests/e2e-sweep/support/https-origin';

import { existsSync } from 'node:fs';

import { defineConfig, type PlaywrightTestProject } from '@playwright/test';

import { DEV_PORT, DEVELOPMENT_URL, E2E_AUTH_SECRET } from './tests/e2e/support/servers';

/**
 * The sweep, the keyboard-only flows and the browser matrix (STORY-10.08, AQP-370; NFR-016, NFR-018, NFR-019; test strategy sections 4, 9 and 10.9).
 *
 * It is a configuration of its own, with its own folder (`tests/e2e-sweep`), so the required check "Stages 1 to 11" and its four shards are untouched: `playwright.config.ts`
 * lists `tests/e2e` only, picks up none of these specs, and has no `firefox` or `webkit` project. This configuration runs in the nightly job "Sweep, keyboard flows and browsers"
 * of `.github/workflows/nightly.yml`, by schedule and by hand, never in a pull request's required check. A developer's PC is short of memory, so it is not run there either.
 *
 * What runs where (`SWEEP_PROJECTS` below is read by tests/unit/sweep-config.test.ts, which pins it):
 *   - `chromium-360`, `chromium-768`, `chromium-1366`: the sweep (`screens.spec.ts`: every implemented page of the route manifest, as every role it allows, at the three widths of
 *     SPEC section 14 item 13, with the no-sideways-scroll check, the declared primary actions and axe). The 360 and 1366 projects also run the journeys (`browsers.spec.ts`) and the
 *     keyboard-only flows (`keyboard-flows.spec.ts`); the 1366 project alone runs the once-per-page check of the "no access" card (`no-access.spec.ts`).
 *   - `chromium-sizes`: the no-sideways-scroll check at the other sizes of NFR-016 (`sizes.spec.ts`).
 *   - `firefox-360`, `firefox-1366`, `webkit-360`, `webkit-1366`: the journeys, in the two other engines (NFR-019).
 *
 * One portal: the PRODUCTION build (`next start`) on an internal port, behind a TLS front on the port the helpers of tests/e2e/support already name as the portal's own origin (`DEV_PORT`), so the
 * browsers use `https://localhost:<DEV_PORT>`. The production build sets its session cookie Secure, and WebKit on Linux does not keep a Secure cookie that comes over plain http, so over http no
 * WebKit journey could sign in (run 44931496595); real Safari is always on HTTPS. The front passes every request through unchanged (`scripts/lib/tls-front.ts`), the portal's `APP_ORIGIN` is the
 * https address, and every engine uses it. The database is the job's own and `DATABASE_URL` comes from the environment, as in `playwright.config.ts`. One retry, reported; no other retry (AC-8).
 */

if (existsSync('.env')) process.loadEnvFile('.env');

const IN_CI = Boolean(process.env['CI']);
const CI_WORKERS = 4;
const LOCAL_WORKERS = 2;

/** The port `next start` listens on behind the TLS front. */
const UPSTREAM_PORT = Number(process.env['E2E_SWEEP_UPSTREAM_PORT'] ?? DEV_PORT + 98);
if (!Number.isInteger(UPSTREAM_PORT) || UPSTREAM_PORT === DEV_PORT) throw new Error('E2E_SWEEP_UPSTREAM_PORT must be a port number other than the one the portal itself uses.');

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://accucut_app:invented-e2e-password@localhost:55432/accucut';

/** The three widths of the sweep (SPEC section 14 item 13). */
const MOBILE = { width: 360, height: 800 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1366, height: 768 };

type Engine = 'chromium' | 'firefox' | 'webkit';

const SCREENS = '**/screens.spec.ts';
const NO_ACCESS = '**/no-access.spec.ts';
const KEYBOARD = '**/keyboard-flows.spec.ts';
const JOURNEYS = '**/browsers.spec.ts';
const SIZES = '**/sizes.spec.ts';
const SETUP = '**/sweep.setup.ts';

/** One project of the matrix: the engine, the width (null for the set-up and the sizes projects) and the spec files it runs. */
interface SweepProject {
  readonly name: string;
  readonly engine: Engine;
  readonly viewport: { readonly width: number; readonly height: number } | null;
  readonly runs: ReadonlyArray<string>;
}

/** Project names and what each one runs, in one place for the guard test (tests/unit/sweep-config.test.ts). */
export const SWEEP_PROJECTS: ReadonlyArray<SweepProject> = [
  { name: 'setup', engine: 'chromium', viewport: null, runs: [SETUP] },
  { name: 'chromium-360', engine: 'chromium', viewport: MOBILE, runs: [SCREENS, JOURNEYS, KEYBOARD] },
  { name: 'chromium-768', engine: 'chromium', viewport: TABLET, runs: [SCREENS] },
  { name: 'chromium-1366', engine: 'chromium', viewport: DESKTOP, runs: [SCREENS, NO_ACCESS, JOURNEYS, KEYBOARD] },
  { name: 'chromium-sizes', engine: 'chromium', viewport: DESKTOP, runs: [SIZES] },
  { name: 'firefox-360', engine: 'firefox', viewport: MOBILE, runs: [JOURNEYS] },
  { name: 'firefox-1366', engine: 'firefox', viewport: DESKTOP, runs: [JOURNEYS] },
  { name: 'webkit-360', engine: 'webkit', viewport: MOBILE, runs: [JOURNEYS] },
  { name: 'webkit-1366', engine: 'webkit', viewport: DESKTOP, runs: [JOURNEYS] },
];

function toPlaywrightProject(project: SweepProject): PlaywrightTestProject {
  if (project.name === 'setup') return { name: project.name, testMatch: [...project.runs], use: { browserName: project.engine } };
  const viewport = project.viewport ?? DESKTOP;
  // A touch screen only for the two narrow widths of Chromium, as `playwright.config.ts` does for its mobile and tablet projects (Firefox has no touch emulation).
  const touch = project.engine === 'chromium' && viewport.width < 1024 ? { hasTouch: true } : {};
  return { name: project.name, testMatch: [...project.runs], dependencies: ['setup'], use: { browserName: project.engine, viewport: { ...viewport }, ...touch } };
}

export default defineConfig({
  testDir: './tests/e2e-sweep',
  testMatch: '**/*.{spec,setup}.ts',
  fullyParallel: true,
  forbidOnly: IN_CI,
  retries: 1,
  workers: IN_CI ? CI_WORKERS : LOCAL_WORKERS,
  // A page of a production build answers fast, but three engines share four workers and the first request of a route loads its module; the sweep's own tests are not
  // timed, they assert what happened (the same reasoning as playwright.config.ts).
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/sweep',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/sweep' }], ['json', { outputFile: 'test-results/sweep-results.json' }]],
  use: {
    baseURL: DEVELOPMENT_URL,
    // The TLS front's certificate is self-signed and made for the run.
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: SWEEP_PROJECTS.map(toPlaywrightProject),
  webServer: [
    {
      // CI builds before this step (the job's build step); a developer's run builds first, so it never tests a stale build.
      command: IN_CI ? `npx next start --port ${UPSTREAM_PORT}` : `npx next build && npx tsx scripts/build-export-worker.ts && npx next start --port ${UPSTREAM_PORT}`,
      url: `http://localhost:${UPSTREAM_PORT}/sign-in`,
      reuseExistingServer: !IN_CI,
      timeout: 300_000,
      env: {
        DATABASE_URL,
        AUTH_SECRET: E2E_AUTH_SECRET,
        APP_ORIGIN: DEVELOPMENT_URL,
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        SMTP_AUTH_MODE: 'none',
        // The longer keep-alive of the other E2E servers (AQP-340): a `page.request` call is never reset on a connection the server is closing.
        NODE_OPTIONS: [process.env['NODE_OPTIONS'], '--require ./tests/e2e/support/server-keep-alive.cjs'].filter((option) => option !== undefined && option !== '').join(' '),
      },
    },
    {
      // The TLS front: the browsers' address, passing to the server above. Ready when the portal answers through it.
      command: 'npx tsx scripts/sweep-tls-front.ts',
      url: `${DEVELOPMENT_URL}/sign-in`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: !IN_CI,
      timeout: 60_000,
      env: { SWEEP_TLS_PORT: String(DEV_PORT), SWEEP_UPSTREAM_PORT: String(UPSTREAM_PORT) },
    },
  ],
});
