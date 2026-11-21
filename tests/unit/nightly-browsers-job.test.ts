import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-10.08 AC-6 and AC-7: the nightly job "Sweep, keyboard flows and browsers (NFR-016, NFR-018, NFR-019)". The workflow cannot run in a unit test, so these read its text. A fault here
 * is silent: a job that lengthens the required check, one that is never run by the pull request that changes it, or one that installs only Chromium would be noticed on a runner, in a public log.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (relative: string): string => readFileSync(`${ROOT}${relative}`, 'utf8').replaceAll('\r\n', '\n');
const WORKFLOW = read('.github/workflows/nightly.yml');
const LINES = WORKFLOW.split('\n');

function jobOf(id: string): string {
  const start = LINES.findIndex((line) => line === `  ${id}:`);
  if (start === -1) throw new Error(`No job "${id}"`);
  const rest = LINES.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}[\w-]+:\s*$/.test(line));
  return [LINES[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

const JOB = jobOf('browsers');
const JOB_CODE = JOB.split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

function stepOf(prefix: string): string {
  const lines = JOB.split('\n');
  const start = lines.findIndex((line) => line.includes(`- name: ${prefix}`) || line.includes(`- name: "${prefix}`));
  if (start === -1) throw new Error(`No step named "${prefix}..."`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*- name:/.test(line));
  return [lines[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

/** The text of every `run:` of the job: a GitHub expression inside one is expanded into the script, which is how an injection starts. */
function runBlocks(): string[] {
  const lines = JOB.split('\n');
  const blocks: string[] = [];
  lines.forEach((line, index) => {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(line);
    if (match === null) return;
    const indent = (match[1] ?? '').length;
    const block = [match[2] ?? ''];
    for (const next of lines.slice(index + 1)) {
      if (next.trim() !== '' && next.length - next.trimStart().length <= indent) break;
      block.push(next);
    }
    blocks.push(block.join('\n'));
  });
  return blocks;
}

function pullRequestPaths(): string[] {
  const start = LINES.findIndex((line) => /^ {2}pull_request:/.test(line));
  const paths = LINES.findIndex((line, index) => index > start && /^ {4}paths:/.test(line));
  const entries: string[] = [];
  for (const line of LINES.slice(paths + 1)) {
    const match = /^ {6}- (.+)$/.exec(line);
    if (match === null) break;
    entries.push(match[1] ?? '');
  }
  return entries;
}

const sourcesOf = (folder: string): string[] =>
  readdirSync(`${ROOT}${folder}`, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sourcesOf(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]));

describe('AC-7: the job exists under its name, on the reference runner, with a database of its own', () => {
  it('is named "Sweep, keyboard flows and browsers (NFR-016, NFR-018, NFR-019)", has a time limit, and runs on ubuntu-24.04', () => {
    expect(JOB).toMatch(/^ {4}name: Sweep, keyboard flows and browsers \(NFR-016, NFR-018, NFR-019\)$/m);
    expect(JOB).toMatch(/^ {4}timeout-minutes: 45$/m);
    expect(JOB).toMatch(/^ {4}runs-on: ubuntu-24\.04$/m);
  });

  it('has a Postgres service pinned by the same digest as the Lighthouse job, and makes its own roles and its own throwaway passwords', () => {
    const image = /image: (postgres:17@sha256:[0-9a-f]{64})/.exec(JOB)?.[1];
    expect(image).toBeDefined();
    expect(jobOf('lighthouse')).toContain(`image: ${image ?? ''}`);
    expect(stepOf('Create the database roles')).toMatch(/openssl rand[\s\S]*::add-mask::[\s\S]*01-create-roles\.sh[\s\S]*prisma migrate deploy/);
  });
});

describe('AC-7: the required check is not lengthened, and the job is not part of it', () => {
  it('has no `needs`, so it waits for no other job and no other job waits for it', () => {
    expect(JOB_CODE).not.toMatch(/^\s*needs:/m);
    for (const line of LINES) expect(line).not.toMatch(/needs:.*browsers/);
  });

  it('cannot hide a red test: no continue-on-error in the job, and the Playwright step is not conditional', () => {
    expect(JOB_CODE).not.toContain('continue-on-error');
    expect(stepOf('Sweep, keyboard flows and browsers (Playwright')).not.toMatch(/^\s+if:/m);
  });

  it('is not the required check "Stages 1 to 11", and ci.yml does not run it', () => {
    expect(JOB).not.toContain('Stages 1 to 11');
    expect(read('.github/workflows/ci.yml')).not.toMatch(/playwright\.sweep|sweep-report|browsers:/);
  });

  it('keeps the triggers: schedule, by hand, and a pull request that changes the files that define the run', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}schedule:\n {4}- cron: '[^']+'\n {2}workflow_dispatch:\n {2}pull_request:\n {4}branches: \[master\]\n {4}paths:/m);
  });
});

describe('AC-6: three engines through the bounded install script, under cache keys of their own', () => {
  it('installs Chromium, Firefox and WebKit with the stage 12a script, with a step limit, and not with an unbounded --with-deps', () => {
    const install = stepOf('Install Chromium, Firefox and WebKit');
    expect(install).toContain('PLAYWRIGHT_BROWSERS: chromium firefox webkit');
    expect(install).toContain('bash scripts/ci/playwright-system-deps.sh');
    expect(install).toMatch(/timeout-minutes: \d+/);
    expect(JOB_CODE).not.toContain('--with-deps');
  });

  it('uses cache keys that differ from the required check\'s, because the browsers and the packages differ', () => {
    expect(stepOf('Read the Playwright and runner image versions')).toContain('-${playwright}-matrix');
    expect(stepOf('Cache the Playwright browsers')).toContain('-matrix');
    const ci = read('.github/workflows/ci.yml');
    expect(ci).not.toContain('-matrix');
  });

  it('gives the cache steps and the install step the same key, in order, before the run', () => {
    expect(JOB.indexOf('Cache the Playwright system packages')).toBeLessThan(JOB.indexOf('Install Chromium, Firefox and WebKit'));
    expect(JOB.indexOf('Install Chromium, Firefox and WebKit')).toBeLessThan(JOB.indexOf('Sweep, keyboard flows and browsers (Playwright'));
    expect(stepOf('Install Chromium, Firefox and WebKit')).toContain('PLAYWRIGHT_DEBS_CACHE_KEY: ${{ steps.versions.outputs.debs_key }}');
  });
});

describe('AC-1, AC-6, AC-7: it runs the sweep configuration on the production build, and keeps the evidence', () => {
  it('stores the seed configuration version, builds with `npm run build` (which bundles the export thread) and runs the sweep configuration', () => {
    expect(stepOf('Store the seed configuration version')).toContain('node --conditions=react-server --import tsx scripts/ensure-seed-version.ts');
    expect(stepOf('Build')).toContain('npm run build');
    expect(stepOf('Sweep, keyboard flows and browsers (Playwright')).toContain('npx playwright test --config playwright.sweep.config.ts');
    expect(JOB.indexOf('Store the seed configuration version')).toBeLessThan(JOB.indexOf('npx playwright test --config playwright.sweep.config.ts'));
    expect(JOB.indexOf('- name: Build')).toBeLessThan(JOB.indexOf('npx playwright test --config playwright.sweep.config.ts'));
  });

  it('writes the summary and keeps the report, the traces and the JSON for 30 days, even when a test failed', () => {
    const summary = stepOf('Summary (passed, failed, flaky and skipped');
    expect(summary).toContain('if: ${{ !cancelled() }}');
    expect(summary).toContain('npx tsx scripts/summarise-sweep.ts test-results/sweep-results.json');
    const keep = stepOf('Keep the report and the traces');
    expect(keep).toContain('if: ${{ !cancelled() }}');
    expect(keep).toContain('retention-days: 30');
    expect(keep).toContain('name: sweep-report');
    for (const path of ['playwright-report/sweep', 'test-results/sweep', 'test-results/sweep-results.json']) expect(keep).toContain(path);
  });

  it('uses no secret and no expression inside a run script', () => {
    expect(JOB_CODE).not.toMatch(/\$\{\{\s*secrets\./);
    expect(runBlocks().length).toBeGreaterThan(0);
    expect(runBlocks().filter((block) => block.includes('${{'))).toEqual([]);
  });
});

describe('AC-7: a pull request that changes the job, the configuration or a file of the sweep runs it', () => {
  const paths = pullRequestPaths();

  it('lists the configuration, the summary script and its module, and every file of the sweep folder; these files exist', () => {
    for (const path of ['playwright.sweep.config.ts', 'scripts/summarise-sweep.ts', 'scripts/lib/sweep-summary.ts', ...sourcesOf('tests/e2e-sweep')]) {
      expect(paths, `${path} is not in the pull-request paths of the nightly workflow`).toContain(path);
      expect(existsSync(`${ROOT}${path}`), path).toBe(true);
    }
  });

  it('does not list package.json: a dependency update must not start a 45-minute run', () => {
    expect(paths).not.toContain('package.json');
  });

  it('has a package script for the sweep, named only (CLAUDE.md prompts for npm run, so the job calls Playwright directly)', () => {
    const manifest = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(manifest.scripts?.['test:e2e:sweep']).toBe('playwright test --config playwright.sweep.config.ts');
    expect(manifest.scripts?.['test:e2e']).toBe('playwright test');
  });
});
