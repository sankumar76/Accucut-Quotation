/**
 * CI stage 3: fails if a tracked file is a data file (.csv, .xlsx, .json ...) that is not on the
 * allow-list in `scripts/lib/data-files.ts`.
 *
 * Usage: npx tsx scripts/check-data-files.ts [--root <directory>]
 */
import { execFileSync } from 'node:child_process';

import { findDisallowedDataFiles } from './lib/data-files';

function rootFromArguments(args: ReadonlyArray<string>): string {
  const index = args.indexOf('--root');
  const value = index === -1 ? undefined : args[index + 1];
  return value ?? '.';
}

function trackedFiles(root: string): string[] {
  const output = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' });
  return output.split('\0').filter((path) => path !== '');
}

const violations = findDisallowedDataFiles(trackedFiles(rootFromArguments(process.argv.slice(2))));

if (violations.length > 0) {
  process.stderr.write(
    [
      'Data-file check failed. These tracked files are data files that are not on the allow-list:',
      ...violations.map((path) => `  - ${path}`),
      'Real master data must never enter this public repository (ADR-014).',
      'If a file is configuration and not data, add its exact path and a reason to scripts/lib/data-files.ts in a reviewed change.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

process.stdout.write('Data-file check passed.\n');
