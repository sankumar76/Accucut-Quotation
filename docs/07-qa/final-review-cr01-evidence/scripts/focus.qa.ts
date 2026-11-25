import { expect, test, type Page } from '@playwright/test';

import { approvedEstimate } from '../e2e/support/approved-estimate';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';
import { connectToTestDatabase, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const H = { origin: 'http://localhost:3301', 'content-type': 'application/json' };

/** Tab through the page until the focus has been on `stopAfter` controls inside the table's last column, reporting each one's visibility in the table region and the viewport. */
async function tabReport(page: Page, label: string, code: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  // start at the task code link of this row, then Tab through the row
  const row = page.locator('tbody tr').filter({ hasText: code }).first();
  await row.locator('a').first().focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab'); // keyboard modality, back on the task link
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(800);
    const r = await page.evaluate((rowCode) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const tr = el.closest('tr');
      if (!tr || !(tr.textContent ?? '').includes(rowCode)) return { outside: true, name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30) };
      let p: HTMLElement | null = el.parentElement;
      let sc: HTMLElement | null = null;
      while (p) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth) { sc = p; break; } p = p.parentElement; }
      const r = el.getBoundingClientRect();
      const s = sc ? sc.getBoundingClientRect() : { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
      const wholly = r.left >= s.left - 0.5 && r.right <= s.right + 0.5 && r.top >= 0 && r.bottom <= innerHeight;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(Math.min(Math.max(cx, 0), innerWidth - 1), Math.min(Math.max(cy, 0), innerHeight - 1));
      return {
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 34),
        tag: el.tagName,
        left: Math.round(r.left), right: Math.round(r.right), regionLeft: Math.round(s.left), regionRight: Math.round(s.right),
        scrollLeft: sc ? Math.round(sc.scrollLeft) : null, scrollable: !!sc,
        whollyInRegion: wholly, hitIsSelf: top === el || el.contains(top),
        hiddenPx: Math.max(0, Math.round(Math.max(s.left - r.left, 0) + Math.max(r.right - s.right, 0))),
      };
    }, code);
    if (r === null) break;
    seen.push(JSON.stringify(r));
    log(label, 'TAB', i + 1, JSON.stringify(r));
    if ('outside' in r) break;
    await page.keyboard.press('Tab');
  }
  void seen;
}

test('T12 queue table: keyboard focus on row actions at 1024, 1280, 1366 (SC 2.4.11)', async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  await ensureE2eUsers();
  await ensureE2eAdmin();
  // Open (Draft), Closed (Quoted, downloaded once), Ignored (Prepared then ignored)
  const open = await engineerWithEstimate(testInfo);
  const closed = await approvedEstimate(page, testInfo);
  const ign = await approvedEstimate(page, testInfo);
  const client = await connectToTestDatabase();
  try {
    for (const [id, name] of [[open.owner.id, 'Priya Nair'], [closed.owner.id, 'Arun Rao'], [ign.owner.id, 'Meena Iyer'], [closed.lead.id, 'Kiran Bose'], [ign.lead.id, 'Kiran Bose']] as const) {
      await client.query('UPDATE users SET name = $2 WHERE id = $1::uuid', [id, name]);
    }
  } finally {
    await client.end();
  }
  await signInAs(page, closed.lead);
  log('setup: quote', (await page.request.post(`/api/v1/estimates/${closed.owner.id}/quoted`, { headers: H })).status(), 'download', (await page.request.get(`/api/v1/estimates/${closed.owner.id}/export`)).status());
  await signInAs(page, ign.lead);
  // ignore from Approved: unlock first is not needed (Ignore is allowed from Approved)
  log('setup: ignore', (await page.request.post(`/api/v1/estimates/${ign.owner.id}/ignore`, { headers: H, data: { remarks: 'Not taken forward.' } })).status());
  // a Lead who sees all: use the Admin so all three tasks are in scope
  const { E2E_ADMIN } = await import('../e2e/support/auth');
  await signInAs(page, E2E_ADMIN);
  const cases: Array<[string, string, string]> = [['open', open.code, 'Open'], ['closed', closed.code, 'Closed'], ['ignored', ign.code, 'Ignored']];
  for (const w of [1366, 1280, 1024]) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const [tab, code, label] of cases) {
      await page.goto(`/queue?tab=${tab}&assignedBy=anyone&q=${encodeURIComponent(code)}`);
      await expect(page.locator('tbody tr').filter({ hasText: code }).first()).toBeVisible({ timeout: 240000 });
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => { const t = document.querySelector('table') as HTMLElement; let p = t.parentElement as HTMLElement | null; while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowX)) p = p.parentElement; return p ? p.scrollWidth - p.clientWidth : -1; });
      log(`${w}px ${label} tab: table region overflow`, overflow, 'px');
      await tabReport(page, `${w}px ${label}`, code);
    }
  }
});
