import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Layer rules of architecture section 10 and ADR-008 (layer 2) / ADR-010, plus the coding standards.
 * `tests/unit/lint/layer-rules.test.ts` plants a fault against each rule and requires it to fail.
 *
 * `no-restricted-imports` keeps one setting per file, so the groups a file is subject to are
 * composed here and each file gets the union (not one block per rule).
 */

const PRISMA_IMPORTS = {
  group: ['prisma', 'prisma/**', '@prisma', '@prisma/**', 'pg', '**/generated/prisma', '**/generated/prisma/**'],
  message: 'Only src/server/repositories/** may import the Prisma client or the database driver (architecture section 10).',
};

const LIB_IMPORTS = [
  {
    group: ['@/server', '@/server/**', '**/src/server/**', '../**/server', '../**/server/**'],
    message: 'src/lib is pure: it must not import src/server (architecture section 10).',
  },
  {
    group: ['@/app', '@/app/**', '**/src/app/**', '../**/app', '../**/app/**'],
    message: 'src/lib is pure: it must not import src/app (architecture section 10).',
  },
  {
    group: ['@/components', '@/components/**', '**/src/components/**', '../**/components', '../**/components/**'],
    message: 'src/lib is pure: it must not import src/components (architecture section 10).',
  },
  {
    group: ['next', 'next/**'],
    message: 'src/lib is pure: it must not import next/* (architecture section 10).',
  },
  PRISMA_IMPORTS,
];

// Cost repositories (ADR-008 layer 2). A later story that adds one more cost repository adds its
// file-name prefix here.
const ENGINEER_IMPORTS = [
  {
    group: ['**/repositories/calculation-*', '**/repositories/cost-*', '**/repositories/rate-*'],
    message: 'Engineer code must not import a cost repository (ADR-008, NFR-002).',
  },
  {
    group: ['**/lib/formula', '**/lib/formula/**'],
    message: 'Engineer code must not import the formula engine (ADR-008, NFR-002).',
  },
  PRISMA_IMPORTS,
];

const restrictImports = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

// Engineer-facing code. Later stories name their Engineer pages under one of these directories.
const ENGINEER_FILES = [
  'src/server/views/engineer-*.ts',
  'src/app/**/engineer/**',
  'src/app/**/(engineer)/**',
];

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
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-console': 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportExpression:not([source.type='Literal'])",
          message: 'Dynamic import of a computed path is forbidden (ADR-010, CONSTRAINT-02).',
        },
        {
          selector: "ExpressionStatement[directive='use server']",
          message: "'use server' is forbidden: route handlers only, no Server Actions (ADR-010).",
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    name: 'accucut/no-type-assertions-in-source',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    name: 'accucut/prisma-only-in-repositories',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/repositories/**', 'src/generated/**'],
    rules: restrictImports([PRISMA_IMPORTS]),
  },
  {
    name: 'accucut/lib-is-pure',
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: restrictImports(LIB_IMPORTS),
  },
  {
    name: 'accucut/engineer-code-has-no-cost-access',
    files: ENGINEER_FILES,
    rules: restrictImports(ENGINEER_IMPORTS),
  },
]);
