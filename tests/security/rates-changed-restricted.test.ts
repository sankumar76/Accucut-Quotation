import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-06.11 AC-7 (NFR-002; ADR-008): the count of rates that changed since a calculation is Restricted data (it says that a rate, a price or an exchange rate moved), so it is carried by the Lead's and the
 * Admin's routes alone and no Engineer route, page or component names it. Written as a scan of the source tree, so a later change that carries `ratesChanged` somewhere else fails here and not in review. Who may
 * call `GET /costs` and that an Engineer gets the fixed 403 before any read are `tests/unit/estimate-review-route.test.ts` and `tests/security/*`; the service's own refusal is `tests/unit/estimate-review-rates.test.ts`.
 * The scan has a control that plants a fault in a copy of the text and sees it found.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(ROOT, 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (path.includes(join('src', 'generated'))) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const ALL = sourceFiles(SRC).map((path) => ({ path: relative(ROOT, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }));
const pathsMatching = (files: ReadonlyArray<{ path: string; text: string }>, pattern: RegExp): string[] => files.filter((file) => pattern.test(file.text)).map((file) => file.path).sort();

/** The key and the words of the notice, and the module that counts. */
const RATES_CHANGED = /\bratesChanged\b|rates-changed-copy|rate-changes|\bcountRateChanges\b/;

/** The files that may name them: the contract, the two services of the Lead and the Admin, the review's own folder and the Approve dialog that imports the copy (STORY-06.11). Nothing else. */
const ALLOWED = [
  'src/components/features/estimate-approve/approve-dialog.tsx',
  'src/components/features/estimate-review/estimate-review.tsx',
  'src/components/features/estimate-review/rates-changed-notice.tsx',
  'src/components/features/estimate-review/review-actions.tsx',
  'src/server/services/estimate-review-service.ts',
  'src/server/services/rate-changes.ts',
  'src/server/services/unlock-service.ts',
  'src/server/views/schemas/costs.ts',
];

describe('AC-7: only the Lead\'s and the Admin\'s code names the rates-changed counts', () => {
  it('the files that name them are exactly the allowed ones', () => {
    expect(pathsMatching(ALL, RATES_CHANGED)).toEqual(ALLOWED);
  });

  it('no Engineer route, no Engineer page and no component of the Engineer\'s workspace names them', () => {
    const engineerReachable = ALL.filter(
      (file) =>
        /^src\/app\/api\/v1\/estimates\/\[id\]\/(calculate|nodes|image|inputs)/.test(file.path) ||
        /^src\/app\/api\/v1\/(tasks|me)/.test(file.path) ||
        /^src\/components\/features\/(estimate-workspace|task-queue)\//.test(file.path) ||
        file.path === 'src/app/(portal)/estimates/[code]/page.tsx',
    );
    expect(engineerReachable.length).toBeGreaterThan(10);
    expect(pathsMatching(engineerReachable, RATES_CHANGED)).toEqual([]);
  });

  it('the only routes that ask the review service for the costs view are the costs read and Recalculate, which are the Lead\'s and the Admin\'s (the manifest holds no Engineer row for either)', () => {
    const askers = pathsMatching(ALL.filter((file) => file.path.startsWith('src/app/')), /getEstimateReviewService/);
    expect(askers).toEqual(['src/app/(portal)/estimates/[code]/review-page.tsx', 'src/app/api/v1/estimates/[id]/costs/route.ts', 'src/app/api/v1/estimates/[id]/recalculate/route.ts']);
  });

  it('control: a file of the Engineer\'s workspace that carried the counts is found by the same scan', () => {
    const planted = [{ path: 'src/components/features/estimate-workspace/planted.tsx', text: 'const n = costs.ratesChanged;' }];
    expect(pathsMatching(planted, RATES_CHANGED)).toEqual(['src/components/features/estimate-workspace/planted.tsx']);
    expect(pathsMatching([{ path: 'src/x.ts', text: "import { countRateChanges } from './rate-changes';" }], RATES_CHANGED)).toEqual(['src/x.ts']);
  });
});
