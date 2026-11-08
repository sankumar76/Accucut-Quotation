/**
 * CI stage 9, after `next build`: fails if a route that must not exist in production would be served. Reads the build output;
 * nothing is started.
 *   - `/design-system` (SCR-00) answers 404 (STORY-10.02 AC-7).
 *   - The scan's test-only route `/api/test-only/leak` has its `NODE_ENV` gate replaced by the bundler (STORY-01.03 AC-4, STD-02).
 *
 * Usage: npx tsx scripts/check-production-routes.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NEGATIVE_CONTROL_ENV_NAME } from '../src/lib/negative-control-gate';

import { findExposedRoutes, findNegativeControlGateProblems, type BuiltFile } from './lib/production-routes';

const SERVER_BUILD = '.next/server';

/** Every compiled `.js` file under the server build (not the `.map` files, which hold the source text). */
function builtFiles(directory: string): BuiltFile[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return builtFiles(path);
    return entry.name.endsWith('.js') ? [{ path, text: readFileSync(path, 'utf8') }] : [];
  });
}

const problems = [
  ...findExposedRoutes((path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined)),
  ...findNegativeControlGateProblems(builtFiles(SERVER_BUILD), NEGATIVE_CONTROL_ENV_NAME),
];

if (problems.length > 0) {
  process.stderr.write(['Production route check failed:', ...problems.map((problem) => `  - ${problem}`), ''].join('\n'));
  process.exit(1);
}
process.stdout.write('Production route check passed.\n');
