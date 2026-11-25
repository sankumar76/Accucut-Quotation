import { expect, test } from '@playwright/test';

import { approvedEstimate } from '../e2e/support/approved-estimate';
import { signInAs } from '../e2e/support/calculated-estimate';
import { E2E_ADMIN, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const H = { origin: 'http://localhost:3300', 'content-type': 'application/json' };

test('T8 Admin: actions on Approved/Quoted/Ignored; every mutating route refuses an Ignored RFQ', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const a = await approvedEstimate(page, testInfo);
  const id = a.owner.id;
  await signInAs(page, E2E_ADMIN);
  await page.goto(`/estimates/${a.code}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(a.code, { timeout: 240000 });
  await page.waitForTimeout(1500);
  log(proj, 'ADMIN SCR-06 Approved: actions', JSON.stringify(await page.locator('#review-actions button, #review-actions a').allInnerTexts()));
  const q = await page.request.post(`/api/v1/estimates/${id}/quoted`, { headers: H });
  log(proj, 'ADMIN mark quoted', q.status());
  await page.reload();
  await page.waitForTimeout(1500);
  log(proj, 'ADMIN SCR-06 Quoted: actions', JSON.stringify(await page.locator('#review-actions button, #review-actions a').allInnerTexts()), '| cancel-approval/remove-price controls:', await page.locator('#review-cancel, #review-remove-price').count());
  const again = await page.request.post(`/api/v1/estimates/${id}/quoted`, { headers: H });
  log(proj, 'ADMIN second mark quoted (already Quoted)', again.status(), (await again.text()).slice(0, 120));
  // ignore a Quoted estimate must be refused (ignore is "from any status before Quoted")
  const ig = await page.request.post(`/api/v1/estimates/${id}/ignore`, { headers: H, data: { remarks: 'QA remarks.' } });
  log(proj, 'ADMIN ignore of a QUOTED estimate', ig.status(), (await ig.text()).slice(0, 140));
  // unlock the quoted estimate, re-approve path skipped; ignore from Draft after unlock
  const un = await page.request.post(`/api/v1/estimates/${id}/unlock`, { headers: H, data: { reason: 'QA unlock.' } });
  log(proj, 'ADMIN unlock of QUOTED', un.status());
  const ig2 = await page.request.post(`/api/v1/estimates/${id}/ignore`, { headers: H, data: { remarks: '  ' } });
  log(proj, 'ADMIN ignore with blank remarks', ig2.status(), (await ig2.text()).replace(/\s+/g, ' ').slice(0, 160));
  const longRemarks = 'x'.repeat(501);
  const ig3 = await page.request.post(`/api/v1/estimates/${id}/ignore`, { headers: H, data: { remarks: longRemarks } });
  log(proj, 'ADMIN ignore with 501 chars', ig3.status());
  const zw = await page.request.post(`/api/v1/estimates/${id}/ignore`, { headers: H, data: { remarks: 'hidden‍char' } });
  log(proj, 'ADMIN ignore with a zero-width joiner', zw.status(), (await zw.text()).replace(/\s+/g, ' ').slice(0, 200));
  const ok = await page.request.post(`/api/v1/estimates/${id}/ignore`, { headers: H, data: { remarks: 'a'.repeat(500) } });
  log(proj, 'ADMIN ignore with exactly 500 chars', ok.status());
  const ok2 = await page.request.post(`/api/v1/estimates/${id}/ignore`, { headers: H, data: { remarks: 'second' } });
  log(proj, 'ADMIN second ignore', ok2.status(), (await ok2.text()).slice(0, 100));
  // the frozen RFQ
  const probes: Array<[string, string, string, unknown?]> = [
    ['recalculate', 'POST', `/api/v1/estimates/${id}/recalculate`],
    ['calculate', 'POST', `/api/v1/estimates/${id}/calculate`],
    ['approve', 'POST', `/api/v1/estimates/${id}/approve`, { calculationId: '00000000-0000-4000-8000-000000000000', price: '1.00' }],
    ['unlock', 'POST', `/api/v1/estimates/${id}/unlock`, { reason: 'x' }],
    ['quoted', 'POST', `/api/v1/estimates/${id}/quoted`],
    ['cancel approval', 'POST', `/api/v1/estimates/${id}/approval/cancel`, { reason: 'x' }],
    ['remove price', 'POST', `/api/v1/estimates/${id}/approval/remove-price`],
    ['customer', 'PUT', `/api/v1/estimates/${id}/customer`, { customerId: '00000000-0000-4000-8000-000000000000' }],
    ['export', 'GET', `/api/v1/estimates/${id}/export`],
    ['tree add', 'POST', `/api/v1/estimates/${id}/nodes`, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' }],
    ['tree move', 'POST', `/api/v1/estimates/${id}/tree/move`, { nodeId: id, revision: 1, parentId: null, index: 0 }],
    ['task patch (reassign to same Engineer)', 'PATCH', `/api/v1/tasks/${id}`, { engineerId: id }],
    ['task patch (deadline)', 'PATCH', `/api/v1/tasks/${id}`, { deadlineAt: '2099-06-01T10:00:00+05:30' }],
  ];
  for (const [label, method, url, data] of probes) {
    const r = await page.request.fetch(url, { method, headers: H, ...(data === undefined ? {} : { data }) });
    log(proj, 'ADMIN on IGNORED', label, r.status(), (await r.text()).replace(/\s+/g, ' ').slice(0, 110));
  }
  await page.reload();
  await page.waitForTimeout(1500);
  log(proj, 'ADMIN SCR-06 Ignored: controls', JSON.stringify(await page.locator('main button:visible').allInnerTexts()).slice(0, 300));
  const rs = await page.request.post(`/api/v1/estimates/${id}/restore`, { headers: H });
  log(proj, 'ADMIN restore', rs.status());
  const rs2 = await page.request.post(`/api/v1/estimates/${id}/restore`, { headers: H });
  log(proj, 'ADMIN second restore', rs2.status(), (await rs2.text()).slice(0, 100));
});
