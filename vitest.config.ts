import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const COVERAGE_TARGET = 80;
const FORMULA_COVERAGE_TARGET = 95;

const target = (percent: number) => ({
  lines: percent,
  functions: percent,
  branches: percent,
  statements: percent,
});

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    // Refuses a wrong database or NODE_ENV=production before any suite starts (AC-10).
    globalSetup: ['./tests/support/global-setup.ts'],
    // Retries are off in unit and integration tests (test strategy section 10).
    retry: 0,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'scripts/lib/**/*.ts'],
      // Next.js route files and generated code are covered by E2E, not unit coverage.
      exclude: ['src/app/**', 'src/generated/**', 'src/components/ui/**', '**/*.d.ts'],
      // Test strategy section 11. The whole-package gate is below; changed-code coverage is checked by
      // scripts/check-changed-coverage.ts in CI. The formula gate starts to bite once src/lib/formula exists.
      thresholds: {
        ...target(COVERAGE_TARGET),
        'src/lib/formula/**': target(FORMULA_COVERAGE_TARGET),
      },
    },
  },
});
