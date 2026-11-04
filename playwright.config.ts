import { defineConfig } from '@playwright/test';

/**
 * End-to-end configuration: Chromium at three screen sizes (test strategy sections 2 and 9, NFR-016).
 * Mobile 360x800, tablet 768x1024, desktop 1366x768. One retry, reported (test strategy section 10).
 * CI stage 12 runs this suite; it is switched on by the first page story (see .github/workflows/ci.yml).
 */

const PORT = 3100;

// Invented values so the app's start-up check (src/lib/env.ts) passes. No database is contacted.
const TEST_ENVIRONMENT = {
  DATABASE_URL: 'postgresql://accucut_app:invented-e2e-password@localhost:55432/accucut',
  AUTH_SECRET: 'invented-e2e-auth-secret-0123456789-abcdef',
  APP_ORIGIN: `http://localhost:${PORT}`,
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_AUTH_MODE: 'none',
};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: 1,
  // Two workers on every machine: the development server compiles on demand, and more workers than that made
  // a slow laptop exceed a test's 30 s on first requests (G6 PRF-06: set it once the runner size is fixed).
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, hasTouch: true } },
    { name: 'tablet', use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    // Ready only when the heaviest page has compiled: the development server compiles a page on its first
    // request, which took longer than a test's 30 s when three projects asked at once on a slow machine.
    url: `http://localhost:${PORT}/design-system`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: TEST_ENVIRONMENT,
  },
});
