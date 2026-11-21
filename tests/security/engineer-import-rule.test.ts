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
    // STORY-06.06 (NFR-002): the approvals table holds the Approved Quote Price (BO), the calculated total and who approved it. Restricted in full, so no Engineer view may import it.
    'approval-repository',
    'audit-repository',
    // STORY-03.05 (AC-4, NFR-002): every column of the calculation record is cost data (calculations and calculation_rows are Restricted, architecture section 5.1).
    'calculation-repository',
    'config-repository',
    'customer-repository',
    'decimal-text',
    // STORY-09.01 (TB-4): the e-mail outbox holds names and task details in bodies, and the settings row of the mail sender. Confidential; no Engineer view reads or writes it.
    'email-outbox-repository',
    'estimate-node-repository',
    'estimate-repository',
    // STORY-07.01: the task code and the customer's name of an estimate, for the name of its export file. Nothing an Engineer view has a use for.
    'export-repository',
    // STORY-02.07: the open estimates that use a customer or a material, read for the delete guard of the Admin's masters. No Engineer view needs it.
    'estimate-use',
    'exchange-rate-repository',
    // STORY-05.07: the part pictures, stored whole and read by their ID. No Engineer view needs the bytes or their owner lookup; the picture route is a handler, not a view.
    'image-repository',
    // STORY-02.09: the backup and disk readings of `job_runs`, for the Admin's Settings page. Internal data, but nothing an Engineer's view has a use for, so it stays blocked.
    'job-run-repository',
    'master-constraints',
    'master-repository',
    'material-repository',
    // STORY-09.04 and 09.05: the overdue scan's candidate read and the daily digest's read (task code, title, folder, deadline, the Engineer's ID, the assigner's ID and name, never an address) and their stores. No Engineer view imports it.
    'overdue-repository',
    'prisma-client',
    // STORY-09.02: the one `settings` row (the alerts switch and the sender mailbox), for the Admin's Settings page. No cost data and no credential, but nothing an Engineer's view has a use for, so it stays blocked.
    'settings-repository',
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
    // STORY-01.09: the Admin hand-over holds no cost data, but it moves the top role and is the guard of an Admin-only, step-up action; called by its one route, never by a view. Blocked, as `step-up-service` is.
    'admin-handover-service',
    // STORY-06.05 (NFR-002): the approval's guard reads the calculation basis under the estimate's lock, for the Lead and the Admin only; from STORY-06.06 it also holds the approved price.
    'approval-service',
    'audit-cursor',
    'audit-events',
    'audit-secrets',
    'audit-service',
    'bootstrap-admin-service',
    // STORY-05.09: the masters one calculation reads (the customer's rates, every material's price and the exchange rates), in the caller's transaction. Restricted in full, like the service that reads it.
    'calculation-masters',
    'calculation-service',
    // STORY-06.12 (NFR-002): cancel approval reads and writes the approval (its price is in the audit entry), for the Admin only; no Engineer view imports it.
    'cancel-approval-service',
    // STORY-08.02 (NFR-002): the formula editor reads formulas, rate names and a stored calculation, and saves a version with the Admin's password. Admin only; no Engineer view imports it.
    'config-edit-service',
    'config-read-service',
    'config-service',
    // STORY-08.03 (NFR-002): the insert wizard's options, preview and save read formulas, rate names and column labels, for the Admin only; no Engineer view imports it.
    'config-structure-service',
    // STORY-06.03 (AC-8, NFR-002): the cost details of one row read the calculation record and answer with formulas, rate values and costs, for the Lead and the Admin only.
    'cost-details-service',
    'customer-service',
    // STORY-06.08 and STORY-06.12: the check of a customer or a material deleted after the approval, shared by unlock and cancel approval. It reads the estimate's customer and materials, for the Lead's and the Admin's services only.
    'deleted-masters',
    // STORY-05.03: the inputs half of the estimate service (the part form and the save of what was typed). It reads the Material Master and the field registry, so an Engineer view has no use for it.
    'estimate-inputs',
    // STORY-06.02 (AC-5, NFR-002): the review reads the calculation record and answers with every figure of an estimate, for the Lead and the Admin only.
    'estimate-review-service',
    'estimate-service',
    // STORY-07.01 (AC-3, NFR-002): the Excel export builds the file of the worksheet's layout (its figures from STORY-07.02), for the Lead and the Admin only.
    'export-service',
    // STORY-05.07: the picture half of the estimate service (add, replace, remove, read). Built by the estimate service; no Engineer view has a use for it.
    'image-service',
    'exchange-rate-service',
    'masters-service',
    'password-policy',
    // STORY-06.11 (NFR-002): the count of what changed in the rates since a calculation reads the stored snapshot and the masters now, for the unlock preview and the Lead's notice only.
    'rate-changes',
    'rate-name-rules',
    // STORY-06.13 (NFR-002): remove price reads the approval's price (it is in the audit entry that keeps it), for the Admin only; no Engineer view imports it.
    'remove-price-service',
    // STORY-02.09: the Admin's Settings page (the last good backup and the server disk). It holds no cost data, but it is Admin only and no Engineer view imports it.
    'settings-service',
    // STORY-06.14: the password step-up check holds no cost data, but it is the guard of Admin-only actions (cancel an approval, remove a
    // price, edit a formula) and is called by their services and routes, never by a view. An Engineer view has no use for it, so it stays
    // blocked, as `account-service` (the other password check) is; only people, sign-in state and plain types are allowed.
    'step-up-service',
    // STORY-09.03 (NFR-002): the assignment e-mail's outbox row (names, folder path, deadline; no cost field), written by the task service in its transaction. No Engineer view imports it.
    'task-mail',
    'task-queue-cursor',
    'task-service',
    'treatment-service',
    // STORY-06.08 (NFR-002): unlock reads the approved calculation's master snapshot (rates and prices) to count what changed, and writes the approval's unlock. For the Lead and the Admin only; no Engineer view imports it.
    'unlock-service',
  ],
} as const;

/** Files that do not exist yet. The rule refuses them as well, because it lists what is allowed, not what is forbidden. */
const FUTURE_IMPORTS: ReadonlyArray<string> = [
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

/**
 * The contract of `GET /estimates/{id}/costs` (STORY-06.02 AC-4, AC-5): every figure of an estimate. The lint refuses it to an Engineer view by name (the other schema files are refused only through
 * the barrel), as a static import and as `import()`, in the two spellings a view would use. `lib/estimate/figure-state` holds only counts and stays allowed.
 */
const COSTS_SCHEMA_IMPORTS: ReadonlyArray<string> = [
  '@/server/views/schemas/costs',
  './schemas/costs',
  '../views/schemas/costs',
  // STORY-06.03 (AC-8, NFR-002): the contract of `GET /estimates/{id}/nodes/{nodeId}/costs`, which holds the formulas, rates and calculated costs of a row.
  '@/server/views/schemas/node-costs',
  './schemas/node-costs',
  '../views/schemas/node-costs',
  // STORY-07.01 (AC-3, NFR-002): the contracts of the Excel file and its summary.
  '@/server/views/schemas/export',
  './schemas/export',
  '../views/schemas/export',
];

const FORMULA_IMPORTS: ReadonlyArray<string> = ['@/lib/formula', '@/lib/formula/evaluator', '../../lib/formula', '../../lib/formula/plan'];

/** The calculated row outputs and the calculator that makes them (STORY-03.03 AC-7). Other modules of `lib/estimate` hold nothing Restricted. */
const ROW_OUTPUT_IMPORTS: ReadonlyArray<string> = [
  '@/lib/estimate/row-outputs',
  '@/lib/estimate/row-calculator',
  '@/lib/estimate/product-totals',
  '../../lib/estimate/row-outputs',
  '../../lib/estimate/product-totals',
  // STORY-06.03 (AC-8, NFR-002): the working of a stored row, with its formulas, rate values and calculated costs.
  '@/lib/estimate/cost-working',
  '../../lib/estimate/cost-working',
];

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
  // STORY-06.02: the figure state holds two counts and no figure, so an Engineer's code may know it (the calculation repository and the review service, which hold the figures, stay blocked).
  '@/lib/estimate/figure-state',
  '../auth/resolve-session-user',
];

const BLOCKED_IMPORTS: ReadonlyArray<string> = [
  ...REPOSITORIES.blocked.map(repositoryPath),
  ...SERVICES.blocked.map(servicePath),
  ...FUTURE_IMPORTS,
  ...CONTAINER_AND_BARREL_IMPORTS,
  ...COSTS_SCHEMA_IMPORTS,
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

/**
 * The worker's jobs (`src/server/jobs`, ADR-011, STORY-10.04). A job file is not a view and not part of the data layer, so the lint has no list for it; it is
 * classed here instead. A job that reads the database is a service in all but name, so a job is allowed to exist only if it takes no repository, service, the
 * container, the formula engine or the database driver: `log-prune` reads and deletes log files and holds no cost data, and its log lines hold counts only.
 * A new job file fails this test until someone classes it, and a job that needs the data layer has to be classed (and reviewed) as the service it is.
 *
 * `backup-watch` (STORY-10.05) reads and writes `job_runs`, which holds the record of the backups and the free space of the disk: Internal data, no cost or rate. It reaches the
 * database only through a store that the worker gives it as a parameter (`takesItsStoreByInjection`), so the job file itself imports no repository, service or driver, and a test
 * can fix the clock and stub both the store and `statfs`. What the store may do is decided where it is built (`src/server/repositories/job-run-repository.ts`).
 *
 * `heartbeat` (STORY-10.09a) writes its one `job_runs` row a minute and calls the prune function through a store the worker gives it, the same way, and it uses the one wrapper.
 * `run-job` (STORY-10.09a) is that wrapper: it holds no data and imports nothing at all (the worker gives it the logger, the clock and the way to write a failed row), so a job's
 * log lines and its failed row cannot reach the data layer through it. A new file fails the list test below until someone classes it.
 *
 * `outbox-send` (STORY-09.01) reads and writes `email_outbox` and `settings`: Confidential, names and task details, never a cost or a rate. It takes the same route: its store, its mailer
 * and its clock are parameters, and the only mail modules it names are types. `tests/security/mail-confidentiality.test.ts` checks its imports (and those of `src/server/mail`) against an exact list (AC-10).
 */
const JOBS = { holdsNoData: ['log-prune'], takesItsStoreByInjection: ['backup-watch', 'daily-digest', 'heartbeat', 'outbox-send', 'overdue-scan'] } as const;
const ALL_JOBS = [...JOBS.holdsNoData, ...JOBS.takesItsStoreByInjection];
/** Not a job: the wrapper every job runs through. It imports nothing. */
const JOB_WRAPPER = 'run-job';

describe('every worker job is classed and takes nothing from the data layer (NFR-002)', () => {
  it('every file in src/server/jobs is on the list; a new file fails here until someone decides', () => {
    expect(filesIn('src/server/jobs').sort()).toEqual([...ALL_JOBS, JOB_WRAPPER].sort());
  });

  it('the job wrapper imports nothing at all, so no job can reach the data layer through it', () => {
    const source = readFileSync(`${ROOT}src/server/jobs/${JOB_WRAPPER}.ts`, 'utf8');
    expect([...source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map((match) => match[1])).toEqual([]);
    expect(source).not.toMatch(/readFile|createReadStream|open\(/);
  });

  it.each(ALL_JOBS)('%s imports no repository, service, container, formula engine or database driver, and logs no file content', (job) => {
    const source = readFileSync(`${ROOT}src/server/jobs/${job}.ts`, 'utf8');
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '');
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier, `${job} imports ${specifier}`).not.toMatch(/repositories|services|composition|@\/lib\/formula|lib\/formula|@prisma\/client|generated\/prisma|\/views\//);
    }
    // It never opens a file to read it: only lstat, readdir, unlink and statfs.
    expect(source).not.toMatch(/readFile|createReadStream|open\(/);
  });

  it('backup-watch takes only Node, node-cron and one plain lib module, and its row holds figures of the disk and nothing about an estimate', () => {
    const source = readFileSync(`${ROOT}src/server/jobs/backup-watch.ts`, 'utf8');
    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1] ?? '').sort();
    expect(specifiers).toEqual(['../../lib/settings/backup-status', './run-job', 'node-cron', 'node:fs/promises']);
    expect(source).not.toMatch(/\b(?:estimates?|customers?|rates?|costs?|prices?)\b/i);
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
