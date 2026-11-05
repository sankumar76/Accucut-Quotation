'use strict';

/**
 * Lighthouse CI configuration for the NFR-009 reference run (test strategy section 10.2; STORY-10.10 AC-6).
 *
 * Two profiles, chosen by LHCI_PROFILE (default "wifi"):
 *   wifi    the pass-or-fail profile: office Wi-Fi on a recent phone. LCP at most 2,000 ms and TBT at most 200 ms, each as
 *           the median of 5 runs, on the key screens listed in KEY_SCREENS.
 *   slow4g  the same settings on a slow mobile network, with no assertions: report only.
 *
 * KEY_SCREENS is empty until a key screen exists. Add one row (path and the role it is for) in the story that builds it:
 * masters, assign, queue, workspace, cost view. Pages in REPORTED_PAGES are measured and reported, never asserted;
 * the shell page "/" is the first (AC-9 baseline). Every page loads signed in as its role, through the puppeteer script.
 *
 * The browser is the Chromium that Playwright installs (`npx playwright install chromium`), so it changes only when
 * Playwright is upgraded. LHCI_BASE_URL is where the production server listens. Nothing is uploaded to a public server:
 * the reports are written to a folder, which the nightly workflow keeps as an artefact.
 */

const PROFILES = {
  wifi: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 4 },
  slow4g: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
};

const NUMBER_OF_RUNS = 5;
const MAX_LCP_MS = 2000;
const MAX_TBT_MS = 200;
const DEFAULT_BASE_URL = 'http://localhost:3000';
const SIGN_IN_SCRIPT = './scripts/lighthouse-sign-in.cjs';

/** The five key screens, as each comes into being: `{ path: '/queue', role: 'ADMIN' }`. */
const KEY_SCREENS = [];

/** Measured and reported, not asserted. */
const REPORTED_PAGES = [{ path: '/', role: 'ADMIN' }];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function chromePathFrom(env) {
  if (env.LHCI_CHROME_PATH) return env.LHCI_CHROME_PATH;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS file: require is its only import form
  return require('@playwright/test').chromium.executablePath();
}

function buildConfig({ profile, baseUrl, keyScreens, reportedPages, env }) {
  const throttling = PROFILES[profile];
  if (throttling === undefined) throw new Error(`LHCI_PROFILE must be one of: ${Object.keys(PROFILES).join(', ')}`);
  const origin = baseUrl.replace(/\/+$/, '');
  const urlOf = (screen) => `${origin}${screen.path}`;

  const ci = {
    collect: {
      url: [...keyScreens, ...reportedPages].map(urlOf),
      numberOfRuns: NUMBER_OF_RUNS,
      chromePath: chromePathFrom(env),
      puppeteerScript: SIGN_IN_SCRIPT,
      // The runner's kernel policy blocks Chromium's sandbox for an unprivileged user; this is an ephemeral runner
      // that loads only this application's own pages.
      puppeteerLaunchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
      settings: {
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 360, height: 800, deviceScaleFactor: 1.75, disabled: false },
        throttlingMethod: 'simulate',
        throttling,
        onlyCategories: ['performance'],
        // Keep the session cookie between the runs of a page (the sign-in is done once, before them).
        disableStorageReset: true,
      },
    },
    upload: { target: 'filesystem', outputDir: `lighthouse-reports/${profile}` },
  };

  if (profile === 'wifi' && keyScreens.length > 0) {
    ci.assert = {
      assertMatrix: keyScreens.map((screen) => ({
        matchingUrlPattern: `^${escapeRegExp(urlOf(screen))}$`,
        assertions: {
          'largest-contentful-paint': ['error', { maxNumericValue: MAX_LCP_MS, aggregationMethod: 'median' }],
          'total-blocking-time': ['error', { maxNumericValue: MAX_TBT_MS, aggregationMethod: 'median' }],
        },
      })),
    };
  }
  return { ci };
}

const config = buildConfig({
  profile: process.env.LHCI_PROFILE || 'wifi',
  baseUrl: process.env.LHCI_BASE_URL || DEFAULT_BASE_URL,
  keyScreens: KEY_SCREENS,
  reportedPages: REPORTED_PAGES,
  env: process.env,
});

// Lighthouse CI reads only `ci`; the rest is for the unit test and the sign-in script.
module.exports = { ci: config.ci, buildConfig, KEY_SCREENS, REPORTED_PAGES };
