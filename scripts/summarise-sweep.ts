/**
 * Writes the sweep run's summary (STORY-10.08 AC-6, AC-7): the tests that passed, failed, were flaky or were skipped, by engine and by project, and each failure by name. Reads the JSON
 * report that `playwright.sweep.config.ts` writes. It judges nothing: the Playwright step that ran the tests fails the job; this only makes the result readable in the job summary. It exits 1
 * only when the report cannot be read, because a summary that is missing must not look like a summary of a clean run.
 *
 * Usage: npx tsx scripts/summarise-sweep.ts <path of the JSON report>
 */
import { appendFileSync, readFileSync } from 'node:fs';

import { markdown, summarise } from './lib/sweep-summary';

function run(): number {
  const file = process.argv[2];
  if (file === undefined || file === '') throw new Error('The path of the JSON report is required.');
  const text = `### Sweep, keyboard flows and browser matrix (NFR-016, NFR-018, NFR-019)\n\n${markdown(summarise(JSON.parse(readFileSync(file, 'utf8'))))}`;
  process.stdout.write(text);
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryFile !== undefined && summaryFile !== '') appendFileSync(summaryFile, text);
  return 0;
}

try {
  process.exitCode = run();
} catch (error) {
  process.stderr.write(`The sweep summary could not be written: ${error instanceof Error ? error.message : 'unexpected error'}\n`);
  process.exitCode = 1;
}
