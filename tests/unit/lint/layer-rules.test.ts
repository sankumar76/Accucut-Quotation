import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * AC-6: every layer rule of architecture section 10 fires on a planted fault, and a clean file passes.
 * The fixtures are source strings linted under the file path the rule applies to; nothing is written
 * to disk, so the repository itself still lints clean.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: ROOT });

interface Fixture {
  readonly name: string;
  readonly filePath: string;
  readonly code: string;
  readonly ruleId: string;
}

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${ROOT}${filePath}` });
  return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]));
}

const LIB = 'src/lib/estimate/example.ts';
const SERVICE = 'src/server/services/example.ts';

const BREAKING_FIXTURES: ReadonlyArray<Fixture> = [
  { name: 'src/lib imports src/server (alias)', filePath: LIB, code: "import { run } from '@/server/services/run';\nexport const x = run;\n", ruleId: 'no-restricted-imports' },
  { name: 'src/lib imports src/server (relative)', filePath: LIB, code: "import { run } from '../../server/services/run';\nexport const x = run;\n", ruleId: 'no-restricted-imports' },
  { name: 'src/lib imports src/app', filePath: LIB, code: "import Page from '@/app/page';\nexport const x = Page;\n", ruleId: 'no-restricted-imports' },
  { name: 'src/lib imports src/components', filePath: LIB, code: "import { Money } from '@/components/shared/money';\nexport const x = Money;\n", ruleId: 'no-restricted-imports' },
  { name: 'src/lib imports next/*', filePath: LIB, code: "import { headers } from 'next/headers';\nexport const x = headers;\n", ruleId: 'no-restricted-imports' },
  { name: 'src/lib imports the Prisma client', filePath: LIB, code: "import { PrismaClient } from '@prisma/client';\nexport const x = PrismaClient;\n", ruleId: 'no-restricted-imports' },
  { name: 'a service imports the Prisma client', filePath: SERVICE, code: "import { PrismaClient } from '@prisma/client';\nexport const x = PrismaClient;\n", ruleId: 'no-restricted-imports' },
  { name: 'a service imports the generated client', filePath: SERVICE, code: "import { PrismaClient } from '../../generated/prisma/client';\nexport const x = PrismaClient;\n", ruleId: 'no-restricted-imports' },
  { name: 'a page imports the database driver', filePath: 'src/app/example/page.tsx', code: "import { Pool } from 'pg';\nexport const x = Pool;\n", ruleId: 'no-restricted-imports' },
  { name: 'an Engineer view imports a cost repository', filePath: 'src/server/views/engineer-queue.ts', code: "import { find } from '@/server/repositories/calculation-repository';\nexport const x = find;\n", ruleId: 'no-restricted-imports' },
  { name: 'an Engineer view imports the formula engine', filePath: 'src/server/views/engineer-form.ts', code: "import { evaluate } from '@/lib/formula/evaluator';\nexport const x = evaluate;\n", ruleId: 'no-restricted-imports' },
  { name: 'an Engineer page imports a cost repository', filePath: 'src/app/(portal)/engineer/page.tsx', code: "import { find } from '@/server/repositories/cost-repository';\nexport default function Page() { return find; }\n", ruleId: 'no-restricted-imports' },
  { name: 'eval', filePath: SERVICE, code: "export const x = eval('1 + 1');\n", ruleId: 'no-eval' },
  { name: 'new Function', filePath: SERVICE, code: "export const x = new Function('return 1');\n", ruleId: 'no-new-func' },
  { name: 'implied eval through a timer string', filePath: SERVICE, code: "setTimeout('doWork()', 10);\n", ruleId: 'no-implied-eval' },
  { name: 'dynamic import of user input', filePath: SERVICE, code: 'export async function load(name: string) {\n  return import(name);\n}\n', ruleId: 'no-restricted-syntax' },
  { name: "'use server' at file level", filePath: 'src/app/example/actions.ts', code: "'use server';\nexport async function save() {}\n", ruleId: 'no-restricted-syntax' },
  { name: "'use server' inside a function", filePath: 'src/app/example/form.tsx', code: "export function Form() {\n  async function save() {\n    'use server';\n  }\n  return save;\n}\n", ruleId: 'no-restricted-syntax' },
];

const CLEAN_FIXTURES: ReadonlyArray<Pick<Fixture, 'name' | 'filePath' | 'code'>> = [
  { name: 'a repository imports the Prisma client', filePath: 'src/server/repositories/example-repository.ts', code: "import { PrismaClient } from '@prisma/client';\nexport const x = PrismaClient;\n" },
  { name: 'a service imports the formula engine', filePath: SERVICE, code: "import { evaluate } from '@/lib/formula/evaluator';\nexport const x = evaluate;\n" },
  { name: 'src/lib imports another lib module', filePath: LIB, code: "import { ConfigurationError } from '../errors';\nexport const x = ConfigurationError;\n" },
  { name: 'a static dynamic import', filePath: SERVICE, code: "export const load = () => import('./other');\n" },
  { name: 'a Route Handler imports a service', filePath: 'src/app/api/example/route.ts', code: "import { run } from '@/server/services/example';\nexport const GET = run;\n" },
];

// The first lint of a run loads the whole configuration, which can take a few seconds.
describe('ESLint layer rules (AC-6)', { timeout: 30_000 }, () => {
  it.each(BREAKING_FIXTURES)('AC-6: fails lint for $name', async ({ filePath, code, ruleId }) => {
    const ruleIds = await ruleIdsFor(filePath, code);
    expect(ruleIds).toContain(ruleId);
  });

  it.each(CLEAN_FIXTURES)('AC-6: passes lint for $name', async ({ filePath, code }) => {
    const ruleIds = await ruleIdsFor(filePath, code);
    expect(ruleIds).toEqual([]);
  });
});
