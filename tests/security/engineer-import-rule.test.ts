import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

import { allowsRole, ROUTE_MANIFEST } from '@/server/http/route-manifest';

import { nonEmpty } from '../support/security-loops';

/**
 * STORY-01.03 T4 (AC-1; ADR-008 layer 2): an Engineer view (`src/server/views/engineer-*.ts`) or an Engineer page that imports a
 * cost repository, or the formula engine, fails lint. The fixtures are planted at the exact paths the rule applies to, with the
 * imports a careless change would make (`calculation-repository`, the approvals, the masters' rates), as a static `import` and as a
 * literal `import()`. Nothing is written to disk. The paths of the pages come from the route manifest, so a later story that
 * opens a page to an Engineer gets its fixture here without an edit (AC-6).
 *
 * The other half of AC-1, "a client component importing the formula engine fails the build", is shown by
 * `tests/integration/formula/server-only-build.test.ts` (a real `next build` of a client page and of a server page, as a control)
 * and `tests/unit/formula/server-only.test.ts` (every `src/lib/formula/**` file starts with `import 'server-only'`), both from
 * STORY-03.02 (AQP-106). Story 03.02 owns the module; the rule and the harness are here and there.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: ROOT });

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${ROOT}${filePath}` });
  return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]));
}

const staticImport = (specifier: string): string => `import * as imported from '${specifier}';\nexport const x = imported;\n`;
const dynamicImport = (specifier: string): string => `export const load = () => import('${specifier}');\n`;

/** The views that sit under the rule: a real one, and the names the architecture plans (section 10). */
const ENGINEER_VIEWS: ReadonlyArray<string> = [
  'src/server/views/engineer-me.ts',
  'src/server/views/engineer-queue.ts',
  'src/server/views/engineer-form.ts',
  'src/server/views/engineer-tree.tsx',
];

/** A repository or service an Engineer view must never import: Restricted data lives behind each. Real files and planned ones. */
const COST_IMPORTS: ReadonlyArray<string> = [
  '@/server/repositories/calculation-repository',
  '@/server/repositories/approval-repository',
  '@/server/repositories/master-repository',
  '@/server/repositories/customer-rate-repository',
  '@/server/repositories/material-repository',
  '@/server/repositories/exchange-rate-repository',
  '@/server/repositories/cost-repository',
  '@/server/repositories/rate-repository',
  '../repositories/master-repository',
  '../../server/repositories/calculation-repository',
  '@/server/services/masters-service',
  '@/server/services/calculation-service',
  '@/server/services/approval-service',
];

const FORMULA_IMPORTS: ReadonlyArray<string> = ['@/lib/formula', '@/lib/formula/evaluator', '../../lib/formula', '../../lib/formula/plan'];

const PRISMA_IMPORTS: ReadonlyArray<string> = ['@prisma/client', '../../generated/prisma/client'];

/** Imports an Engineer view may make: its own kind of module, none of which holds a rate, a calculation or an approval. */
const ALLOWED_IMPORTS: ReadonlyArray<string> = [
  '@/server/repositories/user-repository',
  '@/server/services/user-service',
  '@/server/http/navigation',
  '@/server/views/schemas',
  '../auth/resolve-session-user',
];

/** The page file of each manifest row that an Engineer may open, taken from the manifest, never written out here. */
const ENGINEER_PAGES: ReadonlyArray<string> = nonEmpty(
  'Engineer pages in the route manifest',
  ROUTE_MANIFEST.filter((row) => row.kind === 'page' && row.roles !== 'public' && allowsRole(row, 'ENGINEER')).map(
    (row) => `src/app/(portal)${row.path === '/' ? '' : row.path}/page.tsx`,
  ),
);

/** The first lint loads the whole configuration; it is set-up, not the behaviour under test (test strategy section 10, DL-057). */
const ESLINT_WARM_UP_TIMEOUT = 180_000;

beforeAll(async () => {
  await ruleIdsFor('src/lib/warm-up.ts', 'export const warmUp = 1;\n');
}, ESLINT_WARM_UP_TIMEOUT);

describe('an Engineer view that imports cost data fails lint (AC-1)', () => {
  const faults = ENGINEER_VIEWS.flatMap((view) =>
    [...COST_IMPORTS, ...FORMULA_IMPORTS, ...PRISMA_IMPORTS].map((specifier) => ({ view, specifier })),
  );

  it.each(faults)('static import: $view imports $specifier', async ({ view, specifier }) => {
    expect(await ruleIdsFor(view, staticImport(specifier))).toContain('no-restricted-imports');
  });

  it.each(faults)('import(): $view imports $specifier', async ({ view, specifier }) => {
    expect(await ruleIdsFor(view, dynamicImport(specifier))).toContain('no-restricted-syntax');
  });

  it.each(ENGINEER_VIEWS.flatMap((view) => ALLOWED_IMPORTS.map((specifier) => ({ view, specifier }))))(
    'control: $view may import $specifier',
    async ({ view, specifier }) => {
      expect(await ruleIdsFor(view, staticImport(specifier))).toEqual([]);
      expect(await ruleIdsFor(view, dynamicImport(specifier))).toEqual([]);
    },
  );

  it('the rule covers every repository file of the source tree that holds Restricted data, by name', () => {
    // A new repository file is a decision: it is either a cost repository (add its prefix to the rule and to COST_IMPORTS) or it is
    // listed here as one an Engineer view may import.
    const NOT_COST: ReadonlyArray<string> = ['audit-repository', 'config-repository', 'database-errors', 'prisma-client', 'throttle-repository', 'transaction', 'user-repository'];
    const COST: ReadonlyArray<string> = ['master-repository'];
    const files = readdirSync(`${ROOT}src/server/repositories`).map((name) => name.replace(/\.ts$/, ''));
    expect(files.filter((name) => ![...NOT_COST, ...COST].includes(name))).toEqual([]);
    for (const name of COST) expect(COST_IMPORTS).toContain(`@/server/repositories/${name}`);
  });
});

describe('an Engineer page that imports cost data fails lint (AC-1)', () => {
  // A page reaches data through a service or a view, so what the rule forbids it is every repository, the engine and the database
  // driver (architecture section 10); a service is a page's normal neighbour and is judged by the views it feeds.
  const pageFaults = ENGINEER_PAGES.flatMap((page) =>
    [...COST_IMPORTS.filter((specifier) => specifier.startsWith('@/server/repositories/')), ...FORMULA_IMPORTS, ...PRISMA_IMPORTS, '@/server/repositories/user-repository'].map(
      (specifier) => ({ page, specifier }),
    ),
  );

  it('lists the pages an Engineer may open, from the manifest', () => {
    expect(ENGINEER_PAGES).toEqual(expect.arrayContaining(['src/app/(portal)/queue/page.tsx', 'src/app/(portal)/page.tsx']));
  });

  it.each(pageFaults)('static import: $page imports $specifier', async ({ page, specifier }) => {
    expect(await ruleIdsFor(page, staticImport(specifier))).toContain('no-restricted-imports');
  });

  it.each(pageFaults)('import(): $page imports $specifier', async ({ page, specifier }) => {
    expect(await ruleIdsFor(page, dynamicImport(specifier))).toContain('no-restricted-syntax');
  });

  it('control: a page may import a view and a lib module', async () => {
    for (const page of ENGINEER_PAGES) {
      expect(await ruleIdsFor(page, staticImport('@/server/views/engineer-me'))).toEqual([]);
      expect(await ruleIdsFor(page, staticImport('@/lib/format'))).toEqual([]);
    }
  });
});
