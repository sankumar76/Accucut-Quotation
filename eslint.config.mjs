import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Layer rules of architecture section 10 and ADR-008 (layer 2) / ADR-010, plus the coding standards.
 * `tests/unit/lint/layer-rules.test.ts` plants a fault against each rule, as a static import and as
 * `import()`, and requires it to fail.
 *
 * ESLint keeps one setting per rule per file, so the groups a file is subject to are composed here and
 * each file gets the union (not one block per rule). Every restricted module is written twice, from one
 * entry: as globs for `no-restricted-imports` (static imports and re-exports) and as a regular
 * expression for a literal `import()`, which `no-restricted-imports` does not inspect.
 */

// Every code file ESLint should treat as source. `allowJs` is off for tsc, but the bundler still
// accepts these extensions, so the extension alone must not decide whether a layer rule applies.
const CODE_EXTENSIONS = '{js,jsx,mjs,cjs,ts,mts,cts,tsx}';
// `\x2F` is a slash: a literal slash would end the regular expression inside an esquery selector.
const SLASH = '\\x2F';
const END = `(${SLASH}|$)`;

const PRISMA_IMPORT = {
  group: ['prisma', 'prisma/**', '@prisma', '@prisma/**', 'pg', '**/generated/prisma', '**/generated/prisma/**'],
  regex: `^(prisma|@prisma)${END}|^pg$|${SLASH}generated${SLASH}prisma${END}`,
  message: 'Only src/server/repositories/** may import the Prisma client or the database driver (architecture section 10).',
};

const LIB_IMPORTS = [
  {
    group: ['@/server', '@/server/**', '**/src/server/**', '../**/server', '../**/server/**'],
    regex: `^@${SLASH}server${END}|${SLASH}src${SLASH}server${SLASH}|^\\.\\.${SLASH}(.*${SLASH})?server${END}`,
    message: 'src/lib is pure: it must not import src/server (architecture section 10).',
  },
  {
    group: ['@/app', '@/app/**', '**/src/app/**', '../**/app', '../**/app/**'],
    regex: `^@${SLASH}app${END}|${SLASH}src${SLASH}app${SLASH}|^\\.\\.${SLASH}(.*${SLASH})?app${END}`,
    message: 'src/lib is pure: it must not import src/app (architecture section 10).',
  },
  {
    group: ['@/components', '@/components/**', '**/src/components/**', '../**/components', '../**/components/**'],
    regex: `^@${SLASH}components${END}|${SLASH}src${SLASH}components${SLASH}|^\\.\\.${SLASH}(.*${SLASH})?components${END}`,
    message: 'src/lib is pure: it must not import src/components (architecture section 10).',
  },
  {
    group: ['next', 'next/**'],
    regex: `^next${END}`,
    message: 'src/lib is pure: it must not import next/* (architecture section 10).',
  },
  PRISMA_IMPORT,
];

const FORMULA_IMPORT = {
  group: ['**/lib/formula', '**/lib/formula/**'],
  regex: `(^|${SLASH})lib${SLASH}formula${END}`,
  message: 'This code must not import the formula engine (ADR-008, NFR-002).',
};

// Presentation code reaches data through services and views only (architecture section 4.1, 10). Pages
// are shared by role (ADR-008), so no path marks an "Engineer page": the rule covers all of src/app and
// src/components, Lead and Admin pages included (QLT-01).
const PRESENTATION_IMPORTS = [
  {
    group: ['**/repositories', '**/repositories/**'],
    regex: `(^|${SLASH})repositories${END}`,
    message: 'src/app and src/components import no repository: reach data through a service or a view (architecture section 10).',
  },
  FORMULA_IMPORT,
  PRISMA_IMPORT,
];

// What an Engineer view may import from the data layer (ADR-008 layer 2; STORY-01.03 AC-1; Coding Standards section 5, deny by
// default). Everything Restricted is reachable through some repository or service: the rates and prices of the masters, the
// calculations and approvals, the audit entries (a Process Master entry keeps the rate before and after) and the configuration
// snapshots (they hold the formula text). So the rule is a short ALLOW-LIST and every other repository and service is refused,
// including one that does not exist yet: a new file is blocked until someone decides it is safe and adds its name here.
// `@/server/composition` is refused too, because it hands out every service (views receive their data; they do not fetch it), and
// so is the schemas barrel, which re-exports the Admin-only schemas (an Engineer view imports `schemas/me` and the like directly).
// `tests/security/engineer-import-rule.test.ts` lints a planted import of every file in both directories, so these lists cannot
// drift from the source tree: a file in neither list fails that test. A form that needs a master's names (not its rates) gets a
// narrow reader with a different name, added to the allow-list on purpose. The entry `transaction` allows the NAMED imports of that
// file except `createTransactionHandle` (refused for every file but the runner's own and the tests, see TRANSACTION_HANDLE_IMPORT); a
// namespace import and `import()` of it are refused too. It does not make the file "types only": `clientFor` and `createTransactionRunner`
// pass, and a view still cannot reach a client without a `PrismaClient`, which the allow-list refuses.
const ENGINEER_ALLOWED_REPOSITORIES = ['user-repository', 'database-errors', 'transaction'];
const ENGINEER_ALLOWED_SERVICES = ['user-service', 'auth-service'];
const allowOnly = (directory, allowed) => ({
  group: [`**/${directory}/*`, ...allowed.map((name) => `!**/${directory}/${name}`)],
  regex: `${SLASH}${directory}${SLASH}(?!(${allowed.join('|')})$)`,
});

const ENGINEER_VIEW_IMPORTS = [
  {
    ...allowOnly('repositories', ENGINEER_ALLOWED_REPOSITORIES),
    message: 'Engineer views may import only the repositories on the allow-list: the others hold Restricted data (ADR-008, NFR-002).',
  },
  {
    ...allowOnly('services', ENGINEER_ALLOWED_SERVICES),
    message: 'Engineer views may import only the services on the allow-list: the others read rates, audit entries, formulas or approvals (ADR-008, NFR-002).',
  },
  {
    // The directory itself, which would be an `index` barrel if one were ever added (STD-19): no such file exists, and none is allowed.
    staticRegex: '(^|/)(repositories|services)/?$',
    regex: `(^|${SLASH})(repositories|services)${SLASH}?$`,
    message: 'Engineer views may not import the data layer\'s directory (a barrel); import a file on the allow-list instead (ADR-008, NFR-002).',
  },
  {
    group: ['**/composition'],
    regex: `(^|${SLASH})composition${END}`,
    message: 'Engineer views receive their data; they do not reach the service container (ADR-008 layer 2).',
  },
  {
    staticRegex: '(^|/)schemas(/index)?$',
    regex: `(^|${SLASH})schemas(${SLASH}index)?$`,
    message: 'Engineer views import the one schema file they need (schemas/me), not the barrel that re-exports the Admin schemas.',
  },
  FORMULA_IMPORT,
  PRISMA_IMPORT,
];

const BASE_SYNTAX = [
  {
    selector: "ImportExpression:not([source.type='Literal'])",
    message: 'Dynamic import of a computed path is forbidden (ADR-010, CONSTRAINT-02).',
  },
  {
    selector: "ExpressionStatement[directive='use server']",
    message: "'use server' is forbidden: route handlers only, no Server Actions (ADR-010).",
  },
];

// Images are `unoptimized` in this project, so `next/image` only adds client code to the first load (AQP-74 PRF-01). A plain
// `<img>` with width, height and alt is the rule everywhere (architecture section 10). It is listed in every group below
// as well as in the general block, because ESLint keeps one `no-restricted-imports` setting per file: a group's setting
// replaces the general one and would otherwise lift the ban in src/.
const NEXT_IMAGE_IMPORT = {
  group: ['next/image', 'next/image/**'],
  regex: `^next${SLASH}image${END}`,
  message: 'Use a plain <img> with width, height and alt (architecture section 10)',
};

// Only the transaction runner makes a `Transaction` handle (STORY-10.18, architecture section 6). A service that could make one
// could write an audit entry in a transaction of its own, which commits whether or not the change does. The rule names the
// function, so the types and the other names of that file (`Transaction`, `TransactionRunner`, `clientFor`) can still be imported
// by anyone with a static import. A literal `import()` of that file is refused whole, because `no-restricted-syntax` cannot see
// which names a dynamic import uses. The entry is in the block `accucut/transaction-handle-is-for-the-runner` (every file but
// `transaction.ts` and `tests/**`) and, because a later block replaces the setting of an earlier one, in every group of
// `restrict()` too. That block must stay above the group blocks: moved below them, `restrict([])` would replace their lists.
// `tests/unit/lint/transaction-handle-rule.test.ts` asserts the message in every group, so dropping the entry from `restrict()` fails it.
const TRANSACTION_HANDLE_IMPORT = {
  group: ['**/transaction', '**/transaction.*'],
  importNames: ['createTransactionHandle'],
  regex: `(^|${SLASH})transaction([.][cm]?[jt]s)?$`,
  message:
    'Only src/server/repositories/transaction.ts and tests/** may import createTransactionHandle: a service gets its Transaction from TransactionRunner.run (architecture section 6). ' +
    'An import() of this file is refused whole, because the lint cannot see which names it takes; use a static import of the names you need.',
};

/** The two rules for one file group: static imports by glob (by `staticRegex` where a glob cannot say it), literal `import()` by regular expression. */
const restrict = (groupEntries) => {
  const entries = [NEXT_IMAGE_IMPORT, TRANSACTION_HANDLE_IMPORT, ...groupEntries];
  return {
    'no-restricted-imports': [
      'error',
      {
        patterns: entries.map(({ group, importNames, staticRegex, message }) =>
          group === undefined ? { regex: staticRegex, message } : importNames === undefined ? { group, message } : { group, importNames, message },
        ),
      },
    ],
    'no-restricted-syntax': [
      'error',
      ...BASE_SYNTAX,
      ...entries.map(({ regex, message }) => ({
        selector: `ImportExpression[source.value=/${regex}/]`,
        message: `${message} (also when loaded with import())`,
      })),
    ],
  };
};

export default defineConfig([
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'src/generated/**',
    'next-env.d.ts',
    // Not product code: delivery documents and their generators, and the agent tooling.
    'docs/**',
    'Agents/**',
    '.claude/**',
    '.superpowers/**',
  ]),
  ...nextVitals,
  ...nextTypescript,
  {
    name: 'accucut/rules',
    files: [`**/*.${CODE_EXTENSIONS}`],
    rules: {
      'no-console': 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': ['error', ...BASE_SYNTAX],
      'no-restricted-imports': ['error', { patterns: [{ group: NEXT_IMAGE_IMPORT.group, message: NEXT_IMAGE_IMPORT.message }] }],
      // Off repo-wide: the plain `<img>` is the rule, and the rule that bans it is replaced by the `next/image` ban above
      // (architecture section 10; AQP-74 PRF-01).
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // Every file but the runner's own and the tests (which build a handle for an in-memory runner). The general block above keeps
    // the `next/image` ban for those two; this block repeats it and adds the handle, because a block replaces the setting it names.
    // It must stay above the group blocks below (see TRANSACTION_HANDLE_IMPORT).
    name: 'accucut/transaction-handle-is-for-the-runner',
    files: [`**/*.${CODE_EXTENSIONS}`],
    ignores: ['src/server/repositories/transaction.ts', 'tests/**'],
    rules: restrict([]),
  },
  {
    name: 'accucut/no-type-assertions-in-source',
    files: [`src/**/*.${CODE_EXTENSIONS}`],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    name: 'accucut/prisma-only-in-repositories',
    files: [`src/**/*.${CODE_EXTENSIONS}`],
    ignores: ['src/server/repositories/**', 'src/generated/**'],
    rules: restrict([PRISMA_IMPORT]),
  },
  {
    name: 'accucut/lib-is-pure',
    files: [`src/lib/**/*.${CODE_EXTENSIONS}`],
    rules: restrict(LIB_IMPORTS),
  },
  {
    name: 'accucut/presentation-reaches-data-through-services',
    files: [`src/app/**/*.${CODE_EXTENSIONS}`, `src/components/**/*.${CODE_EXTENSIONS}`],
    rules: restrict(PRESENTATION_IMPORTS),
  },
  {
    name: 'accucut/engineer-views-have-no-cost-access',
    files: [`src/server/views/engineer-*.${CODE_EXTENSIONS}`],
    rules: restrict(ENGINEER_VIEW_IMPORTS),
  },
]);
