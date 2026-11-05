/**
 * Writes the Lighthouse reference run's summary table (NFR-009; test strategy section 10.2; STORY-10.10 AC-7): the median
 * LCP and TBT of each page, the median `benchmarkIndex`, the Chromium version, and whether the run can be compared with
 * the baseline B0. Reads the `*.report.json` files that `lhci autorun` keeps in the two folders (its filesystem target
 * writes `<host>-<path>-<time>.report.json`, beside a manifest and the HTML). It does not judge LCP or TBT (the assertions do,
 * in `lhci assert`), but it exits 1 when a folder holds no report or a page ended on another page (a sign-in that did not
 * take). B0 comes from `LIGHTHOUSE_B0`, a repository variable that is not a secret.
 *
 * Usage: npx tsx scripts/summarise-lighthouse.ts --wifi <folder> --slow4g <folder>
 */
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  REPORT_FILE,
  parseBaseline,
  parseRun,
  profileMarkdown,
  redirectedPages,
  summariseProfile,
  type RunFigures,
} from './lib/lighthouse-summary';

function option(args: ReadonlyArray<string>, name: string): string {
  const value = args[args.indexOf(name) + 1];
  if (args.indexOf(name) === -1 || value === undefined) throw new Error(`${name} <folder> is required`);
  return value;
}

/** Every report in the folder. A file that is not a report, and a folder with none, are failures, not something to skip. */
function readRuns(folder: string): RunFigures[] {
  const runs = readdirSync(folder)
    .filter((name) => REPORT_FILE.test(name))
    .sort()
    .map((name) => {
      const run = parseRun(readFileSync(join(folder, name), 'utf8'));
      if (run === undefined) throw new Error(`${name} in ${folder} is not a Lighthouse report`);
      return run;
    });
  if (runs.length === 0) throw new Error(`${folder} holds no Lighthouse report`);
  return runs;
}

function run(): number {
  const args = process.argv.slice(2);
  const b0 = parseBaseline(process.env['LIGHTHOUSE_B0']);
  const wifi = summariseProfile(readRuns(option(args, '--wifi')));
  const slow = summariseProfile(readRuns(option(args, '--slow4g')));
  const sections = [
    '### Lighthouse reference run (NFR-009)',
    profileMarkdown('Wi-Fi profile (pass or fail)', wifi, b0),
    profileMarkdown('Slow 4G profile (report only)', slow, b0),
  ];
  const text = `${sections.join('\n\n')}\n`;
  process.stdout.write(text);
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryFile !== undefined && summaryFile !== '') appendFileSync(summaryFile, text);
  // A page that redirected was not the page measured (a sign-in that did not take): its figures are wrong, so the run fails.
  const redirected = [...redirectedPages(wifi), ...redirectedPages(slow)];
  if (redirected.length > 0) process.stderr.write(`Pages that ended on another page, so their figures are not their own: ${redirected.join(', ')}\n`);
  return redirected.length === 0 ? 0 : 1;
}

try {
  process.exitCode = run();
} catch (error) {
  process.stderr.write(`Lighthouse summary could not be written: ${error instanceof Error ? error.message : 'unexpected error'}\n`);
  process.exitCode = 1;
}
