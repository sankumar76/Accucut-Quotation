import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * STORY-10.18, AC-1 and AC-3 (P4): only `src/server/repositories/transaction.ts` and `tests/**` may import `createTransactionHandle`.
 * A service that could make a handle could write an audit entry in a transaction of its own (architecture section 6). The fixtures
 * are source strings linted under the path the rule applies to; nothing is written to disk. Each fault runs as a static import, a
 * re-export and a literal `import()`, the three forms AC-1 names.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: ROOT });

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: `${ROOT}${filePath}` });
  return (result?.messages ?? []).flatMap((message) => (message.ruleId === null ? [] : [message.ruleId]));
}

const MODULE = '@/server/repositories/transaction';

/** Files that must refuse the handle: services (the point of the rule), and one in every other group of the lint configuration. */
const REFUSING_FILES: ReadonlyArray<readonly [string, string]> = [
  ['a service', 'src/server/services/example.ts'],
  ['a .mts service', 'src/server/services/example.mts'],
  ['another repository', 'src/server/repositories/example-repository.ts'],
  ['a lib module', 'src/lib/example.ts'],
  ['a page', 'src/app/example/page.tsx'],
  ['a feature component', 'src/components/features/example/example.tsx'],
  ['an Engineer view', 'src/server/views/engineer-example.ts'],
  ['a script', 'scripts/example.ts'],
  ['a file in the project root', 'example.config.mjs'],
];

const IMPORT_FORMS: ReadonlyArray<readonly [string, string, string]> = [
  ['a static import', `import { createTransactionHandle } from '${MODULE}';\nexport const x = createTransactionHandle;\n`, 'no-restricted-imports'],
  ['a static import under another name', `import { createTransactionHandle as make } from '${MODULE}';\nexport const x = make;\n`, 'no-restricted-imports'],
  ['a relative static import', "import { createTransactionHandle } from '../repositories/transaction';\nexport const x = createTransactionHandle;\n", 'no-restricted-imports'],
  ['a sibling import', "import { createTransactionHandle } from './transaction';\nexport const x = createTransactionHandle;\n", 'no-restricted-imports'],
  ['a namespace import', `import * as transaction from '${MODULE}';\nexport const x = transaction;\n`, 'no-restricted-imports'],
  ['a re-export', `export { createTransactionHandle } from '${MODULE}';\n`, 'no-restricted-imports'],
  ['a re-export of everything', `export * from '${MODULE}';\n`, 'no-restricted-imports'],
  ['a literal import()', `export const load = () => import('${MODULE}');\n`, 'no-restricted-syntax'],
  ['a literal import() of a relative path with an extension', "export const load = () => import('../repositories/transaction.js');\n", 'no-restricted-syntax'],
];

/** Files that may use the handle: the runner's own file, and the tests (an in-memory runner builds one). */
const ALLOWED_FILES: ReadonlyArray<readonly [string, string]> = [
  ['transaction.ts itself', 'src/server/repositories/transaction.ts'],
  ['a support file under tests', 'tests/support/example.ts'],
  ['a unit test', 'tests/unit/example.test.ts'],
];

/**
 * The first lint of a run loads the whole configuration (the Next.js and TypeScript plugins). That is set-up, not the behaviour
 * under test, so it runs once here, in its own hook, with its own limit (test strategy section 10, DL-057; DEF-003).
 */
const ESLINT_WARM_UP_TIMEOUT = 180_000;

beforeAll(async () => {
  await ruleIdsFor('src/lib/example.ts', 'export const warmUp = 1;\n');
}, ESLINT_WARM_UP_TIMEOUT);

describe('AC-1 / AC-3 (P4): createTransactionHandle is for the transaction runner and the tests only', { timeout: 30_000 }, () => {
  describe.each(REFUSING_FILES)('%s', (_name, filePath) => {
    it.each(IMPORT_FORMS)('refuses %s', async (_form, code, ruleId) => {
      expect(await ruleIdsFor(filePath, code)).toContain(ruleId);
    });
  });

  describe.each(ALLOWED_FILES)('%s', (_name, filePath) => {
    it.each(IMPORT_FORMS)('allows %s', async (_form, code) => {
      expect(await ruleIdsFor(filePath, code)).toEqual([]);
    });
  });

  it('leaves the rest of transaction.ts open to a service: the types and the other names', async () => {
    const code = `import { clientFor, createTransactionRunner, type Transaction, type TransactionRunner } from '${MODULE}';\nexport { clientFor, createTransactionRunner };\nexport type Handle = Transaction | TransactionRunner;\n`;
    expect(await ruleIdsFor('src/server/services/example.ts', code)).toEqual([]);
    expect(await ruleIdsFor('src/server/repositories/example-repository.ts', code)).toEqual([]);
  });

  it('keeps the next/image ban in a file the new rule covers, and in one it leaves out', async () => {
    const code = "import Image from 'next/image';\nexport const x = Image;\n";
    expect(await ruleIdsFor('src/server/services/example.ts', code)).toContain('no-restricted-imports');
    expect(await ruleIdsFor('tests/support/example.ts', code)).toContain('no-restricted-imports');
  });

  it('keeps the other syntax rules in the files it covers', async () => {
    expect(await ruleIdsFor('scripts/example.ts', 'export async function load(name: string) {\n  return import(name);\n}\n')).toContain('no-restricted-syntax');
  });
});
