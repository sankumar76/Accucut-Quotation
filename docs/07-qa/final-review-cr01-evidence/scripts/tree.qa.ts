import { expect, test, type Page } from '@playwright/test';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';
import { showTree, tree } from '../e2e/support/part-form';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const rowCount = (page: Page) => tree(page).locator('li[data-part-row]').count();
const link = (page: Page, sl: string) => tree(page).locator(`a[data-part-id]:has([data-sl-no]:text-is("${sl}"))`);
const btn = (page: Page, words: string, sl: string) => tree(page).getByRole('button', { name: new RegExp(`^${words} ${sl.replaceAll('.', '\\.')} `) });
const flat = async (page: Page): Promise<string[]> =>
  tree(page).locator('a[data-part-id]').evaluateAll((as) => as.map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim() + ' | ' + (a.querySelector('svg[data-node-kind]')?.getAttribute('data-node-kind') ?? '')));
async function settle(page: Page): Promise<void> {
  await expect(tree(page).getByRole('button', { name: /^Add under|^Move|^Delete/ }).first()).not.toHaveAttribute('aria-disabled', 'true', { timeout: 30000 });
}
async function addUnder(page: Page, sl: string, kind: string | null): Promise<void> {
  await link(page, sl).click();
  const before = await rowCount(page);
  if (kind === null) await btn(page, 'Add fastener under', sl).click();
  else {
    await btn(page, 'Add under', sl).click();
    await page.getByRole('menuitem', { name: kind, exact: true }).click();
  }
  await expect.poll(() => rowCount(page), { timeout: 30000 }).toBe(before + 1);
  await settle(page);
}

test('T1 tree build, toolbar geometry, centre presses, keyboard', async ({ page }, testInfo) => {
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
  await page.waitForSelector('form[data-part-form]', { timeout: 180000 });
  await showTree(page);
  log(proj, 'initial', await flat(page));

  await page.getByRole('button', { name: 'Add main assembly' }).click();
  await expect.poll(() => rowCount(page), { timeout: 30000 }).toBe(2);
  await settle(page);
  await addUnder(page, '1', 'Sub-Assembly');
  await addUnder(page, '1.1', 'Part');
  log(proj, 'after one Part under 1.1', await flat(page));
  await addUnder(page, '1.1', 'Part');
  log(proj, 'after two Parts under 1.1 (expect both Sub-part)', await flat(page));
  await addUnder(page, '1.1.1', null);
  log(proj, 'after fastener under 1.1.1', await flat(page));
  await addUnder(page, '1', 'Fastener');
  log(proj, 'tree', await flat(page));
  for (const sl of ['1', '1.1']) {
    await link(page, sl).click();
    await btn(page, 'Add under', sl).click();
    log(proj, `menu items on ${sl}`, await page.getByRole('menuitem').allInnerTexts());
    await page.keyboard.press('Escape');
  }

  await link(page, '1.1').click();
  const geo = await tree(page).locator('li[data-part-row]').evaluateAll((lis) =>
    lis.map((li) => {
      const a = li.querySelector('a[data-part-id]') as HTMLElement;
      const tb = li.querySelector('[data-row-actions]') as HTMLElement | null;
      const ra = a.getBoundingClientRect();
      const rt = tb?.getBoundingClientRect();
      const open = a.getAttribute('aria-current') === 'true';
      const inter = rt ? !(rt.bottom <= ra.top || rt.top >= ra.bottom || rt.right <= ra.left || rt.left >= ra.right) : false;
      const bs = tb ? Array.from(tb.querySelectorAll('button')).map((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }) : [];
      const hit = rt && rt.width > 1 ? (document.elementFromPoint(rt.left + rt.width / 2, rt.top + rt.height / 2)?.closest('button, a')?.tagName ?? 'none') : 'n/a(hidden)';
      return { sl: a.querySelector('[data-sl-no]')?.textContent, open, tbW: rt ? Math.round(rt.width) : null, tbH: rt ? Math.round(rt.height) : null, intersectsLink: inter, buttons: bs, hitAtToolbarCentre: hit };
    }),
  );
  log(proj, 'GEOMETRY', JSON.stringify(geo));

  requests.length = 0;
  const labels: string[] = [];
  const all = await tree(page).locator('a[data-part-id]').count();
  for (let i = 0; i < all; i++) {
    const a = tree(page).locator('a[data-part-id]').nth(i);
    const box = await a.boundingBox();
    if (!box) continue;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    if (proj === 'desktop') {
      await page.mouse.down();
      await page.mouse.up();
    } else await page.touchscreen.tap(cx, cy);
    await page.waitForTimeout(400);
    const sel = await a.getAttribute('aria-current');
    const overlays = (await page.getByRole('alertdialog').count()) + (await page.getByRole('dialog').count()) + (await page.getByRole('menu').count());
    labels.push(`${await a.locator('[data-sl-no]').innerText()}:${sel}:overlay=${overlays}`);
    if (overlays > 0) await page.keyboard.press('Escape');
  }
  log(proj, 'CENTRE PRESSES (row:selected:overlay)', labels.join(' '), '| mutating requests during presses:', requests.length, requests.join(','));

  const sls = await tree(page).locator('li[data-part-row] [data-sl-no]').allInnerTexts();
  const lastSl = sls[sls.length - 1] ?? '2';
  const report = (label: string) =>
    page.evaluate((l) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return `${l}: none`;
      const r = el.getBoundingClientRect();
      const stickies = Array.from(document.querySelectorAll('*'))
        .filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return (cs.position === 'sticky' || cs.position === 'fixed') && b.height > 20 && b.width > 100 && e !== document.body && e !== document.documentElement; })
        .map((e) => ({ id: e.id || e.tagName, r: e.getBoundingClientRect() }));
      const obscured = stickies.filter((s) => !(r.bottom <= s.r.top || r.top >= s.r.bottom || r.right <= s.r.left || r.left >= s.r.right)).map((s) => s.id);
      return `${l}: ${el.getAttribute('aria-label') ?? el.textContent?.slice(0, 30)} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} vh=${innerHeight} fullyInViewport=${r.top >= 0 && r.bottom <= innerHeight} obscuredBy=[${obscured.join(',')}] stickyTops=[${stickies.map((s) => s.id + '@' + Math.round(s.r.top)).join(',')}]`;
    }, label);
  await link(page, lastSl).scrollIntoViewIfNeeded();
  await link(page, lastSl).focus();
  log(proj, 'KB fwd', await report('last-row link'));
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    log(proj, 'KB fwd', await report(`tab${i + 1}`));
  }
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    log(proj, 'KB back', await report(`shift-tab${i + 1}`));
  }
  await page.screenshot({ path: `qa-out/tree-${proj}.png` });
});
