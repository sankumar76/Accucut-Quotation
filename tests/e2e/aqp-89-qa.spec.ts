/* eslint-disable no-console -- QA evidence spec on a control branch: its output lines are the evidence */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { createDisposableUser, E2E_ADMIN, E2E_PASSWORD, expectOnQueue, signInThroughThePage, useFreshAddress } from './support/auth';
import { waitUntilAccountMenuIsLive, waitUntilHydrated } from './support/design-system';
import { addEndedSession, SESSION_COOKIE_NAME } from './support/ended-session';
import { PRODUCTION_URL } from './support/servers';

/**
 * QA (qa-engineer) for AQP-89 / STORY-01.06, G7. Lives on a control branch only (never merged): it adds browser journeys the story's own
 * spec does not run, against the PRODUCTION build and a real database, at the three widths.
 *
 *   1. AC-4 hop: a person who really signed in, whose session then ends while the page is open, does something that asks the server for
 *      data. The browser's own client code gets 401 SESSION_ENDED and leaves for SCR-01 "Session ended" with the page kept as the way back.
 *   2. A deliberate sign-out never shows "Session ended", not even for a stale copy of its cookie.
 *   3. QLT-09: what a browser exposes about the SCR-26 / SCR-01 alerts (raw HTML, accessibility tree, event order). Output lines start
 *      with `QA-A11Y`.
 */

test.use({ baseURL: PRODUCTION_URL, storageState: { cookies: [], origins: [] } });

const NOTICE = 'Your session ended. Sign in again to continue where you left off.';
const SCR26_TEXT = 'Sessions last 12 hours from the time you sign in, so you were signed out. Sign in again. Anything you had saved is still there.';

test.beforeEach(async ({ context }) => {
  await useFreshAddress(context);
});

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await signInThroughThePage(page, E2E_ADMIN.email, E2E_PASSWORD);
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
}

for (const kind of ['expired-token', 'old-sign-in'] as const) {
  test(`AC-4 hop (${kind}): an API call from an open page after the session ended leads to SCR-01 "Session ended" and back after signing in`, async ({ page, context }) => {
    await signInAsAdmin(page);
    await page.goto('/audit');
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
    await waitUntilHydrated(page, '#audit-event', 'onChange');

    // The session ends while the page is open: the browser now holds an ended session cookie instead of the live one.
    await context.clearCookies();
    await addEndedSession(context, kind, kind === 'old-sign-in' ? '00000000-0000-4000-8000-000000000001' : undefined);

    // The page's own request goes to the real server; the answer is read here before it is handed on, because the page leaves for
    // SCR-01 as soon as it has it and a body read after that fails (a race of the first version of this spec, a test defect).
    const seen: { status?: number; contentType?: string; cacheControl?: string; body?: unknown } = {};
    await page.route(
      (url) => url.pathname === '/api/v1/audit',
      async (route) => {
        const real = await route.fetch();
        seen.status = real.status();
        seen.contentType = real.headers()['content-type'] ?? '';
        seen.cacheControl = real.headers()['cache-control'] ?? '';
        seen.body = await real.json();
        await route.fulfill({ response: real });
      },
    );
    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
    await expect.poll(() => seen.status).toBe(401);
    expect(seen.contentType).toContain('application/problem+json');
    expect(seen.cacheControl).toBe('private, no-store');
    expect(seen.body).toEqual({ type: 'about:blank', title: 'Your session ended. Sign in again.', status: 401, code: 'SESSION_ENDED', requestId: expect.any(String) });
    console.log(`QA-HOP ${kind} api=${seen.status} body=${JSON.stringify(seen.body)}`);

    // Then the browser's client code takes the person to SCR-01 in its "Session ended" state, with the audit page kept as the way back.
    await expect(page).toHaveURL(/\/sign-in\?reason=session-ended&callbackUrl=%2Faudit$/);
    console.log(`QA-HOP ${kind} landed=${new URL(page.url()).pathname}${new URL(page.url()).search}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeFocused();
    await expect(page.locator('[data-slot="alert"]')).toHaveText(NOTICE);

    await signInThroughThePage(page, E2E_ADMIN.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/audit$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
  });
}

test('a deliberate sign-out never shows "Session ended", and neither does a stale copy of its cookie', async ({ page, context }, testInfo) => {
  const person = await createDisposableUser('sign-out', testInfo);
  await page.goto('/sign-in');
  await signInThroughThePage(page, person.email, E2E_PASSWORD);
  await expectOnQueue(page, 'My tasks');
  const live = (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE_NAME);
  expect(live).toBeDefined();

  await waitUntilAccountMenuIsLive(page);
  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);
  await expect(page.getByText(/session ended/i)).toHaveCount(0);
  console.log(`QA-SIGNOUT landed=${new URL(page.url()).pathname}${new URL(page.url()).search}`);

  // A copy of the cookie that was live before sign-out (another tab, a copied browser profile). Its token still reads and is under
  // 12 hours old, but sign-out raised the person's session_version, so it is refused as a signed-out visit, not as an ended session.
  await context.clearCookies();
  if (live !== undefined) await context.addCookies([live]);
  await page.goto('/queue');
  const landed = new URL(page.url());
  console.log(`QA-SIGNOUT stale page landed=${landed.pathname}${landed.search}`);
  expect(landed.pathname).toBe('/sign-in');
  expect(landed.searchParams.get('reason')).toBeNull();
  await expect(page.getByRole('heading', { level: 1, name: 'Your session ended' })).toHaveCount(0);
  await expect(page.getByText(/session ended/i)).toHaveCount(0);

  const api = await context.request.get('/api/v1/users');
  const apiBody = (await api.json()) as { code?: string };
  console.log(`QA-SIGNOUT stale api status=${api.status()} code=${apiBody.code ?? 'none'}`);
  expect(api.status()).toBe(401);
  expect(apiBody.code).not.toBe('SESSION_ENDED');
});

test('a visit with no session at all never shows "Session ended"', async ({ page, context }) => {
  await page.goto('/queue');
  expect(new URL(page.url()).searchParams.get('reason')).toBeNull();
  await expect(page.getByText(/session ended/i)).toHaveCount(0);
  const api = await context.request.get('/api/v1/users');
  const apiBody = (await api.json()) as { code?: string };
  console.log(`QA-NOSESSION api status=${api.status()} code=${apiBody.code ?? 'none'}`);
  expect(api.status()).toBe(401);
  expect(apiBody.code).not.toBe('SESSION_ENDED');
});

interface AlertProbe {
  readonly alertsInDocument: ReadonlyArray<{ readonly text: string; readonly inMain: boolean; readonly tag: string }>;
  readonly log: ReadonlyArray<string>;
  readonly activeElement: string;
}

/** Records, from the first parsed byte, when an element with role=alert appears or changes and when focus moves. */
async function recordAnnouncementEvents(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[] = [];
    Reflect.set(window, '__qaLog', log);
    const stamp = (): string => `${performance.now().toFixed(0)}ms[${document.readyState}]`;
    const describe = (node: Node): string => (node instanceof Element ? `${node.tagName.toLowerCase()}${node.getAttribute('role') ? `[role=${node.getAttribute('role')}]` : ''}` : '#text');
    document.addEventListener('focusin', (event) => log.push(`${stamp()} focusin ${event.target instanceof Node ? describe(event.target) : '?'}`), true);
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (node instanceof Element && (node.getAttribute('role') === 'alert' || node.querySelector('[role="alert"]') !== null)) log.push(`${stamp()} added ${describe(node)}`);
        }
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (record.type === 'characterData' && target?.closest('[role="alert"]')) log.push(`${stamp()} text-changed-in alert`);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}

async function probe(page: Page, label: string, context: BrowserContext, url: string): Promise<void> {
  const raw = await context.request.get(url);
  const html = await raw.text();
  const alertAt = html.indexOf('role="alert"');
  const headingAt = html.indexOf('<h1');
  console.log(`QA-A11Y ${label} raw-html status=${raw.status()} role-alert-in-initial-html=${alertAt >= 0} h1-before-alert=${headingAt >= 0 && headingAt < alertAt}`);
  // Where the words are in the first response, if anywhere (SCR-26 is drawn by Next.js's unauthorized boundary).
  const wordsAt = html.indexOf('Sessions last 12 hours');
  const escapedRoleAt = html.indexOf('\\"role\\":\\"alert\\"');
  console.log(
    `QA-A11Y ${label} raw-html words-at=${wordsAt} escaped-role-alert-at=${escapedRoleAt} length=${html.length} snippet=${JSON.stringify(wordsAt >= 0 ? html.slice(Math.max(0, wordsAt - 260), wordsAt + 40) : '')}`,
  );

  await recordAnnouncementEvents(page);
  await page.goto(url);
  await expect(page.locator('main h1')).toBeFocused();
  const state = await page.evaluate<AlertProbe>(() => ({
    alertsInDocument: Array.from(document.querySelectorAll('[role="alert"]')).map((element) => ({
      text: (element.textContent ?? '').trim(),
      inMain: element.closest('main') !== null,
      tag: element.tagName.toLowerCase(),
    })),
    log: (Reflect.get(window, '__qaLog') as string[] | undefined) ?? [],
    activeElement: document.activeElement?.tagName.toLowerCase() ?? 'none',
  }));
  console.log(`QA-A11Y ${label} alerts-in-document=${JSON.stringify(state.alertsInDocument)}`);
  console.log(`QA-A11Y ${label} events=${JSON.stringify(state.log)} active=${state.activeElement}`);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
    nodes: Array<{ nodeId: string; ignored?: boolean; role?: { value?: unknown }; name?: { value?: unknown }; properties?: Array<{ name: string; value: { value?: unknown } }> }>;
  };
  const kept = nodes.filter((node) => node.ignored !== true);
  const order = kept.map((node) => String(node.role?.value ?? '')).filter((role) => role === 'heading' || role === 'alert' || role === 'link' || role === 'button');
  console.log(`QA-A11Y ${label} ax-order=${JSON.stringify(order)}`);
  for (const node of kept.filter((candidate) => candidate.role?.value === 'alert')) {
    const props = Object.fromEntries((node.properties ?? []).filter((property) => ['live', 'atomic', 'relevant', 'busy', 'container-live', 'container-atomic'].includes(property.name)).map((property) => [property.name, property.value.value]));
    console.log(`QA-A11Y ${label} ax-alert name=${JSON.stringify(node.name?.value ?? '')} props=${JSON.stringify(props)}`);
  }
  console.log(`QA-A11Y ${label} aria-snapshot-main=\n${await page.locator('main').ariaSnapshot()}`);
}

test('QLT-09: what the browser exposes for the SCR-26 alert (page request after the session ended)', async ({ page, context }) => {
  await addEndedSession(context, 'expired-token');
  await probe(page, 'SCR-26', context, '/masters/materials');
  await expect(page.locator('main [role="alert"]')).toHaveText(SCR26_TEXT);
});

test('QLT-09: what the browser exposes for the SCR-01 "Session ended" alert', async ({ page, context }) => {
  await probe(page, 'SCR-01', context, '/sign-in?reason=session-ended');
  await expect(page.locator('[data-slot="alert"]')).toHaveText(NOTICE);
});
