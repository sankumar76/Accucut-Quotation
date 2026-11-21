import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import sweepConfig, { SWEEP_PROJECTS } from '../../playwright.sweep.config';

/**
 * STORY-10.08 AC-5 to AC-8: the sweep configuration and its isolation from the required check. The sweep, the keyboard flows and the browser matrix are heavy, so they run in the nightly job
 * and on demand; the required check "Stages 1 to 11" and its four shards run `playwright.config.ts`, which must keep its folder, its Chromium-only projects and its shard split untouched
 * (CLAUDE.md section 9, item 4: CI speed and tooling are frozen). These tests read the files, so a change that would pull the heavy suites into the required check, or leave a spec of the
 * sweep without a project to run it, fails here and not on a runner.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (relative: string): string => readFileSync(`${ROOT}${relative}`, 'utf8').replaceAll('\r\n', '\n');
const SWEEP_FOLDER = 'tests/e2e-sweep';
const sourcesOf = (folder: string): string[] =>
  readdirSync(`${ROOT}${folder}`, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sourcesOf(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]));

const projectNamed = (name: string) => SWEEP_PROJECTS.find((project) => project.name === name);
const globToFile = (glob: string): string => glob.replace('**/', '');

describe('AC-6: the browser matrix', () => {
  it('has Chromium, Firefox and WebKit at 360 and 1366 px, each running the journeys', () => {
    for (const engine of ['chromium', 'firefox', 'webkit']) {
      for (const width of [360, 1366]) {
        const project = projectNamed(`${engine}-${width}`);
        expect(project, `${engine}-${width}`).toBeDefined();
        expect(project?.engine).toBe(engine);
        expect(project?.viewport?.width).toBe(width);
        expect(project?.runs.map(globToFile)).toContain('browsers.spec.ts');
      }
    }
  });

  it('runs only the journeys in Firefox and WebKit: the sweep and the keyboard flows are Chromium\'s', () => {
    for (const project of SWEEP_PROJECTS.filter((candidate) => candidate.engine !== 'chromium')) expect(project.runs.map(globToFile), project.name).toEqual(['browsers.spec.ts']);
  });

  it('gives the narrow widths a phone-sized window and the wide one a desktop window (the sizes of SPEC section 14 item 13)', () => {
    expect(projectNamed('chromium-360')?.viewport).toEqual({ width: 360, height: 800 });
    expect(projectNamed('chromium-768')?.viewport).toEqual({ width: 768, height: 1024 });
    expect(projectNamed('chromium-1366')?.viewport).toEqual({ width: 1366, height: 768 });
  });
});

describe('AC-1, AC-4, AC-5: what each project runs', () => {
  it('sweeps at the three widths, and runs the "no access" check once per page (in the 1366 project only)', () => {
    for (const width of [360, 768, 1366]) expect(projectNamed(`chromium-${width}`)?.runs.map(globToFile), `chromium-${width}`).toContain('screens.spec.ts');
    const withNoAccess = SWEEP_PROJECTS.filter((project) => project.runs.map(globToFile).includes('no-access.spec.ts'));
    expect(withNoAccess.map((project) => project.name)).toEqual(['chromium-1366']);
  });

  it('runs the keyboard flows in Chromium at 360 and 1366 px only', () => {
    const withKeyboard = SWEEP_PROJECTS.filter((project) => project.runs.map(globToFile).includes('keyboard-flows.spec.ts'));
    expect(withKeyboard.map((project) => project.name)).toEqual(['chromium-360', 'chromium-1366']);
  });

  it('runs the other sizes in a project of its own', () => {
    expect(projectNamed('chromium-sizes')?.runs.map(globToFile)).toEqual(['sizes.spec.ts']);
  });

  it('gives every spec of the folder at least one project, and every pattern of a project a file', () => {
    const files = sourcesOf(SWEEP_FOLDER).map((path) => path.slice(SWEEP_FOLDER.length + 1));
    const specs = files.filter((file) => /\.(spec|setup)\.ts$/.test(file) && !file.includes('/'));
    const run = new Set(SWEEP_PROJECTS.flatMap((project) => project.runs.map(globToFile)));
    for (const spec of specs) expect(run.has(spec), `${spec} is run by no project`).toBe(true);
    for (const name of run) expect(files, `a project names ${name}, which does not exist`).toContain(name);
  });

  it('has the one set-up project, which every other project waits for', () => {
    expect(SWEEP_PROJECTS.filter((project) => project.runs.map(globToFile).includes('sweep.setup.ts')).map((project) => project.name)).toEqual(['setup']);
    const projects = sweepConfig.projects ?? [];
    for (const project of projects.filter((candidate) => candidate.name !== 'setup')) expect(project.dependencies, project.name).toEqual(['setup']);
  });
});

describe('AC-7: the required check is not changed', () => {
  const required = read('playwright.config.ts');

  it('keeps `playwright.config.ts` on tests/e2e with its three Chromium projects, and gives it no Firefox or WebKit project and no sweep path', () => {
    expect(required).toContain("testDir: './tests/e2e'");
    expect(required).not.toMatch(/e2e-sweep|firefox|webkit|sweep/i);
    expect([...required.matchAll(/\bname: '([\w-]+)'/g)].map((match) => match[1])).toEqual(['setup', 'mobile', 'tablet', 'desktop']);
  });

  it('keeps the sweep out of the pull-request workflow: ci.yml names neither the sweep configuration nor its folder', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).not.toMatch(/playwright\.sweep|e2e-sweep|sweep-report/);
    expect(ci).toContain('npx playwright test --shard=');
    expect(ci).not.toContain('--config playwright.sweep');
  });

  it('uses a folder and a configuration of its own, a separate output folder, and the one retry', () => {
    expect(sweepConfig.testDir).toBe('./tests/e2e-sweep');
    expect(sweepConfig.retries).toBe(1);
    expect(sweepConfig.forbidOnly).toBe(Boolean(process.env['CI']));
    expect(sweepConfig.outputDir).toBe('test-results/sweep');
  });

  it('is not picked up by Vitest: no file of the folder ends in .test.ts', () => {
    expect(sourcesOf(SWEEP_FOLDER).filter((path) => /\.test\.ts$/.test(path))).toEqual([]);
  });
});

describe('AC-8: no sleeps, no blanket skip, no second retry', () => {
  const sources = sourcesOf(SWEEP_FOLDER).filter((path) => path.endsWith('.ts'));
  const code = (path: string): string =>
    read(path)
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('/*'))
      .join('\n');

  it('waits on a state, never on a clock', () => {
    for (const path of sources) expect(code(path), path).not.toMatch(/waitForTimeout|(?<![.\w])setTimeout\(|new Promise\(\s*\(?\s*resolve/);
  });

  it('skips only by name, with a reason and an issue, and never a whole engine or file', () => {
    for (const path of sources) {
      expect(code(path), path).not.toMatch(/test\.(describe\.)?skip\(\s*(\)|true|false|['"`])/);
      expect(code(path), path).not.toMatch(/\.fixme\(|test\.only|describe\.only/);
    }
    // The only skip is in the journeys, through the list of known faults, which is empty until a run finds one.
    const skips = sources.filter((path) => /test\.skip\(/.test(code(path)));
    expect(skips).toEqual([`${SWEEP_FOLDER}/browsers.spec.ts`]);
    expect(code(`${SWEEP_FOLDER}/browsers.spec.ts`)).toMatch(/\$\{known\.reason\} \(\$\{known\.issue\}\)/);
  });

  it('does not use the tag that the one-width guard looks for, so that guard is not given a spec it does not own', () => {
    for (const path of sources) expect(read(path), path).not.toContain('@one-width');
  });

  it('never uses a pointer in the keyboard flows: no click, tap, hover, check or mouse call', () => {
    const flows = code(`${SWEEP_FOLDER}/keyboard-flows.spec.ts`) + code(`${SWEEP_FOLDER}/support/keyboard.ts`);
    expect(flows).not.toMatch(/\.(click|dblclick|tap|hover|check|uncheck|selectOption|dragTo|setInputFiles)\(|\.mouse\.|\.touchscreen\./);
    expect(flows).toContain('page.keyboard.press');
  });
});
