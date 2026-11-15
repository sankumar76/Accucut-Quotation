import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoAxeViolations, horizontalOverflow } from './support/design-system';
import { seedLateBackupAndFullDisk } from './support/job-runs';
import { ADMIN_STATE, SIGNED_IN_STATE } from './support/servers';

/**
 * STORY-02.09 (AC-1, AC-2, AC-4, AC-5, AC-6, AC-7): SCR-15 "Settings", the Last backup line, at 360x800, 768x1024 and 1366x768 on the development server, as the E2E Admin and the E2E
 * Lead (the saved browser states of the set-up project). The words are the UX spec's and the story's, written out here and not imported.
 *
 * The database holds one state for the whole spec: a weekly backup 9 days old (late) and a reading made just now with 10 % of the disk free (nearly full). The runtime role can only add
 * rows to `job_runs`, so the other states (7, 8 and 9 days; 25, 20 and 19 percent; no rows; a failed run; a stale reading) are in the unit, page and integration tests, which control the
 * clock and the rows. What is checked here: both notices have a title, an icon and a sentence; the lines say what the spec says and show no path or volume name; the page has no control; no
 * sideways scroll; axe 0 violations; the page by keyboard; and a Lead is refused.
 */

const TITLE = 'Settings';
const LATE_SENTENCE = 'No backup has finished for 8 days. Ask Accucut IT to check the weekly backup.';
const FULL_SENTENCE = 'Less than 20 % of the server disk is free. Backups are kept on the same server, so ask Accucut IT to free space or add disk.';
const NO_ACCESS_TITLE = 'You do not have access to this page';

const notice = (page: Page, title: string): Locator => page.locator('[data-slot="alert"]').filter({ hasText: title });

async function openSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
}

test.beforeAll(async () => {
  await seedLateBackupAndFullDisk();
});

test.describe('the Admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('AC-1, AC-2, AC-4, AC-5: shows the last good backup, "Backup late", the server disk and "Disk nearly full", each notice with an icon and words, and the one sentence about the server', async ({ page }) => {
    await openSettings(page);
    const main = page.getByRole('main');

    // The last good backup is the 9-day-old weekly row, written the way the spec writes it: a weekday, a date and a time in IST.
    await expect(main.getByText('Last good backup', { exact: true })).toBeVisible();
    await expect(main.getByText(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} IST\. Finished without errors\.$/)).toBeVisible();

    const late = notice(page, 'Backup late');
    await expect(late).toContainText(LATE_SENTENCE);
    await expect(late.locator('svg')).toHaveCount(1);

    // The newest reading is the daily check's, made when the spec began: 10 % free, and a fresh reading says how long ago it was made.
    await expect(main.getByText('Server disk', { exact: true })).toBeVisible();
    await expect(main.getByText(/^10 % free\. Read (less than a minute|\d+ (minute|hour)s?) ago\.$/)).toBeVisible();
    const full = notice(page, 'Disk nearly full');
    await expect(full).toContainText(FULL_SENTENCE);
    await expect(full.locator('svg')).toHaveCount(1);

    await expect(main.getByText('Backups are kept on the same server.', { exact: true })).toBeVisible();
    // The labelled place the alert switch and the sender will fill (story 09.02): a heading and a sentence, and no control.
    await expect(main.getByRole('heading', { level: 2, name: 'E-mail alerts' })).toBeVisible();

    // The page shows no file path and no volume name, though the rows hold both.
    const text = await main.innerText();
    expect(text).not.toContain('InventedBackupFolder');
    expect(text).not.toContain('InventedVolumeLabel');
  });

  test('AC-5, AC-7: the page has no control that starts, restores or deletes a backup, and no control at all to reach by keyboard', async ({ page }) => {
    await openSettings(page);
    const main = page.getByRole('main');
    await expect(main.getByRole('button')).toHaveCount(0);
    await expect(main.getByRole('link')).toHaveCount(0);
    await expect(main.getByRole('switch')).toHaveCount(0);
    await expect(main.getByRole('textbox')).toHaveCount(0);
    await expect(main.locator('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).toHaveCount(0);
    // The heading is where focus lands after a move to the page, so a keyboard user starts at the title and has nothing to tab through below it.
    await page.keyboard.press('Tab');
    await expect(main.locator(':focus')).toHaveCount(0);
  });

  test('AC-7: no sideways scroll of the page, and axe finds 0 violations', async ({ page }) => {
    await openSettings(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('AC-6: the menu offers Settings to the Admin, and the read answers 200 with no path or volume name', async ({ page }) => {
    const me: unknown = await (await page.request.get('/api/v1/me')).json();
    const labels = typeof me === 'object' && me !== null && 'navigation' in me && Array.isArray(me.navigation) ? me.navigation.map((item: { label?: string }) => item.label) : [];
    expect(labels).toContain('Settings');

    const response = await page.request.get('/api/v1/settings');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).not.toContain('InventedBackupFolder');
    expect(body).not.toContain('InventedVolumeLabel');
    expect(JSON.parse(body)).toMatchObject({ backupLate: true, diskNearlyFull: true });
  });
});

test.describe('the Lead', () => {
  test.use({ storageState: SIGNED_IN_STATE });

  test('AC-6: is refused the page with "no access" and the API with the fixed 403, and the menu does not offer Settings', async ({ page }) => {
    const response = await page.goto('/settings');
    expect(response?.status()).toBe(403);
    await expect(page.getByRole('heading', { name: NO_ACCESS_TITLE })).toBeVisible();
    await expect(page.getByText('Last good backup')).toHaveCount(0);

    expect((await page.request.get('/api/v1/settings')).status()).toBe(403);
    const me: unknown = await (await page.request.get('/api/v1/me')).json();
    const labels = typeof me === 'object' && me !== null && 'navigation' in me && Array.isArray(me.navigation) ? me.navigation.map((item: { label?: string }) => item.label) : [];
    expect(labels).not.toContain('Settings');
  });
});
