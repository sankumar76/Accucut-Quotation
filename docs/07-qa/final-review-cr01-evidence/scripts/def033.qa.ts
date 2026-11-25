import { expect, test } from '@playwright/test';
import { Client } from 'pg';

import { E2E_ADMIN, ensureE2eAdmin, ensureE2eUsers } from '../e2e/support/auth';
import { signInAs } from '../e2e/support/calculated-estimate';

// QA, DEF-033 verification on origin/master 1ab13781 (#668): the original reproduction (DEF-033 file, Steps to Reproduce), by the owner role.
// SELECT is withdrawn from the application role on the table the page reads, the page is reloaded (error state), SELECT is given back, Try again is pressed.
const log = (...a: unknown[]): void => console.log('QA3|', ...a);

async function asOwner(): Promise<Client> {
  const url = process.env['MIGRATE_DATABASE_URL'];
  if (url === undefined || !/localhost|127\.0\.0\.1/.test(url)) throw new Error('MIGRATE_DATABASE_URL must be the local throwaway database');
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
}

const CASES: ReadonlyArray<readonly [string, string, string]> = [
  ['Customers list', '/masters/customers', 'customers'],
  ['Process master', '/masters/process', 'process_items'],
  ['Materials', '/masters/materials', 'materials'],
  ['Audit log', '/audit', 'audit_log'],
];

for (const width of [1366, 768, 360]) {
  test(`DEF-033 Try again re-reads at ${width}px`, async ({ page }) => {
    test.setTimeout(600_000);
    await ensureE2eUsers();
    await ensureE2eAdmin();
    await page.setViewportSize({ width, height: 900 });
    await signInAs(page, E2E_ADMIN);
    for (const [name, path, table] of CASES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const owner = await asOwner();
      try {
        await owner.query(`REVOKE SELECT ON ${table} FROM accucut_app`);
        await page.goto(path);
        const tryAgain = page.getByRole('button', { name: 'Try again' });
        await expect(tryAgain).toBeVisible({ timeout: 60_000 });
        log(width, name, 'error state shown (SELECT withdrawn on', table + ')');
        await owner.query(`GRANT SELECT ON ${table} TO accucut_app`);
        await tryAgain.click();
        let recovered = true;
        try {
          await expect(tryAgain).toBeHidden({ timeout: 15_000 });
        } catch {
          recovered = false;
        }
        log(width, name, 'recoveredByTryAgain', recovered);
        expect.soft(recovered, `${name} at ${width}px recovered by Try again`).toBe(true);
        // control: a reload still works
        await page.goto(path);
        await expect(page.getByRole('button', { name: 'Try again' })).toBeHidden({ timeout: 30_000 });
      } finally {
        await owner.query(`GRANT SELECT ON ${table} TO accucut_app`).catch(() => undefined);
        await owner.end();
      }
    }
  });
}
