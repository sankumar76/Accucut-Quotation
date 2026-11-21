import { isNotApplicable, STATE_NAMES, type DataScreen, type ExemptPage, type StateProof } from './screen-states';

/**
 * The rules of the screen-states guard (STORY-10.07 AC-6), as a function of the implemented pages, the table, and two readers of the repository, so
 * a test can hand it a planted page or a planted row and require a problem (the guard must itself be able to fail).
 */

export interface Repository {
  /** The text of a file, or `null` when there is no such file. Relative to the repository, with forward slashes. */
  readonly read: (file: string) => string | null;
}

const MIN_REASON_LENGTH = 12;

/** The route-level boundary files of `src/app` that sit at or above a page, from the nearest outwards, the root boundary last. */
export function boundaryCandidates(pageFile: string): string[] {
  const parts = pageFile.split('/').slice(0, -1);
  const candidates: string[] = [];
  for (let length = parts.length; length >= 2; length -= 1) candidates.push(`${parts.slice(0, length).join('/')}/error.tsx`);
  return candidates;
}

function proofProblems(page: string, state: string, value: StateProof, repository: Repository): string[] {
  if (isNotApplicable(value)) {
    return value.na.trim().length >= MIN_REASON_LENGTH ? [] : [`${page}: ${state} is not applicable, but gives no reason`];
  }
  const source = repository.read(value.file);
  if (source === null) return [`${page}: ${state} names ${value.file}, which does not exist`];
  if (!source.includes(value.marker)) return [`${page}: ${state} names ${value.file}, which does not contain "${value.marker}"`];
  return [];
}

export function findScreenStateProblems(
  pages: ReadonlyArray<{ readonly pattern: string; readonly file: string }>,
  screens: ReadonlyArray<DataScreen>,
  exempt: ReadonlyArray<ExemptPage>,
  repository: Repository,
): string[] {
  const problems: string[] = [];
  const implemented = new Set(pages.map((page) => page.pattern));
  const listed = [...screens.map((row) => row.page), ...exempt.map((row) => row.page)];

  for (const page of pages) {
    const count = listed.filter((name) => name === page.pattern).length;
    if (count === 0) problems.push(`${page.pattern}: an implemented page is in neither the data-screen table nor the exempt list (tests/support/screen-states.ts)`);
    if (count > 1) problems.push(`${page.pattern}: listed more than once`);
  }
  for (const name of new Set(listed)) {
    if (!implemented.has(name)) problems.push(`${name}: listed in the table, but there is no such page`);
  }
  for (const row of exempt) {
    if (row.reason.trim().length < MIN_REASON_LENGTH) problems.push(`${row.page}: exempt, but gives no reason`);
  }

  for (const row of screens) {
    for (const state of STATE_NAMES) problems.push(...proofProblems(row.page, state, row.states[state], repository));
    const page = pages.find((candidate) => candidate.pattern === row.page);
    if (page === undefined || isNotApplicable(row.states.errorLoad)) continue;
    // The root boundary is the generic SCR-26 page: a data screen owes a boundary of its own, in its own folder or above it below the root.
    const own = boundaryCandidates(page.file).filter((file) => file !== 'src/app/error.tsx' && repository.read(file) !== null);
    if (own.length === 0) problems.push(`${row.page}: no error.tsx at or above the page, so a thrown render error shows the generic page`);
  }
  return problems;
}
