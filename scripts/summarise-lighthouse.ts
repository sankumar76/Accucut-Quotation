/**
 * Writes the Lighthouse reference run's summary table (NFR-009; test strategy section 10.2; STORY-10.10 AC-7): the median
 * LCP and TBT of each page, the median `benchmarkIndex`, the Chromium version, and whether the run can be compared with
 * the baseline B0. Reads the `lhr-*.json` reports that `lhci collect` keeps in the two folders; does not decide pass
 * or fail (the assertions do, in `lhci assert`). B0 comes from `LIGHTHOUSE_B0`, a repository variable that is not a secret.
 *
 * Usage: npx tsx scripts/summarise-lighthouse.ts --wifi <folder> --slow4g <folder>
 */
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { parseBaseline, parseRun, profileMarkdown, summariseProfile, type RunFigures } from './lib/lighthouse-summary';

function option(args: ReadonlyArray<string>, name: string): string {
  const value = args[args.indexOf(name) + 1];
  if (args.indexOf(name) === -1 || value === undefined) throw new Error(`${name} <folder> is required`);
  return value;
}

/** Every report in the folder. A file that is not a report is a failure, not something to skip. */
function readRuns(folder: string): RunFigures[] {
  return readdirSync(folder)
    .filter((name) => /^lhr-.*\.json$/.test(name))
    .sort()
    .map((name) => {
      const run = parseRun(readFileSync(join(folder, name), 'utf8'));
      if (run === undefined) throw new Error(`${name} in ${folder} is not a Lighthouse report`);
      return run;
    });
}

function run(): void {
  const args = process.argv.slice(2);
  const b0 = parseBaseline(process.env['LIGHTHOUSE_B0']);
  const sections = [
    '### Lighthouse reference run (NFR-009)',
    profileMarkdown('Wi-Fi profile (pass or fail)', summariseProfile(readRuns(option(args, '--wifi'))), b0),
    profileMarkdown('Slow 4G profile (report only)', summariseProfile(readRuns(option(args, '--slow4g'))), b0),
  ];
  const text = `${sections.join('\n\n')}\n`;
  process.stdout.write(text);
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryFile !== undefined && summaryFile !== '') appendFileSync(summaryFile, text);
}

try {
  run();
} catch (error) {
  process.stderr.write(`Lighthouse summary could not be written: ${error instanceof Error ? error.message : 'unexpected error'}\n`);
  process.exitCode = 1;
}
