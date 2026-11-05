'use strict';

/**
 * Signs in before a page is measured (STORY-10.10 AC-6). Lighthouse CI calls this once per URL, before the 5 runs, with
 * the browser it launched; `disableStorageReset` in lighthouserc.cjs keeps the session cookie for the runs.
 *
 * The role of a page comes from the key-screen table in lighthouserc.cjs (the Admin for a page not in it). The e-mail and
 * password of a role are MEASUREMENT_<ROLE>_EMAIL and MEASUREMENT_<ROLE>_PASSWORD: invented values made in the job for its
 * throwaway database (`npx tsx scripts/ensure-measurement-user.ts` makes the Admin). Neither is ever printed.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS file: require is its only import form
const { KEY_SCREENS, REPORTED_PAGES } = require('../lighthouserc.cjs');

const SIGN_IN_TIMEOUT_MS = 30000;

function roleOf(url) {
  const pathname = new URL(url).pathname;
  const screen = [...KEY_SCREENS, ...REPORTED_PAGES].find((entry) => entry.path === pathname);
  return screen === undefined ? 'ADMIN' : screen.role;
}

function credentialsOf(role) {
  const email = process.env[`MEASUREMENT_${role}_EMAIL`];
  const password = process.env[`MEASUREMENT_${role}_PASSWORD`];
  if (!email || !password) throw new Error(`MEASUREMENT_${role}_EMAIL and MEASUREMENT_${role}_PASSWORD must be set to sign in as ${role}`);
  return { email, password };
}

module.exports = async (browser, context) => {
  const { email, password } = credentialsOf(roleOf(context.url));
  const page = await browser.newPage();
  try {
    await page.goto(new URL('/sign-in', context.url).href, { waitUntil: 'networkidle0', timeout: SIGN_IN_TIMEOUT_MS });
    await page.type('input[name="email"]', email);
    await page.type('input[name="password"]', password);
    await Promise.all([
      page.waitForFunction(() => window.location.pathname !== '/sign-in', { timeout: SIGN_IN_TIMEOUT_MS }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await page.close();
  }
};
