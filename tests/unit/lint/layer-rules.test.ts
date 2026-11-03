import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * AC-6: every layer rule of architecture section 10 fires on a planted fault, and a clean file passes.
 * The fixtures are source strings linted under the file path the rule applies to; nothing is written
 * to disk, so the repository itself still lints clean.
 *
 * Each import fixture runs twice: as a static `import` (rule `no-restricted-imports`) and as a literal
 * `import()` (rule `no-restricted-syntax`), because lazy loading must not bypass a layer rule (QLT-02).
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: ROOT });

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${ROOT}${filePath}` });
  return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]));
}

interface ImportCase {
  readonly name: string;
  readonly filePath: string;
  readonly specifier: string;
}

const PRISMA = '@prisma/client';
const COST_REPOSITORY = '@/server/repositories/cost-repository';
const OTHER_REPOSITORY = '@/server/repositories/user-repository';
const FORMULA = '@/lib/formula/evaluator';

// Real paths from architecture section 10, not invented ones (QLT-01).
const QUEUE_PAGE = 'src/app/(portal)/queue/page.tsx';
const ESTIMATE_PAGE = 'src/app/(portal)/estimates/[code]/page.tsx';
const FEATURE_COMPONENT = 'src/components/features/queue/queue-list.tsx';
const ENGINEER_VIEW = 'src/server/views/engineer-queue.ts';
const LIB = 'src/lib/estimate/example.ts';
const SERVICE = 'src/server/services/example.ts';

const IMPORT_FAULTS: ReadonlyArray<ImportCase> = [
  { name: 'src/lib imports src/server (alias)', filePath: LIB, specifier: '@/server/services/run' },
  { name: 'src/lib imports src/server (relative)', filePath: LIB, specifier: '../../server/services/run' },
  { name: 'src/lib imports src/app', filePath: LIB, specifier: '@/app/page' },
  { name: 'src/lib imports src/components', filePath: LIB, specifier: '@/components/shared/money' },
  { name: 'src/lib imports next/*', filePath: LIB, specifier: 'next/headers' },
  { name: 'src/lib imports the Prisma client', filePath: LIB, specifier: PRISMA },
  { name: 'a .js file in src/lib imports the Prisma client', filePath: 'src/lib/example.js', specifier: PRISMA },
  { name: 'a service imports the Prisma client', filePath: SERVICE, specifier: PRISMA },
  { name: 'a .mts service imports the Prisma client', filePath: 'src/server/services/example.mts', specifier: PRISMA },
  { name: 'a service imports the generated client', filePath: SERVICE, specifier: '../../generated/prisma/client' },
  { name: 'a page imports the database driver', filePath: 'src/app/example/page.tsx', specifier: 'pg' },
  { name: 'the queue page imports a cost repository', filePath: QUEUE_PAGE, specifier: COST_REPOSITORY },
  { name: 'the queue page imports the formula engine', filePath: QUEUE_PAGE, specifier: FORMULA },
  { name: 'the queue page imports any repository', filePath: QUEUE_PAGE, specifier: OTHER_REPOSITORY },
  {
    name: 'the queue page imports a repository by a relative path',
    filePath: QUEUE_PAGE,
    specifier: '../../../server/repositories/user-repository',
  },
  { name: 'the estimate page imports a cost repository', filePath: ESTIMATE_PAGE, specifier: COST_REPOSITORY },
  { name: 'the estimate page imports the formula engine', filePath: ESTIMATE_PAGE, specifier: FORMULA },
  { name: 'a feature component imports a cost repository', filePath: FEATURE_COMPONENT, specifier: COST_REPOSITORY },
  { name: 'a feature component imports the formula engine', filePath: FEATURE_COMPONENT, specifier: FORMULA },
  { name: 'a feature component imports any repository', filePath: FEATURE_COMPONENT, specifier: OTHER_REPOSITORY },
  { name: 'a feature component imports the Prisma client', filePath: FEATURE_COMPONENT, specifier: PRISMA },
  { name: 'an Engineer view imports a cost repository', filePath: ENGINEER_VIEW, specifier: COST_REPOSITORY },
  { name: 'an Engineer view imports the formula engine', filePath: 'src/server/views/engineer-form.ts', specifier: FORMULA },
  { name: 'a .tsx Engineer view imports a cost repository', filePath: 'src/server/views/engineer-a.tsx', specifier: COST_REPOSITORY },
  { name: 'an Engineer view imports the Prisma client', filePath: ENGINEER_VIEW, specifier: PRISMA },
];

const CLEAN_IMPORTS: ReadonlyArray<ImportCase> = [
  { name: 'a repository imports the Prisma client', filePath: 'src/server/repositories/example-repository.ts', specifier: PRISMA },
  { name: 'a service imports the formula engine', filePath: SERVICE, specifier: FORMULA },
  { name: 'a service imports a repository', filePath: SERVICE, specifier: OTHER_REPOSITORY },
  { name: 'a non-Engineer view imports a repository', filePath: 'src/server/views/lead-queue.ts', specifier: OTHER_REPOSITORY },
  { name: 'src/lib imports another lib module', filePath: LIB, specifier: '../errors' },
  { name: 'a Route Handler imports a service', filePath: 'src/app/api/example/route.ts', specifier: '@/server/services/example' },
  { name: 'a page imports a view', filePath: QUEUE_PAGE, specifier: '@/server/views/lead-queue' },
  { name: 'a component imports a lib module', filePath: FEATURE_COMPONENT, specifier: '@/lib/format' },
];

const staticImport = (specifier: string): string => `import * as imported from '${specifier}';\nexport const x = imported;\n`;
const dynamicImport = (specifier: string): string => `export const load = () => import('${specifier}');\n`;

const OTHER_FAULTS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['eval', SERVICE, "export const x = eval('1 + 1');\n", 'no-eval'],
  ['eval in a .mts file', 'src/server/services/example.mts', "export const x = eval('1 + 1');\n", 'no-eval'],
  ['new Function', SERVICE, "export const x = new Function('return 1');\n", 'no-new-func'],
  ['implied eval through a timer string', SERVICE, "setTimeout('doWork()', 10);\n", 'no-implied-eval'],
  ['dynamic import of user input', SERVICE, 'export async function load(name: string) {\n  return import(name);\n}\n', 'no-restricted-syntax'],
  ["'use server' at file level", 'src/app/example/actions.ts', "'use server';\nexport async function save() {}\n", 'no-restricted-syntax'],
  [
    "'use server' inside a function",
    'src/app/example/form.tsx',
    "export function Form() {\n  async function save() {\n    'use server';\n  }\n  return save;\n}\n",
    'no-restricted-syntax',
  ],
  ["'use server' in a .jsx file", 'src/app/example/form.jsx', "'use server';\nexport const x = 1;\n", 'no-restricted-syntax'],
];

/**
 * The first lint of a run loads the whole configuration (the Next.js and TypeScript plugins). That is set-up, not
 * the behaviour under test, so it runs once here, in its own hook, with its own time limit (test strategy section
 * 10, DL-057; DEF-003). On a busy machine it took up to about a minute; it must not count against a test.
 */
const ESLINT_WARM_UP_TIMEOUT = 180_000;

beforeAll(async () => {
  await ruleIdsFor(LIB, 'export const warmUp = 1;\n');
}, ESLINT_WARM_UP_TIMEOUT);

// After the warm-up a lint takes milliseconds; this limit only stops a hang.
describe('ESLint layer rules (AC-6)', { timeout: 30_000 }, () => {
  it.each(IMPORT_FAULTS)('AC-6: static import fails lint: $name', async ({ filePath, specifier }) => {
    expect(await ruleIdsFor(filePath, staticImport(specifier))).toContain('no-restricted-imports');
  });

  it.each(IMPORT_FAULTS)('AC-6: import() fails lint too (QLT-02): $name', async ({ filePath, specifier }) => {
    expect(await ruleIdsFor(filePath, dynamicImport(specifier))).toContain('no-restricted-syntax');
  });

  it.each(CLEAN_IMPORTS)('AC-6: passes lint, static and import(): $name', async ({ filePath, specifier }) => {
    expect(await ruleIdsFor(filePath, staticImport(specifier))).toEqual([]);
    expect(await ruleIdsFor(filePath, dynamicImport(specifier))).toEqual([]);
  });

  it.each(OTHER_FAULTS)('AC-6: fails lint for %s', async (_name, filePath, code, ruleId) => {
    expect(await ruleIdsFor(filePath, code)).toContain(ruleId);
  });

  it('AC-6: a static dynamic import is allowed', async () => {
    expect(await ruleIdsFor(SERVICE, "export const load = () => import('./other');\n")).toEqual([]);
  });
});
