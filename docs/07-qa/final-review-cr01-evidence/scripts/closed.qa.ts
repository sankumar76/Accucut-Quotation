import { expect, test } from '@playwright/test';

import { approvedEstimate } from '../e2e/support/approved-estimate';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';
import { connectToTestDatabase, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const JSON_HEADERS = { origin: 'http://localhost:3300', 'content-type': 'application/json' };

test('T7 Closed tab chip fit with realistic names', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const a = await approvedEstimate(page, testInfo);
  const client = await connectToTestDatabase();
  try {
    await client.query('UPDATE users SET name = $2 WHERE id = $1::uuid', [a.owner.id, 'Priya Nair']);
    await client.query('UPDATE users SET name = $2 WHERE id = $1::uuid', [a.lead.id, 'Kiran Bose']);
  } finally {
    await client.end();
  }
  await signInAs(page, a.lead);
  await page.request.post(`/api/v1/estimates/${a.owner.id}/quoted`, { headers: JSON_HEADERS });
  await page.request.get(`/api/v1/estimates/${a.owner.id}/export`);
  for (const [w, h] of [[1366, 768], [1280, 800], [1024, 768], [768, 1024], [360, 800]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`/queue?tab=closed&assignedBy=anyone&q=${encodeURIComponent(a.code)}`);
    await expect(page.getByText(a.code).locator('visible=true').first()).toBeVisible({ timeout: 120000 });
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const chip = document.querySelector('[data-slot="download-chip"]') as HTMLElement | null;
      if (!chip) return { chip: 'none' };
      const cr = chip.getBoundingClientRect();
      let p: HTMLElement | null = chip.parentElement;
      let scroller: HTMLElement | null = null;
      while (p) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) { scroller = p; break; } p = p.parentElement; }
      const sr = scroller?.getBoundingClientRect();
      return { chipRight: Math.round(cr.right), chipText: chip.innerText.replace(/\s+/g, ' '), scrollerRight: sr ? Math.round(sr.right) : null, scrollerOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0, chipClipped: sr ? cr.right > sr.right : false, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    log(proj, `CLOSED chip at ${w}px`, JSON.stringify(m));
    await page.screenshot({ path: `qa-out/closed-real-${w}.png` });
  }
  // Open and Ignored tabs for the same widths
  const d = await engineerWithEstimate(testInfo);
  const c2 = await connectToTestDatabase();
  try { await c2.query('UPDATE users SET name = $2 WHERE id = $1::uuid', [d.owner.id, 'Priya Nair']); } finally { await c2.end(); }
  await signInAs(page, a.lead);
  for (const tab of ['open', 'ignored']) {
    if (tab === 'ignored') await page.request.post('/api/v1/estimates/' + d.owner.id + '/ignore', { headers: JSON_HEADERS, data: { remarks: 'Not taken forward.' } });
    for (const [w, h] of [[1366, 768], [1280, 800], [1024, 768]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/queue?tab=' + tab + '&assignedBy=anyone&q=' + encodeURIComponent(d.code));
      await expect(page.getByText(d.code).locator('visible=true').first()).toBeVisible({ timeout: 120000 });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const table = document.querySelector('table') as HTMLElement | null;
        if (!table) return { table: 'none' };
        let p: HTMLElement | null = table.parentElement; let sc: HTMLElement | null = null;
        while (p) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX)) { sc = p; break; } p = p.parentElement; }
        const th = table.querySelector('th:last-child') as HTMLElement; const td = table.querySelector('tbody tr td:last-child') as HTMLElement; const sr = sc?.getBoundingClientRect(); const tr = td.getBoundingClientRect(); const inner = Array.from(td.querySelectorAll('button, a, [data-slot=download-chip]')).map((e) => { const r = e.getBoundingClientRect(); return (e.textContent ?? '').trim().slice(0, 18) + ':' + Math.round(r.left) + '-' + Math.round(r.right); }); return { scrollerOverflow: sc ? sc.scrollWidth - sc.clientWidth : -1, scrollerRight: sr ? Math.round(sr.right) : null, lastHeader: th.innerText, thSticky: getComputedStyle(th).position, tdSticky: getComputedStyle(td).position, tdLeft: Math.round(tr.left), tdRight: Math.round(tr.right), inner };
      });
      log(proj, 'TAB ' + tab + ' at ' + w + 'px', JSON.stringify(m));
    }
  }
});
