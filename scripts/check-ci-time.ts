/**
 * Nightly step (NFR-009; test strategy section 10.3; STORY-10.10 AC-8): reads the GitHub API for the duration of the
 * required job, `Stages 1 to 11`, over the first attempts of the last 20 pull-request runs, prints the p95 and the median,
 * and exits 1 when the p95 is over 10 minutes or the median is over 6 minutes. A breach never blocks a merge: this runs
 * in the nightly workflow only. Needs `GITHUB_REPOSITORY` and `GITHUB_TOKEN` (a token with `actions: read`, which the
 * workflow's own token has); neither is printed.
 *
 * Usage: npx tsx scripts/check-ci-time.ts
 */
import { appendFileSync } from 'node:fs';

import { ciTimeLines, ciTimeReport, fetchJobRecords } from './lib/ci-feedback-time';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
}

async function run(): Promise<number> {
  const records = await fetchJobRecords(required('GITHUB_REPOSITORY'), required('GITHUB_TOKEN'));
  const report = ciTimeReport(records);
  const lines = ciTimeLines(report);
  process.stdout.write(`${lines.join('\n')}\n`);
  const summaryFile = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryFile !== undefined && summaryFile !== '') appendFileSync(summaryFile, `### CI feedback time (NFR-009)\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`);
  return report.breaches.length === 0 ? 0 : 1;
}

run().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`CI feedback time could not be read: ${error instanceof Error ? error.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  },
);
