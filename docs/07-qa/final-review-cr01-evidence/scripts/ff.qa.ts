import { expect, test, type Page } from '@playwright/test';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { engineerWithEstimate, signInAs } from '../e2e/support/calculated-estimate';
import { tree } from '../e2e/support/part-form';

const log = (...a: unknown[]): void => console.log('QA|', ...a);
const rowCount = (page: Page) => tree(page).locator('li[data-part-row]').count();
const link = (page: Page, sl: string) => tree(page).locator(`a[data-part-id]:has([data-sl-no]:text-is("${sl}"))`);
const current = (page: Page) => tree(page).locator('a[data-part-id]').evaluateAll((as) => as.filter((a) => a.getAttribute('aria-current') === 'true').map((a) => a.querySelector('[data-sl-no]')?.textContent).join(','));

async function humanClick(page: Page, sl: string, holdMs: number): Promise<void> {
  const box = await link(page, sl).boundingBox();
  if (!box) throw new Error('no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
  await page.waitForTimeout(600);
}

test('lost click after keyboard-revealed toolbar', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const { owner, code } = await engineerWithEstimate(testInfo);
  await signInAs(page, owner);
  await page.goto(`/estimates/${code}`);
  await page.waitForSelector('form[data-part-form]', { timeout: 240000 });
  await expect(tree(page)).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Add main assembly' }).click();
    await expect.poll(() => rowCount(page), { timeout: 30000 }).toBe(2 + i);
    await page.waitForTimeout(1200);
  }
  // control: mouse only, human speed
  await humanClick(page, '1', 150);
  await humanClick(page, '2', 150);
  log(proj, 'CONTROL mouse-only human clicks 1 then 2 -> open row:', await current(page));
  await humanClick(page, '3', 150);
  log(proj, 'CONTROL mouse-only human click 3 -> open row:', await current(page));
  // keyboard reveals row 1's toolbar, then a human click on row 2
  for (const hold of [150, 150]) {
    await link(page, '3').click();
    await link(page, '1').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const state = await page.evaluate(() => {
      const li = document.querySelector('li[data-part-row]') as HTMLElement;
      const tb = li.querySelector('[data-row-actions]') as HTMLElement;
      return `row1 toolbar ${tb.getBoundingClientRect().width > 2 ? 'SHOWN' : 'hidden'}, active=${document.activeElement?.tagName}`;
    });
    const before = await link(page, '2').boundingBox();
    await humanClick(page, '2', hold);
    const after = await link(page, '2').boundingBox();
    log(proj, 'KEYBOARD then human click on row 2 (hold', hold, 'ms):', state, '| row 2 y before/after', Math.round(before?.y ?? 0), Math.round(after?.y ?? 0), '| open row now:', await current(page), '(expected 2)');
  }
  // fast click (Playwright default) for comparison
  await link(page, '3').click();
  await link(page, '1').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await link(page, '2').click();
  await page.waitForTimeout(500);
  log(proj, 'KEYBOARD then fast click on row 2: open row now:', await current(page), '(expected 2)');
});
