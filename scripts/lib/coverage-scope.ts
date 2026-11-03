/**
 * Which files coverage measures (test strategy section 11, architecture section 10).
 *
 * One list, read by `vitest.config.ts` and by the changed-code check, so the two cannot drift apart
 * (QLT-05, QLT-06). `src/server/**` is never excluded: services and repositories are measured on
 * unit and integration lines together at CI stage 11.
 */

export const COVERAGE_INCLUDE: ReadonlyArray<string> = ['src/**/*.{ts,tsx}', 'scripts/lib/**/*.ts'];

/**
 * Vitest cannot render a Next.js route or a component, and section 10 allows no logic there, so
 * E2E and axe cover them. `src/worker/main.ts` is the cron entry point, a thin start-up file.
 */
export const COVERAGE_EXCLUDE: ReadonlyArray<string> = [
  'src/app/**',
  'src/components/**',
  'src/worker/main.ts',
  'src/generated/**',
  '**/*.d.ts',
];

/** Turns the few glob forms used above (`**`, `*`, `{a,b}`) into a regular expression. */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob.charAt(index);
    if (char === '*' && glob.charAt(index + 1) === '*') {
      const followedBySlash = glob.charAt(index + 2) === '/';
      // `**/` also matches nothing, so `**/*.d.ts` matches a file in the root.
      source += followedBySlash ? '(?:.*/)?' : '.*';
      index += followedBySlash ? 2 : 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '{') {
      const close = glob.indexOf('}', index);
      const alternatives = glob.slice(index + 1, close).split(',');
      source += `(?:${alternatives.map(escapeLiteral).join('|')})`;
      index = close;
    } else {
      source += escapeLiteral(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function escapeLiteral(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

const INCLUDE_PATTERNS = COVERAGE_INCLUDE.map(globToRegExp);
const EXCLUDE_PATTERNS = COVERAGE_EXCLUDE.map(globToRegExp);

export function isExcluded(path: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(path));
}

/** True if coverage measures this repository-relative path. */
export function isCoverageScoped(path: string): boolean {
  return INCLUDE_PATTERNS.some((pattern) => pattern.test(path)) && !isExcluded(path);
}
