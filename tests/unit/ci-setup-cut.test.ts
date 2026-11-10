import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { installSteps } from '../support/ci-run-jobs';

/**
 * AQP-243 (STORY-10.19): the guards on the set-up cut in `.github/workflows/ci.yml` that `ci-workflow.test.ts` (near its 400-line
 * limit) does not carry: the `node_modules` cache (AC-2, AC-3), the host line (AC-5) and the run summary in the fan-in job (AC-5).
 * Like that file, this reads the workflow text, because a workflow cannot run in a unit test. The script behind each step is
 * run elsewhere: node-modules-integrity.test.ts (the check) and ci-run-summary.test.ts (the summary).
 */

const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const WORKFLOW = read('../../.github/workflows/ci.yml');
const LINES = WORKFLOW.split('\n');
/** The whole `key:` line of a node_modules cache step (QLT-10): a suffix such as `-${{ github.run_id }}` makes every run miss, so `toContain` is not enough. */
const KEY_LINE = /^\s+key: \$\{\{ steps\.nmkey\.outputs\.key \}\}$/m;
const CACHE_SHA = /actions\/cache(?:\/restore|\/save)?@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6\.1\.0$/;

/** The text of one job, from its key to the next job's key. */
function jobText(id: string): string {
  const start = LINES.findIndex((line, index) => line === `  ${id}:` && index > LINES.indexOf('jobs:'));
  if (start === -1) throw new Error(`No job "${id}"`);
  const rest = LINES.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}[\w-]+:\s*$/.test(line));
  return LINES.slice(start, end === -1 ? undefined : start + 1 + end).join('\n');
}

/** The steps of a job as blocks of text, comment lines left out, keyed by their name. */
function stepsOf(job: string): Map<string, string> {
  const steps = new Map<string, string>();
  let name = '';
  let body: string[] = [];
  const flush = (): void => {
    if (name !== '') steps.set(name, body.join('\n'));
  };
  for (const line of job.split('\n')) {
    if (line.trimStart().startsWith('#')) continue;
    const match = /^ {6}- name:\s*"?(.*?)"?\s*$/.exec(line);
    if (match !== null) {
      flush();
      name = match[1] ?? '';
      body = [line];
    } else if (name !== '') {
      body.push(line);
    }
  }
  flush();
  return steps;
}

const stepText = (job: string, name: string): string => {
  const found = stepsOf(job).get(name);
  if (found === undefined) throw new Error(`No step "${name}"`);
  return found;
};

const INSTALL_JOBS = [
  { job: 'verify', prefix: 'Stage 1', build: 'Stage 9: build', first: 'Use the pinned npm' },
  { job: 'e2e', prefix: 'Shard', build: 'Shard: build (next build)', first: 'Use the pinned npm' },
] as const;

describe.each(INSTALL_JOBS)('AQP-243 AC-2 / AC-3: the node_modules cache in the $job job', ({ job, prefix, build, first }) => {
  const text = jobText(job);
  const names = [...stepsOf(text).keys()];
  const step = (part: string): string => stepText(text, `${prefix}: install, ${part}`);

  it('replaces the old install step, which is gone: npm ci runs only on a miss or after a failed check', () => {
    expect(names.some((name) => name.includes('install (npm ci, prisma generate)'))).toBe(false);
    const npmCi = [...stepsOf(text)].filter(([, body]) => /^\s+(?:run: )?\s*npm ci\s*$/m.test(body)).map(([name]) => name);
    expect(npmCi).toEqual([`${prefix}: install, npm ci (cache miss)`, `${prefix}: install, npm ci (cache fallback)`]);
    expect(step('npm ci (cache miss)')).toMatch(/^\s+if: steps\.nm\.outputs\.cache-hit != 'true'$/m);
    expect(step('npm ci (cache fallback)')).toMatch(/^\s+if: steps\.nm\.outputs\.cache-hit == 'true' && steps\.nmcheck\.outputs\.intact != 'true'$/m);
  });

  it('runs the steps in order: pinned npm, key, restore, check, npm ci (miss), npm ci (fallback), save, prisma generate, build', () => {
    const order = ['name the node_modules cache key', 'restore node_modules', 'check node_modules', 'npm ci (cache miss)', 'npm ci (cache fallback)', 'save node_modules', 'prisma generate'].map(
      (part) => names.indexOf(`${prefix}: install, ${part}`),
    );
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // A restore must not come before the pinned npm (the key reads its version) and must come before the build.
    expect(names.indexOf(first)).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(first)).toBeLessThan(order[0] ?? -1);
    expect(order.at(-1)).toBeLessThan(names.indexOf(build));
  });

  it('keys the cache on the runner, Node, npm and the three files, with no restore-keys (a changed file is a miss)', () => {
    const key = step('name the node_modules cache key');
    expect(key).toContain("INPUT_HASH: ${{ hashFiles('package-lock.json', 'package.json', '.npmrc') }}");
    expect(key).toContain('"key=node-modules-v${NODE_MODULES_CACHE_FORMAT}-${RUNNER_OS}-${RUNNER_ARCH}-${ImageOS}-node${NODE_VERSION}-npm${NPM_VERSION}-${INPUT_HASH}"');
    expect(step('restore node_modules')).toMatch(KEY_LINE);
    expect(step('save node_modules')).toMatch(KEY_LINE);
    for (const part of ['restore node_modules', 'save node_modules']) {
      expect(step(part), part).not.toContain('restore-keys');
      expect(step(part), part).toContain('path: node_modules');
    }
  });

  it('restores and saves with the already pinned cache action, saves only after a miss whose install and record succeeded, and never continues on error', () => {
    expect(step('restore node_modules')).toMatch(/uses: actions\/cache\/restore@/);
    expect(step('save node_modules')).toMatch(/uses: actions\/cache\/save@/);
    for (const part of ['restore node_modules', 'save node_modules']) expect(step(part).match(/uses: .*$/m)?.[0], part).toMatch(CACHE_SHA);
    // No status function: the step is skipped unless every step before it succeeded, so a failed `npm ci` saves nothing.
    expect(step('save node_modules')).toMatch(/^\s+if: steps\.nm\.outputs\.cache-hit != 'true' && steps\.nminstall\.outputs\.recorded == 'true'$/m);
    expect(step('save node_modules')).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
    expect(step('npm ci (cache fallback)')).not.toContain('actions/cache');
    for (const part of ['restore node_modules', 'check node_modules', 'npm ci (cache miss)', 'npm ci (cache fallback)', 'save node_modules']) {
      expect(step(part), part).not.toContain('continue-on-error');
    }
  });

  it('runs npm ci before it records, records before it saves, and a failed record only stops the save', () => {
    const miss = step('npm ci (cache miss)');
    expect(miss.indexOf('npm ci')).toBeLessThan(miss.indexOf('node-modules-integrity.sh record'));
    expect(miss).toContain('echo "recorded=true" >> "${GITHUB_OUTPUT}"');
    expect(miss).toContain('::warning::');
    expect(miss).not.toMatch(/\|\|\s*true/);
  });

  it('checks a hit with the integrity script and turns its result into an output, never into a failed step', () => {
    const check = step('check node_modules');
    expect(check).toMatch(/^\s+if: steps\.nm\.outputs\.cache-hit == 'true'$/m);
    expect(check).toContain('if bash scripts/ci/node-modules-integrity.sh check; then');
    expect(check).toContain('echo "intact=true" >> "${GITHUB_OUTPUT}"');
    expect(check).toContain('echo "intact=false" >> "${GITHUB_OUTPUT}"');
  });

  it('deletes node_modules, warns with the key and the delete command, and runs a clean npm ci with no save on a failed check', () => {
    const fallback = step('npm ci (cache fallback)');
    expect(fallback).toContain('gh cache delete ${NM_KEY}');
    expect(fallback.indexOf('rm -rf node_modules')).toBeGreaterThan(fallback.indexOf('::warning::'));
    expect(fallback.indexOf('rm -rf node_modules')).toBeLessThan(fallback.lastIndexOf('npm ci'));
    expect(fallback).not.toContain('record');
  });

  it('generates the Prisma client on every run, hit or miss', () => {
    const generate = step('prisma generate');
    expect(generate).toContain('run: npx prisma generate');
    expect(generate).not.toMatch(/^\s+if:/m);
  });

  it('writes the host CPU count and model to the job summary before Node is set up, and needs no permission to do so', () => {
    const host = stepText(text, 'Host: CPU count and model (job summary)');
    expect(host).toContain('$(nproc)');
    expect(host).toContain("/^model name/ {print $2; exit}' /proc/cpuinfo");
    expect(host).toContain('${model:-n/a}');
    expect(host).toContain('>> "${GITHUB_STEP_SUMMARY}"');
    expect(names.indexOf('Host: CPU count and model (job summary)')).toBeLessThan(names.indexOf('Set up Node.js'));
  });

  it('uses the step names that the run-summary fixtures (and so the summary script) read', () => {
    for (const made of installSteps(prefix, 'miss', 0).steps) expect(names, made.name).toContain(made.name);
  });
});

describe('AQP-243 AC-2 / AC-3: the whole workflow', () => {
  // STD-05: the record format is one quoted constant in the top-level env, beside CACHE_EPOCH, and the key text it makes is the one
  // that was measured (`node-modules-v1-...`), so the entries already saved stay valid.
  it('keeps the record format in one quoted env entry before the jobs, set to 1', () => {
    const entries = LINES.filter((line) => /^\s*NODE_MODULES_CACHE_FORMAT:/.test(line));
    expect(entries).toEqual(["  NODE_MODULES_CACHE_FORMAT: '1'"]);
    expect(WORKFLOW.indexOf('NODE_MODULES_CACHE_FORMAT:')).toBeLessThan(WORKFLOW.indexOf('jobs:'));
    expect(WORKFLOW).not.toMatch(/node-modules-v\d/);
  });

  // QLT-02 (G12 rule). `ci-workflow.test.ts` no longer bans the split cache action as a whole, so this is the exact replacement:
  // it is used four times, and only for the node_modules restore and save. A cache handed from `verify` to `e2e`, or a second save
  // of another cache (the Playwright browsers) under a new key, fails here.
  it('uses the split cache action only for the node_modules restore and save', () => {
    expect(LINES.filter((line) => /uses: actions\/cache\/(save|restore)@/.test(line))).toHaveLength(4);
    for (const job of ['verify', 'e2e', 'required']) {
      for (const [name, body] of stepsOf(jobText(job))) {
        if (!/actions\/cache\/(save|restore)@/.test(body)) continue;
        expect(name).toMatch(/: install, (restore|save) node_modules$/);
        expect(body).toContain('path: node_modules');
        expect(body).toMatch(KEY_LINE);
      }
    }
  });

  it('has restore-keys only on the two Next.js build caches, never on the node_modules cache', () => {
    expect(LINES.filter((line) => line.trim() === 'restore-keys: |')).toHaveLength(2);
    expect(WORKFLOW).not.toContain('restore-keys: node-modules');
    // The integrity script is the only helper the install steps call.
    expect(WORKFLOW.match(/node-modules-integrity\.sh (record|check)/g)).toHaveLength(4);
    expect(existsSync(fileURLToPath(new URL('../../scripts/ci/node-modules-integrity.sh', import.meta.url)))).toBe(true);
  });

  it('keeps the pinned npm and setup-node cache: npm in both install jobs (a miss or a fallback stays off the network)', () => {
    for (const job of ['verify', 'e2e']) {
      const text = jobText(job);
      expect(text, job).toContain('run: npm install --global "npm@${NPM_VERSION}"');
      expect(stepText(text, 'Set up Node.js'), job).toContain('cache: npm');
    }
  });
});

describe('AQP-243 AC-5: the run summary in the fan-in job', () => {
  const required = jobText('required');
  const steps = stepsOf(required);
  const summaryNames = ['Summary: check out the script', 'Summary: set up Node.js', 'Summary: show the time of this run'];

  it('has the verdict step first, unchanged in kind, and then exactly the three summary steps', () => {
    expect([...steps.keys()]).toEqual(['Require every needed job to have succeeded', ...summaryNames]);
    expect(stepText(required, 'Require every needed job to have succeeded')).not.toMatch(/uses:|continue-on-error|github\.token|GITHUB_TOKEN/);
  });

  it('lets only the three summary steps continue on error, so the summary cannot change the job result, and always runs them', () => {
    expect(required.match(/continue-on-error/g)).toHaveLength(3);
    for (const name of summaryNames) {
      const step = stepText(required, name);
      expect(step, name).toMatch(/^\s+continue-on-error: true$/m);
      // A stalled step is a failure, which `continue-on-error` absorbs; the 5-minute job limit is not (STD-02, QLT-04, PRF-01).
      expect(step, name).toMatch(/^\s+timeout-minutes: 1$/m);
      expect(step, name).toMatch(/^\s+if: \$\{\{ always\(\) \}\}$/m);
    }
    expect(required).not.toMatch(/^ {4}continue-on-error:/m);
  });

  it('holds the token in the script step only, as github.token, with no secret', () => {
    expect(required.match(/GITHUB_TOKEN|github\.token/g)).toHaveLength(2);
    expect(stepText(required, 'Summary: show the time of this run')).toContain('GITHUB_TOKEN: ${{ github.token }}');
    expect(required).not.toContain('secrets.');
  });

  it('checks out only the script, without keeping the credential, and sets up the pinned Node version', () => {
    const checkout = stepText(required, 'Summary: check out the script');
    expect(checkout).toMatch(/uses: actions\/checkout@[0-9a-f]{40} # v7\.0\.1$/m);
    expect(checkout).toContain('sparse-checkout: scripts/lib/ci-run-summary.ts');
    expect(checkout).toContain('persist-credentials: false');
    const node = stepText(required, 'Summary: set up Node.js');
    expect(node).toMatch(/uses: actions\/setup-node@[0-9a-f]{40} # v7\.1\.0$/m);
    expect(node).toContain('node-version: ${{ env.NODE_VERSION }}');
    expect(node).not.toContain('cache:');
  });

  it('runs the script with Node type stripping and no install, from the file that the checkout fetched', () => {
    const run = stepText(required, 'Summary: show the time of this run');
    expect(run).toContain('run: node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/lib/ci-run-summary.ts');
    expect(run).not.toMatch(/npm |npx /);
    expect(existsSync(fileURLToPath(new URL('../../scripts/lib/ci-run-summary.ts', import.meta.url)))).toBe(true);
  });

  it('does not change the topology: still the only job with needs, still [verify, e2e], still named Stages 1 to 11', () => {
    expect(required).toMatch(/^ {4}needs: \[verify, e2e\]$/m);
    expect(required).toMatch(/^ {4}name: Stages 1 to 11$/m);
    expect(WORKFLOW.match(/^\s+needs:/gm)).toHaveLength(1);
  });
});

describe('AQP-243: the README says how the node_modules cache works and how to replace a bad entry', () => {
  it('has a section on the key, the check, the fallback, gh cache delete and the ref scoping', () => {
    const readme = read('../../README.md');
    const section = readme.slice(readme.indexOf('### node_modules cache'), readme.indexOf('## Performance checks'));
    expect(section.length).toBeGreaterThan(200);
    const wanted = ['package-lock.json', 'package.json', '.npmrc', 'restore-keys', 'gh cache delete', '--ref refs/pull/', 'fallback', 'node-modules-integrity.sh', 'NODE_MODULES_CACHE_FORMAT', 'CPU count and model', 'actions/cache/usage'];
    for (const text of wanted) {
      expect(section, text).toContain(text);
    }
  });
});
