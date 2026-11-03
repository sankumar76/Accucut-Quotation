import { describe, expect, it } from 'vitest';

import { COVERAGE_EXCLUDE, COVERAGE_INCLUDE, globToRegExp, isCoverageScoped } from '../../scripts/lib/coverage-scope';
import vitestConfig from '../../vitest.config';

/**
 * QLT-05 / QLT-06: one list says which files coverage measures. Vitest and the changed-code check
 * both read it, so they cannot drift apart.
 */

describe('globToRegExp', () => {
  it.each([
    ['src/app/**', 'src/app/page.tsx', true],
    ['src/app/**', 'src/app/(portal)/queue/page.tsx', true],
    ['src/app/**', 'src/application/x.ts', false],
    ['**/*.d.ts', 'src/types/global.d.ts', true],
    ['**/*.d.ts', 'global.d.ts', true],
    ['**/*.d.ts', 'src/lib/env.ts', false],
    ['src/**/*.{ts,tsx}', 'src/lib/env.ts', true],
    ['src/**/*.{ts,tsx}', 'src/components/shared/money.tsx', true],
    ['src/**/*.{ts,tsx}', 'src/lib/env.js', false],
    ['src/worker/main.ts', 'src/worker/main.ts', true],
    ['src/worker/main.ts', 'src/worker/main.tsx', false],
  ])('%s matches %s: %s', (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });
});

describe('globToRegExp refuses syntax it cannot read (QLT-18)', () => {
  // Vitest reads these with picomatch; this hand-written parser would read them as literal characters
  // and disagree with it, which can let a change through the changed-code check.
  it.each(['src/**/*.stories.?(ts|tsx)', 'src/server/[ab].ts', 'src/(a|b)/**', 'src/!(lib)/**', 'src/+(a|b).ts', 'src/@(a).ts', 'src/a?.ts'])(
    'throws on %s',
    (glob) => {
      expect(() => globToRegExp(glob)).toThrow(/Unsupported glob syntax/);
    },
  );

  it('still reads the forms the coverage list uses, braces included', () => {
    expect(() => globToRegExp('src/**/*.{ts,tsx}')).not.toThrow();
    expect(() => globToRegExp('**/*.d.ts')).not.toThrow();
    expect(() => globToRegExp('src/worker/main.ts')).not.toThrow();
  });

  it('every entry in the coverage list is readable', () => {
    for (const glob of [...COVERAGE_INCLUDE, ...COVERAGE_EXCLUDE]) expect(() => globToRegExp(glob)).not.toThrow();
  });
});

describe('isCoverageScoped', () => {
  it.each([
    ['src/lib/env.ts', true],
    ['src/server/services/estimate-service.ts', true],
    ['src/server/coverage-probe.ts', true],
    ['src/instrumentation.ts', true],
    ['src/worker/jobs.ts', true],
    ['scripts/lib/licences.ts', true],
    // Excluded: Vitest cannot render these, so E2E and axe cover them (test strategy 11).
    ['src/app/page.tsx', false],
    ['src/components/features/queue/queue-list.tsx', false],
    ['src/components/ui/button.tsx', false],
    ['src/worker/main.ts', false],
    ['src/generated/prisma/client.ts', false],
    ['src/types/global.d.ts', false],
    // Not in the measured set at all.
    ['tests/unit/env.test.ts', false],
    ['scripts/check-data-files.ts', false],
    ['prisma/seed/index.ts', false],
    ['docs/readme.md', false],
  ])('%s is in scope: %s', (path, expected) => {
    expect(isCoverageScoped(path)).toBe(expected);
  });

  it('never excludes src/server', () => {
    expect(COVERAGE_EXCLUDE.some((glob) => glob.includes('src/server'))).toBe(false);
  });
});

describe('vitest.config.ts uses the same list', () => {
  it('reads coverage.include and coverage.exclude from coverage-scope.ts', () => {
    const coverage = vitestConfig.test?.coverage;
    expect(coverage?.include).toEqual([...COVERAGE_INCLUDE]);
    expect(coverage?.exclude).toEqual([...COVERAGE_EXCLUDE]);
  });

  it('keeps the thresholds of test strategy section 11', () => {
    const thresholds = vitestConfig.test?.coverage?.thresholds;
    expect(thresholds).toMatchObject({
      lines: 80,
      branches: 80,
      'src/lib/formula/**': { lines: 95 },
      'src/lib/estimate/validation.ts': { lines: 95 },
      'src/lib/estimate/figure-state.ts': { branches: 100 },
      'src/lib/auth/password-rule.ts': { branches: 100 },
    });
  });
});
