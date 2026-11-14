import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import vitestConfig from '../../vitest.config';
import perfConfig from '../../vitest.perf.config';

/**
 * STORY-03.06 AC-4: the timing tests are not in the per-pull-request path. The default configuration excludes `tests/perf/`, so `npm test`
 * and the CI stages never time anything; the perf configuration runs that directory only; `npm run test:perf` is the tagged command.
 */

describe('the timing tests run on demand only (AC-4)', () => {
  it('the default configuration excludes tests/perf', () => {
    expect(vitestConfig.test?.exclude).toContain('tests/perf/**');
  });

  it('the perf configuration includes tests/perf and nothing else, and shares the aliases of the default one', () => {
    expect(perfConfig.test?.include).toEqual(['tests/perf/**/*.test.ts']);
    expect(perfConfig.resolve).toEqual(vitestConfig.resolve);
  });

  it('npm run test:perf runs it with the perf configuration, and npm test is unchanged', () => {
    const manifest: unknown = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));
    const scripts = typeof manifest === 'object' && manifest !== null && 'scripts' in manifest ? manifest.scripts : undefined;
    expect(scripts).toMatchObject({ test: 'vitest run', 'test:perf': 'vitest run --config vitest.perf.config.ts' });
  });
});
