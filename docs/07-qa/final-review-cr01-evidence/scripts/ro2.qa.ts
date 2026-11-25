import { test } from '@playwright/test';

import { estimateInStatus, ignoreThroughTheApi, type UnderlyingStatus } from '../e2e/support/ignored';
import { signInAs } from '../e2e/support/calculated-estimate';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);

for (const status of ['DRAFT', 'PREPARED', 'APPROVED'] as UnderlyingStatus[]) {
  test(`T11 Engineer sees on an Ignored task that was ${status}`, async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const proj = testInfo.project.name;
    await ensureE2eUsers();
    await ensureE2eAdmin();
    const e = await estimateInStatus(page, testInfo, status);
    await ignoreThroughTheApi(page, e.owner.id, 'Not taken forward.');
    await signInAs(page, { ...e.owner, role: 'ENGINEER' });
    await page.goto(`/estimates/${e.code}`);
    await page.waitForSelector('form[data-part-form]', { timeout: 240000 });
    await page.waitForTimeout(2000);
    const banners = await page.evaluate(() => Array.from(document.querySelectorAll('[data-slot="alert"], [role=status]')).map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean));
    log(proj, `ENGINEER view of Ignored (was ${status}): badge`, (await page.locator('[data-slot="status-badge"]').first().innerText()).trim(), '| banners:', JSON.stringify(banners));
  });
}
