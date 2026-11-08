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

// Cost repositories and the services that read them (ADR-008 layer 2; STORY-01.03 AC-1). Everything Restricted lives in
// `calculations`, `calculation_rows`, `approvals` and the masters, so an Engineer view may not import the repository of any of
// them: calculation-, approval-, master- (the Process Master's rates), material-, exchange- (the exchange rate), customer-rate
// (a customer's rates), cost- and rate-. Masters reach an Engineer only through `/options/*`, which return IDs and names
// (architecture section 6). A later story that adds one more cost repository adds its file-name prefix here, and
// `tests/security/engineer-import-rule.test.ts` plants a fault against each prefix and against each real repository file.
const ENGINEER_VIEW_IMPORTS = [
  {
    group: [
      '**/repositories/calculation-*',
      '**/repositories/approval-*',
      '**/repositories/cost-*',
      '**/repositories/rate-*',
      '**/repositories/master-*',
      '**/repositories/material-*',
      '**/repositories/exchange-*',
      '**/repositories/customer-rate*',
    ],
    regex: `${SLASH}repositories${SLASH}(calculation-|approval-|cost-|rate-|master-|material-|exchange-|customer-rate)`,
    message: 'Engineer views must not import a cost repository (ADR-008, NFR-002).',
  },
  {
    group: ['**/services/masters-service', '**/services/calculation-*', '**/services/approval-*'],
    regex: `${SLASH}services${SLASH}(masters-service|calculation-|approval-)`,
    message: 'Engineer views must not import a service that reads rates, calculations or approvals (ADR-008, NFR-002).',
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

/** The two rules for one file group: static imports by glob, literal `import()` by regular expression. */
const restrict = (groupEntries) => {
  const entries = [NEXT_IMAGE_IMPORT, ...groupEntries];
  return {
    'no-restricted-imports': ['error', { patterns: entries.map(({ group, message }) => ({ group, message })) }],
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
