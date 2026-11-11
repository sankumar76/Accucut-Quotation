import { randomBytes } from 'node:crypto';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { createDisposableUser, E2E_PASSWORD, signInThroughThePage, useFreshAddress } from './support/auth';
import { expectNoAxeViolations, horizontalOverflow, ROW_TARGET, TOUCH_TARGET, waitUntilHydrated } from './support/design-system';
import { ADMIN_STATE, DEVELOPMENT_URL, SIGNED_IN_STATE } from './support/servers';

/**
 * QA's own browser checks for STORY-02.05 (AQP-130) at G7, at 360x800, 768x1024 and 1366x768 on the development server, written from the words of
 * ux-spec v0.22 (SCR-13 "The Treatment / Color list: final words") and from the acceptance criteria, which are written out below and not imported
 * from the code or from the developer's support file. Signed in as the E2E Admin unless a test says otherwise. Each test makes its own treatments
 * through the API with an invented name that carries the screen size, the repeat and the retry plus a random part. This file is a QA probe: it is
 * run in a throwaway pull request and kept as text evidence (`docs/07-qa/AQP-130-evidence/`), not added to the suite (RISK-023).
 *
 * Covered here and, in part, not in the developer's `treatments.spec.ts`: every sentence of the ux-spec table for the dialogs, the notices, the
 * failed writes, loading and the load error; the four messages under Name and that each clears when the field is edited; the controls of every
 * dialog at 44 px; axe and sideways scroll with each dialog open; the keyboard-only journey of add, rename and delete with the Tab order of the
 * delete dialog; a name of 100 characters with no space in the notice and the dialog title; a 320 px reflow; and access for a Lead, an Engineer
 * and a signed-out visitor, page and API. Measurements are printed as `QA130-MEASURE` lines for the report.
 */

const TITLE = 'Materials and lists';
const TAB = 'Treatment / Color';
const NO_ACCESS_TITLE = 'You do not have access to this page';

// The words, from ux-spec v0.22.
const W = {
  locked: 'Always offered; the Engineer types the text',
  required: 'Enter a name.',
  tooLong: 'Use 100 characters or fewer.',
  taken: 'A treatment with this name already exists.',
  reserved: 'That name cannot be used.',
  loading: 'Loading the treatments',
  loadErrorTitle: 'We could not load the treatments',
  loadErrorPlain: 'Check your connection and try again. Nothing was changed.',
  addFailedTitle: 'We could not add the treatment.',
  renameFailedTitle: 'We could not save the changes.',
  deleteFailedTitle: 'We could not delete the treatment.',
  failedWithForm: 'Check your connection and try again. What you typed is still in the form.',
  failedPlain: 'Check your connection and try again.',
  added: (name: string) => `${name} was added. The change is in the audit log.`,
  renamed: (from: string, to: string) => `${from} was renamed to ${to}.`,
  deleted: (name: string) => `${name} was deleted. The change is in the audit log.`,
  deleteText: (name: string) =>
    `${name} is removed from the Treatment / Color list. Estimates that are already calculated keep the treatment they show. To bring it back, add it again.`,
};

const API = `${DEVELOPMENT_URL}/api/v1/treatments`;
const HEADERS = { origin: DEVELOPMENT_URL, 'content-type': 'application/json' };
const BUSY = {
  status: 503,
  contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'The service is busy. Try again in a moment.', status: 503, code: 'DATABASE_BUSY', requestId: 'req-0a0b0c0d' }),
};

const isWide = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768;

function newName(testInfo: TestInfo, tag = ''): string {
  return `QA130-${testInfo.project.name}-r${testInfo.repeatEachIndex}-t${testInfo.retry}${tag}-${randomBytes(3).toString('hex')}`;
}

async function make(page: Page, name: string): Promise<string> {
  const response = await page.request.post(API, { headers: HEADERS, data: { name } });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { id: string };
  return body.id;
}

async function openTab(page: Page): Promise<void> {
  await page.goto('/masters/materials');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await waitUntilHydrated(page, 'main button[data-action="add"]');
  await page.getByRole('tab', { name: TAB }).click();
  await expect(page.getByRole('button', { name: 'Add treatment' })).toBeVisible();
  await expect(page.getByText(W.locked).first()).toBeVisible();
}

const rename = (page: Page, name: string): Locator => page.getByRole('button', { name: `Rename ${name}`, exact: true });
const del = (page: Page, name: string): Locator => page.getByRole('button', { name: `Delete ${name}`, exact: true });
const notices = (page: Page): Locator => page.locator('main').getByRole('status').filter({ hasText: /\S/ });

async function press(button: Locator): Promise<void> {
  await button.focus();
  await button.press('Enter');
}

async function height(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  return box?.height ?? 0;
}

function measure(testInfo: TestInfo, what: string, value: unknown): void {
  // A probe prints its measurements for the report; it is not part of the suite.
  // eslint-disable-next-line no-console
  console.log(`QA130-MEASURE ${testInfo.project.name} ${what} ${JSON.stringify(value)}`);
}

test.describe('as the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('[AQP-130 AC-1, AC-8] the tab: names, "Other" first with its reason as text, no control on it; no sideways scroll; axe 0 violations', async ({ page }, testInfo) => {
    const name = newName(testInfo);
    await make(page, name);
    await openTab(page);
    await expect(page.getByRole('tablist', { name: 'Lists' })).toBeVisible();
    await expect(page.getByRole('tab', { name: TAB })).toHaveAttribute('aria-selected', 'true');
    const first = page.locator('[data-item-id]:visible').first();
    await expect(first).toContainText('Other');
    await expect(first).toContainText(W.locked);
    await expect(first.getByRole('button')).toHaveCount(0);
    expect(await first.locator('[disabled], [aria-disabled="true"]').count()).toBe(0);
    expect(await first.locator('svg[aria-hidden="true"]').count()).toBeGreaterThan(0);
    // The reason is part of the row's name in reading order (ux-spec accessibility paragraph).
    expect((await first.innerText()).replace(/\s+/g, ' ')).toContain(`Other ${W.locked}`);
    await expect(rename(page, name)).toBeVisible();
    await expect(del(page, name)).toBeVisible();
    if (isWide(page)) await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    else await expect(page.getByRole('list', { name: 'Treatment / Color' })).toBeVisible();
    const overflow = await horizontalOverflow(page);
    measure(testInfo, 'tab overflow px', overflow);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('[AQP-130 AC-8] 320 px reflow: the tab with a treatment and a 100-character name has no sideways page scroll', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await make(page, newName(testInfo, '-narrow'));
    await make(page, `${newName(testInfo, '-long')}-`.padEnd(100, 'W'));
    await openTab(page);
    const overflow = await horizontalOverflow(page);
    measure(testInfo, '320px overflow px', overflow);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('[AQP-130 AC-8] controls are 44 px (icon buttons of a table row 36 px) in the list and in all three dialogs; each dialog fits the screen and has no axe violation', async ({ page }, testInfo) => {
    const name = newName(testInfo);
    await make(page, name);
    await openTab(page);
    const sizes: Record<string, number> = {};
    sizes['Add treatment button'] = await height(page.getByRole('button', { name: 'Add treatment' }));
    sizes['Treatment / Color tab'] = await height(page.getByRole('tab', { name: TAB }));
    sizes['Rename row button'] = await height(rename(page, name));
    sizes['Delete row button'] = await height(del(page, name));
    const rowLeast = isWide(page) ? ROW_TARGET : TOUCH_TARGET;
    expect(sizes['Add treatment button']).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(sizes['Treatment / Color tab']).toBeGreaterThanOrEqual(TOUCH_TARGET);
    expect(sizes['Rename row button']).toBeGreaterThanOrEqual(rowLeast);
    expect(sizes['Delete row button']).toBeGreaterThanOrEqual(rowLeast);

    const width = page.viewportSize()?.width ?? 0;
    const inside = async (dialog: Locator, label: string): Promise<void> => {
      const box = await dialog.boundingBox();
      expect(box?.x ?? -1, `${label} left edge`).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0), `${label} right edge`).toBeLessThanOrEqual(width);
      expect(await horizontalOverflow(page), `${label} sideways scroll`).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    };

    await press(page.getByRole('button', { name: 'Add treatment' }));
    const addDialog = page.getByRole('dialog', { name: 'Add treatment' });
    await expect(addDialog.getByLabel('Name')).toBeFocused();
    sizes['Add: Name field'] = await height(addDialog.getByLabel('Name'));
    sizes['Add: Cancel'] = await height(addDialog.getByRole('button', { name: 'Cancel' }));
    sizes['Add: Add treatment'] = await height(addDialog.getByRole('button', { name: 'Add treatment' }));
    await inside(addDialog, 'Add dialog');
    await page.keyboard.press('Escape');

    await press(rename(page, name));
    const renameDialog = page.getByRole('dialog', { name: `Rename ${name}` });
    await expect(renameDialog.getByLabel('Name')).toHaveValue(name);
    sizes['Rename: Name field'] = await height(renameDialog.getByLabel('Name'));
    sizes['Rename: Cancel'] = await height(renameDialog.getByRole('button', { name: 'Cancel' }));
    sizes['Rename: Save'] = await height(renameDialog.getByRole('button', { name: 'Save' }));
    await inside(renameDialog, 'Rename dialog');
    await page.keyboard.press('Escape');

    await press(del(page, name));
    const deleteDialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    sizes['Delete: Keep treatment'] = await height(deleteDialog.getByRole('button', { name: 'Keep treatment' }));
    sizes['Delete: Delete treatment'] = await height(deleteDialog.getByRole('button', { name: 'Delete treatment' }));
    await inside(deleteDialog, 'Delete dialog');
    await page.keyboard.press('Escape');

    measure(testInfo, 'control heights px', sizes);
    for (const [label, value] of Object.entries(sizes)) {
      if (!label.endsWith('row button')) expect(value, label).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }
  });

  test('[AQP-130 AC-2, AC-6, AC-8] the sentences: Add, Rename and Delete dialogs and the three notices, exactly as ux-spec v0.22 writes them', async ({ page }, testInfo) => {
    const added = newName(testInfo, '-add');
    const old = newName(testInfo, '-old');
    const renamed = `${old}-new`;
    const doomed = newName(testInfo, '-doomed');
    await make(page, old);
    await make(page, doomed);
    await openTab(page);

    await press(page.getByRole('button', { name: 'Add treatment' }));
    const addDialog = page.getByRole('dialog', { name: 'Add treatment' });
    await expect(addDialog.getByLabel('Name')).toBeFocused();
    await expect(addDialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await addDialog.getByLabel('Name').fill(`  ${added}  `);
    await addDialog.getByRole('button', { name: 'Add treatment' }).click();
    await expect(page.getByRole('status').filter({ hasText: W.added(added) })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: W.added(added) })).toHaveText(W.added(added));
    await expect(rename(page, added)).toBeVisible();

    await press(rename(page, old));
    const renameDialog = page.getByRole('dialog', { name: `Rename ${old}` });
    await expect(renameDialog.getByLabel('Name')).toHaveValue(old);
    await renameDialog.getByLabel('Name').fill(renamed);
    // The title keeps the name as it was when the dialog opened, while the field changes.
    await expect(page.getByRole('dialog', { name: `Rename ${old}` })).toBeVisible();
    await renameDialog.getByRole('button', { name: 'Save' }).click();
    const renamedNotice = page.getByRole('status').filter({ hasText: W.renamed(old, renamed) });
    await expect(renamedNotice).toBeVisible();
    await expect(renamedNotice).toHaveText(W.renamed(old, renamed));
    await expect(renamedNotice).not.toContainText(/audit/i);
    await expect(notices(page)).toHaveCount(1);

    await press(del(page, doomed));
    const deleteDialog = page.getByRole('alertdialog', { name: `Delete ${doomed}?` });
    await expect(deleteDialog.getByRole('button', { name: 'Keep treatment' })).toBeFocused();
    await expect(deleteDialog).toContainText(W.deleteText(doomed));
    const dialogText = (await deleteDialog.innerText()).replace(/\s+/g, ' ');
    expect(dialogText).not.toMatch(/figures|undo/i);
    await deleteDialog.getByRole('button', { name: 'Delete treatment' }).click();
    await expect(page.getByRole('status').filter({ hasText: W.deleted(doomed) })).toHaveText(W.deleted(doomed));
    await expect(del(page, doomed)).toHaveCount(0);
    await expect(notices(page)).toHaveCount(1);
  });

  test('[AQP-130 AC-2] the four messages under Name; each clears when the field is edited; the typed text stays; typing after a refusal keeps focus in the field', async ({ page }, testInfo) => {
    const existing = newName(testInfo, '-exists');
    await make(page, existing);
    await openTab(page);
    await press(page.getByRole('button', { name: 'Add treatment' }));
    const dialog = page.getByRole('dialog', { name: 'Add treatment' });
    const field = dialog.getByLabel('Name');
    const submit = dialog.getByRole('button', { name: 'Add treatment' });

    await submit.click();
    await expect(dialog.getByText(W.required)).toBeVisible();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await page.keyboard.type('xyz');
    await expect(field).toHaveValue('xyz');
    await expect(field).toBeFocused();
    await expect(dialog.getByText(W.required)).toHaveCount(0);

    await field.fill('x'.repeat(101));
    await submit.click();
    await expect(dialog.getByText(W.tooLong)).toBeVisible();
    await field.fill('x'.repeat(100));
    await expect(dialog.getByText(W.tooLong)).toHaveCount(0);

    await field.fill(existing.toLowerCase());
    await submit.click();
    await expect(dialog.getByText(W.taken)).toBeVisible();
    await expect(field).toHaveValue(existing.toLowerCase());
    await expect(field).toBeFocused();
    await field.fill(`${existing}2`);
    await expect(dialog.getByText(W.taken)).toHaveCount(0);

    for (const reserved of ['Other', ' oTHER ', 'Not applicable', 'NOT  APPLICABLE', 'Ｏｔｈｅｒ']) {
      await field.fill(reserved);
      await submit.click();
      await expect(dialog.getByText(W.reserved)).toBeVisible();
      await expect(field).toHaveValue(reserved);
      expect(await dialog.innerText()).not.toMatch(/applicable/i);
      await field.fill(`${reserved}!`);
      await expect(dialog.getByText(W.reserved)).toHaveCount(0);
    }
    await expectNoAxeViolations(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('[AQP-130 AC-3, AC-8] by keyboard alone: add, rename and delete; the delete dialog starts on Keep treatment, keeps focus inside, Escape sends nothing; focus returns where the ux-spec says', async ({ page }, testInfo) => {
    const name = newName(testInfo, '-kbd');
    const renamed = `${name}-r`;
    await openTab(page);
    const sent: string[] = [];
    page.on('request', (request) => {
      if (['POST', 'PATCH', 'DELETE'].includes(request.method()) && request.url().includes('/api/v1/treatments')) sent.push(request.method());
    });

    const add = page.getByRole('button', { name: 'Add treatment' });
    await press(add);
    await expect(page.getByRole('dialog', { name: 'Add treatment' }).getByLabel('Name')).toBeFocused();
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: W.added(name) })).toBeVisible();
    await expect(add).toBeFocused();

    await press(rename(page, name));
    await expect(page.getByRole('dialog', { name: `Rename ${name}` }).getByLabel('Name')).toBeFocused();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(renamed);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: W.renamed(name, renamed) })).toBeVisible();
    await expect(rename(page, renamed)).toBeFocused();

    await press(del(page, renamed));
    const dialog = page.getByRole('alertdialog', { name: `Delete ${renamed}?` });
    await expect(dialog.getByRole('button', { name: 'Keep treatment' })).toBeFocused();
    const order: string[] = [];
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? 'none'));
    }
    measure(testInfo, 'delete dialog tab order after Keep treatment', order);
    expect(order[0]).toBe('Delete treatment');
    for (const stop of order) expect(['Keep treatment', 'Delete treatment']).toContain(stop);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(del(page, renamed)).toBeFocused();
    expect(sent).toEqual(['POST', 'PATCH']);

    await press(del(page, renamed));
    await expect(dialog.getByRole('button', { name: 'Keep treatment' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Delete treatment' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: W.deleted(renamed) })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeFocused();
    expect(sent).toEqual(['POST', 'PATCH', 'DELETE']);
  });

  test('[AQP-130 AC-6, AC-8] a failed add, rename and delete say so in the words of ux-spec v0.22, keep the typed name, and never say "Nothing was changed."', async ({ page }, testInfo) => {
    const name = newName(testInfo, '-fail');
    await make(page, name);
    await openTab(page);
    await page.route('**/api/v1/treatments**', (route) => (['POST', 'PATCH', 'DELETE'].includes(route.request().method()) ? route.fulfill(BUSY) : route.continue()));

    await press(page.getByRole('button', { name: 'Add treatment' }));
    const addDialog = page.getByRole('dialog', { name: 'Add treatment' });
    const typed = newName(testInfo, '-typed');
    await addDialog.getByLabel('Name').fill(typed);
    await addDialog.getByRole('button', { name: 'Add treatment' }).click();
    const addAlert = addDialog.getByRole('alert');
    await expect(addAlert).toContainText(W.addFailedTitle);
    await expect(addAlert).toContainText(W.failedWithForm);
    await expect(addDialog.getByLabel('Name')).toHaveValue(typed);
    expect(await page.locator('body').innerText()).not.toContain('Nothing was changed');
    await page.keyboard.press('Escape');

    await press(rename(page, name));
    const renameDialog = page.getByRole('dialog', { name: `Rename ${name}` });
    await renameDialog.getByLabel('Name').fill(`${name}-x`);
    await renameDialog.getByRole('button', { name: 'Save' }).click();
    await expect(renameDialog.getByRole('alert')).toContainText(W.renameFailedTitle);
    await expect(renameDialog.getByRole('alert')).toContainText(W.failedWithForm);
    await expect(renameDialog.getByLabel('Name')).toHaveValue(`${name}-x`);
    expect(await page.locator('body').innerText()).not.toContain('Nothing was changed');
    await page.keyboard.press('Escape');

    await press(del(page, name));
    const deleteDialog = page.getByRole('alertdialog', { name: `Delete ${name}?` });
    await deleteDialog.getByRole('button', { name: 'Delete treatment' }).click();
    const deleteAlert = deleteDialog.getByRole('alert');
    await expect(deleteAlert).toContainText(W.deleteFailedTitle);
    await expect(deleteAlert).toContainText(W.failedPlain);
    await expect(deleteAlert).not.toContainText('What you typed');
    await expect(deleteDialog.getByRole('button', { name: 'Keep treatment' })).toBeEnabled();
    await expect(deleteDialog.getByRole('button', { name: 'Delete treatment' })).toBeEnabled();
    expect(await page.locator('body').innerText()).not.toContain('Nothing was changed');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('[AQP-130 AC-1, AC-8] loading shows "Loading the treatments"; a failed read shows the error with focus on its title and "Try again"', async ({ page }) => {
    await page.goto('/masters/materials');
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await waitUntilHydrated(page, 'main button[data-action="add"]');
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let failing = true;
    await page.route('**/api/v1/treatments', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await held;
      return failing ? route.fulfill(BUSY) : route.continue();
    });
    await page.getByRole('tab', { name: TAB }).click();
    await expect(page.getByText(W.loading).first()).toBeVisible();
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached();
    release();
    const title = page.getByText(W.loadErrorTitle);
    await expect(title).toBeVisible();
    await expect(page.getByText(W.loadErrorPlain)).toBeVisible();
    await expect(title).toBeFocused();
    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText(W.locked).first()).toBeVisible();
    await expect(page.getByText(W.loadErrorTitle)).toHaveCount(0);
  });

  test('[AQP-130 AC-8] a 100-character name with no space stays inside the notice, the Rename title and the Delete title: no sideways scroll at any step', async ({ page }, testInfo) => {
    const long = `${newName(testInfo, '-long')}-`.padEnd(100, 'W');
    expect(long).toHaveLength(100);
    const next = `${long.slice(0, 99)}V`;
    await make(page, long);
    await openTab(page);
    await expect(rename(page, long)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await press(rename(page, long));
    const renameDialog = page.getByRole('dialog', { name: `Rename ${long}` });
    await expect(renameDialog).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await renameDialog.getByLabel('Name').fill(next);
    await renameDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: W.renamed(long, next) })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await press(del(page, next));
    await expect(page.getByRole('alertdialog', { name: `Delete ${next}?` })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Delete treatment' }).click();
    await expect(page.getByRole('status').filter({ hasText: W.deleted(next) })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('as a Lead (the saved browser state of the set-up project)', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('[AQP-130 AC-7] the page is SCR-26 "no access" with status 403 and holds no tab and no treatment; every admin route is 403 for a real and an invented ID alike; the options list is open', async ({ page }) => {
    const response = await page.goto('/masters/materials');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_TITLE })).toBeVisible();
    await expect(page.getByRole('tab', { name: TAB })).toHaveCount(0);
    await expect(page.getByText('Add treatment')).toHaveCount(0);
    expect(await page.content()).not.toContain(W.locked);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    const real = await page.request.get(API);
    expect(real.status()).toBe(403);
    const realId = '00000000-0000-4000-8000-000700000001';
    const invented = '00000000-0000-4000-8000-0fffffffffff';
    const answers = [
      await page.request.post(API, { headers: HEADERS, data: { name: 'QA130-lead-never' } }),
      await page.request.patch(`${API}/${realId}`, { headers: HEADERS, data: { name: 'QA130-lead-never' } }),
      await page.request.patch(`${API}/${invented}`, { headers: HEADERS, data: { name: 'QA130-lead-never' } }),
      await page.request.delete(`${API}/${realId}`, { headers: HEADERS }),
      await page.request.delete(`${API}/${invented}`, { headers: HEADERS }),
    ];
    for (const answer of answers) expect(answer.status()).toBe(403);
    const bodies = await Promise.all(answers.map(async (answer) => (await answer.text()).replace(/"requestId":"[^"]*"/, '')));
    expect(new Set(bodies).size).toBe(1);
    const options = await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/treatments`);
    expect(options.status()).toBe(200);
    for (const option of ((await options.json()) as { options: Array<Record<string, unknown>> }).options) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
  });
});

test.describe('as an Engineer and signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('[AQP-130 AC-5, AC-7] a signed-out visitor is sent to sign-in and gets 401; an Engineer gets SCR-26 and 403 on the page and the admin routes, and the options list as IDs and names only', async ({ page, context }, testInfo) => {
    const signedOut = await page.goto('/masters/materials');
    expect(signedOut?.url()).toContain('/sign-in');
    expect((await page.request.get(API)).status()).toBe(401);
    expect((await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/treatments`)).status()).toBe(401);

    const engineer = await createDisposableUser('managed', testInfo);
    await useFreshAddress(context);
    await page.goto('/sign-in');
    await signInThroughThePage(page, engineer.email, E2E_PASSWORD);
    await expect(page).toHaveURL(/\/queue$/);
    const response = await page.goto('/masters/materials');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { level: 1, name: NO_ACCESS_TITLE })).toBeVisible();
    expect(await page.content()).not.toContain(W.locked);
    expect((await page.request.get(API)).status()).toBe(403);
    expect((await page.request.post(API, { headers: HEADERS, data: { name: 'QA130-eng-never' } })).status()).toBe(403);
    const options = await page.request.get(`${DEVELOPMENT_URL}/api/v1/options/treatments`);
    expect(options.status()).toBe(200);
    const text = await options.text();
    expect(text).not.toMatch(/price|rate|cost|usd|eur|inr/i);
    const listed = (JSON.parse(text) as { options: Array<Record<string, unknown>> }).options;
    expect(listed.some((option) => option['name'] === 'Other')).toBe(true);
    for (const option of listed) expect(Object.keys(option).sort()).toEqual(['id', 'name']);
  });
});
