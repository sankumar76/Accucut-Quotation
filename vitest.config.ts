import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { COVERAGE_EXCLUDE, COVERAGE_INCLUDE } from './scripts/lib/coverage-scope';

const COVERAGE_TARGET = 80;
const PURE_CODE_TARGET = 95;
const FULL_BRANCH_TARGET = 100;

const target = (percent: number) => ({
  lines: percent,
  functions: percent,
  branches: percent,
  statements: percent,
});

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // An empty module in place of the `server-only` package: see tests/support/server-only-stub.ts.
      'server-only': fileURLToPath(new URL('./tests/support/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    // Refuses a wrong database or NODE_ENV=production before any suite starts (AC-10).
    globalSetup: ['./tests/support/global-setup.ts'],
    // Retries are off in unit and integration tests (test strategy section 10).
    retry: 0,
    // Set-up runs in hooks, not in tests: creating and migrating a scratch database, or starting a process, can take
    // well over Vitest's 10 s default on a busy machine. One hook limit for every level, set here and not per file
    // (test strategy section 10, DL-057; DEF-003). A hook that needs more (a real `next build`) passes its own.
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // One list for Vitest and for the changed-code check (scripts/lib/coverage-scope.ts).
      include: [...COVERAGE_INCLUDE],
      exclude: [...COVERAGE_EXCLUDE],
      // Test strategy section 11. Where each gate is decided:
      //   CI stage 6 narrows `include` on the command line to src/lib and scripts/lib and runs the unit
      //   tests only, so these thresholds judge pure code on unit lines.
      //   CI stage 11 runs every level in one run with this full `include`, so the whole-package gate
      //   counts unit and integration lines together (services are tested by integration).
      // A glob below that matches no file passes silently, so each one starts to bite when its file exists.
      thresholds: {
        ...target(COVERAGE_TARGET),
        'src/lib/formula/**': target(PURE_CODE_TARGET),
        'src/lib/estimate/validation.ts': target(PURE_CODE_TARGET),
        'src/lib/estimate/figure-state.ts': { branches: FULL_BRANCH_TARGET },
        'src/lib/auth/password-rule.ts': { branches: FULL_BRANCH_TARGET },
      },
    },
  },
});
