import { expect, test } from '@playwright/test';

import { approvedEstimate, latestApprovalIdOf } from '../e2e/support/approved-estimate';
import { signInAs } from '../e2e/support/calculated-estimate';
import { E2E_ADMIN, E2E_PASSWORD, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const H = { origin: 'http://localhost:3300', 'content-type': 'application/json' };

test('T9 Admin cancels the approval of a QUOTED estimate; Remove price on Quoted', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const a = await approvedEstimate(page, testInfo);
  const id = a.owner.id;
  await signInAs(page, E2E_ADMIN);
  const q = await page.request.post(`/api/v1/estimates/${id}/quoted`, { headers: H });
  log(proj, 'mark quoted', q.status());
  const approvalId = await latestApprovalIdOf(id);
  const c = await page.request.post(`/api/v1/estimates/${id}/approval/cancel`, { headers: H, data: { approvalId, reason: 'QA cancel of a quoted estimate', password: E2E_PASSWORD } });
  log(proj, 'Admin cancel approval on QUOTED', c.status(), (await c.text()).slice(0, 160));
  await page.goto(`/estimates/${a.code}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(a.code, { timeout: 240000 });
  await page.waitForTimeout(1500);
  log(proj, 'SCR-06 after cancel: status', (await page.locator('[data-slot="status-badge"]').first().innerText()).trim(), '| actions', JSON.stringify(await page.locator('#review-actions button, #review-actions a').allInnerTexts()), '| quoted notice present:', await page.locator('#review-quoted-notice').count(), '| cancelled notice:', await page.locator('#review-cancelled-notice').count());
  log(proj, 'chip', (await page.locator('[data-slot="download-chip"]').first().innerText().catch(() => 'none')).replace(/\s+/g, ' '));
  const un = await page.request.post(`/api/v1/estimates/${id}/quoted`, { headers: H });
  log(proj, 'mark quoted again after cancel (estimate is Draft)', un.status(), (await un.text()).slice(0, 140));
});
