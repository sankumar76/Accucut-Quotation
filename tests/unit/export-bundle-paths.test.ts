import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { exportThreadProblem } from '@/server/export/thread-runner';

/**
 * AQP-487 (DEF-130): the Download of a workbook fails with "We could not build the file" when the export thread's bundle, `.next/export-worker.mjs`, is not where the server looks for it. `next build` on its own empties `.next`
 * and does not make it. This pins every way a server is built in this repository: each path that runs `next build` makes the bundle after it (the bundle is inside `.next`, so one made before would be wiped), the Windows package
 * cannot be made without it, and the start-up of a production server says so once when it is missing. The source files are read as text; no build is run here.
 */

const read = (path: string): string => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const BUNDLE_STEP = 'tsx scripts/build-export-worker.ts';

describe('the ways a server is built make the export thread bundle after the build', () => {
  it('`npm run build` runs the bundle step after `next build`, and `npm run dev` before the server', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    const build = scripts['build'] ?? '';
    expect(build).toContain('next build');
    expect(build.indexOf(BUNDLE_STEP), build).toBeGreaterThan(build.indexOf('next build'));
    // Joined by `&&`: with `;` a failed `next build` would still end green, and a build without the bundle would look finished.
    expect(build).toMatch(/next build && tsx scripts\/build-export-worker\.ts/);
    const dev = scripts['dev'] ?? '';
    expect(dev.indexOf(BUNDLE_STEP), dev).toBeGreaterThanOrEqual(0);
    expect(dev.indexOf(BUNDLE_STEP)).toBeLessThan(dev.indexOf('next dev'));
  });

  it('every `npx next build` of the CI workflows that starts the portal is followed by the bundle step in the same step', () => {
    const steps = read('.github/workflows/ci.yml').split(/\n {6}- name:/);
    const building = steps.filter((step) => /npx next build/.test(step));
    expect(building.length).toBeGreaterThanOrEqual(2);
    for (const step of building) {
      const name = step.split('\n')[0] ?? '';
      expect(step.indexOf('npx tsx scripts/build-export-worker.ts'), name).toBeGreaterThan(step.indexOf('npx next build'));
    }
  });

  it.each(['playwright.config.ts', 'playwright.sweep.config.ts'])('%s: a server it builds makes the bundle after `next build`', (file) => {
    expect(read(file)).toMatch(/npx next build && npx tsx scripts\/build-export-worker\.ts && npx next start/);
  });

  it('the Playwright development server makes the bundle before `next dev`', () => {
    expect(read('playwright.config.ts')).toMatch(/npx tsx scripts\/build-export-worker\.ts && npx next dev/);
  });

  it('the Windows package makes it inside the package (the app folder that the standalone copy fills), as a line that runs, and stops without it', () => {
    const script = read('scripts/package-windows.ps1');
    const copied = script.indexOf('Copy-PackageFolder -Source $standalone -Destination $app');
    // Anchored to the start of the line: the same text inside a comment (`# New-EsbuildBundle ...`) does not count (QLT-799-03).
    const bundled = /^[ \t]*New-EsbuildBundle -Entry 'src\/worker\/export-thread\.ts' -OutFile \(Join-Path \$app '\.next\\export-worker\.mjs'\)/m.exec(script);
    expect(copied).toBeGreaterThan(0);
    expect(bundled?.index ?? -1).toBeGreaterThan(copied);
    // The helper stops the package on an esbuild failure and on a missing file: a release cannot be made without the bundle. The checks themselves are pinned, not only their words.
    expect(script).toMatch(/^[ \t]*if \(\$LASTEXITCODE -ne 0\) \{ throw "esbuild failed for/m);
    expect(script).toMatch(/^[ \t]*if \(-not \(Test-Path -LiteralPath \$OutFile\)\) \{ throw "esbuild wrote no file for/m);
  });

  it('the bundle is where the server looks: `.next/export-worker.mjs` under the folder it runs in', () => {
    const problem = exportThreadProblem('D:\\Accucut\\app', () => false);
    // The separator is the machine's (`join`): a backslash on Windows, a slash on Linux.
    expect(problem).toMatch(/Accucut\\app[\\/]\.next[\\/]export-worker\.mjs/);
  });
});

describe('the start-up line for a missing bundle', () => {
  it('is empty when the bundle is there', () => {
    expect(exportThreadProblem('/srv/portal', () => true)).toBeNull();
  });

  it('names the file, the failure the person will see, why `next build` is not enough and the exact command to run', () => {
    const problem = exportThreadProblem('/srv/portal', () => false) ?? '';
    expect(problem).toMatch(/\.next[\\/]export-worker\.mjs/);
    expect(problem).toContain('EXPORT_THREAD_MISSING');
    expect(problem).toContain('`next build` alone does not make it');
    expect(problem).toContain('`npx tsx scripts/build-export-worker.ts`');
    expect(problem).toContain('`npm run build`');
    // One line, so a log reader sees it as one event.
    expect(problem).not.toContain('\n');
  });

  it('asks the file system about the one path it names, and nothing else', () => {
    const asked: string[] = [];
    exportThreadProblem('/srv/portal', (path) => {
      asked.push(path);
      return true;
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/export-worker\.mjs$/);
  });
});

describe('the README says it', () => {
  it('gives the full build, with the bundle step, as "Build", and warns against `next build` alone', () => {
    const row = read('README.md')
      .split('\n')
      .find((line) => line.startsWith('| Build (**the full build**'));
    expect(row, 'the README has the Build row').toBeDefined();
    expect(row).toContain('`npx prisma generate && npx next build && npx tsx scripts/build-export-worker.ts`');
    expect(row).toContain('Never run `next build` alone');
    expect(row).toContain('a demo included');
  });

  it('has no instruction that builds with `npx next build` alone (QLT-799-04): no README line is the bare build', () => {
    const lines = read('README.md').split('\n');
    const alone = lines.map((line, index) => ({ line: line.trim(), index })).filter(({ line }) => line === 'npx next build');
    expect(alone, 'a README line that is exactly `npx next build`').toEqual([]);
  });
});
