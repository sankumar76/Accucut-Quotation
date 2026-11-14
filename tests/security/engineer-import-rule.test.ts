import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

import { allowsRole, ROUTE_MANIFEST } from '@/server/http/route-manifest';

import { nonEmpty } from '../support/security-loops';

/**
 * STORY-01.03 T4 (AC-1; ADR-008 layer 2; G6 STD-01, STD-05): an Engineer view (`src/server/views/engineer-*.ts`) may import from the data
 * layer only what is on a short allow-list; everything else is refused, including a file that does not exist yet. The fixtures are
 * planted at the exact paths the rule applies to, as a static `import` and as a literal `import()`. Nothing is written to disk.
 *   - every file in `src/server/repositories` and `src/server/services` is classed here as allowed or blocked, and the lint is asked
 *     about each: a file in neither list fails the test, so a new file cannot be added unclassified (the "block by default" is the
 *     rule's; the classification is this test's);
 *   - files that do not exist yet (a calculation or approval service or repository, a customer-rate repository) are refused by the same rule;
 *   - `@/server/composition` (it hands out every service) and the schemas barrel (it re-exports the Admin schemas) are refused;
 *   - an Engineer page may import no repository, no formula engine and no database driver. The pages come from the route manifest, so a
 *     later story that opens a page to an Engineer gets its fixture here without an edit (AC-6).
 *
 * The other half of AC-1, "a client component importing the formula engine fails the build", is shown by
 * `tests/integration/formula/server-only-build.test.ts` (a real `next build` of a client page and of a server page, as a control)
 * and `tests/unit/formula/server-only.test.ts` (every `src/lib/formula/**` file starts with `import 'server-only'`), both from
 * STORY-03.02 (AQP-106). "Build" here means the CI build, whose stage 4 runs this lint: `next build` itself runs no ESLint (QLT-13).
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
  // STORY-04.04: `GET /api/v1/tasks/{id}`. It imports its own schema file and the status machine's types and no service or repository (they are all blocked for it).
  'src/server/views/engineer-task.ts',
  'src/server/views/engineer-queue.ts',
  'src/server/views/engineer-form.ts',
  'src/server/views/engineer-tree.tsx',
];

/** What an Engineer view may import from `src/server/repositories`, and what it may not. Both lists together are the directory. */
const REPOSITORIES = {
  allowed: ['user-repository', 'database-errors', 'transaction'],
  blocked: [
    'audit-repository',
    // STORY-03.05 (AC-4, NFR-002): every column of the calculation record is cost data (calculations and calculation_rows are Restricted, architecture section 5.1).
    'calculation-repository',
    'config-repository',
    'customer-repository',
    'decimal-text',
    'estimate-node-repository',
    'estimate-repository',
    // STORY-02.07: the open estimates that use a customer or a material, read for the delete guard of the Admin's masters. No Engineer view needs it.
    'estimate-use',
    'exchange-rate-repository',
    'master-constraints',
    'master-repository',
    'material-repository',
    'prisma-client',
    'task-repository',
    'throttle-repository',
    'treatment-repository',
  ],
} as const;

/** The same for `src/server/services`. Audit and config modules hold the rate before and after, and the formula text. */
const SERVICES = {
  allowed: ['user-service', 'auth-service'],
  blocked: [
    'account-service',
    'audit-cursor',
    'audit-events',
    'audit-secrets',
    'audit-service',
    'bootstrap-admin-service',
    'calculation-service',
    'config-service',
    'customer-service',
    // STORY-05.03: the inputs half of the estimate service (the part form and the save of what was typed). It reads the Material Master and the field registry, so an Engineer view has no use for it.
    'estimate-inputs',
    'estimate-service',
    'exchange-rate-service',
    'masters-service',
    'password-policy',
    'rate-name-rules',
    // STORY-06.14: the password step-up check holds no cost data, but it is the guard of Admin-only actions (cancel an approval, remove a
    // price, edit a formula) and is called by their services and routes, never by a view. An Engineer view has no use for it, so it stays
    // blocked, as `account-service` (the other password check) is; only people, sign-in state and plain types are allowed.
    'step-up-service',
    'task-queue-cursor',
    'task-service',
    'treatment-service',
  ],
} as const;

/** Files that do not exist yet. The rule refuses them as well, because it lists what is allowed, not what is forbidden. */
const FUTURE_IMPORTS: ReadonlyArray<string> = [
  '@/server/repositories/approval-repository',
  '@/server/repositories/customer-rate-repository',
  '../repositories/master-repository',
  '../../server/repositories/calculation-repository',
  '@/server/services/approval-service',
  '@/server/services/customers-service',
  '@/server/services/materials-service',
];

/** The service container, and the barrel that re-exports the Admin schemas. */
const CONTAINER_AND_BARREL_IMPORTS: ReadonlyArray<string> = [
  '@/server/repositories',
  '@/server/services',
  '../repositories',
  '../services/',
  '@/server/composition',
  '../composition',
  '../../server/composition',
  '@/server/views/schemas',
  '@/server/views/schemas/index',
  './schemas',
  './schemas/index',
];

const FORMULA_IMPORTS: ReadonlyArray<string> = ['@/lib/formula', '@/lib/formula/evaluator', '../../lib/formula', '../../lib/formula/plan'];

/** The calculated row outputs and the calculator that makes them (STORY-03.03 AC-7). Other modules of `lib/estimate` hold nothing Restricted. */
const ROW_OUTPUT_IMPORTS: ReadonlyArray<string> = ['@/lib/estimate/row-outputs', '@/lib/estimate/row-calculator', '@/lib/estimate/product-totals', '../../lib/estimate/row-outputs', '../../lib/estimate/product-totals'];

const PRISMA_IMPORTS: ReadonlyArray<string> = ['@prisma/client', '../../generated/prisma/client'];

const repositoryPath = (name: string): string => `@/server/repositories/${name}`;
const servicePath = (name: string): string => `@/server/services/${name}`;

/**
 * Modules an Engineer view may import by NAME only (STORY-10.18, AQP-237). `transaction.ts` also holds `createTransactionHandle`, which
 * only that file and `tests/**` may import (architecture section 6), so a namespace import or an `import()` of the whole module is refused
 * for a view as it is for a service, and so is the name `createTransactionHandle`. Every other name passes, the types and also
 * `clientFor` and `createTransactionRunner`: the lint does not make the file "types only" (a view still has no way to a `PrismaClient`).
 */
const NAMED_IMPORTS_ONLY: ReadonlyArray<string> = [repositoryPath('transaction')];

/** Imports an Engineer view may make: the allow-lists, its own schema file, and the shell's modules. */
const ALLOWED_IMPORTS: ReadonlyArray<string> = [
  ...REPOSITORIES.allowed.map(repositoryPath).filter((specifier) => !NAMED_IMPORTS_ONLY.includes(specifier)),
  ...SERVICES.allowed.map(servicePath),
  '@/server/http/navigation',
  '@/server/views/schemas/me',
  './schemas/me',
  // STORY-04.04: the task schema file holds names, codes, paths, instants and the status of an estimate, no cost field (the barrel stays refused).
  '@/server/views/schemas/tasks',
  './schemas/tasks',
  // STORY-04.04: the words of a task's status, derived from `estimates.status` alone; it holds no Restricted type.
  '@/lib/estimate/task-status',
  '@/lib/estimate/validation',
  // STORY-06.01: the status machine holds statuses, events and roles, no figure and no person's data, so an Engineer view may read it to show inputs read-only.
  '@/lib/estimate/state-machine',
  '@/lib/estimate/can-edit-inputs',
  '../auth/resolve-session-user',
];

const BLOCKED_IMPORTS: ReadonlyArray<string> = [
  ...REPOSITORIES.blocked.map(repositoryPath),
  ...SERVICES.blocked.map(servicePath),
  ...FUTURE_IMPORTS,
  ...CONTAINER_AND_BARREL_IMPORTS,
  ...FORMULA_IMPORTS,
  ...ROW_OUTPUT_IMPORTS,
  ...PRISMA_IMPORTS,
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

const filesIn = (directory: string): string[] => readdirSync(`${ROOT}${directory}`).map((name) => name.replace(/\.tsx?$/, ''));

describe('an Engineer view may import only what is on the allow-list (AC-1, STD-01)', () => {
  const faults = ENGINEER_VIEWS.flatMap((view) => BLOCKED_IMPORTS.map((specifier) => ({ view, specifier })));

  it.each(faults)('static import is refused: $view imports $specifier', async ({ view, specifier }) => {
    expect(await ruleIdsFor(view, staticImport(specifier))).toContain('no-restricted-imports');
  });

  it.each(faults)('import() is refused too: $view imports $specifier', async ({ view, specifier }) => {
    expect(await ruleIdsFor(view, dynamicImport(specifier))).toContain('no-restricted-syntax');
  });

  it.each(ENGINEER_VIEWS.flatMap((view) => ALLOWED_IMPORTS.map((specifier) => ({ view, specifier }))))(
    'control: $view may import $specifier',
    async ({ view, specifier }) => {
      expect(await ruleIdsFor(view, staticImport(specifier))).toEqual([]);
      expect(await ruleIdsFor(view, dynamicImport(specifier))).toEqual([]);
    },
  );

  it.each(ENGINEER_VIEWS.flatMap((view) => NAMED_IMPORTS_ONLY.map((specifier) => ({ view, specifier }))))(
    'control: $view may import names from $specifier, but not createTransactionHandle and not the whole module (AQP-237)',
    async ({ view, specifier }) => {
      expect(await ruleIdsFor(view, `import type { Transaction } from '${specifier}';\nexport type Handle = Transaction;\n`)).toEqual([]);
      expect(await ruleIdsFor(view, `import { clientFor } from '${specifier}';\nexport const reach = clientFor;\n`)).toEqual([]);
      expect(await ruleIdsFor(view, `import { createTransactionHandle } from '${specifier}';\nexport const make = createTransactionHandle;\n`)).toContain(
        'no-restricted-imports',
      );
      expect(await ruleIdsFor(view, staticImport(specifier))).toContain('no-restricted-imports');
      expect(await ruleIdsFor(view, dynamicImport(specifier))).toContain('no-restricted-syntax');
    },
  );

  it('F10: a named import of a service getter from the container is refused', async () => {
    const code = "import { getMastersService } from '@/server/composition';\nexport const service = getMastersService;\n";
    expect(await ruleIdsFor('src/server/views/engineer-me.ts', code)).toContain('no-restricted-imports');
  });

  it('STORY-04.04: the real task view lints clean, and the same file with the task service or the task repository imported is refused', async () => {
    const view = 'src/server/views/engineer-task.ts';
    const real = readFileSync(`${ROOT}${view}`, 'utf8');
    expect(await ruleIdsFor(view, real)).toEqual([]);
    expect(await ruleIdsFor(view, `import type { TaskDetail } from '../services/task-service';\n${real}`)).toContain('no-restricted-imports');
    expect(await ruleIdsFor(view, `import type { TaskDetailRow } from '../repositories/task-repository';\n${real}`)).toContain('no-restricted-imports');
  });
});

describe('every repository and service file is classed, and the lint agrees with the class (STD-01 d)', () => {
  it.each([
    ['repositories', REPOSITORIES, 'src/server/repositories'],
    ['services', SERVICES, 'src/server/services'],
  ] as const)('every file in src/server/%s is on exactly one list; a new file fails here until someone decides', (_name, lists, directory) => {
    const classed = [...lists.allowed, ...lists.blocked];
    const files = filesIn(directory);
    expect(files.filter((file) => !classed.some((name) => name === file))).toEqual([]);
    expect(classed.filter((name) => !files.includes(name))).toEqual([]);
    expect(new Set(classed).size).toBe(classed.length);
  });

  it('the allowed files are the ones a view needs for the shell: people, sign-in state and plain types', () => {
    expect([...REPOSITORIES.allowed, ...SERVICES.allowed].sort()).toEqual([
      'auth-service',
      'database-errors',
      'transaction',
      'user-repository',
      'user-service',
    ]);
  });
});

describe('an Engineer page that imports cost data fails lint (AC-1)', () => {
  // A page reaches data through a service or a view, so what the rule forbids it is every repository, the engine and the database
  // driver (architecture section 10); a service is a page's normal neighbour and is judged by the views it feeds.
  const repositories = [...REPOSITORIES.allowed, ...REPOSITORIES.blocked].map(repositoryPath);
  const pageFaults = ENGINEER_PAGES.flatMap((page) => [...repositories, ...FORMULA_IMPORTS, ...PRISMA_IMPORTS].map((specifier) => ({ page, specifier })));

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
