import { expect, test, type Page } from '@playwright/test';
import { z } from 'zod';

import { E2E_LEAD, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import { isDesktopProject, openDrawer, waitUntilAccountMenuIsLive, waitUntilHydrated } from './support/design-system';
import { PRODUCTION_URL } from './support/servers';

/**
 * DEF-054 (AQP-384, STD-F-01) on the PRODUCTION build (`next start`), the artefact that ships: every page carries the Content Security Policy
 * with a per-request nonce, `frame-ancestors 'none'`, `nosniff`, a Referrer-Policy and a Permissions-Policy; sign-in, the two reset pages and the
 * signed-in frame still run under the policy (hydrated, the account menu and its scroll lock open) with no violation reported; and a page of the portal
 * cannot be framed. The Content Security Policy of `next dev` is looser by design (`src/lib/security/csp.ts`), so the strict policy is judged here.
 *
 * A violation is recorded two ways, because either alone can miss one: the `securitypolicyviolation` event (an init script, so it is listening before
 * the page's own scripts run) and the browser's console error. A control test shows the recorder does see one.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const NONCE = /'nonce-([A-Za-z0-9+/=]+)'/;

/** Starts recording violations; the returned function reads what has been recorded so far. */
async function recordViolations(page: Page): Promise<() => Promise<ReadonlyArray<string>>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Reflect.set(window, '__cspViolations', seen);
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const reported: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) reported.push(message.text());
  });
  const events = z.array(z.string());
  return async () => [...events.parse(await page.evaluate(() => Reflect.get(window, '__cspViolations') ?? [])), ...reported];
}

function directiveOf(policy: string, name: string): string {
  return policy.split('; ').find((entry) => entry.startsWith(`${name} `)) ?? '';
}

/** What every answer must say, whatever it is. Returns the policy so a page test can read its nonce. */
function expectSecurityHeaders(headers: Readonly<Record<string, string>>, referrerPolicy: string): string {
  const policy = headers['content-security-policy'] ?? '';
  expect(directiveOf(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe(referrerPolicy);
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['permissions-policy']).toContain('microphone=()');
  expect(headers['permissions-policy']).toContain('geolocation=()');
  // HSTS is the reverse proxy's header and never the app's (architecture section 8, P3).
  expect(headers['strict-transport-security']).toBeUndefined();
  return policy;
}

/** The page policy: scripts by nonce, no inline and no eval, everything else the portal's own. */
function expectPagePolicy(policy: string): string {
  const scripts = directiveOf(policy, 'script-src');
  expect(scripts).toContain("'strict-dynamic'");
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(scripts).not.toContain("'unsafe-eval'");
  expect(directiveOf(policy, 'default-src')).toBe("default-src 'self'");
  expect(directiveOf(policy, 'object-src')).toBe("object-src 'none'");
  expect(directiveOf(policy, 'base-uri')).toBe("base-uri 'self'");
  const nonce = NONCE.exec(scripts)?.[1];
  expect(nonce, 'a nonce in script-src').toBeDefined();
  return nonce ?? '';
}

/** Every external script of the page carries this request's nonce, and the browser's own code was given it. */
async function expectScriptsCarryNonce(page: Page, nonce: string): Promise<void> {
  const found = await page.evaluate(() => ({
    external: [...document.scripts].filter((script) => script.src !== '').map((script) => script.nonce),
    given: Reflect.get(window, '__webpack_nonce__'),
  }));
  expect(found.external.length).toBeGreaterThan(0);
  for (const value of found.external) expect(value).toBe(nonce);
  expect(found.given).toBe(nonce);
}

const FRAMER = 'http://framer.test';

/**
 * Another site puts the page in a frame. The host page is made by the test (a route answers for a made-up address, no network), so it is a different
 * origin from the portal and has no policy of its own. A second frame, to a page of the same made-up site, is the control: its title can be read, so a
 * portal frame whose title cannot be read as the portal's was refused by the browser (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), not merely slow.
 */
async function expectCannotBeFramed(page: Page, path: string): Promise<void> {
  await page.route(`${FRAMER}/**`, (route) => {
    const inner = route.request().url().endsWith('/inner');
    const loaded = 'onload="window.framesLoaded = (window.framesLoaded || 0) + 1"';
    return route.fulfill({
      contentType: 'text/html',
      body: inner ? '<title>Control page</title><p>Control page</p>' : `<iframe id="portal" ${loaded} src="${PRODUCTION_URL}${path}"></iframe><iframe id="control" ${loaded} src="${FRAMER}/inner"></iframe>`,
    });
  });
  await page.goto(`${FRAMER}/`);
  await page.waitForFunction(() => Reflect.get(window, 'framesLoaded') === 2);
  const control = await (await page.locator('#control').elementHandle())?.contentFrame();
  const portal = await (await page.locator('#portal').elementHandle())?.contentFrame();
  expect(await control?.title(), 'the control frame shows its page').toBe('Control page');
  expect(await portal?.title().catch(() => 'unreadable'), `${path} was shown inside a frame of another site`).not.toContain('Accucut');
}

for (const [path, referrerPolicy] of [
  ['/sign-in', 'same-origin'],
  ['/forgot-password', 'no-referrer'],
  ['/reset-password', 'no-referrer'],
] as const) {
  test(`DEF-054: ${path} carries the headers, runs under the policy with no violation, and cannot be framed`, async ({ page }) => {
    const violations = await recordViolations(page);
    const first = await page.goto(path);
    const nonce = expectPagePolicy(expectSecurityHeaders(first?.headers() ?? {}, referrerPolicy));
    if (path === '/sign-in') await waitUntilHydrated(page, 'form[aria-label="Sign in"]', 'onSubmit');
    await expectScriptsCarryNonce(page, nonce);

    // A second request gets another nonce: it is made per request, not per build or per process.
    const second = await page.request.get(path);
    expect(expectPagePolicy(second.headers()['content-security-policy'] ?? '')).not.toBe(nonce);

    expect(await violations()).toEqual([]);
    await expectCannotBeFramed(page, path);
  });
}

test('DEF-054 (control): the recorder sees a violation, so an empty list means the policy is on and nothing broke', async ({ page }) => {
  const violations = await recordViolations(page);
  await page.goto('/forgot-password');
  // Two things the policy must stop. (A script added from code is not one of them: `'strict-dynamic'` trusts what a trusted script adds, by design.)
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = 'body { outline: 5px solid red; }';
    document.head.append(style);
    const image = document.createElement('img');
    image.setAttribute('onerror', 'window.__injected = true');
    image.src = 'blob:control-that-does-not-exist';
    document.body.append(image);
  });
  await expect.poll(async () => (await violations()).length).toBeGreaterThanOrEqual(2);
  const seen = await violations();
  expect(seen.some((entry) => entry.startsWith('style-src-elem'))).toBe(true);
  expect(seen.some((entry) => entry.startsWith('script-src-attr'))).toBe(true);
  expect(await page.evaluate(() => Reflect.get(window, '__injected'))).toBeUndefined();
});

test('DEF-054: a redirect, a JSON answer and a static file carry the headers', async ({ page, request }) => {
  // Signed out, an unknown path is sent to sign-in; the redirect carries the headers too.
  const redirect = await request.get('/no/such/page', { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expectSecurityHeaders(redirect.headers(), 'same-origin');

  const json = await request.get('/api/v1/me');
  expect(json.status()).toBe(401);
  const policy = expectSecurityHeaders(json.headers(), 'same-origin');
  expect(policy).toBe("default-src 'none'; frame-ancestors 'none'");

  await page.goto('/forgot-password');
  const source = await page.evaluate(() => [...document.scripts].find((script) => script.src !== '')?.src ?? '');
  const file = await request.get(source);
  expect(file.status()).toBe(200);
  expect(file.headers()['x-content-type-options']).toBe('nosniff');
  expect(file.headers()['x-frame-options']).toBe('DENY');
});

test('DEF-054: a signed-in Lead gets the same headers on the queue, opens the menu drawer and the account menu (the scroll lock adds a style element) and sees no violation', async ({ page, context }, testInfo) => {
  await useFreshAddress(context);
  const violations = await recordViolations(page);
  await page.goto('/sign-in');
  await signInThroughThePage(page, E2E_LEAD.email, E2E_PASSWORD);
  await expect(page).toHaveURL(/\/queue$/);

  const queue = await page.goto('/queue');
  const nonce = expectPagePolicy(expectSecurityHeaders(queue?.headers() ?? {}, 'same-origin'));
  expect(queue?.headers()['cache-control']).toBe('private, no-store');
  await expectScriptsCarryNonce(page, nonce);

  // Below 1024 px the menu is a drawer, a modal dialog: opening it makes the scroll lock add a style element, which needs the nonce (`__webpack_nonce__`).
  if (!isDesktopProject(testInfo.project.name)) {
    await openDrawer(page);
    expect(await page.evaluate(() => document.querySelectorAll('style').length), 'the scroll lock added its style element').toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
  }
  await waitUntilAccountMenuIsLive(page);
  await page.getByRole('button', { name: /^Account menu/ }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  expect(await violations()).toEqual([]);

  const me = await page.request.get('/api/v1/me');
  expect(me.status()).toBe(200);
  expectSecurityHeaders(me.headers(), 'same-origin');

  const missing = await page.goto('/no/such/page');
  expect(missing?.status()).toBe(404);
  expectPagePolicy(expectSecurityHeaders(missing?.headers() ?? {}, 'same-origin'));
});
