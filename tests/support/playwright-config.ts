import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The text of `playwright.config.ts`, for the unit tests that guard its projects (`one-width-tag.test.ts`,
 * `own-width-files.test.ts`). The E2E suite cannot run in a unit test and the config imports the application, so these tests read
 * its text and ask Playwright itself to list the tests (`tests/support/playwright-list.ts`). A Windows checkout with Git's default
 * autocrlf writes CRLF; the checks expect LF (DEF-002), so the line ends are normalised here.
 */
export const readConfig = (): string => readFileSync(fileURLToPath(new URL('../../playwright.config.ts', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');

/** The object of one project, from its `name:` line to the next project or the end of the list. */
export function projectBlock(config: string, name: string): string {
  const start = config.indexOf(`name: '${name}'`);
  if (start === -1) throw new Error(`playwright.config.ts has no project named ${name}`);
  const rest = config.slice(start + 1);
  const next = rest.search(/\n {4}\{|\n {2}\],/);
  return config.slice(start, next === -1 ? undefined : start + 1 + next);
}

/**
 * The file names in `OWN_WIDTH_FILES` (STORY-10.20, AQP-244 AC-2; test strategy section 10.5 item 9): the specs whose tests set their
 * own widths and skip unless the project is `desktop`. The config lists them in `desktop` only.
 */
export function ownWidthFilesOf(config: string): string[] {
  const list = /^const OWN_WIDTH_FILES: ReadonlyArray<string> = \[([^\]]*)\];$/m.exec(config)?.[1];
  if (list === undefined) throw new Error('playwright.config.ts has no `const OWN_WIDTH_FILES: ReadonlyArray<string> = [...];`');
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
}
