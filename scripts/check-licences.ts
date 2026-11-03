/**
 * CI stage 8: fails if a locked package has a licence that is not on the allow-list in
 * `scripts/lib/licences.ts` and is not a named exception.
 *
 * Usage: npx tsx scripts/check-licences.ts [--lockfile <path>]
 */
import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { findLicenceViolations } from './lib/licences';

// Only the fields this check reads. Anything else in the lockfile is ignored.
const lockSchema = z.object({
  packages: z.record(z.string(), z.object({ license: z.string().optional() })),
});

function lockfileFromArguments(args: ReadonlyArray<string>): string {
  const index = args.indexOf('--lockfile');
  return (index === -1 ? undefined : args[index + 1]) ?? 'package-lock.json';
}

const lock = lockSchema.parse(JSON.parse(readFileSync(lockfileFromArguments(process.argv.slice(2)), 'utf8')));
const violations = findLicenceViolations(lock);

if (violations.length > 0) {
  process.stderr.write(
    [
      'Licence check failed. These packages have a licence that is not allowed:',
      ...violations.map(({ name, licence }) => `  - ${name}: ${licence === '' ? '(not stated)' : licence}`),
      'Add a named exception, with a reason, to scripts/lib/licences.ts only after review.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

process.stdout.write('Licence check passed.\n');
