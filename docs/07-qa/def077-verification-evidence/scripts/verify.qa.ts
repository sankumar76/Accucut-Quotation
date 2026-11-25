import { expect, test, type Page } from '@playwright/test';

import { approvedEstimate } from '../e2e/support/approved-estimate';
import { E2E_ADMIN, connectToTestDatabase, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';
import { expectNoAxeViolations } from '../e2e/support/design-system';
import { moveDeadlineIntoThePast } from '../e2e/support/ignored';

// QA, DEF-077 verification, DL-358 (5)(d): the by-hand reading on the fix head (efc6d7e2), Admin and Lead, 1024 / 1280 / 1366 / 1440 px,
// Open / Closed / Ignored, scrollLeft 0. Throwaway (not part of the product suite). Nothing is scrolled by hand except in the forced-wide case, where it is said.
const log = (...a: unknown[]): void => console.log('QA3|', ...a);
const H = { origin: `http://localhost:${process.env['E2E_DEV_PORT'] ?? '3377'}`, 'content-type': 'application/json' };
const TOL = 0.5;
const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';

interface Item {
  readonly label: string;
  readonly whole: boolean;
  readonly left: number;
  readonly right: number;
  readonly hit: boolean | 'outside-viewport';
}

interface Static {
  readonly regionLeft: number;
  readonly regionRight: number;
  readonly scrollLeft: number;
  readonly overflow: number;
  readonly cellPosition: string;
  readonly cellOpaque: boolean;
  readonly headPosition: string;
  readonly headOpaque: boolean;
  readonly cellLeft: number;
  readonly cellRight: number;
  readonly items: ReadonlyArray<Item>;
  /** Focusable controls outside the Actions cell whose box passes the Actions cell's left edge (under the sticky column). */
  readonly underSticky: ReadonlyArray<string>;
  readonly viewportWidth: number;
}

/** What lies where, at the scrollLeft as it is. The row is the visible `[data-task-code]`. */
async function readStatic(page: Page, code: string): Promise<Static> {
  return page.evaluate(
    ([c, focusable]): Static => {
      const region = document.querySelector('[data-slot="table-container"]') as HTMLElement;
      const row = Array.from(document.querySelectorAll(`[data-task-code="${c}"]`)).find((e) => (e as HTMLElement).offsetParent !== null) as HTMLElement;
      const rb = region.getBoundingClientRect();
      const L = rb.left + region.clientLeft;
      const R = L + region.clientWidth;
      const cell = row.querySelector('td:last-child') as HTMLElement;
      const head = region.querySelector('thead th:last-child') as HTMLElement;
      const opaque = (colour: string): boolean => (colour.startsWith('rgb(') || /,\s*1\)$/.test(colour)) && colour !== 'rgba(0, 0, 0, 0)';
      const cr = cell.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const rectsOf = (el: Element): DOMRect[] => [el, ...Array.from(el.querySelectorAll('*'))].flatMap((n) => Array.from(n.getClientRects()).filter((q) => q.width > 0 && q.height > 0));
      const hitOf = (el: Element): boolean | 'outside-viewport' => {
        const rs = Array.from(el.getClientRects()).filter((q) => q.width > 0 && q.height > 0);
        if (rs.length === 0) return false;
        let result: boolean | 'outside-viewport' = true;
        for (const q of rs) {
          const x = q.left + q.width / 2;
          const y = q.top + q.height / 2;
          if (x < 0 || y < 0 || x >= vw || y >= vh) {
            result = 'outside-viewport';
            continue;
          }
          const top = document.elementFromPoint(x, y);
          if (top === null || !el.contains(top)) return false;
        }
        return result;
      };
      const items: Item[] = [];
      const add = (label: string, el: Element | null): void => {
        if (el === null) return;
        const rs = rectsOf(el);
        if (rs.length === 0) return;
        const left = Math.min(...rs.map((q) => q.left));
        const right = Math.max(...rs.map((q) => q.right));
        items.push({ label, whole: left >= L - 0.5 && right <= R + 0.5, left: Math.round(left * 10) / 10, right: Math.round(right * 10) / 10, hit: hitOf(el) });
      };
      for (const a of Array.from(row.querySelectorAll('a[href],button'))) {
        const name = (a.getAttribute('aria-label') ?? a.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
        add(`control "${name}"`, a);
      }
      add('the Actions cell (all content)', cell);
      add('the Downloaded chip', row.querySelector('[data-slot="download-chip"]'));
      add('the word Closed', row.querySelector('[data-closed-action]'));
      const underSticky: string[] = [];
      for (const f of Array.from(row.querySelectorAll(focusable))) {
        if (cell.contains(f)) continue;
        const q = f.getBoundingClientRect();
        if (q.right > cr.left + 0.5 && q.left < cr.right) underSticky.push((f.getAttribute('aria-label') ?? f.textContent ?? '').trim().slice(0, 30));
      }
      return {
        regionLeft: Math.round(L),
        regionRight: Math.round(R),
        scrollLeft: Math.round(region.scrollLeft),
        overflow: Math.round(region.scrollWidth - region.clientWidth),
        cellPosition: getComputedStyle(cell).position,
        cellOpaque: opaque(getComputedStyle(cell).backgroundColor),
        headPosition: getComputedStyle(head).position,
        headOpaque: opaque(getComputedStyle(head).backgroundColor),
        cellLeft: Math.round(cr.left),
        cellRight: Math.round(cr.right),
        items,
        underSticky,
        viewportWidth: vw,
      };
    },
    [code, FOCUSABLE] as const,
  );
}

interface Stop {
  readonly name: string;
  readonly left: number;
  readonly right: number;
  readonly regionLeft: number;
  readonly regionRight: number;
  readonly scrollLeft: number;
  readonly inRegionX: boolean;
  readonly inViewport: boolean;
  readonly hitAllRects: boolean;
  readonly rects: number;
}

/** Tab from the focusable region through every control of the row `code`, a wait after each press, nothing scrolled by hand (the browser's own focus scroll only). */
async function tabWalk(page: Page, label: string, code: string, waitMs: number): Promise<{ stops: number; notWhole: number; names: string[] }> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-slot="table-container"]').first().focus();
  let notWhole = 0;
  const names: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(waitMs);
    const r = await page.evaluate((c): Stop | { outside: true } => {
      const el = document.activeElement as HTMLElement | null;
      const region = document.querySelector('[data-slot="table-container"]') as HTMLElement | null;
      if (!el || !region || !region.contains(el)) return { outside: true };
      const tr = el.closest('tr');
      if (!tr || tr.getAttribute('data-task-code') !== c) return { outside: true };
      const rb = region.getBoundingClientRect();
      const L = rb.left + region.clientLeft;
      const R = L + region.clientWidth;
      const b = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const rects = Array.from(el.getClientRects());
      const hit = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= vw || y >= vh) return false;
        const top = document.elementFromPoint(x, y);
        return top !== null && el.contains(top);
      };
      const allInRegion = rects.every((q) => q.left >= L - 0.5 && q.right <= R + 0.5);
      return {
        name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        left: Math.round(b.left),
        right: Math.round(b.right),
        regionLeft: Math.round(L),
        regionRight: Math.round(R),
        scrollLeft: Math.round(region.scrollLeft),
        inRegionX: allInRegion,
        inViewport: b.left >= 0 && b.right <= vw && b.top >= 0 && b.bottom <= vh,
        hitAllRects: rects.length > 0 && rects.every((q) => hit(q.left + q.width / 2, q.top + q.height / 2)),
        rects: rects.length,
      };
    }, code);
    if ('outside' in r) {
      log(label, 'STOP at', i + 1);
      break;
    }
    const whole = r.inRegionX && r.inViewport && r.hitAllRects;
    if (!whole) notWhole++;
    names.push(r.name);
    log(label, 'TAB', i + 1, whole ? 'WHOLE' : 'NOT-WHOLE', JSON.stringify(r));
  }
  return { stops: names.length, notWhole, names };
}

async function axeNote(page: Page): Promise<string> {
  try {
    await expectNoAxeViolations(page);
    return 'axe clean';
  } catch (error) {
    return `axe VIOLATIONS: ${String((error as Error).message).replace(/\s+/g, ' ').slice(0, 600)}`;
  }
}

const REGION = '[data-slot="table-container"]';

test('T14 DEF-077 verification: queue as Admin and as Lead at 1024, 1280, 1366, 1440; Open, Closed, Ignored; scrollLeft 0', async ({ page }, testInfo) => {
  test.setTimeout(2_400_000);
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
  await moveDeadlineIntoThePast(open.owner.id);
  await signInAs(page, closed.lead);
  log('setup: quote', (await page.request.post(`/api/v1/estimates/${closed.owner.id}/quoted`, { headers: H })).status(), 'download', (await page.request.get(`/api/v1/estimates/${closed.owner.id}/export`)).status());
  await signInAs(page, ign.lead);
  log('setup: ignore', (await page.request.post(`/api/v1/estimates/${ign.owner.id}/ignore`, { headers: H, data: { remarks: 'Not taken forward.' } })).status());

  const summary: string[] = [];
  const widths = [1366, 1280, 1024, 1440];
  const people = [['Admin', E2E_ADMIN], ['Lead', closed.lead]] as const;
  for (const [who, person] of people) {
    await signInAs(page, person);
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const [tab, code, label] of [['open', open.code, 'Open'], ['closed', closed.code, 'Closed'], ['ignored', ign.code, 'Ignored']] as const) {
        const tag = `${who} ${w}px ${label}`;
        await page.goto(`/queue?tab=${tab}&assignedBy=anyone&q=${encodeURIComponent(code)}`);
        await expect(page.locator('tbody tr').filter({ hasText: code }).first()).toBeVisible({ timeout: 240000 });
        await page.waitForTimeout(700);
        await page.locator(REGION).first().evaluate((el) => {
          el.scrollLeft = 0;
        });
        const s = await readStatic(page, code);
        const bad = s.items.filter((i) => !i.whole);
        const covered = s.items.filter((i) => i.hit === false);
        const stickyOpaque = s.cellPosition === 'sticky' && s.cellOpaque && s.headPosition === 'sticky' && s.headOpaque;
        log(tag, 'STATIC', JSON.stringify({ region: [s.regionLeft, s.regionRight], scrollLeft: s.scrollLeft, overflow: s.overflow, cell: [s.cellLeft, s.cellRight], cellSticky: s.cellPosition, cellOpaque: s.cellOpaque, headSticky: s.headPosition, headOpaque: s.headOpaque, underSticky: s.underSticky }));
        for (const i of s.items) log(tag, 'ITEM', i.whole ? 'INSIDE' : 'OUTSIDE', JSON.stringify(i));
        const axe = await axeNote(page);
        log(tag, axe);
        const walk = await tabWalk(page, `${tag} TAB`, code, 500);
        summary.push(`${tag}: overflow ${s.overflow}, outside-region ${bad.length}, covered ${covered.length}, sticky+opaque ${stickyOpaque}, underSticky ${s.underSticky.length}, passLine ${bad.length === 0 ? 'MET' : stickyOpaque ? 'MET-BY-STICKY' : 'FAIL'}, tab stops ${walk.stops} (${walk.names.join(' | ')}), not whole ${walk.notWhole}, ${axe}`);
      }
    }
  }

  // Forced-wide table (a long name widens it): the sticky column at the right edge, the Tab walk whole. Admin, Open and Ignored tabs.
  await signInAs(page, E2E_ADMIN);
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    for (const [tab, code, label] of [['open', open.code, 'Open'], ['ignored', ign.code, 'Ignored']] as const) {
      const tag = `FORCED-WIDE Admin ${w}px ${label}`;
      await page.goto(`/queue?tab=${tab}&assignedBy=anyone&q=${encodeURIComponent(code)}`);
      await expect(page.locator('tbody tr').filter({ hasText: code }).first()).toBeVisible({ timeout: 240000 });
      await page.waitForTimeout(700);
      await page.locator(REGION).first().evaluate((el) => {
        const t = el.querySelector('table');
        if (t) t.style.minWidth = '2400px';
        el.scrollLeft = 0;
      });
      const s = await readStatic(page, code);
      const edgeOk = Math.abs(s.cellRight - s.regionRight) <= TOL;
      const bad = s.items.filter((i) => !i.whole);
      log(tag, 'STATIC', JSON.stringify({ overflow: s.overflow, cellRight: s.cellRight, regionRight: s.regionRight, edgeOk, sticky: s.cellPosition, opaque: s.cellOpaque, outside: bad.map((b) => b.label), underStickyAtZero: s.underSticky }));
      const walk = await tabWalk(page, `${tag} TAB`, code, 500);
      // At the end of the region (scrolled by hand here, as the spec does): the column is still at the right edge.
      await page.locator(REGION).first().evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const e = await readStatic(page, code);
      const endEdge = Math.abs(e.cellRight - e.regionRight) <= TOL;
      log(tag, 'AT-END', JSON.stringify({ cellRight: e.cellRight, regionRight: e.regionRight, edgeOk: endEdge }));
      summary.push(`${tag}: overflow ${s.overflow}, sticky edge ${edgeOk}, sticky+opaque ${s.cellPosition === 'sticky' && s.cellOpaque}, action outside region ${bad.length}, tab stops ${walk.stops}, not whole ${walk.notWhole}, at end edge ${endEdge}`);
    }
  }

  // One masters table (SCR-17 Fields and formulas, Admin): the ui/table.tsx change must not move it.
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/config/fields');
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 240000 });
    await page.waitForTimeout(1000);
    const m = await page.evaluate((regionSelector) => {
      const region = document.querySelector(regionSelector) as HTMLElement;
      const head = region.querySelector('thead th:last-child') as HTMLElement;
      const cell = region.querySelector('tbody tr td:last-child') as HTMLElement;
      const hb = head.getBoundingClientRect();
      const rb = region.getBoundingClientRect();
      const opaque = (c: string): boolean => (c.startsWith('rgb(') || /,\s*1\)$/.test(c)) && c !== 'rgba(0, 0, 0, 0)';
      return {
        rows: region.querySelectorAll('tbody tr').length,
        headText: (head.textContent ?? '').trim(),
        headWidth: Math.round(hb.width),
        headSticky: getComputedStyle(head).position,
        headOpaque: opaque(getComputedStyle(head).backgroundColor),
        cellSticky: getComputedStyle(cell).position,
        cellOpaque: opaque(getComputedStyle(cell).backgroundColor),
        endsAtEdge: Math.abs(hb.right - (rb.left + region.clientLeft + region.clientWidth)) <= 0.5,
        overflow: Math.round(region.scrollWidth - region.clientWidth),
      };
    }, REGION);
    log(`SCR-17 Admin ${w}px`, 'STATIC', JSON.stringify(m));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(REGION).first().focus();
    let notWhole = 0;
    let stops = 0;
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      const r = await page.evaluate((regionSelector) => {
        const el = document.activeElement as HTMLElement | null;
        const region = document.querySelector(regionSelector) as HTMLElement | null;
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
    summary.push(`SCR-17 Admin ${w}: ${JSON.stringify(m)}, first ${stops} stops, not whole ${notWhole}`);
  }
  for (const s of summary) log('SUMMARY', s);
});
