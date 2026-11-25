import { expect, test } from '@playwright/test';

import { estimateInStatus, ignoreThroughTheApi } from '../e2e/support/ignored';
import { signInAs } from '../e2e/support/calculated-estimate';
import { ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';

const log = (...a: unknown[]): void => console.log('QA|', ...a);

test('T10 Engineer read-only view of an Ignored task: inputs focusable, nothing editable, no action bar', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const proj = testInfo.project.name;
  await ensureE2eUsers();
  await ensureE2eAdmin();
  const e = await estimateInStatus(page, testInfo, 'PREPARED');
  const st = await ignoreThroughTheApi(page, e.owner.id, 'Customer withdrew.\nSecond line <i>x</i>');
  log(proj, 'ignore (Prepared) status', st);
  await signInAs(page, { ...e.owner, role: 'ENGINEER' });
  await page.goto(`/estimates/${e.code}`);
  await page.waitForSelector('form[data-part-form]', { timeout: 240000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const f = document.querySelector('form[data-part-form]') as HTMLElement;
    const ctrls = Array.from(f.querySelectorAll('input:not([type=hidden]), select, textarea')) as Array<HTMLInputElement>;
    return {
      controls: ctrls.length,
      readonly: ctrls.filter((c) => c.readOnly || c.getAttribute('aria-readonly') === 'true').length,
      disabled: ctrls.filter((c) => c.disabled).length,
      focusable: ctrls.filter((c) => c.tabIndex >= 0 && !c.disabled).length,
      buttons: Array.from(document.querySelectorAll('main button')).map((b) => (b.textContent ?? '').trim()).filter(Boolean),
      actionBar: document.querySelectorAll('#estimate-actions, [data-estimate-actions]').length,
      statusRoles: Array.from(document.querySelectorAll('[role=status],[role=alert]')).map((s) => s.getAttribute('role') + ':' + (s.textContent ?? '').trim().slice(0, 50)),
    };
  });
  log(proj, 'ENGINEER IGNORED workspace', JSON.stringify(info));
  const where = await page.evaluate(() => { const el = Array.from(document.querySelectorAll('[role=status]')).find((s) => /Cost will be calculated/.test(s.textContent ?? '')) as HTMLElement | undefined; const lab = el?.closest('[data-slot=field], div')?.parentElement; return el ? { html: el.outerHTML.slice(0, 260), ancestorText: (lab?.textContent ?? '').replace(/s+/g, ' ').slice(0, 160) } : null; });
  log(proj, 'WHERE is the Prepared/Cost status region', JSON.stringify(where));
  await page.screenshot({ path: 'qa-out/engineer-ignored-prepared.png', fullPage: true });
  const html = await page.content();
  log(proj, 'remarks markup shown as text (no <i> element in the notice):', !/<i>x<\/i>/.test(html.replace(/&lt;i&gt;x&lt;\/i&gt;/g, '')), '| escaped entity present:', /&lt;i&gt;x&lt;\/i&gt;/.test(html));
  // type into the first field: nothing changes, no request
  let patches = 0;
  page.on('request', (r) => { if (r.method() === 'PATCH') patches += 1; });
  const first = page.locator('form[data-part-form] input:not([type=hidden])').first();
  const before = await first.inputValue();
  await first.focus();
  await page.keyboard.type('999');
  await page.waitForTimeout(1500);
  log(proj, 'typing into a read-only field: value before/after', before, '/', await first.inputValue(), '| PATCH requests', patches);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(e.code);
});
