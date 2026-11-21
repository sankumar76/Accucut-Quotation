import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { readRouteFiles } from '../support/route-files';
import { DATA_SCREENS, EXEMPT_PAGES, type DataScreen } from '../support/screen-states';
import { findScreenStateProblems, type Repository } from '../support/screen-states-problems';

/**
 * STORY-10.07 AC-6 (FR-088): every implemented page is in the table of `tests/support/screen-states.ts`, as a data screen with the proof of each state
 * it owes or as an exempt page with its reason, and every proof names a file that exists and holds what the row says. The planted-fault tests prove the
 * guard can fail: a page added later that skips the table fails here, and so does a row whose file is gone.
 */

const PAGES = readRouteFiles().filter((file) => file.kind === 'page');

const disk: Repository = { read: (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null) };

/** A repository of a few invented files. */
function repositoryOf(files: Readonly<Record<string, string>>): Repository {
  return { read: (file) => files[file] ?? null };
}

const PLANTED_PAGE = { pattern: '/planted', file: 'src/app/(portal)/planted/page.tsx' };
const PLANTED_ROW: DataScreen = {
  page: '/planted',
  screen: 'SCR-99',
  states: {
    loading: { file: 'src/planted.tsx', marker: 'SkeletonBlock' },
    empty: { file: 'src/planted.tsx', marker: 'EmptyState' },
    noMatch: { na: 'The screen has no search or filter.' },
    errorLoad: { file: 'src/planted.tsx', marker: 'ErrorState' },
    saved: { na: 'The screen saves nothing at all.' },
  },
};
const PLANTED_FILES = { 'src/planted.tsx': 'SkeletonBlock EmptyState ErrorState', 'src/app/(portal)/planted/error.tsx': 'ErrorState' };

describe('STORY-10.07 AC-6: the screen-states guard', () => {
  it('finds the pages to look at (the scan is not empty), among them the queue and an estimate page', () => {
    expect(PAGES.map((page) => page.pattern)).toEqual(expect.arrayContaining(['/queue', '/estimates/[code]', '/estimates/[code]/export']));
  });

  it('has no problem in the source tree: every page is in the table, every proof exists, every data screen has its error boundary', () => {
    expect(findScreenStateProblems(PAGES, DATA_SCREENS, EXEMPT_PAGES, disk)).toEqual([]);
  });

  it('a page that is in neither the table nor the exempt list fails', () => {
    const problems = findScreenStateProblems([...PAGES, PLANTED_PAGE], DATA_SCREENS, EXEMPT_PAGES, disk).filter((problem) => problem.startsWith('/planted'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('/planted');
  });

  it('a row for a page that does not exist fails', () => {
    const problems = findScreenStateProblems(PAGES, [...DATA_SCREENS, PLANTED_ROW], EXEMPT_PAGES, repositoryOf(PLANTED_FILES));
    expect(problems.some((problem) => problem.includes('/planted') && problem.includes('no such page'))).toBe(true);
  });

  it('a page listed as data screen and as exempt fails', () => {
    const problems = findScreenStateProblems([PLANTED_PAGE], [PLANTED_ROW], [{ page: '/planted', reason: 'A reason that is long enough.' }], repositoryOf(PLANTED_FILES));
    expect(problems.some((problem) => problem.includes('listed more than once'))).toBe(true);
  });

  it('a complete row passes', () => {
    expect(findScreenStateProblems([PLANTED_PAGE], [PLANTED_ROW], [], repositoryOf(PLANTED_FILES))).toEqual([]);
  });

  it('a row that names a file that does not exist fails', () => {
    const files = { 'src/app/(portal)/planted/error.tsx': 'ErrorState' };
    const problems = findScreenStateProblems([PLANTED_PAGE], [PLANTED_ROW], [], repositoryOf(files));
    expect(problems.filter((problem) => problem.includes('does not exist'))).toHaveLength(3);
  });

  it('a row whose file no longer holds the marker fails', () => {
    const files = { ...PLANTED_FILES, 'src/planted.tsx': 'SkeletonBlock ErrorState' };
    const problems = findScreenStateProblems([PLANTED_PAGE], [PLANTED_ROW], [], repositoryOf(files));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('does not contain "EmptyState"');
  });

  it('a state that is not applicable with no reason fails', () => {
    const row: DataScreen = { ...PLANTED_ROW, states: { ...PLANTED_ROW.states, noMatch: { na: ' ' } } };
    const problems = findScreenStateProblems([PLANTED_PAGE], [row], [], repositoryOf(PLANTED_FILES));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('gives no reason');
  });

  it('an exempt page with no reason fails', () => {
    const problems = findScreenStateProblems([PLANTED_PAGE], [], [{ page: '/planted', reason: '' }], repositoryOf({}));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('gives no reason');
  });

  it('a data screen with no error.tsx of its own, at or above its page, fails; the root boundary does not count', () => {
    const files = { 'src/planted.tsx': 'SkeletonBlock EmptyState ErrorState', 'src/app/error.tsx': 'ErrorBoundary' };
    const problems = findScreenStateProblems([PLANTED_PAGE], [PLANTED_ROW], [], repositoryOf(files));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no error.tsx');
  });

  it('an error.tsx of a folder above the page counts (the formula editor sits under the fields boundary)', () => {
    const files = { 'src/planted.tsx': 'SkeletonBlock EmptyState ErrorState', 'src/app/(portal)/error.tsx': 'ErrorState' };
    expect(findScreenStateProblems([PLANTED_PAGE], [PLANTED_ROW], [], repositoryOf(files))).toEqual([]);
  });

  it('a screen that reads nothing says so, and owes no boundary', () => {
    const row: DataScreen = { ...PLANTED_ROW, states: { ...PLANTED_ROW.states, errorLoad: { na: 'The page reads nothing that could fail.' } } };
    const files = { 'src/planted.tsx': 'SkeletonBlock EmptyState' };
    expect(findScreenStateProblems([PLANTED_PAGE], [row], [], repositoryOf(files))).toEqual([]);
  });
});
