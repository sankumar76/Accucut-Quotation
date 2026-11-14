import { defineConfig } from 'vitest/config';

import base from './vitest.config';

/**
 * The timing tests under `tests/perf/` (test strategy sections 8 and 10.3), run on demand with `npm run test:perf`. The default
 * configuration excludes this directory, so `npm test` and the per-pull-request stages never run a timing (STORY-03.06 AC-4); this one runs
 * nothing else. It shares the default configuration's aliases (`@`, and `server-only` as an empty module) and its wrong-database guard.
 */
export default defineConfig({
  // `resolve` is optional in the base type and `exactOptionalPropertyTypes` is on, so an undefined value is not passed through.
  resolve: base.resolve ?? {},
  test: {
    environment: 'node',
    include: ['tests/perf/**/*.test.ts'],
    exclude: ['node_modules/**'],
    globalSetup: ['./tests/support/global-setup.ts'],
    retry: 0,
    hookTimeout: 120_000,
  },
});
