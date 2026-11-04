/**
 * CI stage 9, after `next build`: fails if a route that must not exist in production (`/design-system`) would be
 * served. Reads the build output; nothing is started.
 *
 * Usage: npx tsx scripts/check-production-routes.ts
 */
import { existsSync, readFileSync } from 'node:fs';

import { findExposedRoutes } from './lib/production-routes';

const problems = findExposedRoutes((path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined));

if (problems.length > 0) {
  process.stderr.write(['Production route check failed:', ...problems.map((problem) => `  - ${problem}`), ''].join('\n'));
  process.exit(1);
}
process.stdout.write('Production route check passed.\n');
