/**
 * CI stage 6 (after the unit run with coverage): fails if less than the threshold of the executable
 * lines this pull request adds are covered.
 *
 * Usage: npx tsx scripts/check-changed-coverage.ts --base <git ref> [--lcov <path>] [--threshold <percent>]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { computeChangedCoverage, parseAddedLines, parseLcov } from './lib/changed-coverage';

const DEFAULT_THRESHOLD = 80;
const DEFAULT_LCOV = 'coverage/lcov.info';

function option(args: ReadonlyArray<string>, name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const args = process.argv.slice(2);
const base = option(args, '--base');
if (base === undefined) {
  process.stderr.write('Usage: check-changed-coverage.ts --base <git ref> [--lcov <path>] [--threshold <percent>]\n');
  process.exit(2);
}
const threshold = Number(option(args, '--threshold') ?? DEFAULT_THRESHOLD);

const diff = execFileSync('git', ['diff', '-U0', '--no-color', `${base}...HEAD`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const lcov = readFileSync(option(args, '--lcov') ?? DEFAULT_LCOV, 'utf8');
const result = computeChangedCoverage(parseAddedLines(diff), parseLcov(lcov, process.cwd()));

process.stdout.write(
  `Changed-code coverage: ${result.percent.toFixed(1)}% (${result.covered} of ${result.total} executable added lines), threshold ${threshold}%.\n`,
);
if (result.percent < threshold) {
  process.stderr.write(`Uncovered added lines:\n${result.uncovered.map((line) => `  - ${line}`).join('\n')}\n`);
  process.exit(1);
}
