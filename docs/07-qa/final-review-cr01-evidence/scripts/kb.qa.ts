import { expect, test, type Page } from '@playwright/test';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';
import { isPhone, tree } from '../e2e/support/part-form';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const rowCount = (page: Page) => tree(page).locator('li[data-part-row]').count();

async function ensureTree(page: Page): Promise<void> {
  if (await tree(page).isVisible().catch(() => false)) return;
  if (isPhone(page)) await page.getByRole('button', { name: /^Parts tree/ }).click();
  await expect(tree(page)).toBeVisible();
}
const report = (page: Page, label: string) =>
  page.evaluate((l) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return `${l}: none`;
    const r = el.getBoundingClientRect();
    const stickies = Array.from(document.querySelectorAll('*'))
      .filter((e) => {
        const cs = getComputedStyle(e);
        const b = e.getBoundingClientRect();
        return (cs.position === 'sticky' || cs.position === 'fixed') && b.height > 20 && b.width > 100 && e !== document.body && e !== document.documentElement && b.bottom > 0 && b.top < innerHeight;
      })
      .map((e) => ({ id: (e.id || e.tagName) + (e.getAttribute('role') ? `[${e.getAttribute('role')}]` : ''), r: e.getBoundingClientRect() }));
    const obscured = stickies.filter((s) => !(r.bottom <= s.r.top || r.top >= s.r.bottom || r.right <= s.r.left || r.left >= s.r.right)).map((s) => s.id);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const top = document.elementFromPoint(cx, cy); const reachable = top === el || el.contains(top); return `${l}: HIT_TEST_OK=${reachable} [${el.getAttribute('aria-label') ?? (el.textContent ?? '').replace(/\s+/g, ' ').slice(0, 22)}] top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} vh=${innerHeight} inViewport=${r.top >= 0 && r.bottom <= innerHeight} OBSCURED_BY=[${obscured.join(',')}] stickies=[${stickies.map((s) => s.id + '@' + Math.round(s.r.top) + '-' + Math.round(s.r.bottom)).join(',')}]`;
  }, label);

test('KB: last-row toolbar vs sticky bar, both Tab directions', async ({ page }, testInfo) => {
  test.setTimeout(500_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const { owner, code } = await engineerWithEstimate(testInfo);
  await signInAs(page, owner);
  await page.goto(`/estimates/${code}`);
  await page.waitForSelector('form[data-part-form]', { timeout: 240000 });
  await ensureTree(page);
  for (let i = 0; i < 4; i++) {
    await ensureTree(page);
    await page.getByRole('button', { name: 'Add main assembly' }).click();
    await ensureTree(page);
    await expect.poll(() => rowCount(page), { timeout: 30000 }).toBe(2 + i);
    await page.waitForTimeout(1200);
  }
  // From the top of the page, Tab forward until the last row's buttons are reached (real keyboard path), then back.
  if (isPhone(page)) {
    log(proj, 'phone: tree is a drawer (modal sheet); checking inside the drawer');
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  const lastLink = tree(page).locator('a[data-part-id]').last();
  await lastLink.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  log(proj, 'KB fwd', await report(page, 'last-row link (keyboard)'));
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    log(proj, 'KB fwd', await report(page, `tab${i + 1}`));
  }
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Shift+Tab');
    log(proj, 'KB back', await report(page, `shift-tab${i + 1}`));
  }
  // second entry: from the bottom of the page backwards (Shift+Tab from the Calculate bar towards the tree)
  if (!isPhone(page)) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('button', { name: 'Calculate' }).focus();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+Tab');
      const lab = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
      if (/^Delete 4 /.test(lab) || /^Delete \d /.test(lab)) {
        log(proj, 'KB back (from the bottom bar, first toolbar button met)', await report(page, `shift-tab#${i + 1}`));
        break;
      }
    }
  }
  await page.screenshot({ path: `qa-out/kb-${proj}.png` });
});
