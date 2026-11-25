import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { E2E_ADMIN, E2E_ENGINEER, E2E_LEAD, ensureCanaryCustomers, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { signInAs } from '../e2e/support/calculated-estimate';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
async function axe(page: Page, label: string, proj: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  log(proj, 'AXE', label, r.violations.length === 0 ? '0 violations' : r.violations.map((v) => `${v.id}(${v.impact}) x${v.nodes.length}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' ; ')}`).join(' || '));
}
async function overflow(page: Page, label: string, proj: string): Promise<void> {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log(proj, 'OVERFLOW', label, o.sw > o.cw ? `SIDEWAYS SCROLL sw=${o.sw} cw=${o.cw}` : `ok (${o.sw}<=${o.cw})`);
}

test('T4 assign task, customers short name, rename strings', async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  await ensureCanaryCustomers();
  await signInAs(page, E2E_LEAD);

  await page.goto('/assign');
  await expect(page.getByRole('heading', { level: 1, name: 'Assign task' })).toBeVisible({ timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `qa-out/assign-${proj}.png`, fullPage: true });
  await overflow(page, 'assign empty', proj);
  await axe(page, 'assign empty', proj);
  log(proj, 'ASSIGN fields', JSON.stringify(await page.locator('main label').allInnerTexts()).replace(/\s+/g, ' '));

  // submit empty -> error summary
  await page.getByRole('button', { name: 'Assign task' }).last().click();
  await page.waitForTimeout(800);
  const alertText = (await page.locator('[role=alert]').allInnerTexts()).join(' // ').replace(/\s+/g, ' ');
  log(proj, 'ASSIGN empty submit alert', alertText, '| focus:', await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
  await axe(page, 'assign with errors', proj);
  await overflow(page, 'assign errors', proj);

  // short name readout and subject boundaries
  const customerSelect = page.getByLabel('Customer Name');
  const options = await customerSelect.locator('option').allInnerTexts();
  log(proj, 'customer options (first 4)', JSON.stringify(options.slice(0, 4)));
  await customerSelect.selectOption({ index: 1 });
  log(proj, 'short name output', (await page.locator('output').allInnerTexts()).join('|'));
  const subject = page.getByLabel('Subject (project name)');
  await subject.fill('x'.repeat(81));
  await page.getByLabel('Title').fill('QA title');
  await page.getByRole('button', { name: 'Assign task' }).last().click();
  await page.waitForTimeout(600);
  log(proj, 'subject 81 error', (await page.locator('#assign-subject-error, [id$=subject-error], [role=alert]').allInnerTexts()).join(' // ').replace(/\s+/g, ' ').slice(0, 300));
  const typed80 = 'y'.repeat(80);
  await subject.fill(typed80);
  log(proj, 'subject accepted 80 -> input value length', (await subject.inputValue()).length);

  // fill the rest and create
  await page.getByLabel('Engineer').selectOption({ label: E2E_ENGINEER.name });
  await page.getByLabel('Network folder path').fill('\\\\invented-server\\invented-share\\QA-final');
  await page.getByLabel('Deadline date').fill('2099-01-05');
  await page.getByLabel('Deadline time').fill('10:00');
  await subject.fill('QA final review ' + proj);
  await page.getByRole('button', { name: 'Assign task' }).last().click();
  await page.waitForTimeout(4000);
  log(proj, 'after create: url', page.url(), '| status text', (await page.locator('[role=status], [role=alert]').allInnerTexts()).join(' // ').replace(/\s+/g, ' ').slice(0, 300));

  // Customers (Admin)
  await signInAs(page, E2E_ADMIN);
  await page.goto('/masters/customers');
  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible({ timeout: 240000 });
  await page.waitForTimeout(1500);
  await overflow(page, 'customers', proj);
  await axe(page, 'customers list', proj);
  await page.getByRole('button', { name: 'Add customer' }).first().click();
  await page.waitForTimeout(800);
  const dlg = page.getByRole('dialog');
  log(proj, 'CUSTOMER form labels', JSON.stringify(await dlg.locator('label').allInnerTexts()).replace(/\s+/g, ' ').slice(0, 400));
  await dlg.getByLabel(/^Customer name|^Name/).first().fill('QA Short Co ' + proj);
  await dlg.getByLabel(/Short name/).fill('ABCDEFGHIJK');
  await dlg.getByRole('button', { name: /Save|Add customer|Create/ }).last().click();
  await page.waitForTimeout(1200);
  log(proj, 'short name 11 chars', (await dlg.innerText()).replace(/\s+/g, ' ').match(/Keep the short name[^.]*\./)?.[0] ?? 'no message: ' + (await dlg.innerText()).replace(/\s+/g, ' ').slice(-200));
  await axe(page, 'customer dialog with error', proj);
  await page.keyboard.press('Escape');

  // Rename checks across routes (Admin)
  for (const route of ['/about', '/', '/queue', '/assign', '/masters/customers', '/users', '/account']) {
    const res = await page.goto(route);
    await page.waitForTimeout(600);
    const html = await page.content();
    const title = await page.title();
    log(proj, 'RENAME', route, res?.status(), 'title=', title, '| "Quotation Portal" occurrences:', (html.match(/Quotation Portal/gi) ?? []).length, '| "RFQ Portal":', (html.match(/RFQ Portal/g) ?? []).length);
  }
  await page.goto('/about');
  log(proj, 'ABOUT text', (await page.locator('main').innerText()).replace(/\s+/g, ' '));
  await page.context().clearCookies();
  const si = await page.goto('/sign-in');
  const html = await page.content();
  log(proj, 'RENAME /sign-in', si?.status(), await page.title(), '| robots:', await page.locator('meta[name=robots]').getAttribute('content'), '| og:title', await page.locator('meta[property="og:title"]').getAttribute('content'), '| og:image count', await page.locator('meta[property="og:image"]').count(), '| QP:', (html.match(/Quotation Portal/gi) ?? []).length);
  await axe(page, 'sign-in', proj);
  void E2E_ADMIN;
});
