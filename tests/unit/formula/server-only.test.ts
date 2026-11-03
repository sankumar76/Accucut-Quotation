import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * AC-8 (CONSTRAINT-02, NFR-002): the engine is server-only, and nothing in the repository runs a string as code.
 *
 * - Every `src/lib/formula/**` file starts with `import 'server-only'`.
 * - The package really does throw under plain Node and load under the `react-server` condition (architecture
 *   section 10). Vitest aliases it to an empty module, so this test starts real Node processes to see the real
 *   package. The scripts that import the engine (`scripts/ensure-seed-version.ts`) must be run with the condition.
 * - A search of the source finds no `eval`, no `new Function`, no string passed to a timer, and no `import()` of a
 *   computed path (ESLint's rules for the same are exercised in `tests/unit/lint/layer-rules.test.ts`).
 * - A real `next build` of a client component that imports the engine fails: `tests/integration/formula/server-only-build.test.ts`.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FORMULA_DIR = join(ROOT, 'src', 'lib', 'formula');
const ENTRY = pathToFileURL(join(FORMULA_DIR, 'index.ts')).href;

function filesUnder(directory: string, extensions: ReadonlyArray<string>): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === 'generated' ? [] : filesUnder(path, extensions);
    return extensions.some((extension) => name.endsWith(extension)) ? [path] : [];
  });
}

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Loads the engine in a fresh Node process, with or without the `react-server` condition. */
function loadEngine(conditions: ReadonlyArray<string>): Run {
  const result = spawnSync(
    process.execPath,
    [...conditions.map((condition) => `--conditions=${condition}`), '--import', 'tsx', '--input-type=module', '-e', `await import(${JSON.stringify(ENTRY)}); process.stdout.write('loaded');`],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('every engine file is marked server-only (AC-8)', () => {
  const formulaFiles = filesUnder(FORMULA_DIR, ['.ts', '.tsx']);

  it('AC-8: the module has the files the architecture lists', () => {
    const names = formulaFiles.map((file) => relative(FORMULA_DIR, file).replaceAll('\\', '/')).sort();
    expect(names).toEqual(
      expect.arrayContaining(['ast.ts', 'errors.ts', 'evaluator.ts', 'graph.ts', 'index.ts', 'internal-form.ts', 'parser.ts', 'tokenizer.ts', 'validate.ts']),
    );
  });

  it.each(formulaFiles.map((file) => [relative(FORMULA_DIR, file).replaceAll('\\', '/'), file] as const))(
    "AC-8: src/lib/formula/%s starts with import 'server-only'",
    (_name, file) => {
      expect(readFileSync(file, 'utf8').split(/\r?\n/, 1)[0]).toBe("import 'server-only';");
    },
  );
});

describe('the server-only package under plain Node and under react-server (AC-8)', () => {
  let plain: Run;
  let withCondition: Run;

  // Starting Node with the TypeScript loader takes a moment: it is set-up, so it has its own hook (test strategy section 10).
  beforeAll(() => {
    plain = loadEngine([]);
    withCondition = loadEngine(['react-server']);
  }, 120_000);

  it('AC-8: loading the engine in plain Node throws the package\'s error', () => {
    expect(plain.status).not.toBe(0);
    expect(plain.stderr).toContain('This module cannot be imported from a Client Component module');
    expect(plain.stdout).not.toContain('loaded');
  });

  it('AC-8: loading it with the react-server condition works, which is how scripts and the migrate step run it', () => {
    expect(withCondition.stderr).toBe('');
    expect(withCondition.stdout).toBe('loaded');
    expect(withCondition.status).toBe(0);
  });
});

describe('no code is built from a string (AC-8, CONSTRAINT-02)', () => {
  const SEARCHED = ['src', 'scripts', 'prisma'].flatMap((directory) => filesUnder(join(ROOT, directory), ['.ts', '.tsx', '.mts', '.js', '.mjs']));

  /** The lines of a file that are code: comment lines are left out, so a rule written in a comment does not count. */
  function codeLines(file: string): string[] {
    let inBlock = false;
    return readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        if (inBlock) {
          inBlock = !trimmed.includes('*/');
          return false;
        }
        if (trimmed.startsWith('/*')) {
          inBlock = !trimmed.includes('*/');
          return false;
        }
        return !trimmed.startsWith('//') && !trimmed.startsWith('*');
      });
  }

  const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
    ['eval()', /(^|[^\w.])eval\s*\(/],
    ['new Function', /\bnew\s+Function\b/],
    ['Function()', /(^|[^\w.])Function\s*\(/],
    ['a string passed to setTimeout', /\bsetTimeout\s*\(\s*['"`]/],
    ['a string passed to setInterval', /\bsetInterval\s*\(\s*['"`]/],
    ['import() of a computed path', /\bimport\s*\(\s*[^'"\s)]/],
  ];

  it('AC-8: the search covers the source, the scripts and the seed', () => {
    expect(SEARCHED.length).toBeGreaterThan(40);
    expect(SEARCHED.some((file) => file.includes(join('src', 'lib', 'formula', 'evaluator.ts')))).toBe(true);
  });

  it('AC-8: the search finds each fault when one is planted (a control for the search itself)', () => {
    const planted = [
      "const x = eval('1');",
      "const f = new Function('return 1');",
      "const g = Function('return 1');",
      "setTimeout('run()', 10);",
      "setInterval(`run()`, 10);",
      'const m = await import(name);',
    ];
    for (const [index, [, pattern]] of FORBIDDEN.entries()) {
      const hits = planted.filter((line) => pattern.test(line));
      expect(hits.length, FORBIDDEN[index]?.[0]).toBeGreaterThan(0);
    }
    // And a literal import(), a method called "evaluate", and a word that merely contains "eval" are not faults.
    const fine = ["const m = await import('./other');", 'const v = evaluate(node);', 'const retrieval = 1;', 'engine.eval(1);'];
    for (const [, pattern] of FORBIDDEN) expect(fine.filter((line) => pattern.test(line))).toEqual([]);
  });

  it.each(FORBIDDEN)('AC-8: 0 uses of %s', (_name, pattern) => {
    const offenders = SEARCHED.filter((file) => codeLines(file).some((line) => pattern.test(line))).map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
