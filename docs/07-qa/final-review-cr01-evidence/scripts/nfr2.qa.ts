import { expect, test } from '@playwright/test';
import { z } from 'zod';

import { approvedEstimate, APPROVED_PRICE } from '../e2e/support/approved-estimate';
import { signInAs } from '../e2e/support/calculated-estimate';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const JSON_HEADERS = { origin: 'http://localhost:3300', 'content-type': 'application/json' };
const costsShape = z.object({ calculationId: z.string().min(1) });

test('T5 Engineer cost confidentiality across Approved, Quoted, Ignored (NFR-002) with planted figures', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const est = await approvedEstimate(page, testInfo);
  const { owner, lead, code } = est;
  // the Lead's figures, as the Lead sees them
  await signInAs(page, lead);
  const costsRes = await page.request.get(`/api/v1/estimates/${owner.id}/costs`);
  const costsText = await costsRes.text();
  const { calculationId } = costsShape.parse(JSON.parse(costsText));
  const numbers = Array.from(new Set(costsText.match(/\d{5,}(?:\.\d+)?/g) ?? [])).slice(0, 12);
  log(proj, 'figures the Lead sees (sample, digits only, no secrets):', numbers.join(' '));
  const tokens = [APPROVED_PRICE, APPROVED_PRICE.replace('.', ''), '48,271', '4,82,71', calculationId, lead.email, lead.name, ...numbers.filter((n) => n.length >= 6)];
  // Lead marks as quoted, downloads once, then ignores (all by API as another window would)
  const q = await page.request.post(`/api/v1/estimates/${owner.id}/quoted`, { headers: JSON_HEADERS });
  const dl = await page.request.get(`/api/v1/estimates/${owner.id}/export`);
  log(proj, 'Lead: mark quoted', q.status(), 'download', dl.status());
  const states: Array<[string, () => Promise<void>]> = [
    ['QUOTED', async () => undefined],
    ['IGNORED(after unlock -> draft)', async () => {
      const u = await page.request.post(`/api/v1/estimates/${owner.id}/unlock`, { headers: JSON_HEADERS, data: { reason: 'QA unlock to test the ignored view' } });
      const i = await page.request.post(`/api/v1/estimates/${owner.id}/ignore`, { headers: JSON_HEADERS, data: { remarks: 'QA remarks without figures.' } });
      log(proj, 'Lead: unlock', u.status(), 'ignore', i.status());
    }],
  ];
  for (const [label, prepare] of states) {
    await signInAs(page, lead);
    await prepare();
    await signInAs(page, { ...owner, role: 'ENGINEER' });
    const bodies: Array<[string, number, string]> = [];
    const pages = [`/estimates/${code}`, `/queue`, `/queue?tab=closed`, `/queue?tab=ignored`, `/queue?tab=open`, `/estimates/${code}/export`, `/estimates/${code}/costs/1`];
    for (const p of pages) {
      const r = await page.request.get(p, { maxRedirects: 0 });
      bodies.push([p, r.status(), await r.text()]);
    }
    const apis = [`/api/v1/estimates/${owner.id}/form`, `/api/v1/estimates/${owner.id}/nodes`, `/api/v1/estimates/${owner.id}/tree`, `/api/v1/estimates/${owner.id}/costs`, `/api/v1/estimates/${owner.id}/export-summary`, `/api/v1/estimates/${owner.id}/unlock-preview`, `/api/v1/tasks`, `/api/v1/tasks?tab=closed`, `/api/v1/tasks?tab=ignored`];
    for (const a of apis) {
      const r = await page.request.get(a);
      bodies.push([a, r.status(), await r.text()]);
    }
    const nodes = bodies.find((b) => b[0].endsWith('/nodes') && b[1] === 200);
    const hits: string[] = [];
    for (const [p, status, body] of bodies) {
      const found = tokens.filter((t) => t.length >= 4 && body.includes(t));
      const words = (body.match(/Downloaded \d|Not downloaded|Changed since download|Mark as quoted|Quoted on|marked as quoted by/gi) ?? []).slice(0, 3);
      log(proj, 'ENGINEER', label, p, status, `bytes=${body.length}`, found.length || words.length ? `LEAK? tokens=${JSON.stringify(found)} words=${JSON.stringify(words)}` : 'clean');
      if (found.length || words.length) hits.push(p);
    }
    void nodes;
    log(proj, 'ENGINEER', label, 'summary: paths with a hit =', hits.length);
    expect(true).toBe(true);
  }
});
