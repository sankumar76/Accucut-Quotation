import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';
import { findPendingTestsInDirectory } from '../../scripts/lib/pending-tests';
import { placeholderMasters } from '../../prisma/seed/placeholders';
import { assertSeedAllowed } from '../../prisma/seed/guard';
import { EnvValidationError, loadAppEnv } from '../../src/lib/env';
import vitestConfig from '../../vitest.config';
import { assertSafeDatabaseTarget } from '../support/db-guard';
import { checkIgnore } from '../support/git-ignore';
import { findNonConformingNumbers } from '../support/placeholder-pattern';

/**
 * QA acceptance tests for AQP-27 (STORY-10.01, scaffold, CI and repository hygiene), written from the
 * acceptance criteria in Jira and the test plan, section 9.1. Each title starts `[AQP-27 AC-n]` so the
 * test report's AC matrix can be built from the titles (test plan section 2).
 *
 * Every value here is invented. Throwaway repositories are built in the operating system's temporary
 * folder and removed afterwards; nothing is committed and no real secret or master datum is used.
 * AC-9 (the two database roles) is in aqp-27-database-roles.test.ts because it needs a database.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
const SLOW = 180_000;

const temporaryDirectories: string[] = [];
afterAll(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

/** Workflow lines that are not comments, so prose that mentions a forbidden word does not count. */
function workflowCode(): string[] {
  return read('.github/workflows/ci.yml')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'));
}

describe('[AQP-27 AC-1] pinned dependencies and the next-auth override', () => {
  const manifest = JSON.parse(read('package.json')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    overrides: unknown;
  };
  const all = { ...manifest.dependencies, ...manifest.devDependencies };

  it('[AQP-27 AC-1] every dependency is an exact x.y.z version (no ^, ~, range or tag)', () => {
    const notExact = Object.entries(all).filter(([, version]) => !/^\d+\.\d+\.\d+$/.test(version));
    expect(notExact).toEqual([]);
  });

  it('[AQP-27 AC-1] prisma and its client are pinned to the same exact version, never "latest"', () => {
    expect(manifest.devDependencies['prisma']).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.dependencies['@prisma/client']).toBe(manifest.devDependencies['prisma']);
  });

  it('[AQP-27 AC-1] package.json carries the next-auth to nodemailer override, exactly', () => {
    expect(manifest.overrides).toEqual({ 'next-auth': { nodemailer: '$nodemailer' } });
  });

  it('[AQP-27 AC-1] package-lock.json is committed', () => {
    const result = spawnSync('git', ['ls-files', '--error-unmatch', 'package-lock.json'], { cwd: ROOT });
    expect(result.status).toBe(0);
  });

  it('[AQP-27 AC-1] neither --legacy-peer-deps nor --force is used by CI, and .npmrc turns the first off', () => {
    const code = workflowCode().join('\n');
    expect(code).not.toMatch(/--legacy-peer-deps|--force\b/);
    expect(read('.npmrc')).toMatch(/^legacy-peer-deps=false$/m);
  });
});

describe('[AQP-27 AC-2] strict compiler settings and Next.js settings', () => {
  const compilerOptions = (JSON.parse(read('tsconfig.json')) as { compilerOptions: Record<string, unknown> })
    .compilerOptions;

  it.each(['strict', 'noUncheckedIndexedAccess', 'noImplicitOverride', 'exactOptionalPropertyTypes'])(
    '[AQP-27 AC-2] tsconfig turns %s on',
    (flag) => {
      expect(compilerOptions[flag]).toBe(true);
    },
  );

  it('[AQP-27 AC-2] next.config.ts has the four settings the architecture fixes', () => {
    expect(nextConfig.output).toBe('standalone');
    expect(nextConfig.images?.unoptimized).toBe(true);
    expect(nextConfig.serverExternalPackages).toEqual(['exceljs', '@node-rs/argon2']);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe('[AQP-27 AC-3] .env.example is tracked, other env files are not, and start-up validation names, never shows', () => {
  it('[AQP-27 AC-3] git does not ignore .env.example', () => {
    expect(checkIgnore('.env.example').ignored).toBe(false);
  });

  it.each(['.env', '.env.local', '.env.production', '.env.staging'])('[AQP-27 AC-3] git still ignores %s', (name) => {
    expect(checkIgnore(name).ignored).toBe(true);
  });

  it('[AQP-27 AC-3] an empty environment fails naming variables as missing', () => {
    expect.assertions(3);
    try {
      loadAppEnv({});
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const text = String((error as Error).message);
      expect(text).toContain('DATABASE_URL (missing)');
      expect(text).toContain('AUTH_SECRET (missing)');
    }
  });

  it('[AQP-27 AC-3] an invalid value is reported by name and its text appears nowhere in the error', () => {
    const sentinel = 'QA-SENTINEL-Zq7-not-a-real-secret';
    expect.assertions(2);
    try {
      loadAppEnv({ DATABASE_URL: `not-a-url-${sentinel}`, AUTH_SECRET: `short-${sentinel}`, APP_ORIGIN: sentinel });
    } catch (error) {
      const serialised = `${String((error as Error).message)} ${JSON.stringify(error)} ${String((error as Error).stack)}`;
      expect(serialised).not.toContain(sentinel);
      expect(serialised).toContain('DATABASE_URL (invalid)');
    }
  });
});

describe('[AQP-27 AC-4] the CI workflow', () => {
  const code = workflowCode();
  const text = code.join('\n');

  it('[AQP-27 AC-4] runs on pull_request and never on pull_request_target', () => {
    expect(text).toMatch(/^on:\s*\n\s+pull_request:/m);
    expect(text).not.toContain('pull_request_target');
  });

  it('[AQP-27 AC-4] uses no repository secret and grants only read access to the contents', () => {
    expect(text).not.toMatch(/secrets\./);
    expect(text).toMatch(/^permissions:\s*\n\s+contents: read\s*$/m);
  });

  it('[AQP-27 AC-4] stages 1 to 11 are present once or more, in order, and none is allowed to fail', () => {
    const stageNumbers = [...text.matchAll(/name: "Stage (\d+):/g)].map((match) => Number(match[1]));
    const sorted = [...stageNumbers].sort((a, b) => a - b);
    expect(stageNumbers).toEqual(sorted);
    expect([...new Set(stageNumbers)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(text).not.toContain('continue-on-error');
  });

  it.each([12, 13])('[AQP-27 AC-4] stage %i exists and is switched off', (stage) => {
    const start = code.findIndex((line) => line.includes(`name: "Stage ${stage}:`));
    expect(start).toBeGreaterThan(-1);
    expect(code[start + 1]).toMatch(/if: \$\{\{ false \}\}/);
  });

  it('[AQP-27 AC-4] every third-party action is pinned to a full commit SHA', () => {
    const uses = code.filter((line) => /\buses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toMatch(/uses:\s*\S+@[0-9a-f]{40}\b/);
  });

  it('[AQP-27 AC-4] the dependency audit uses --audit-level=high', () => {
    expect(text).toMatch(/npm audit --omit=dev --audit-level=high/);
  });
});

describe('[AQP-27 AC-5] the data-file check and the secret-scan baseline', () => {
  function repositoryWith(paths: string[]): string {
    const directory = temporaryDirectory('aqp27-datafiles-');
    const git = (...args: string[]): string =>
      execFileSync('git', ['-c', 'user.name=qa', '-c', 'user.email=qa@example.test', ...args], {
        cwd: directory,
        encoding: 'utf8',
      });
    git('init', '--quiet');
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: directory, input: 'invented\n', encoding: 'utf8' }).trim();
    for (const path of paths) git('update-index', '--add', '--cacheinfo', `100644,${blob},${path}`);
    return directory;
  }

  function runCheck(directory: string): { status: number | null; stderr: string } {
    // No shell: a folder name with spaces must reach the script as one argument, or every run would
    // fail for the wrong reason and the negative cases below would pass without proving anything.
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-data-files.ts', '--root', directory], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return { status: result.status, stderr: result.stderr };
  }

  it('[AQP-27 AC-5] passes on the repository as it stands', () => {
    expect(runCheck(ROOT).status).toBe(0);
  }, SLOW);

  it('[AQP-27 AC-5] fails on a new .csv, .xlsx and .json outside the allow-list, naming each', () => {
    const result = runCheck(repositoryWith(['README.md', 'qa-rates.csv', 'qa-masters.xlsx', 'qa-data/qa-config.json']));
    expect(result.status).toBe(1);
    for (const name of ['qa-rates.csv', 'qa-masters.xlsx', 'qa-data/qa-config.json']) expect(result.stderr).toContain(name);
  }, SLOW);

  it('[AQP-27 AC-5] the two documented exceptions are exact paths, not a pattern that lets new files in', () => {
    const exceptions = ['AMADA-20261006.xlsx', 'Accucut_Quotation_Portal_Req_Understanding_Draft_v5.docx'];
    expect(runCheck(repositoryWith(exceptions)).status).toBe(0);
    const lookalikes = repositoryWith(['sub/AMADA-20261006.xlsx', 'AMADA-20261007.xlsx', 'Copy of AMADA-20261006.xlsx', 'amada-20261006.xlsx']);
    const result = runCheck(lookalikes);
    expect(result.status).toBe(1);
    for (const name of ['sub/AMADA-20261006.xlsx', 'AMADA-20261007.xlsx', 'Copy of AMADA-20261006.xlsx', 'amada-20261006.xlsx']) {
      expect(result.stderr).toContain(name);
    }
  }, SLOW);

  it('[AQP-27 AC-5] upper-case and mixed-case extensions are caught', () => {
    const result = runCheck(repositoryWith(['QA-RATES.CSV', 'QA-Masters.Xlsx']));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('QA-RATES.CSV');
    expect(result.stderr).toContain('QA-Masters.Xlsx');
  }, SLOW);

  it('[AQP-27 AC-5] the secret-scan baseline accepts exactly 7 findings and stores no matched text', () => {
    const baseline = JSON.parse(read('.gitleaks-baseline.json')) as Array<Record<string, unknown>>;
    expect(baseline).toHaveLength(7);
    for (const entry of baseline) {
      expect(Object.keys(entry)).not.toContain('Match');
      expect(Object.keys(entry)).not.toContain('Secret');
    }
  });

  it('[AQP-27 AC-5] the Gitleaks configuration extends the default rules and holds no allow-list by path or pattern', () => {
    const config = read('.gitleaks.toml');
    const code = config
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    expect(code).toMatch(/useDefault\s*=\s*true/);
    expect(code).not.toMatch(/allowlist|\[\[rules|paths\s*=|regexes\s*=/i);
  });
});

describe('[AQP-27 AC-6] the layer rules fire on a planted fault', () => {
  const eslint = new ESLint({ cwd: ROOT });

  async function messagesFor(filePath: string, code: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath: join(ROOT, filePath) });
    return (result?.messages ?? []).map((message) => `${message.ruleId ?? 'parse'}: ${message.message}`);
  }

  const mustFail: Array<[string, string, string]> = [
    ['src/lib imports src/server (alias)', 'src/lib/qa.ts', "import { x } from '@/server/qa';\nexport const a = x;\n"],
    ['src/lib imports src/server (relative, nested)', 'src/lib/deep/qa.ts', "import { x } from '../../server/repositories/qa';\nexport const a = x;\n"],
    ['src/lib imports src/app', 'src/lib/qa.ts', "import { x } from '@/app/page';\nexport const a = x;\n"],
    ['src/lib imports src/components', 'src/lib/qa.ts', "import { x } from '@/components/ui/button';\nexport const a = x;\n"],
    ['src/lib imports next/server', 'src/lib/qa.ts', "import { x } from 'next/server';\nexport const a = x;\n"],
    ['src/lib imports the Prisma client', 'src/lib/qa.ts', "import { PrismaClient } from '@prisma/client';\nexport const a = PrismaClient;\n"],
    ['src/lib imports the generated Prisma client', 'src/lib/qa.ts', "import { P } from '@/generated/prisma/client';\nexport const a = P;\n"],
    ['src/lib imports pg', 'src/lib/qa.ts', "import pg from 'pg';\nexport const a = pg;\n"],
    ['src/lib re-exports from src/server', 'src/lib/qa.ts', "export { x } from '@/server/qa';\n"],
    ['src/lib loads src/server with import()', 'src/lib/qa.ts', "export const a = () => import('@/server/qa');\n"],
    ['a service imports the Prisma client', 'src/server/services/qa.ts', "import { PrismaClient } from '@prisma/client';\nexport const a = PrismaClient;\n"],
    ['a page imports a repository', 'src/app/qa/page.tsx', "import { r } from '@/server/repositories/user-repository';\nexport default function P() {\n  return <p>{String(r)}</p>;\n}\n"],
    ['a component imports the formula engine', 'src/components/qa.tsx', "import { f } from '@/lib/formula/engine';\nexport function C() {\n  return <p>{String(f)}</p>;\n}\n"],
    ['an Engineer view imports a cost repository', 'src/server/views/engineer-qa.ts', "import { r } from '../repositories/cost-repository';\nexport const a = r;\n"],
    ['an Engineer view imports a calculation repository', 'src/server/views/engineer-qa.ts', "import { r } from '@/server/repositories/calculation-rows';\nexport const a = r;\n"],
    ['an Engineer view imports a rate repository', 'src/server/views/engineer-qa.ts', "import { r } from '@/server/repositories/rate-master';\nexport const a = r;\n"],
    ['an Engineer view imports lib/formula', 'src/server/views/engineer-qa.ts', "import { f } from '@/lib/formula';\nexport const a = f;\n"],
    ['eval', 'src/lib/qa.ts', "export const a = eval('1');\n"],
    ['indirect eval', 'src/lib/qa.ts', "export const a = (0, eval)('1');\n"],
    ['new Function', 'src/lib/qa.ts', "export const a = new Function('return 1');\n"],
    ['Function without new', 'src/lib/qa.ts', "export const a = Function('return 1');\n"],
    ['dynamic import of a variable', 'src/lib/qa.ts', 'export const a = (name: string) => import(name);\n'],
    ['dynamic import of a template string', 'src/lib/qa.ts', 'export const a = (name: string) => import(`./${name}`);\n'],
    ["'use server' at the top of a file", 'src/app/qa.ts', "'use server';\nexport const a = 1;\n"],
    ["'use server' with double quotes", 'src/app/qa.ts', '"use server";\nexport const a = 1;\n'],
    ["'use server' inside a function", 'src/app/qa.ts', "export async function a() {\n  'use server';\n  return 1;\n}\n"],
  ];

  it.each(mustFail)('[AQP-27 AC-6] fails lint: %s', async (_name, filePath, code) => {
    expect((await messagesFor(filePath, code)).length).toBeGreaterThan(0);
  }, SLOW);

  const mustPass: Array<[string, string, string]> = [
    ['a repository may import the Prisma client', 'src/server/repositories/qa.ts', "import { PrismaClient } from '@prisma/client';\nexport const a = PrismaClient;\n"],
    ['a Lead view may import a cost repository', 'src/server/views/lead-qa.ts', "import { r } from '../repositories/cost-repository';\nexport const a = r;\n"],
    ['a clean library file', 'src/lib/qa.ts', 'export const a = 1;\n'],
  ];

  it.each(mustPass)('[AQP-27 AC-6] still passes lint: %s', async (_name, filePath, code) => {
    expect(await messagesFor(filePath, code)).toEqual([]);
  }, SLOW);
});

describe('[AQP-27 AC-7] the n.37 placeholder pattern and the production seed refusal', () => {
  it('[AQP-27 AC-7] the committed placeholder masters conform', () => {
    expect(findNonConformingNumbers(placeholderMasters)).toEqual([]);
  });

  it.each([
    ['a whole number', { rate: 100 }],
    ['a two-decimal rate', { rate: 12.5 }],
    ['a rate ending .38', { rate: 12.38 }],
    ['a rate ending .370', { rate: '12.370' }],
    ['a thousands-grouped text', { price: '1,250.00' }],
    ['a negative value', { rate: -3.37 }],
    ['a nested array', { lists: [{ rows: [{ rate: 4.37 }, { rate: 4.4 }] }] }],
  ])('[AQP-27 AC-7] a planted non-conforming number is found: %s', (_name, data) => {
    expect(findNonConformingNumbers(data).length).toBeGreaterThan(0);
  });

  it('[AQP-27 AC-7] with only conforming numbers it reports nothing', () => {
    expect(findNonConformingNumbers({ a: 1.37, b: [{ c: '104.37' }, { c: 0.37 }] })).toEqual([]);
  });

  it('[AQP-27 AC-7] the seed script refuses to run with NODE_ENV=production and runs otherwise', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(/production/);
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertSeedAllowed({})).not.toThrow();
  });
});

describe('[AQP-27 AC-8] coverage thresholds and the pending-test scanner', () => {
  const thresholds = vitestConfig.test?.coverage?.thresholds as unknown as Record<string, unknown>;

  it('[AQP-27 AC-8] the package threshold is 80 percent on lines, functions, branches and statements', () => {
    expect(thresholds).toMatchObject({ lines: 80, functions: 80, branches: 80, statements: 80 });
  });

  it('[AQP-27 AC-8] src/lib/formula/** is held to 95 percent', () => {
    expect(thresholds['src/lib/formula/**']).toMatchObject({ lines: 95, functions: 95, branches: 95, statements: 95 });
  });

  it('[AQP-27 AC-8] coverage is decided by the v8 provider and retries are off', () => {
    expect(vitestConfig.test?.coverage?.provider).toBe('v8');
    expect(vitestConfig.test?.retry).toBe(0);
  });

  it.each(['it.todo', 'it.skip', 'it.only', 'it.fails', 'describe.skip', 'it.skipIf(true)'])(
    '[AQP-27 AC-8] (negative control) a quantity test using %s is flagged with its file and line',
    (marker) => {
      const directory = temporaryDirectory('aqp27-quantity-');
      writeFileSync(join(directory, 'ce-1.test.ts'), `import { it } from 'vitest';\n${marker}('CE-1 is 30', () => {});\n`);
      const findings = findPendingTestsInDirectory(directory);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({ file: 'ce-1.test.ts', line: 2 });
    },
  );

  it('[AQP-27 AC-8] a quantity test with no pending marker is not flagged', () => {
    const directory = temporaryDirectory('aqp27-quantity-');
    writeFileSync(join(directory, 'ce-1.test.ts'), "import { expect, it } from 'vitest';\nit('CE-1 is 30', () => { expect(30).toBe(30); });\n");
    expect(findPendingTestsInDirectory(directory)).toEqual([]);
  });
});

describe('[AQP-27 AC-10] the guard against the wrong database (decision table)', () => {
  const invented = 'qa-invented-password-7f3';
  const url = (host: string, query = ''): string => `postgresql://qa_user:${invented}@${host}/qa_db${query}`;

  it.each([
    ['a remote host', url('db.remote.example.test:5432')],
    ['a host that only starts with localhost', url('localhost.remote.example.test')],
    ['a host that only starts with 127.0.0.1', url('127.0.0.1.remote.example.test')],
    ['loopback in the user name, remote host after the at sign', `postgresql://localhost:x@remote.example.test/qa_db`],
    ['a second at sign inside the password', `postgresql://qa_user:loc@localhost@remote.example.test/qa_db`],
    ['a host override in the query string', url('localhost', '?host=remote.example.test')],
    ['two host overrides, the last one remote', url('localhost', '?host=localhost&host=remote.example.test')],
    ['a socket path override', url('localhost', '?host=/var/run/postgresql')],
    ['no host at all', `postgresql:///qa_db`],
    ['a percent-encoded loopback name', url('%6Cocalhost')],
    ['0.0.0.0', url('0.0.0.0')],
    ['a URL that is not PostgreSQL', `mysql://qa_user:${invented}@localhost/qa_db`],
    ['text that is not a URL', `not a url ${invented}`],
  ])('[AQP-27 AC-10] refuses %s, and the refusal never shows the password or the URL', (_name, value) => {
    expect.assertions(3);
    try {
      assertSafeDatabaseTarget({ DATABASE_URL: value });
    } catch (error) {
      const message = String((error as Error).message);
      expect(message).toMatch(/^Refusing to run:/);
      expect(message).not.toContain(invented);
      expect(message).not.toContain('postgresql://');
    }
  });

  it('[AQP-27 AC-10] refuses when only the migration URL is remote', () => {
    expect(() =>
      assertSafeDatabaseTarget({ DATABASE_URL: url('localhost'), MIGRATE_DATABASE_URL: url('remote.example.test') }),
    ).toThrow(/MIGRATE_DATABASE_URL/);
  });

  it('[AQP-27 AC-10] refuses NODE_ENV=production even when the database is local', () => {
    expect(() => assertSafeDatabaseTarget({ NODE_ENV: 'production', DATABASE_URL: url('localhost') })).toThrow(/production/);
  });

  it.each([
    ['loopback name', url('localhost:5432'), {}],
    ['loopback address', url('127.0.0.1:55432'), {}],
    ['IPv6 loopback', url('[::1]:5432'), {}],
    ['upper-case loopback name', url('LOCALHOST'), {}],
    ['the Compose service name', url('db'), {}],
    ['the CI service host', url('postgres'), {}],
    ['the staging host named in STAGING_DB_HOST', url('staging.example.test'), { STAGING_DB_HOST: 'staging.example.test' }],
  ])('[AQP-27 AC-10] accepts %s when NODE_ENV is not production', (_name, value, extra) => {
    expect(() => assertSafeDatabaseTarget({ NODE_ENV: 'test', DATABASE_URL: value, ...extra })).not.toThrow();
  });

  it('[AQP-27 AC-10] a staging host that is not named in STAGING_DB_HOST is refused', () => {
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: url('staging.example.test') })).toThrow();
    expect(() => assertSafeDatabaseTarget({ DATABASE_URL: url('staging.example.test'), STAGING_DB_HOST: '  ' })).toThrow();
  });
});
