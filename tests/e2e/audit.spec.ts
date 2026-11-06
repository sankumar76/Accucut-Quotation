import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { E2E_ADMIN, E2E_LEAD } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL } from './support/servers';

/**
 * STORY-01.07 T7 (AC-6, AC-8, AC-9): SCR-16 "Audit log" at 360x800, 768x1024 and 1366x768 on the development server, signed in
 * as the E2E Admin (the saved browser state of the set-up project). The entries are made the way the portal makes them: the Admin
 * adds and changes a person through the Users API, and each change writes its own entry in its own transaction. The words are the
 * UX spec's, written out here and not imported.
 *
 * What is checked: the entries newest first with the time in IST; no sideways scroll; axe 0 violations; controls of 44 px; the
 * filters and "Show more entries" by keyboard; the empty, loading and error states; and the screen-size difference (a table
 * from 768 px, cards below it, both following the filter). The pages of the list beyond the first are answered by a stand-in for
 * the server, because the number of real entries in the shared test database is not ours to set.
 */

test.use({ storageState: ADMIN_STATE });

const FIRST_PASSWORD = 'invented-first-password-1';
const IST_TIME = /\d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} IST/;
/** UX spec SCR-16, written out. */
const EMPTY_TITLE = 'No entries match';
const EMPTY_TEXT = 'Try a wider date range or another event type.';
const ERROR_TITLE = 'We could not load the audit log';
const RANGE_MESSAGE = 'The To date must be on or after the From date.';

/** The entry (table row or phone card, whichever is shown) that is about a person. */
function entryOf(page: Page, name: string): Locator {
  return page.locator('[data-entry-id]:visible').filter({ hasText: name });
}

async function openAudit(page: Page): Promise<void> {
  await page.goto('/audit');
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();
  // The selects are plain HTML until React has attached their handlers; a choice before that is lost (DEF-011).
  await waitUntilHydrated(page, '#audit-event', 'onChange');
}

interface Person {
  readonly id: string;
  readonly name: string;
}

/** The Admin adds a person, as the Users screen does: one entry, `user.created`, written with the person. */
async function addPerson(page: Page, label: string): Promise<Person> {
  const suffix = randomBytes(3).toString('hex');
  const name = `E2E Audit ${label} ${suffix}`;
  const response = await page.request.post('/api/v1/users', {
    headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
    data: { name, email: `e2e.audit.${label}.${suffix}@example.test`, role: 'ENGINEER', password: FIRST_PASSWORD },
  });
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  const id = typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string' ? body.id : '';
  expect(id).not.toBe('');
  return { id, name };
}

async function changeRole(page: Page, person: Person, role: 'LEAD' | 'ENGINEER'): Promise<void> {
  const response = await page.request.patch(`/api/v1/users/${person.id}`, {
    headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' },
    data: { role },
  });
  expect(response.status()).toBe(200);
}

/** Today in India, as a date field writes it. */
function todayInIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

test.describe('the list (AC-6, AC-9)', () => {
  test('AC-6, AC-9: shows what the Admin did, newest first, in words, with the time in IST; no sideways scroll, no axe violations', async ({ page }) => {
    const first = await addPerson(page, 'first');
    const second = await addPerson(page, 'second');
    await changeRole(page, second, 'LEAD');
    await openAudit(page);

    const created = entryOf(page, first.name);
    await expect(created).toHaveCount(1);
    await expect(created).toContainText('User change');
    await expect(created).toContainText('Not added');
    await expect(created).toContainText('Added as Engineer');
    await expect(created).toContainText(E2E_ADMIN.name);
    expect(await created.innerText()).toMatch(IST_TIME);

    // Newest first: the role change of the second person, then the second person added, then the first person added.
    const texts = await page.locator('[data-entry-id]:visible').allInnerTexts();
    const positionOf = (needle: string, after = 0): number => texts.findIndex((text, index) => index >= after && text.includes(needle));
    const roleChange = positionOf(second.name);
    expect(texts[roleChange]).toContain('Engineer');
    expect(texts[roleChange]).toContain('Lead');
    const secondAdded = positionOf(second.name, roleChange + 1);
    const firstAdded = positionOf(first.name);
    expect(roleChange).toBeGreaterThanOrEqual(0);
    expect(secondAdded).toBeGreaterThan(roleChange);
    expect(firstAdded).toBeGreaterThan(secondAdded);

    await expect(page.getByRole('status').filter({ hasText: /Showing \d+ of \d+ entries, newest first/ })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-6: there is no control that edits or deletes an entry, anywhere', async ({ page }) => {
    await addPerson(page, 'nocontrols');
    await openAudit(page);
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: /edit|delete|remove|change/i })).toHaveCount(0);
    await expect(main.getByRole('link', { name: /edit|delete|remove/i })).toHaveCount(0);
    // The only button in the list is "Show more entries", and only when there is more.
    for (const name of await main.getByRole('button').allInnerTexts()) expect(name).toMatch(/Show more entries/);
  });

  test('AC-9: the filters are labelled and at least 44 px high', async ({ page }) => {
    await openAudit(page);
    for (const label of ['Who', 'Event', 'From', 'To']) {
      const control = page.getByLabel(label, { exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box?.height ?? 0, label).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
  });

  test('AC-6: a table from 768 px and cards below it, never both; the table scrolls inside its own region only', async ({ page }, testInfo) => {
    const person = await addPerson(page, 'layout');
    await openAudit(page);
    const wide = testInfo.project.name !== 'mobile';
    await expect(page.getByRole('table')).toHaveCount(wide ? 1 : 0);
    await expect(page.getByRole('list', { name: 'Audit log entries, newest first' })).toHaveCount(wide ? 0 : 1);
    await expect(entryOf(page, person.name)).toHaveCount(1);
    if (wide) {
      await expect(page.getByRole('region', { name: 'Audit log, newest first, scrollable' })).toBeVisible();
      await expect(page.getByRole('columnheader')).toHaveText([/When \(IST\)/, 'Who', 'Event', 'Object', /Before\s+to\s+after/]);
    }
  });
});

test.describe('the filters (AC-6)', () => {
  test('filters by who and by event; the list, the cards and the total follow', async ({ page }) => {
    const person = await addPerson(page, 'filtered');
    await openAudit(page);

    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
    await expect(entryOf(page, person.name)).toHaveCount(1);

    await page.getByLabel('Who', { exact: true }).selectOption({ label: E2E_ADMIN.name });
    await expect(entryOf(page, person.name)).toHaveCount(1);

    // The Lead never acts in these tests, so the log has nothing by them.
    await page.getByLabel('Who', { exact: true }).selectOption({ label: E2E_LEAD.name });
    await expect(page.getByRole('heading', { level: 2, name: EMPTY_TITLE })).toBeVisible();
    await expect(page.locator('[data-entry-id]:visible')).toHaveCount(0);
  });

  test('a kind of entry no story has raised yet shows "No entries match", with the way back, and clearing the filters brings the list back', async ({ page }) => {
    const person = await addPerson(page, 'empty');
    await openAudit(page);
    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'Approval' });
    await expect(page.getByRole('heading', { level: 2, name: EMPTY_TITLE })).toBeVisible();
    await expect(page.getByText(EMPTY_TEXT)).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByRole('heading', { level: 2, name: EMPTY_TITLE })).toBeHidden();
    await expect(entryOf(page, person.name)).toHaveCount(1);
    await expect(page.getByLabel('Event', { exact: true })).toHaveValue('');
  });

  test('From and To are whole days in IST: today includes what was just done, tomorrow does not', async ({ page }) => {
    const person = await addPerson(page, 'days');
    await openAudit(page);
    const today = todayInIst();
    await page.getByLabel('From', { exact: true }).fill(today);
    await page.getByLabel('To', { exact: true }).fill(today);
    await expect(entryOf(page, person.name)).toHaveCount(1);

    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel('From', { exact: true }).fill(tomorrow);
    await page.getByLabel('To', { exact: true }).fill(tomorrow);
    await expect(page.getByRole('heading', { level: 2, name: EMPTY_TITLE })).toBeVisible();
  });

  test('a range that ends before it begins is said in words under To, and asks the server nothing', async ({ page }) => {
    await openAudit(page);
    let asked = 0;
    await page.route('**/api/v1/audit*', async (route) => {
      asked += 1;
      await route.continue();
    });
    // A To date alone is a real filter, and is asked for; the From date after it makes the range impossible.
    await page.getByLabel('To', { exact: true }).fill('2026-11-06');
    await expect.poll(() => asked).toBe(1);
    await expect(page.getByText(RANGE_MESSAGE)).toHaveCount(0);
    await page.getByLabel('From', { exact: true }).fill('2026-11-07');
    await expect(page.getByText(RANGE_MESSAGE)).toBeVisible();
    await expect(page.getByLabel('To', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    expect(asked).toBe(1);
    // Putting it right asks again, and the message goes.
    await page.getByLabel('From', { exact: true }).fill('2026-11-05');
    await expect.poll(() => asked).toBe(2);
    await expect(page.getByText(RANGE_MESSAGE)).toHaveCount(0);
  });
});

test.describe('states (AC-8)', () => {
  test('loading: the list stays until 300 ms have passed, then skeleton rows in a busy card; then the answer', async ({ page }) => {
    const person = await addPerson(page, 'loading');
    await openAudit(page);
    await page.route('**/api/v1/audit*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
    const card = page.locator('[aria-busy="true"]').first();
    await expect(card).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Loading the audit log' })).toBeAttached();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(entryOf(page, person.name)).toHaveCount(1);
  });

  test('error: "We could not load the audit log" with "Try again", which asks again', async ({ page }) => {
    const person = await addPerson(page, 'error');
    await openAudit(page);
    await page.route('**/api/v1/audit*', (route) => route.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ code: 'INTERNAL_ERROR' }) }));
    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
    await expect(page.getByRole('heading', { level: 2, name: ERROR_TITLE })).toBeFocused();
    await expect(page.getByText('Check your connection and try again. Nothing was changed.')).toBeVisible();

    await page.unroute('**/api/v1/audit*');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 2, name: ERROR_TITLE })).toBeHidden();
    await expect(entryOf(page, person.name)).toHaveCount(1);
  });

  test('error: a broken answer is an error, never an empty list', async ({ page }) => {
    await openAudit(page);
    await page.route('**/api/v1/audit*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nothing: 'here' }) }));
    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
    await expect(page.getByRole('heading', { level: 2, name: ERROR_TITLE })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: EMPTY_TITLE })).toHaveCount(0);
  });

  test('"Show more entries" adds the next page, and when the last page is shown focus moves to the count', async ({ page }) => {
    const entry = (id: string, label: string) => ({
      id,
      createdAt: '2026-11-05T09:00:00.000Z',
      who: 'Invented Admin',
      event: 'user.created',
      category: { id: 'user_change', label: 'User change' },
      objectLabel: label,
      change: { before: 'Not added', after: 'Added as Engineer' },
    });
    await openAudit(page);
    await page.route('**/api/v1/audit*', (route) => {
      const hasCursor = new URL(route.request().url()).searchParams.has('cursor');
      const body = hasCursor
        ? { entries: [entry('10000000-0000-4000-8000-000000000003', 'Invented Third')], total: 3, nextCursor: null }
        : { entries: [entry('10000000-0000-4000-8000-000000000001', 'Invented First'), entry('10000000-0000-4000-8000-000000000002', 'Invented Second')], total: 3, nextCursor: 'invented-cursor' };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
    await expect(page.locator('[data-entry-id]:visible')).toHaveCount(2);
    await expect(page.getByText('Showing 2 of 3 entries, newest first')).toBeVisible();

    const more = page.getByRole('button', { name: 'Show more entries' });
    await more.focus();
    await more.press('Enter');
    await expect(page.locator('[data-entry-id]:visible')).toHaveCount(3);
    await expect(page.getByText('Showing 3 of 3 entries, newest first')).toBeVisible();
    await expect(more).toHaveCount(0);
    await expect(page.getByText('Showing 3 of 3 entries, newest first')).toBeFocused();
  });

  test('"Show more entries" that fails says so, keeps the entries, and can be pressed again', async ({ page }) => {
    await openAudit(page);
    const first = { id: '10000000-0000-4000-8000-000000000001', createdAt: '2026-11-05T09:00:00.000Z', who: 'Invented Admin', event: 'user.created', category: { id: 'user_change', label: 'User change' }, objectLabel: 'Invented First', change: { before: 'Not added', after: 'Added as Engineer' } };
    await page.route('**/api/v1/audit*', (route) => {
      if (new URL(route.request().url()).searchParams.has('cursor')) return route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [first], total: 2, nextCursor: 'invented-cursor' }) });
    });
    await page.getByLabel('Event', { exact: true }).selectOption({ label: 'User change' });
    await expect(page.locator('[data-entry-id]:visible')).toHaveCount(1);
    await page.getByRole('button', { name: 'Show more entries' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'We could not load more entries' })).toBeVisible();
    await expect(page.locator('[data-entry-id]:visible')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Show more entries' })).toBeVisible();
  });
});

test.describe('by keyboard (AC-9)', () => {
  test('the filters are reached with Tab and changed with the keyboard, and the result follows', async ({ page }) => {
    const person = await addPerson(page, 'keyboard');
    await openAudit(page);
    const event = page.getByLabel('Event', { exact: true });
    await event.focus();
    // Type-ahead on a closed list chooses the option that starts with the letters, as a person without a pointer does.
    await page.keyboard.type('Approval');
    await expect(event).toHaveValue('approval');
    await expect(page.getByRole('heading', { level: 2, name: EMPTY_TITLE })).toBeVisible();

    const clear = page.getByRole('button', { name: 'Clear filters' });
    await clear.focus();
    await clear.press('Enter');
    await expect(entryOf(page, person.name)).toHaveCount(1);
    await expect(event).toHaveValue('');
  });

  test('Tab runs from Who to Event to From; a date field is three parts (day, month, year) to the keyboard, then comes To', async ({ page }) => {
    await openAudit(page);
    await page.getByLabel('Who', { exact: true }).focus();
    for (const label of ['Event', 'From']) {
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(label, { exact: true })).toBeFocused();
    }
    // The browser's own date field keeps focus through its three parts, so a few more presses leave it for To. The parts
    // themselves are the browser's: how they are typed into is not ours to test.
    const to = page.getByLabel('To', { exact: true });
    for (let press = 0; press < 6 && !(await to.evaluate((element) => element === document.activeElement)); press += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(to).toBeFocused();
  });
});

test.describe('the log has no write route (AC-6)', () => {
  test('PATCH, PUT, DELETE and POST on /api/v1/audit are 405 for the Admin', async ({ page }) => {
    for (const method of ['patch', 'put', 'delete', 'post'] as const) {
      const response = await page.request[method]('/api/v1/audit', { headers: { origin: DEVELOPMENT_URL, 'content-type': 'application/json' }, data: {} });
      expect(response.status(), method).toBe(405);
    }
  });
});
