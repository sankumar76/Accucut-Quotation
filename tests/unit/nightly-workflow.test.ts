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

  it('AQP-216 AC-2: the Lighthouse and CI-time jobs run on GitHub-hosted ubuntu-24.04, their reference image; only the warm-up job uses a floating label', () => {
    expect(jobText('lighthouse')).toMatch(/^ {4}runs-on: ubuntu-24\.04$/m);
    expect(jobText('ci-time')).toMatch(/^ {4}runs-on: ubuntu-24\.04$/m);
    const labels = LINES.filter((line) => /^\s*runs-on:/.test(line)).map((line) => line.trim());
    expect(labels).toEqual(['runs-on: ubuntu-24.04', 'runs-on: ubuntu-24.04', 'runs-on: ubuntu-latest']);
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

  it('AQP-216 AC-2: installs the Chromium Playwright provides with the bounded stage 12a script, not an unbounded --with-deps', () => {
    const install = stepNamed('Install the Chromium that Playwright provides');
    expect(install).toContain('bash scripts/ci/playwright-system-deps.sh');
    expect(install).toContain('timeout-minutes: 8');
    expect(CODE).not.toContain('--with-deps');
    expect(CODE).not.toMatch(/playwright install(?!-deps)/);
  });

  it('uses the production server with invented data', () => {
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

/** The Playwright cache steps and the key formula, as they must read in both ci.yml and nightly.yml (AQP-216 AC-1, AC-2, AC-6). */
const CI = read('.github/workflows/ci.yml');
const CI_LINES = CI.split('\n');

/** The text of one step of a workflow, from its `- name:` line to the next step or job key. */
function stepOf(lines: string[], prefix: string): string {
  const start = lines.findIndex((line) => line.includes(`- name: "${prefix}`) || line.includes(`- name: ${prefix}`));
  if (start === -1) throw new Error(`No step named "${prefix}..."`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*- name:/.test(line) || /^ {2}[\w-]+:\s*$/.test(line));
  const body = end === -1 ? rest : rest.slice(0, end);
  while (body.length > 0 && (body.at(-1) ?? '').trimStart().startsWith('#')) body.pop();
  return [lines[start] ?? '', ...body].join('\n').trimEnd();
}

function jobOf(lines: string[], id: string): string {
  const start = lines.findIndex((line) => line === `  ${id}:`);
  if (start === -1) throw new Error(`No job "${id}"`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}[\w-]+:\s*$/.test(line));
  return [lines[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

function jobText(id: string): string {
  return jobOf(LINES, id);
}

const CACHE_STEPS = [
  'Read the Playwright and runner image versions',
  'Cache the Playwright browsers',
  'Cache the Playwright system packages',
  'Stage 12a: Playwright browser and system packages',
] as const;

describe('AQP-216 AC-1: the warm-up job runs stage 12a and nothing else, with the keys of CI', () => {
  const job = jobText('warm-playwright-cache');

  it('has a job timeout, and the 8-minute cap on the stage 12a step', () => {
    expect(job).toMatch(/^ {4}timeout-minutes: \d+$/m);
    expect(stepNamed('Stage 12a: Playwright browser and system packages')).toContain('timeout-minutes: 8');
  });

  it('uses the same four steps as CI, word for word, so the key formula, the cache paths and the script are the same', () => {
    const ciJob = jobOf(CI_LINES, 'e2e');
    for (const name of CACHE_STEPS) expect(stepOf(job.split('\n'), name), name).toBe(stepOf(ciJob.split('\n'), name));
  });

  it('keeps CACHE_EPOCH equal to the one in ci.yml', () => {
    const epoch = (text: string): string | undefined => /^ {2}CACHE_EPOCH: '(\d+)'$/m.exec(text)?.[1];
    expect(epoch(WORKFLOW)).toBeDefined();
    expect(epoch(WORKFLOW)).toBe(epoch(CI));
  });

  it('runs on the same label as the CI job that runs stage 12a, because the key holds the image version', () => {
    const label = (text: string): string | undefined => /^ {4}runs-on: (\S+)$/m.exec(text)?.[1];
    expect(label(job)).toBe('ubuntu-latest');
    expect(label(job)).toBe(label(jobOf(CI_LINES, 'e2e')));
  });

  it('runs no test, build, database or browser run: it installs, caches and runs the stage 12a step only', () => {
    expect(job).not.toMatch(/next build|vitest|playwright test|prisma|lhci|services:/);
    expect(job.match(/^ {6}- name:/gm)).toHaveLength(8);
  });

  it('is not the required check, and does not change the job structure of AQP-208', () => {
    expect(jobOf(LINES, 'warm-playwright-cache')).not.toContain('Stages 1 to 11');
    expect(CI.match(/^ {4}name: Stages 1 to 11$/gm)).toHaveLength(1);
    expect(CI).toContain('name: Stages 1 to 11b');
  });

  it('is run by a pull request that changes the scripts it calls, as well as by the schedule and by hand', () => {
    const paths = pullRequestPaths();
    expect(paths).toEqual(expect.arrayContaining(['scripts/ci/playwright-system-deps.sh', 'scripts/ci/playwright-deps-packages.sh']));
  });
});

describe('AQP-216 AC-2: the Lighthouse job shares the key formula of CI, on its own image', () => {
  it('has the same cache steps and script call as CI', () => {
    const lighthouse = jobText('lighthouse');
    const ciJob = jobOf(CI_LINES, 'e2e');
    for (const name of CACHE_STEPS.slice(0, 3)) expect(stepOf(lighthouse.split('\n'), name), name).toBe(stepOf(ciJob.split('\n'), name));
    const install = stepNamed('Install the Chromium that Playwright provides');
    expect(install).toContain('PLAYWRIGHT_DEBS_CACHE_HIT: ${{ steps.debs.outputs.cache-hit }}');
    expect(install).toContain('PLAYWRIGHT_DEBS_CACHE_KEY: ${{ steps.versions.outputs.debs_key }}');
    expect(WORKFLOW.indexOf('Cache the Playwright system packages')).toBeLessThan(WORKFLOW.indexOf('Install the Chromium that Playwright provides'));
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
