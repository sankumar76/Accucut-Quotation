import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { z } from 'zod';

import { setCanarySubject } from '../e2e/support/auth';
import { approvedEstimate } from '../e2e/support/approved-estimate';
import { signInAs } from '../e2e/support/calculated-estimate';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const JSON_HEADERS = { origin: 'http://localhost:3300', 'content-type': 'application/json' };
const costsShape = z.object({ calculationId: z.string().min(1) });

async function axe(page: Page, label: string, proj: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  log(proj, 'AXE', label, r.violations.length === 0 ? '0 violations' : r.violations.map((v) => `${v.id}(${v.impact}) x${v.nodes.length}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' ; ')}`).join(' || '));
}
async function overflow(page: Page, label: string, proj: string): Promise<void> {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log(proj, 'OVERFLOW', label, o.sw > o.cw ? `SIDEWAYS SCROLL sw=${o.sw} cw=${o.cw}` : `ok (${o.sw}<=${o.cw})`);
}
async function shot(page: Page, name: string, proj: string): Promise<void> {
  await page.screenshot({ path: `qa-out/${name}-${proj}.png`, fullPage: true });
}
async function step(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    log('STEP FAILED', label, String((e as Error).message).split('\n')[0]);
  }
}
async function engineerCheck(page: Page, owner: { id: string; email: string; name: string }, code: string, label: string, proj: string, lead: { id: string; email: string; name: string; role: string }): Promise<void> {
  await signInAs(page, { ...owner, role: 'ENGINEER' });
  const forbidden = /\b(price|cost|rate|formula|markup|margin|Downloaded|Not downloaded|Changed since download|Quoted by|Marked as quoted)\b/i;
  await page.goto(`/estimates/${code}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code, { timeout: 120000 });
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  const hits = text.match(new RegExp(forbidden, 'gi')) ?? [];
  log(proj, 'ENGINEER PAGE', label, 'status badge:', (await page.locator('[data-slot="status-badge"]').first().innerText()).trim(), '| forbidden-word hits:', JSON.stringify(hits));
  const api = await page.request.get(`/api/v1/estimates/${owner.id}`);
  const body = await api.text();
  log(proj, 'ENGINEER API workspace', label, api.status(), 'cost-ish keys:', JSON.stringify(Array.from(new Set(body.match(/"[A-Za-z]*(price|cost|rate|formula|download|quote|total)[A-Za-z]*"/gi) ?? []))));
  const costs = await page.request.get(`/api/v1/estimates/${owner.id}/costs`);
  const exp = await page.request.get(`/api/v1/estimates/${owner.id}/export`);
  const quoted = await page.request.post(`/api/v1/estimates/${owner.id}/quoted`, { headers: JSON_HEADERS });
  const ign = await page.request.post(`/api/v1/estimates/${owner.id}/ignore`, { headers: JSON_HEADERS, data: { remarks: 'x' } });
  const rst = await page.request.post(`/api/v1/estimates/${owner.id}/restore`, { headers: JSON_HEADERS });
  log(proj, 'ENGINEER FORBIDDEN ROUTES', label, `costs=${costs.status()} export=${exp.status()} quoted=${quoted.status()} ignore=${ign.status()} restore=${rst.status()}`);
  const q = await page.request.get('/api/v1/tasks?tab=closed');
  void q;
  await signInAs(page, lead as never);
}

test('T2 lead journey: approved, quoted, export, marker, unlock, ignore, restore + Engineer view at each step', async ({ page }, testInfo: TestInfo) => {
  test.setTimeout(900_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const est = await approvedEstimate(page, testInfo);
  const { owner, lead, code } = est;
  log(proj, 'estimate', code);
  await step('subject', async () => {
    const short = await setCanarySubject(owner.id, 'Frame / Base: plate "A" <1>|2*3?');
    log(proj, 'short name of customer', short);
  });

  // SCR-06 approved
  await page.goto(`/estimates/${code}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(code, { timeout: 180000 });
  await page.waitForTimeout(1500);
  log(proj, 'SCR-06 approved: buttons', JSON.stringify(await page.locator('#review-actions button, #review-actions a').allInnerTexts()), 'chip:', (await page.locator('[data-slot="download-chip"]').first().innerText().catch(() => 'none')).replace(/\s+/g, ' '));
  await shot(page, 'review-approved', proj);
  await overflow(page, 'SCR-06 approved', proj);
  await axe(page, 'SCR-06 approved', proj);

  // Mark as quoted through UI
  await step('mark quoted', async () => {
    await page.locator('#review-mark-quoted').click();
    const dlg = page.getByRole('alertdialog');
    await expect(dlg).toBeVisible();
    log(proj, 'quote dialog text', (await dlg.innerText()).replace(/\s+/g, ' '));
    await axe(page, 'quote dialog open', proj);
    await shot(page, 'quote-dialog', proj);
    await dlg.getByRole('button', { name: /^Mark as quoted$/ }).click();
    await expect(page.locator('#review-quoted-notice')).toBeVisible({ timeout: 60000 });
    log(proj, 'quoted notice', (await page.locator('#review-quoted-notice').innerText()).replace(/\s+/g, ' '));
    log(proj, 'focus after quote', await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.textContent ?? '').slice(0, 30)));
  });
  await shot(page, 'review-quoted', proj);
  await overflow(page, 'SCR-06 quoted', proj);
  await axe(page, 'SCR-06 quoted', proj);
  log(proj, 'SCR-06 quoted: buttons', JSON.stringify(await page.locator('#review-actions button, #review-actions a').allInnerTexts()));

  // Queue Closed tab
  await step('closed tab', async () => {
    await page.goto(`/queue?tab=closed&assignedBy=anyone&q=${encodeURIComponent(code)}`);
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 120000 });
    log(proj, 'CLOSED tab row', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 700));
    await shot(page, 'queue-closed', proj);
    await overflow(page, 'queue closed', proj);
    await axe(page, 'queue closed', proj);
  });

  // Export screen + download
  await step('export', async () => {
    await page.goto(`/estimates/${code}/export`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Excel export', { timeout: 120000 });
    log(proj, 'SCR-10 text', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 800));
    await shot(page, 'export', proj);
    await overflow(page, 'SCR-10', proj);
    await axe(page, 'SCR-10', proj);
    const dl = page.waitForEvent('download', { timeout: 180000 });
    await page.getByRole('button', { name: /download/i }).first().click();
    const d = await dl;
    log(proj, 'DOWNLOAD suggested file name', d.suggestedFilename());
    await d.saveAs(`qa-out/export-${proj}.xlsx`);
    await page.waitForTimeout(2500);
    log(proj, 'SCR-10 after download', (await page.locator('[data-slot="download-chip"]').first().innerText().catch(() => 'none')).replace(/\s+/g, ' '));
    const second = await page.request.get(`/api/v1/estimates/${owner.id}/export`);
    log(proj, 'second download status', second.status(), second.headers()['content-disposition']);
    await page.goto(`/estimates/${code}`);
    await page.waitForTimeout(1500);
    log(proj, 'SCR-06 header chip after 2 downloads', (await page.locator('[data-slot="download-chip"]').first().innerText().catch(() => 'none')).replace(/\s+/g, ' '));
  });

  // Engineer's view while Quoted
  await step('engineer quoted', async () => engineerCheck(page, owner, code, 'QUOTED', proj, lead));

  // Unlock (Quoted) -> Draft
  await step('unlock', async () => {
    await page.goto(`/estimates/${code}`);
    await expect(page.locator('#review-unlock')).toBeVisible({ timeout: 120000 });
    await page.locator('#review-unlock').click();
    const dlg = page.getByRole('alertdialog');
    await expect(dlg).toBeVisible();
    await dlg.locator('#review-unlock-reason, textarea').first().fill('Customer asked for a revised fixture.');
    await dlg.getByRole('button', { name: /^Unlock/ }).click();
    await expect(page.locator('#review-unlocked-notice')).toBeVisible({ timeout: 60000 });
    log(proj, 'after unlock', (await page.locator('[data-slot="status-badge"]').first().innerText()).trim(), '| chip:', (await page.locator('[data-slot="download-chip"]').first().innerText().catch(() => 'none')).replace(/\s+/g, ' '));
  });
  await step('engineer draft', async () => engineerCheck(page, owner, code, 'DRAFT-after-unlock', proj, lead));

  // Ignore from Draft (as Lead through UI)
  await step('ignore', async () => {
    await page.goto(`/estimates/${code}`);
    await expect(page.locator('#review-ignore')).toBeVisible({ timeout: 120000 });
    await page.locator('#review-ignore').click();
    const dlg = page.getByRole('alertdialog');
    await expect(dlg).toBeVisible();
    await shot(page, 'ignore-dialog', proj);
    await axe(page, 'ignore dialog', proj);
    await dlg.getByRole('button', { name: /^Ignore RFQ$/ }).click();
    log(proj, 'ignore with empty remarks error', (await dlg.innerText()).replace(/\s+/g, ' ').slice(-160));
    await dlg.locator('#ignore-remarks').fill('Not taken forward.\nCustomer chose another supplier. <b>x</b>');
    await dlg.getByRole('button', { name: /^Ignore RFQ$/ }).click();
    await expect(page.locator('#review-ignored-notice')).toBeVisible({ timeout: 60000 });
    log(proj, 'ignored notice', (await page.locator('#review-ignored-notice').innerText()).replace(/\s+/g, ' '));
    log(proj, 'focus after ignore', await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.textContent ?? '').slice(0, 30)), '| announcer:', await page.locator('#page-announcer').innerText());
    log(proj, 'SCR-06 ignored: buttons', JSON.stringify(await page.locator('main button, main a').allInnerTexts()).slice(0, 400));
  });
  await shot(page, 'review-ignored', proj);
  await overflow(page, 'SCR-06 ignored', proj);
  await axe(page, 'SCR-06 ignored', proj);

  // Lead's Ignored tab
  await step('lead ignored tab', async () => {
    await page.goto(`/queue?tab=ignored&assignedBy=anyone&q=${encodeURIComponent(code)}`);
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 120000 });
    log(proj, 'IGNORED tab (Lead)', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600));
    await shot(page, 'queue-ignored-lead', proj);
    await overflow(page, 'queue ignored lead', proj);
    await axe(page, 'queue ignored lead', proj);
  });

  // Engineer's own read-only view
  await step('engineer ignored', async () => {
    await engineerCheck(page, owner, code, 'IGNORED', proj, lead);
    await signInAs(page, { ...owner, role: 'ENGINEER' });
    await page.goto(`/estimates/${code}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(code, { timeout: 120000 });
    await page.waitForTimeout(2000);
    log(proj, 'ENGINEER ignored page notice', (await page.locator('[role=status]').allInnerTexts()).join(' // ').replace(/\s+/g, ' ').slice(0, 700));
    log(proj, 'ENGINEER ignored controls', JSON.stringify(await page.locator('main button').allInnerTexts()).slice(0, 300), 'inputs disabled:', await page.locator('form[data-part-form] input:disabled, form[data-part-form] select:disabled').count(), 'readonly:', await page.locator('form[data-part-form] input[readonly]').count());
    await shot(page, 'engineer-ignored', proj);
    await overflow(page, 'engineer ignored', proj);
    await axe(page, 'engineer ignored workspace', proj);
    await page.goto(`/queue?tab=ignored`);
    await page.waitForTimeout(3000);
    log(proj, 'IGNORED tab (Engineer)', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600));
    await shot(page, 'queue-ignored-engineer', proj);
    await overflow(page, 'queue ignored engineer', proj);
    await axe(page, 'queue ignored engineer', proj);
    await signInAs(page, lead as never);
  });

  // Restore
  await step('restore', async () => {
    await page.goto(`/estimates/${code}`);
    await expect(page.locator('#review-restore')).toBeVisible({ timeout: 120000 });
    await page.locator('#review-restore').click();
    const dlg = page.getByRole('alertdialog');
    await expect(dlg).toBeVisible();
    log(proj, 'restore dialog', (await dlg.innerText()).replace(/\s+/g, ' '));
    await axe(page, 'restore dialog', proj);
    await dlg.getByRole('button', { name: /^Restore RFQ$/ }).click();
    await expect(page.locator('#review-ignored-notice')).toHaveCount(0, { timeout: 60000 });
    log(proj, 'after restore', (await page.locator('[data-slot="status-badge"]').first().innerText()).trim(), 'announcer:', await page.locator('#page-announcer').innerText(), 'focus:', await page.evaluate(() => document.activeElement?.tagName));
  });
  await step('engineer restored', async () => engineerCheck(page, owner, code, 'RESTORED(draft)', proj, lead));
});
