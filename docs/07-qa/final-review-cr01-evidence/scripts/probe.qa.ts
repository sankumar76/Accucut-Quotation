import { test } from '@playwright/test';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';

test('probe', async ({ page }, testInfo) => {
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const { owner, code } = await engineerWithEstimate(testInfo);
  await signInAs(page, owner);
  await page.goto(`/estimates/${code}`);
  await page.waitForSelector('form[data-part-form]', { timeout: 120000 });
  const nav = page.locator('nav[aria-label="Parts tree"]');
  console.log(await nav.ariaSnapshot());
  console.log(await page.getByRole('button', { name: /Add main assembly/i }).count());
  await page.getByRole('button', { name: /Add main assembly/i }).click();
  await page.waitForTimeout(3000);
  console.log(await nav.ariaSnapshot());
  console.log((await nav.locator('li').first().evaluate((e) => e.outerHTML)).slice(0, 3000));
});
