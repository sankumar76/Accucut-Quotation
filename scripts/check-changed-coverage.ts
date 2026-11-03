/**
 * CI stage 11 (after the combined coverage run, on a pull request): fails if less than the threshold
 * of the executable lines this pull request adds are covered, or if the check cannot tell.
 *
 * Usage: npx tsx scripts/check-changed-coverage.ts --base <git ref> [--root <directory>] [--lcov <path>] [--threshold <percent>]
 * Exit codes: 0 passed, 1 below the threshold or the report does not match the diff, 2 bad usage.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import {
  computeChangedCoverage,
  describeJoinFailure,
  filesMissingFromReport,
  parseAddedLines,
  parseLcov,
} from './lib/changed-coverage';

const DEFAULT_THRESHOLD = 80;
const DEFAULT_LCOV = 'coverage/lcov.info';
const MAX_DIFF_BYTES = 64 * 1024 * 1024;
const USAGE =
  'Usage: check-changed-coverage.ts --base <git ref> [--root <directory>] [--lcov <path>] [--threshold <0 to 100>]\n';

const thresholdSchema = z.coerce.number().min(0).max(100);

function option(args: ReadonlyArray<string>, name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function fail(message: string, code: number): never {
  process.stderr.write(message);
  process.exit(code);
}

const args = process.argv.slice(2);
const base = option(args, '--base');
if (base === undefined) fail(USAGE, 2);

// A blank or non-numeric threshold must stop the run: `percent < NaN` is false, which would pass.
const rawThreshold = option(args, '--threshold') ?? String(DEFAULT_THRESHOLD);
const parsedThreshold = thresholdSchema.safeParse(rawThreshold.trim() === '' ? undefined : rawThreshold);
if (!parsedThreshold.success) fail(`The threshold must be a number from 0 to 100.\n${USAGE}`, 2);
const threshold = parsedThreshold.data;

const root = resolve(option(args, '--root') ?? '.');
const diff = execFileSync('git', ['-C', root, 'diff', '-U0', '--no-color', `${base}...HEAD`], {
  encoding: 'utf8',
  maxBuffer: MAX_DIFF_BYTES,
});
const lcov = readFileSync(option(args, '--lcov') ?? join(root, DEFAULT_LCOV), 'utf8');
const added = parseAddedLines(diff);
const coverage = parseLcov(lcov, root);

const joinFailure = describeJoinFailure(added, coverage);
if (joinFailure !== undefined) fail(`${joinFailure}\n`, 1);

// A notice, not a failure: a file that holds only types has no entry. The log shows what was not measured.
for (const file of filesMissingFromReport(added, coverage)) {
  process.stdout.write(`Notice: ${file} has no entry in the coverage report, so its added lines were not measured.\n`);
}

const result = computeChangedCoverage(added, coverage);
process.stdout.write(
  `Changed-code coverage: ${result.percent.toFixed(1)}% (${result.covered} of ${result.total} executable added lines), threshold ${threshold}%.\n`,
);
if (result.percent < threshold) {
  fail(`Uncovered added lines:\n${result.uncovered.map((line) => `  - ${line}`).join('\n')}\n`, 1);
}
