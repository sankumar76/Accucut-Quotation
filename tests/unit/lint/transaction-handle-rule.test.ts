import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { createLintFixture, LINT_WARM_UP_TIMEOUT } from '../../support/lint-fixture';

/**
 * STORY-10.18, AC-1 and AC-3 (P4): only `src/server/repositories/transaction.ts` and `tests/**` may import `createTransactionHandle`.
 * A service that could make a handle could write an audit entry in a transaction of its own (architecture section 6). The fixtures
 * are source strings linted under the path the rule applies to; nothing is written to disk. Each fault runs as a static import, a
 * re-export and a literal `import()`, the three forms AC-1 names.
 *
 * The assertion is on the MESSAGE, not only the rule ID (QLT-05): every group of `eslint.config.mjs` has bans of its own that raise the
 * same rule ID for the same import, so a rule ID alone stays green when the entry is dropped from `restrict()`. Only this rule's
 * message names `createTransactionHandle`, and only its `import()` message says the whole module is refused (STD-07).
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const { messagesFor, ruleIdsFor } = createLintFixture(ROOT);

const MODULE = '@/server/repositories/transaction';
const HANDLE_NAME = 'createTransactionHandle';
const WHOLE_MODULE_REFUSED = 'refused whole';

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

interface ImportForm {
  readonly name: string;
  readonly code: string;
  readonly ruleId: 'no-restricted-imports' | 'no-restricted-syntax';
  /** What the rule's message must say; no other rule of any group says it. */
  readonly messageSays: string;
}

const staticForm = (name: string, code: string): ImportForm => ({ name, code, ruleId: 'no-restricted-imports', messageSays: HANDLE_NAME });
const dynamicForm = (name: string, code: string): ImportForm => ({ name, code, ruleId: 'no-restricted-syntax', messageSays: WHOLE_MODULE_REFUSED });

const IMPORT_FORMS: readonly ImportForm[] = [
  staticForm('a static import', `import { createTransactionHandle } from '${MODULE}';\nexport const x = createTransactionHandle;\n`),
  staticForm('a static import under another name', `import { createTransactionHandle as make } from '${MODULE}';\nexport const x = make;\n`),
  staticForm('a relative static import', "import { createTransactionHandle } from '../repositories/transaction';\nexport const x = createTransactionHandle;\n"),
  staticForm('a sibling import', "import { createTransactionHandle } from './transaction';\nexport const x = createTransactionHandle;\n"),
  staticForm('a namespace import', `import * as transaction from '${MODULE}';\nexport const x = transaction;\n`),
  staticForm('a re-export', `export { createTransactionHandle } from '${MODULE}';\n`),
  staticForm('a re-export of everything', `export * from '${MODULE}';\n`),
  dynamicForm('a literal import()', `export const load = () => import('${MODULE}');\n`),
  dynamicForm('a literal import() of a relative path with an extension', "export const load = () => import('../repositories/transaction.js');\n"),
];

/** Files that may use the handle: the runner's own file, and the tests (an in-memory runner builds one). */
const ALLOWED_FILES: ReadonlyArray<readonly [string, string]> = [
  ['transaction.ts itself', 'src/server/repositories/transaction.ts'],
  ['a support file under tests', 'tests/support/example.ts'],
  ['a unit test', 'tests/unit/example.test.ts'],
];

beforeAll(async () => {
  await ruleIdsFor('src/lib/example.ts', 'export const warmUp = 1;\n');
}, LINT_WARM_UP_TIMEOUT);

describe('AC-1 / AC-3 (P4): createTransactionHandle is for the transaction runner and the tests only', { timeout: 30_000 }, () => {
  describe.each(REFUSING_FILES)('%s', (_name, filePath) => {
    it.each(IMPORT_FORMS)('refuses $name, with this rule\'s message', async ({ code, ruleId, messageSays }) => {
      const messages = await messagesFor(filePath, code);
      expect(messages.filter((message) => message.ruleId === ruleId && message.message.includes(messageSays))).not.toEqual([]);
    });
  });

  describe.each(ALLOWED_FILES)('%s', (_name, filePath) => {
    it.each(IMPORT_FORMS)('allows $name', async ({ code }) => {
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

describe('the lint fixture refuses a fixture that ESLint did not read (STD-13)', { timeout: 30_000 }, () => {
  it('rejects a source that does not parse, naming the path and ESLint\'s text', async () => {
    await expect(messagesFor('src/server/services/example.ts', 'export const = ;\n')).rejects.toThrow(/src\/server\/services\/example\.ts: the fixture does not parse: .+/);
  });

  it('rejects a path that ESLint ignores, naming it', async () => {
    await expect(messagesFor('src/generated/example.ts', 'export const x = 1;\n')).rejects.toThrow(/src\/generated\/example\.ts: ESLint ignores this path/);
  });
});
