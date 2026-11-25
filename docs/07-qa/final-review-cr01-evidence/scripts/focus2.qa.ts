import { expect, test, type Page } from '@playwright/test';

import { approvedEstimate } from '../e2e/support/approved-estimate';
import { E2E_ADMIN, connectToTestDatabase, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';

// QA, DL-358 (D): keyboard focus check with the corrected hit test, on SCR-03 (Admin), SCR-17 (Admin) and the Engineer's list.
// Throwaway, not part of the product suite. Reading: after each real Tab press, 500 ms (smooth scroll), nothing scrolled by hand.
const log = (...a: unknown[]): void => console.log('QA2|', ...a);
const H = { origin: `http://localhost:${process.env['E2E_DEV_PORT'] ?? '3377'}`, 'content-type': 'application/json' };

interface Reading {
  readonly name: string;
  readonly tag: string;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly regionLeft: number;
  readonly regionRight: number;
  readonly scrollLeft: number | null;
  readonly regionOverflow: number | null;
  readonly inRegionX: boolean;
  readonly inViewport: boolean;
  readonly hiddenPx: number;
  /** `control.contains(elementFromPoint(centre of the box))` (the DL-358 (d) hit test). */
  readonly hitCentre: boolean | 'outside-viewport';
  /** Same test at the centre of every client rect of the control (an inline link that wraps has several). */
  readonly hitAllRects: boolean;
  readonly rects: number;
  readonly sticky: boolean;
  readonly done?: true;
}

/** Tab from the region of the first table on the page (the region is focusable) through every control inside it, until focus leaves it. */
async function tabThroughTable(page: Page, label: string, rowFilter: string | null, maxStops: number): Promise<{ stops: number; failures: number; partly: number }> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-slot="table-container"]').first().focus();
  let failures = 0;
  let partly = 0;
  let stops = 0;
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    const r = await page.evaluate((filter): Reading | { outside: true; name: string } => {
      const el = document.activeElement as HTMLElement | null;
      const region = document.querySelector('[data-slot="table-container"]') as HTMLElement | null;
      if (!el || !region || !region.contains(el)) return { outside: true, name: (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim().slice(0, 30) };
      const tr = el.closest('tr');
      if (filter !== null && tr && !(tr.textContent ?? '').includes(filter)) return { outside: true, name: 'other-row' };
      const rb = region.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const hit = (x: number, y: number): boolean | 'outside-viewport' => {
        if (x < 0 || y < 0 || x >= vw || y >= vh) return 'outside-viewport';
        const top = document.elementFromPoint(x, y);
        return top !== null && el.contains(top);
      };
      const rects = Array.from(el.getClientRects());
      const hitAllRects = rects.length > 0 && rects.every((q) => hit(q.left + q.width / 2, q.top + q.height / 2) === true);
      const hiddenPx = Math.max(0, Math.round(Math.max(rb.left - b.left, 0) + Math.max(b.right - rb.right, 0)));
      const cs = getComputedStyle(el.closest('td,th') ?? el);
      return {
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        tag: el.tagName,
        left: Math.round(b.left),
        right: Math.round(b.right),
        width: Math.round(b.width),
        regionLeft: Math.round(rb.left),
        regionRight: Math.round(rb.right),
        scrollLeft: Math.round(region.scrollLeft),
        regionOverflow: Math.round(region.scrollWidth - region.clientWidth),
        inRegionX: b.left >= rb.left - 0.5 && b.right <= rb.right + 0.5,
        inViewport: b.left >= 0 && b.right <= vw && b.top >= 0 && b.bottom <= vh,
        hiddenPx,
        hitCentre: hit(b.left + b.width / 2, b.top + b.height / 2),
        hitAllRects,
        rects: rects.length,
        sticky: cs.position === 'sticky',
      };
    }, rowFilter);
    if ('outside' in r) {
      log(label, 'STOP at', i + 1, JSON.stringify(r));
      break;
    }
    stops++;
    const whole = r.inRegionX && r.inViewport && r.hitAllRects;
    if (!whole) failures++;
    if (r.hiddenPx > 0) partly++;
    log(label, 'TAB', i + 1, whole ? 'WHOLE' : 'NOT-WHOLE', JSON.stringify(r));
  }
  return { stops, failures, partly };
}

async function overflowOf(page: Page): Promise<number> {
  return page.evaluate(() => {
    const r = document.querySelector('[data-slot="table-container"]') as HTMLElement | null;
    return r ? r.scrollWidth - r.clientWidth : -1;
  });
}

test('T13 focus check: queue (Admin), SCR-17 (Admin), Engineer list at 1024, 1280, 1366, 1440 (corrected hit test)', async ({ page }, testInfo) => {
  test.setTimeout(1_500_000);
  await ensureE2eUsers();
  await ensureE2eAdmin();
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
  log('setup: ignore', (await page.request.post(`/api/v1/estimates/${ign.owner.id}/ignore`, { headers: H, data: { remarks: 'Not taken forward.' } })).status());

  const summary: string[] = [];
  const widths = [1366, 1280, 1024, 1440];

  // 1. SCR-03 as the Admin (corrected hit test): row filtered by code, every control of the row
  await signInAs(page, E2E_ADMIN);
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const [tab, code, label] of [['open', open.code, 'Open'], ['closed', closed.code, 'Closed'], ['ignored', ign.code, 'Ignored']] as const) {
      await page.goto(`/queue?tab=${tab}&assignedBy=anyone&q=${encodeURIComponent(code)}`);
      await expect(page.locator('tbody tr').filter({ hasText: code }).first()).toBeVisible({ timeout: 240000 });
      await page.waitForTimeout(700);
      log(`SCR-03 Admin ${w}px ${label}: region overflow`, await overflowOf(page));
      const res = await tabThroughTable(page, `SCR-03 Admin ${w}px ${label}`, code, 12);
      summary.push(`SCR-03 Admin ${w} ${label}: stops ${res.stops}, not whole ${res.failures}, partly hidden ${res.partly}`);
    }
  }

  // 2. SCR-17 as the Admin: every control in every row
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/config/fields');
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 240000 });
    await page.waitForTimeout(1000);
    const rows = await page.locator('tbody tr').count();
    log(`SCR-17 Admin ${w}px: rows`, rows, 'region overflow', await overflowOf(page));
    const res = await tabThroughTable(page, `SCR-17 Admin ${w}px`, null, 400);
    summary.push(`SCR-17 Admin ${w}: rows ${rows}, stops ${res.stops}, not whole ${res.failures}, partly hidden ${res.partly}`);
  }

  // 3. The Engineer's own list (Open, Closed, Ignored), each as the Engineer who owns the task
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const [owner, tab, code, label] of [[open.owner, 'open', open.code, 'Open'], [closed.owner, 'closed', closed.code, 'Closed'], [ign.owner, 'ignored', ign.code, 'Ignored']] as const) {
      await signInAs(page, owner);
      await page.goto(`/queue?tab=${tab}`);
      await expect(page.locator('tbody tr').filter({ hasText: code }).first()).toBeVisible({ timeout: 240000 });
      await page.waitForTimeout(700);
      log(`Engineer ${w}px ${label}: region overflow`, await overflowOf(page));
      const res = await tabThroughTable(page, `Engineer ${w}px ${label}`, code, 12);
      summary.push(`Engineer ${w} ${label}: stops ${res.stops}, not whole ${res.failures}, partly hidden ${res.partly}`);
    }
  }
  for (const s of summary) log('SUMMARY', s);
});
