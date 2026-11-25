import { expect, test, type Page } from '@playwright/test';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';
import { isPhone, tree } from '../e2e/support/part-form';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const rowCount = (page: Page) => tree(page).locator('li[data-part-row]').count();
const link = (page: Page, sl: string) => tree(page).locator(`a[data-part-id]:has([data-sl-no]:text-is("${sl}"))`);
const btn = (page: Page, words: string, sl: string) => tree(page).getByRole('button', { name: new RegExp(`^${words} ${sl.replaceAll('.', '\\.')} `) });
const flat = async (page: Page): Promise<string> =>
  tree(page).locator('a[data-part-id]').evaluateAll((as) => as.map((a) => `${a.querySelector('[data-sl-no]')?.textContent}=${(a.querySelector('svg[data-node-kind]')?.getAttribute('data-node-kind') ?? '?').slice(0, 4)}`).join(' '));

async function ensureTree(page: Page): Promise<void> {
  if (await tree(page).isVisible().catch(() => false)) return;
  if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}
async function settle(page: Page): Promise<void> {
  await ensureTree(page);
  await expect(tree(page).getByRole('button', { name: /^Add under|^Move|^Delete/ }).first()).not.toHaveAttribute('aria-disabled', 'true', { timeout: 30000 });
}
async function select(page: Page, sl: string): Promise<void> {
  await ensureTree(page);
  await link(page, sl).click();
  await ensureTree(page);
}
async function addUnder(page: Page, sl: string, kind: string | null): Promise<void> {
  await select(page, sl);
  const before = await rowCount(page);
  if (kind === null) await btn(page, 'Add fastener under', sl).click();
  else {
    await btn(page, 'Add under', sl).click();
    await page.getByRole('menuitem', { name: kind, exact: true }).click();
  }
  await ensureTree(page);
  await expect.poll(() => rowCount(page), { timeout: 30000 }).toBe(before + 1);
  await settle(page);
}
const overflow = async (page: Page, label: string, proj: string): Promise<void> => {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  log(proj, 'OVERFLOW', label, o.sw > o.cw ? `SIDEWAYS SCROLL sw=${o.sw} cw=${o.cw}` : `ok (${o.sw}<=${o.cw})`);
};
const toolbarState = (page: Page) =>
  tree(page).locator('li[data-part-row]').evaluateAll((lis) =>
    lis.map((li) => {
      const a = li.querySelector('a[data-part-id]') as HTMLElement;
      const tb = li.querySelector('[data-row-actions]') as HTMLElement;
      const r = tb.getBoundingClientRect();
      return `${a.querySelector('[data-sl-no]')?.textContent}:${r.width > 2 ? 'SHOWN' : 'hidden'}`;
    }).join(' '),
  );

test('T3 tree functions, :has() reveal, overflow', async ({ page, browserName }, testInfo) => {
  test.setTimeout(600_000);
  const proj = testInfo.project.name;
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && /\/api\/v1\/estimates\//.test(r.url())) requests.push(`${r.method()} ${new URL(r.url()).pathname.replace(/[0-9a-f-]{36}/g, ':id')}`);
  });
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const { owner, code } = await engineerWithEstimate(testInfo);
  await signInAs(page, owner);
  await page.goto(`/estimates/${code}`);
  await page.waitForSelector('form[data-part-form]', { timeout: 240000 });
  await ensureTree(page);
  log(proj, browserName, 'viewport', JSON.stringify(page.viewportSize()), 'initial', await flat(page));

  await page.getByRole('button', { name: 'Add main assembly' }).click();
  await ensureTree(page);
  await expect.poll(() => rowCount(page), { timeout: 30000 }).toBe(2);
  await settle(page);
  await addUnder(page, '1', 'Sub-Assembly');
  await addUnder(page, '1.1', 'Part');
  await addUnder(page, '1.1', 'Part');
  await addUnder(page, '1.1.1', null);
  await addUnder(page, '1', 'Fastener');
  log(proj, 'tree built', await flat(page));
  await overflow(page, 'tree built', proj);

  // level-4 row open (DEF-075 gap 2): no sideways scroll, toolbar inside the viewport
  await select(page, '1.1.1.1');
  const lvl4 = await page.evaluate(() => { const a = document.querySelector('a[aria-current=true]') as HTMLElement; const li = a.closest('li') as HTMLElement; const tb = li.querySelector('[data-row-actions]') as HTMLElement; const r = tb.getBoundingClientRect(); const l = a.getBoundingClientRect(); return { openRow: a.querySelector('[data-sl-no]')?.textContent, linkLeft: Math.round(l.left), linkRight: Math.round(l.right), toolbarLeft: Math.round(r.left), toolbarRight: Math.round(r.right), toolbarW: Math.round(r.width), clientW: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth }; });
  log(proj, 'LEVEL-4 ROW OPEN', JSON.stringify(lvl4), lvl4.toolbarRight <= lvl4.clientW && lvl4.scrollW <= lvl4.clientW ? 'PASS (no sideways scroll, toolbar inside)' : 'FAIL');
  await page.screenshot({ path: 'qa-out/level4-' + proj + '.png' });
  // :has() reveal: selected row shows toolbar, others hidden
  await select(page, '1.1');
  log(proj, 'REVEAL selected(1.1)', await toolbarState(page));
  // keyboard focus reveal (focus-visible) on a non-open row via Tab from the selected row's buttons
  await link(page, '1.1.2').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  log(proj, 'REVEAL after keyboard focus on 1.1.2 link', 'active=', await page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.slice(0, 20)), await toolbarState(page));
  // Tab into the toolbar buttons of a row that is NOT open
  await page.keyboard.press('Tab');
  log(proj, 'REVEAL tab to handle of 1.1.2 (not open)', 'active=', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), await toolbarState(page));
  await page.locator('h1').first().click({ timeout: 2500 }).catch(() => undefined);
  await page.waitForTimeout(400);
  await select(page, '2');
  try {
    await btn(page, 'Add under', '2').click({ timeout: 8000 });
  } catch (e) {
    const d = await page.evaluate(() => {
      const cur = Array.from(document.querySelectorAll('a[data-part-id]')).map((a) => a.querySelector('[data-sl-no]')?.textContent + ':' + a.getAttribute('aria-current'));
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.getAttribute('aria-label')?.startsWith('Add under 2 ')) as HTMLElement;
      const r = b.getBoundingClientRect();
      const e2 = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) as HTMLElement | null;
      const li = e2?.closest('li[data-part-row]');
      return { cur, btn: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vh: innerHeight, scrollY: Math.round(scrollY), hitRow: li?.querySelector('[data-sl-no]')?.textContent, hitTag: e2?.tagName, groupClass: b.closest('[data-row-actions]')?.className.slice(0, 40), active: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName };
    });
    log(proj, 'CLICK ON + OF 2 FAILED', JSON.stringify(d));
    await page.screenshot({ path: 'qa-out/ff-fail-' + proj + '.png' });
  }
  log(proj, 'REVEAL menu open on 2', await toolbarState(page));
  await page.keyboard.press('Escape');

  // Move via handle menu
  await select(page, '1.1.2');
  requests.length = 0;
  await btn(page, 'Move', '1.1.2').click();
  await page.getByRole('menuitem', { name: 'Move up', exact: true }).waitFor();
  const items = await page.getByRole('menuitem').evaluateAll((es) => es.map((e) => `${e.textContent}:${e.getAttribute('aria-disabled')}`));
  log(proj, 'MOVE menu items on 1.1.2', items.join(' '));
  await page.getByRole('menuitem', { name: 'Move up', exact: true }).click();
  await ensureTree(page);
  await page.waitForTimeout(2500);
  log(proj, 'after Move up of 1.1.2', await flat(page), '| announcer:', (await page.locator('[role=status]').allInnerTexts()).join(' // '), '| requests:', requests.join(','));
  await overflow(page, 'after move', proj);

  // Delete flow
  await select(page, '1.1');
  await btn(page, 'Delete', '1.1').click();
  const dlg = page.getByRole('alertdialog');
  await expect(dlg).toBeVisible();
  log(proj, 'DELETE dialog', (await dlg.innerText()).replace(/\s+/g, ' '));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  log(proj, 'after cancel delete, focus on', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), '| rows', await rowCount(page));
  await btn(page, 'Delete', '1.1').click();
  await expect(dlg).toBeVisible();
  const confirm = dlg.getByRole('button', { name: /^Delete/ });
  await confirm.click();
  await ensureTree(page);
  await expect.poll(() => rowCount(page), { timeout: 30000 }).toBe(3);
  log(proj, 'after delete 1.1 (4 rows go)', await flat(page), '| announcer:', (await page.locator('[role=status]').allInnerTexts()).join(' // '));
  // single Part under parent should be named "Part"
  await addUnder(page, '1', 'Part');
  await addUnder(page, '1', 'Part');
  log(proj, 'two Parts under 1 (Sub-part naming)', await tree(page).locator('a[data-part-id]').evaluateAll((as) => as.map((a) => a.textContent?.replace(/\s+/g, ' ').slice(0, 24)).join(' / ')));
  await select(page, '1.2');
  await btn(page, 'Delete', '1.2').click();
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: /^Delete/ }).click();
  await ensureTree(page);
  await page.waitForTimeout(2500);
  log(proj, 'after deleting one of two Parts (other turns back to Part)', await tree(page).locator('a[data-part-id]').evaluateAll((as) => as.map((a) => a.textContent?.replace(/\s+/g, ' ').slice(0, 24)).join(' / ')));
  await overflow(page, 'end', proj);
  await page.screenshot({ path: `qa-out/tree2-${proj}.png` });
});
