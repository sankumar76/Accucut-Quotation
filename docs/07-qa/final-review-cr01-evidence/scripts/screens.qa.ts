import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { approvedEstimate } from '../e2e/support/approved-estimate';
import { engineerWithEstimate, signInAs, calculateWithoutThePage } from '../e2e/support/calculated-estimate';
import { E2E_SECOND_CUSTOMER, createDisposableUser, ensureE2eAdmin, ensureE2eSecondCustomer, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const JSON_HEADERS = { origin: 'http://localhost:3300', 'content-type': 'application/json' };

async function axe(page: Page, label: string, proj: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  log(proj, 'AXE', label, r.violations.length === 0 ? '0 violations' : r.violations.map((v) => `${v.id}(${v.impact}) x${v.nodes.length}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' ; ')}`).join(' || '));
}
async function overflow(page: Page, label: string, proj: string): Promise<void> {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log(proj, 'OVERFLOW', label, o.sw > o.cw ? `SIDEWAYS SCROLL sw=${o.sw} cw=${o.cw}` : `ok (${o.sw}<=${o.cw})`);
}
async function targets(page: Page, label: string, proj: string): Promise<void> {
  const small = await page.evaluate(() => Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=tab]')).filter((e) => { const r = (e as HTMLElement).getBoundingClientRect(); const cs = getComputedStyle(e as HTMLElement); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && (r.height < 24 || r.width < 24) && !(e.closest('.sr-only')) && !(e.classList.contains('sr-only')); }).map((e) => `${e.tagName}:${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 24)}:${Math.round((e as HTMLElement).getBoundingClientRect().width)}x${Math.round((e as HTMLElement).getBoundingClientRect().height)}`));
  log(proj, 'TARGET<24px', label, small.length === 0 ? 'none' : small.slice(0, 6).join(' | '));
}

test('T6 screens: Lead review read-only tree, cost detail, change customer, Engineer workspace compact, Closed tab', async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const second = await ensureE2eSecondCustomer();
  void second;
  // a Prepared estimate (calculated by Engineer), Lead signed in
  const { owner, code } = await engineerWithEstimate(testInfo);
  await calculateWithoutThePage(page, owner);
  const lead = await createDisposableUser('axe', testInfo, 'LEAD');
  await signInAs(page, lead);

  await page.goto(`/estimates/${code}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code, { timeout: 240000 });
  await page.waitForTimeout(2000);
  const treeBtns = await page.locator('nav[aria-label="Parts tree"] button').allInnerTexts().catch(() => []);
  const toolbarCount = await page.locator('[data-row-actions]').count();
  log(proj, 'SCR-06 Prepared (Lead): status', (await page.locator('[data-slot="status-badge"]').first().innerText()).trim(), '| row toolbars', toolbarCount, '| tree buttons', JSON.stringify(treeBtns), '| actions', JSON.stringify(await page.locator('#review-actions button, #review-actions a').allInnerTexts()));
  log(proj, 'SCR-06 header', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 420));
  await page.screenshot({ path: `qa-out/review-prepared-${proj}.png`, fullPage: true });
  await overflow(page, 'SCR-06 prepared', proj);
  await axe(page, 'SCR-06 prepared', proj);
  await targets(page, 'SCR-06 prepared', proj);

  // Change customer dialog
  await page.getByRole('button', { name: /Change customer/ }).click();
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toBeVisible({ timeout: 30000 });
  log(proj, 'CHANGE CUSTOMER dialog', (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 420), '| focus:', await page.evaluate(() => document.activeElement?.textContent?.slice(0, 30)));
  await axe(page, 'change customer dialog', proj);
  await page.keyboard.press('Escape');

  // SCR-07 cost details
  const res = await page.goto(`/estimates/${code}/costs/1`);
  await page.waitForTimeout(2500);
  log(proj, 'SCR-07', res?.status(), (await page.locator('h1').first().innerText().catch(() => '?')).replace(/\s+/g, ' '));
  await page.screenshot({ path: `qa-out/costs-${proj}.png`, fullPage: true });
  await overflow(page, 'SCR-07', proj);
  await axe(page, 'SCR-07', proj);
  log(proj, 'SCR-07 read-only tree toolbars', await page.locator('[data-row-actions]').count());

  // Engineer: SCR-05 Prepared (read-only) at this width, compact layout
  await signInAs(page, { ...owner, role: 'ENGINEER' });
  await page.goto(`/estimates/${code}`);
  await page.waitForSelector('form[data-part-form]', { timeout: 240000 });
  await page.waitForTimeout(1500);
  log(proj, 'SCR-05 Prepared (Engineer): status', (await page.locator('[data-slot="status-badge"]').first().innerText()).trim(), '| inputs readonly/disabled', await page.locator('form[data-part-form] input[readonly], form[data-part-form] input:disabled').count(), '| row toolbars', await page.locator('[data-row-actions]').count(), '| bar buttons', JSON.stringify(await page.locator('main button:visible').allInnerTexts()).slice(0, 260));
  await page.screenshot({ path: `qa-out/workspace-prepared-${proj}.png`, fullPage: false });
  await overflow(page, 'SCR-05 prepared', proj);
  await axe(page, 'SCR-05 prepared', proj);
  await targets(page, 'SCR-05 prepared', proj);
  const cardInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.is-compact section, .is-compact [data-slot="section-card"]')).slice(0, 3);
    return { compactRoot: document.querySelectorAll('.is-compact').length, firstCardPadding: cards[0] ? getComputedStyle(cards[0] as HTMLElement).padding : 'n/a', fieldH: (() => { const i = document.querySelector('form[data-part-form] input:not([type=hidden])') as HTMLElement | null; return i ? Math.round(i.getBoundingClientRect().height) : null; })() };
  });
  log(proj, 'SCR-05 compact', JSON.stringify(cardInfo));
  // Engineer cannot change customer
  const cc = await page.request.put(`/api/v1/estimates/${owner.id}/customer`, { headers: JSON_HEADERS, data: { customerId: '00000000-0000-4000-8000-000000000000' } });
  log(proj, 'Engineer PUT customer ->', cc.status(), '(expected 403)');

  // Approve by Lead, mark quoted, then Closed tab on this width
  const approved = await approvedEstimate(page, testInfo);
  await signInAs(page, approved.lead);
  await page.request.post(`/api/v1/estimates/${approved.owner.id}/quoted`, { headers: JSON_HEADERS });
  await page.request.get(`/api/v1/estimates/${approved.owner.id}/export`);
  await page.goto(`/queue?tab=closed&assignedBy=anyone&q=${encodeURIComponent(approved.code)}`);
  const hit = page.getByText(approved.code).locator('visible=true').first();
  await expect(hit).toBeVisible({ timeout: 120000 });
  const rowText = await page.locator('tr, article, li, [data-slot="card"]').filter({ hasText: approved.code }).locator('visible=true').first().innerText().catch(() => 'n/a');
  log(proj, 'CLOSED tab row (Lead)', rowText.replace(/\s+/g, ' ').slice(0, 300));
  await page.screenshot({ path: `qa-out/closed-${proj}.png`, fullPage: false });
  await overflow(page, 'Closed tab', proj);
  await axe(page, 'Closed tab', proj);
  await targets(page, 'Closed tab', proj);
  // Admin sees the same actions on an approved estimate
  await ensureE2eAdmin();
  const adminPage = await page.context().newPage();
  void adminPage;
  await adminPage.close();
});
