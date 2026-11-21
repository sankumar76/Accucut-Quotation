import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-08.05 AC-1 (FR-077, NFR-026; architecture sections 4.5 and 5.1 `config_versions`), written as scans of the source tree so a later change that stores a configuration version by another road fails here and
 * not in review:
 *   - **The only code that writes `config_versions` after the seed is `ConfigRepository.insertVersionAfter`.** No other file of `src/`, `scripts/` or `prisma/seed/` holds an `INSERT INTO`, `UPDATE`, `DELETE FROM`
 *     or `TRUNCATE` of the table, or a Prisma write on `configVersion`; the repository holds exactly two inserts, the seed's (`insertSeedVersionIfNone`) and `insertVersionAfter`.
 *   - **Only the config edit services call it**, each a known number of times, one call for each method that changes the configuration (`saveFormula`, `insertFields`, `deleteField`). A story that adds a method
 *     (STORY-08.06's revert and checkpoint) adds its file or its count to `WRITERS` below **and** a row to `tests/integration/config/version-per-change.test.ts`, so the rule "one version per successful change, none per
 *     refusal or no-op" is tested for it too.
 * Every scan has a control that plants a fault in a copy of the text and sees it found.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCANNED_ROOTS = ['src', 'scripts', 'prisma/seed'];
const SKIPPED = new Set(['node_modules', 'generated']);
const REPOSITORY = 'src/server/repositories/config-repository.ts';

/** The files that call `insertVersionAfter`, and how many call sites each holds. */
const WRITERS: Readonly<Record<string, number>> = {
  'src/server/services/config-checkpoint-service.ts': 1,
  'src/server/services/config-edit-service.ts': 1,
  'src/server/services/config-structure-service.ts': 2,
};

/** Comments are not code: a file may say what it must not do. */
const codeOf = (text: string): string => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

const WRITE_SQL = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+"?config_versions\b/gi;
const WRITE_PRISMA = /\.configVersion\.(?:create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\b/g;
const CALL_SITE = /\.insertVersionAfter\(/g;

const countOf = (text: string, pattern: RegExp): number => codeOf(text).match(pattern)?.length ?? 0;
const writesIn = (text: string): number => countOf(text, WRITE_SQL) + countOf(text, WRITE_PRISMA);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(entry.name) ? [path] : [];
  });
}

const FILES: ReadonlyArray<{ readonly path: string; readonly text: string }> = SCANNED_ROOTS.flatMap((root) => sourceFiles(join(ROOT, root))).map((absolute) => ({
  path: relative(ROOT, absolute).replaceAll('\\', '/'),
  text: readFileSync(absolute, 'utf8'),
}));
const fileNamed = (path: string): string => FILES.find((file) => file.path === path)?.text ?? '';

describe('AC-1: the only writer of config_versions after the seed is ConfigRepository.insertVersionAfter', () => {
  it('there are files to scan, and the repository is among them', () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(fileNamed(REPOSITORY)).toContain('insertVersionAfter');
  });

  it('no file other than the config repository writes the table, in SQL or through Prisma', () => {
    const offenders = FILES.filter((file) => file.path !== REPOSITORY && writesIn(file.text) > 0).map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('the repository holds exactly two writes, both inserts: the seed\'s (once, only if none exists) and insertVersionAfter', () => {
    const code = codeOf(fileNamed(REPOSITORY));
    expect(writesIn(fileNamed(REPOSITORY))).toBe(2);
    expect(code.match(/INSERT\s+INTO\s+config_versions/gi)).toHaveLength(2);
    const seed = code.indexOf('insertSeedVersionIfNone({');
    const after = code.indexOf('insertVersionAfter({');
    const find = code.indexOf('findLatestRef(tx) {');
    expect(seed).toBeGreaterThan(-1);
    expect(after).toBeGreaterThan(seed);
    expect(find).toBeGreaterThan(after);
    const inserts = [...code.matchAll(/INSERT\s+INTO\s+config_versions/gi)].map((match) => match.index);
    expect(inserts[0]).toBeGreaterThan(seed);
    expect(inserts[0]).toBeLessThan(after);
    expect(inserts[1]).toBeGreaterThan(after);
    expect(inserts[1]).toBeLessThan(find);
    // The seed's insert is conditional on there being no version, and the next one on the base still being the highest.
    expect(code).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM config_versions\)/);
    expect(code).toMatch(/WHERE \(SELECT max\(number\) FROM config_versions\) = \$\{baseNumber\}/);
  });

  it('only the config edit services call insertVersionAfter, each the known number of times', () => {
    const callers = Object.fromEntries(FILES.filter((file) => file.path !== REPOSITORY && countOf(file.text, CALL_SITE) > 0).map((file) => [file.path, countOf(file.text, CALL_SITE)]));
    expect(callers).toEqual(WRITERS);
  });

  describe('controls: a planted fault is found', () => {
    const repository = fileNamed(REPOSITORY);
    it.each([
      ['an INSERT in another file', 'const q = "INSERT INTO config_versions (number) VALUES (9)";'],
      ['an UPDATE', "await client.query('UPDATE config_versions SET reason = $1');"],
      ['a DELETE', 'await client.query(`DELETE FROM config_versions`);'],
      ['a TRUNCATE', 'await client.query("TRUNCATE TABLE config_versions");'],
      ['a Prisma create', 'await db.configVersion.create({ data });'],
      ['a Prisma upsert', 'await tx.configVersion.upsert({ where, create, update });'],
    ])('%s counts as a write', (_name, planted) => {
      expect(writesIn(planted)).toBe(1);
    });

    it('a comment that names a write is not a write', () => {
      expect(writesIn('// never INSERT INTO config_versions here\n/* UPDATE config_versions */ const x = 1;')).toBe(0);
    });

    it('a third insert planted in a copy of the repository is counted', () => {
      expect(writesIn(`${repository}\nconst q = "INSERT INTO config_versions (number) VALUES (9)";`)).toBe(3);
    });

    it('a call to insertVersionAfter planted in another file is counted', () => {
      expect(countOf('await configurations.insertVersionAfter({ baseNumber: 1 }, tx);', CALL_SITE)).toBe(1);
      expect(countOf('// configurations.insertVersionAfter(x)', CALL_SITE)).toBe(0);
    });
  });
});
