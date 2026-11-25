import { defineConfig } from '@playwright/test';

// QA, DEF-077 verification (throwaway, untracked in the product): no web server, no setup project; the dev server is started by hand on E2E_DEV_PORT.
if (process.env['E2E_DEV_PORT'] === undefined) throw new Error('Set E2E_DEV_PORT=3377');
process.loadEnvFile('.env');

export default defineConfig({
  testDir: './tests/e2e-qa',
  testMatch: '**/*.qa.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: 'qa-out/results',
  use: { baseURL: `http://localhost:${process.env['E2E_DEV_PORT']}`, actionTimeout: 25000, trace: 'off', screenshot: 'off' },
  projects: [{ name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } } }],
});
