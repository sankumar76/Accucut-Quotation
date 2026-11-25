import { expect, test } from '@playwright/test';

import { E2E_ADMIN, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { signInAs } from '../e2e/support/calculated-estimate';
import { expectNoAxeViolations } from '../e2e/support/design-system';

// QA, DEF-077 verification, DL-358 (5)(d) spot-check: one masters table (SCR-14 Users, three buttons in the Actions column, `actionButtons={3}`, 156 px)
// must read the same after the `ui/table.tsx` change (the `wide` width and the optional visible heading word). Throwaway, not part of the product suite.
const log = (...a: unknown[]): void => console.log('QA4|', ...a);
const REGION = '[data-slot="table-container"]';

test('T15 SCR-14 Users (Admin): Actions column sticky, opaque, 156 px, every row action whole, Tab walk whole, at 1024 / 1280 / 1366 / 1440', async ({ page }) => {
  test.setTimeout(900_000);
  await ensureE2eUsers();
  await ensureE2eAdmin();
  await signInAs(page, E2E_ADMIN);
  for (const w of [1366, 1280, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/users');
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 240000 });
    await page.waitForTimeout(1000);
    await page.locator(REGION).first().evaluate((el) => {
      el.scrollLeft = 0;
    });
    const m = await page.evaluate((sel) => {
      const region = document.querySelector(sel) as HTMLElement;
      const head = region.querySelector('thead th:last-child') as HTMLElement;
      const rows = Array.from(region.querySelectorAll('tbody tr')) as HTMLElement[];
      const rb = region.getBoundingClientRect();
      const L = rb.left + region.clientLeft;
      const R = L + region.clientWidth;
      const opaque = (c: string): boolean => (c.startsWith('rgb(') || /,\s*1\)$/.test(c)) && c !== 'rgba(0, 0, 0, 0)';
      const hb = head.getBoundingClientRect();
      let outside = 0;
      let controls = 0;
      let cellsSticky = 0;
      let cellsOpaque = 0;
      for (const r of rows) {
        const cell = r.querySelector('td:last-child') as HTMLElement;
        if (getComputedStyle(cell).position === 'sticky') cellsSticky++;
        if (opaque(getComputedStyle(cell).backgroundColor)) cellsOpaque++;
        for (const b of Array.from(cell.querySelectorAll('a[href],button'))) {
          controls++;
          const q = b.getBoundingClientRect();
          if (q.left < L - 0.5 || q.right > R + 0.5) outside++;
        }
      }
      return {
        rows: rows.length,
        controls,
        outside,
        cellsSticky,
        cellsOpaque,
        headText: (head.textContent ?? '').trim(),
        headWidth: Math.round(hb.width),
        headSticky: getComputedStyle(head).position,
        headOpaque: opaque(getComputedStyle(head).backgroundColor),
        endsAtEdge: Math.abs(hb.right - R) <= 0.5,
        overflow: Math.round(region.scrollWidth - region.clientWidth),
      };
    }, REGION);
    log(`SCR-14 Admin ${w}px STATIC`, JSON.stringify(m));
    let stops = 0;
    let notWhole = 0;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(REGION).first().focus();
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      const r = await page.evaluate((sel) => {
        const el = document.activeElement as HTMLElement | null;
        const region = document.querySelector(sel) as HTMLElement | null;
        if (!el || !region || !region.contains(el)) return null;
        const rb = region.getBoundingClientRect();
        const L = rb.left + region.clientLeft;
        const R = L + region.clientWidth;
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;
        const rects = Array.from(el.getClientRects());
        return (
          rects.length > 0 &&
          rects.every((q) => {
            const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
            return q.left >= L - 0.5 && q.right <= R + 0.5 && q.left >= 0 && q.right <= vw && q.top >= 0 && q.bottom <= vh && t !== null && el.contains(t);
          })
        );
      }, REGION);
      if (r === null) break;
      stops++;
      if (!r) notWhole++;
    }
    let axe = 'axe clean';
    try {
      await expectNoAxeViolations(page);
    } catch (error) {
      axe = `axe VIOLATIONS: ${String((error as Error).message).replace(/\s+/g, ' ').slice(0, 400)}`;
    }
    log(`SCR-14 Admin ${w}px SUMMARY`, JSON.stringify({ ...m, tabStops: stops, notWhole, axe }));
  }
});
