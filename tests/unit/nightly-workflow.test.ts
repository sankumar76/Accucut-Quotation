import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * STORY-10.10 AC-7 and AC-8: the nightly workflow cannot run in a unit test, so these read its text. A regression in its
 * triggers, its permissions, its pinned actions or its secrets would otherwise be noticed only on a runner, in a public log.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (relative: string): string => readFileSync(`${ROOT}${relative}`, 'utf8').replaceAll('\r\n', '\n');
const WORKFLOW = read('.github/workflows/nightly.yml');
const LINES = WORKFLOW.split('\n');
const CODE = LINES.filter((line) => !line.trimStart().startsWith('#')).join('\n');

function runBlocks(): string[] {
  const blocks: string[] = [];
  LINES.forEach((line, index) => {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(line);
    if (match === null) return;
    const indent = (match[1] ?? '').length;
    const block = [match[2] ?? ''];
    for (const next of LINES.slice(index + 1)) {
      if (next.trim() !== '' && next.length - next.trimStart().length <= indent) break;
      block.push(next);
    }
    blocks.push(block.join('\n'));
  });
  return blocks;
}

function stepNamed(prefix: string): string {
  const start = LINES.findIndex((line) => line.includes(`name: "${prefix}`) || line.includes(`name: ${prefix}`));
  if (start === -1) throw new Error(`No step named "${prefix}..."`);
  const rest = LINES.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*- name:/.test(line));
  return [LINES[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

/** The `paths:` list of the pull_request trigger. */
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

describe('AC-7: triggers', () => {
  it('runs on a schedule, on demand, and on a pull request that changes the files defining the run', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}schedule:\n {4}- cron: '[^']+'\n {2}workflow_dispatch:\n {2}pull_request:\n {4}branches: \[master\]\n {4}paths:/m);
  });

  it('uses pull_request, never pull_request_target', () => {
    expect(CODE).not.toContain('pull_request_target');
  });

  it('limits the pull-request trigger to the workflow, the Lighthouse files and the scripts it calls, and these files exist', () => {
    const paths = pullRequestPaths();
    expect(paths).toEqual(expect.arrayContaining(['.github/workflows/nightly.yml', 'lighthouserc.cjs']));
    for (const path of paths) expect(existsSync(`${ROOT}${path}`), path).toBe(true);
    expect(paths.every((path) => !path.includes('*'))).toBe(true);
  });

  it('lists every script the workflow runs, and the scripts/lib modules those scripts import', () => {
    const paths = new Set(pullRequestPaths());
    const called = [...new Set(runBlocks().flatMap((block) => [...block.matchAll(/npx tsx (scripts\/[\w-]+\.ts)/g)].map((match) => match[1] ?? '')))];
    expect(called.length).toBeGreaterThan(0);
    for (const script of called) {
      expect(paths.has(script), script).toBe(true);
      for (const lib of read(script).matchAll(/from '\.\/(lib\/[\w-]+)'/g)) expect(paths.has(`scripts/${lib[1] ?? ''}.ts`), `${script} imports ${lib[1] ?? ''}`).toBe(true);
    }
    expect(paths.has('scripts/lighthouse-sign-in.cjs')).toBe(true);
  });
});

describe('AC-7: least privilege, no secret, pinned actions', () => {
  it('has contents: read and actions: read only, at the top, and no job asks for more', () => {
    expect(WORKFLOW).toMatch(/^permissions:\n {2}contents: read\n {2}actions: read\n/m);
    expect(LINES.filter((line) => /^\s*permissions:/.test(line))).toHaveLength(1);
    expect(CODE).not.toMatch(/:\s*write\b/);
  });

  it('uses no repository secret, and its one variable is the baseline index', () => {
    expect(CODE).not.toMatch(/\$\{\{\s*secrets\./);
    expect([...CODE.matchAll(/\$\{\{\s*vars\.(\w+)/g)].map((match) => match[1])).toEqual(['LIGHTHOUSE_B0']);
  });

  it('has no GitHub expression expanded into a run script', () => {
    expect(runBlocks().filter((block) => block.includes('${{'))).toEqual([]);
  });

  it('pins every action to a commit SHA', () => {
    const uses = LINES.filter((line) => /^\s*(?:- )?uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toMatch(/@[0-9a-f]{40}\b/);
  });

  it('runs on GitHub-hosted ubuntu-24.04, not a floating label', () => {
    const labels = LINES.filter((line) => /^\s*runs-on:/.test(line)).map((line) => line.trim());
    expect(labels).toEqual(['runs-on: ubuntu-24.04', 'runs-on: ubuntu-24.04']);
  });

  it('makes its passwords and its session secret in the job, and masks them', () => {
    expect(stepNamed('Make the invented Admin')).toMatch(/openssl rand[\s\S]*::add-mask::/);
    expect(stepNamed('Start the production server')).toMatch(/openssl rand[\s\S]*::add-mask::/);
    expect(stepNamed('Create the database roles')).toMatch(/openssl rand[\s\S]*::add-mask::/);
  });

  it('cancels a superseded run, and takes the repository token from the run, not a secret', () => {
    expect(WORKFLOW).toMatch(/^concurrency:\n {2}# .*\n {2}group: nightly-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: true$/m);
    expect(stepNamed('CI feedback time of')).toContain('GITHUB_TOKEN: ${{ github.token }}');
  });
});

describe('AC-7: the Lighthouse run', () => {
  it('runs both profiles from the one configuration, and the Slow 4G profile even if the Wi-Fi profile failed', () => {
    const wifi = stepNamed('Lighthouse, Wi-Fi profile');
    const slow = stepNamed('Lighthouse, Slow 4G profile');
    expect(wifi).toContain('LHCI_PROFILE: wifi');
    expect(slow).toContain('LHCI_PROFILE: slow4g');
    for (const step of [wifi, slow]) expect(step).toContain('npx lhci autorun --config=lighthouserc.cjs');
    expect(wifi).not.toMatch(/^\s*if:/m);
    expect(slow).toContain('if: ${{ !cancelled() }}');
  });

  it('uses the Chromium Playwright installs, and the production server with invented data', () => {
    expect(stepNamed('Install the Chromium that Playwright provides')).toContain('npx playwright install --with-deps chromium');
    expect(stepNamed('Start the production server')).toContain('npx next start --port 3000');
    expect(stepNamed('Make the invented Admin')).toContain('npx tsx scripts/ensure-measurement-user.ts');
    expect(WORKFLOW.indexOf('Make the invented Admin')).toBeLessThan(WORKFLOW.indexOf('Start the production server'));
    expect(WORKFLOW.indexOf('Start the production server')).toBeLessThan(WORKFLOW.indexOf('Lighthouse, Wi-Fi profile'));
  });

  it('keeps the reports for 30 days, writes the summary, and uploads nothing to a public server', () => {
    const keep = stepNamed('Keep the reports');
    expect(keep).toContain('retention-days: 30');
    expect(keep).toContain('path: lighthouse-reports');
    expect(stepNamed('Summary (LCP, TBT, benchmarkIndex, Chromium version)')).toContain('npx tsx scripts/summarise-lighthouse.ts --wifi lighthouse-reports/wifi --slow4g lighthouse-reports/slow4g');
    expect(CODE).not.toMatch(/temporary-public-storage|lhci upload|lhci server|--upload\./);
  });
});

describe('AC-8: the CI feedback time step', () => {
  it('runs the script in a job of its own, so a breach fails that step and nothing else', () => {
    expect(stepNamed('CI feedback time of')).toContain('npx tsx scripts/check-ci-time.ts');
    expect(WORKFLOW).toMatch(/^ {2}ci-time:\n {4}name: CI feedback time$/m);
  });

  it('is not the required check: no job here is named "Stages 1 to 11"', () => {
    expect(CODE).not.toContain('Stages 1 to 11');
  });
});
