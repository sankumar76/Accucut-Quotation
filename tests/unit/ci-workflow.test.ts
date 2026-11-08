import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * AC-4 and the review findings on the workflow (STD-01, STD-12, QLT-05). The workflow cannot run in a
 * unit test, so these read its text: a regression here would otherwise be noticed only on a runner.
 */

// A Windows checkout with Git's default autocrlf writes CRLF; the checks below expect LF (DEF-002).
const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8').replaceAll(
  '\r\n',
  '\n',
);
const LINES = WORKFLOW.split(/\r?\n/);

/** The text of every `run:` block, so expressions can be checked where a shell would read them. */
function runBlocks(): string[] {
  const blocks: string[] = [];
  LINES.forEach((line, index) => {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(line);
    if (match === null) return;
    const indent = (match[1] ?? '').length;
    const block = [match[2] ?? ''];
    for (const next of LINES.slice(index + 1)) {
      const nextIndent = next.length - next.trimStart().length;
      if (next.trim() !== '' && nextIndent <= indent) break;
      block.push(next);
    }
    blocks.push(block.join('\n'));
  });
  return blocks;
}

function stepNamed(prefix: string): string {
  const start = LINES.findIndex((line) => line.includes(`- name: "${prefix}`));
  if (start === -1) throw new Error(`No step named "${prefix}..."`);
  const rest = LINES.slice(start + 1);
  // A step ends at the next step or at the next job's key.
  const end = rest.findIndex((line) => /^\s*- name:/.test(line) || /^ {2}[\w-]+:\s*$/.test(line));
  const body = end === -1 ? rest : rest.slice(0, end);
  // The comment block above the next step or job belongs to that one.
  while (body.length > 0 && (body.at(-1) ?? '').trimStart().startsWith('#')) body.pop();
  return [LINES[start] ?? '', ...body].join('\n');
}

/** The ids of the jobs, in file order (a job key is a name indented two spaces under `jobs:`). */
function jobIds(): string[] {
  return LINES.slice(LINES.indexOf('jobs:') + 1)
    .map((line) => /^ {2}([\w-]+):\s*$/.exec(line)?.[1])
    .filter((id): id is string => id !== undefined);
}

/** The text of one job, from its key to the next job's key (comments between jobs belong to the job below them). */
function jobText(id: string): string {
  const keys = jobIds();
  const start = LINES.findIndex((line, index) => line === `  ${id}:` && index > LINES.indexOf('jobs:'));
  if (start === -1) throw new Error(`No job "${id}"`);
  const next = keys[keys.indexOf(id) + 1];
  const nextStart = next === undefined ? LINES.length : LINES.findIndex((line, index) => line === `  ${next}:` && index > start);
  // A comment block directly above the next job's key describes that job.
  let end = nextStart;
  while (end > start && (LINES[end - 1] ?? '').trimStart().startsWith('#')) end -= 1;
  return LINES.slice(start, end).join('\n');
}

const stepsOf = (job: string): string[] => job.split('\n').filter((line) => /^\s*- name:/.test(line));

describe('CI workflow', () => {
  it('STD-01: no run script has a GitHub expression expanded into it', () => {
    const offenders = runBlocks().filter((block) => block.includes('${{'));
    expect(offenders).toEqual([]);
  });

  it('STD-01: the base branch reaches the changed-code step through the environment', () => {
    const step = stepNamed('Stage 11: coverage of changed code');
    expect(step).toContain('BASE_REF: ${{ github.base_ref }}');
    expect(step).toContain('"origin/${BASE_REF}"');
  });

  it('STD-12: only a pull request run is cancelled by a newer one', () => {
    expect(WORKFLOW).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
    expect(WORKFLOW).not.toMatch(/cancel-in-progress:\s*true/);
  });

  it('QLT-05: stage 6 measures pure code on unit tests and does not decide changed-code coverage', () => {
    const step = stepNamed('Stage 6: unit tests');
    expect(step).toContain('tests/unit --coverage');
    expect(step).toContain("--coverage.include='src/lib/**/*.{ts,tsx}'");
    expect(step).toContain("--coverage.include='scripts/lib/**/*.ts'");
    expect(WORKFLOW).not.toContain('Stage 6: coverage of changed code');
  });

  it('QLT-05: stage 11 runs every Vitest level in one coverage run, then the changed-code gate', () => {
    expect(stepNamed('Stage 11: integration')).toContain('npx vitest run tests/unit tests/integration tests/security tests/acceptance --coverage');
    expect(WORKFLOW.indexOf('Stage 11: integration')).toBeLessThan(WORKFLOW.indexOf('Stage 11: coverage of changed code'));
  });

  it('AC-4: the trigger is pull_request, never pull_request_target, and the job keeps its required-check name', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}pull_request:/m);
    const withoutComments = LINES.filter((line) => !line.trimStart().startsWith('#')).join('\n');
    expect(withoutComments).not.toContain('pull_request_target');
    expect(WORKFLOW).toContain('name: Stages 1 to 11');
  });

  it('AC-4: every third-party action is pinned to a commit SHA', () => {
    const uses = LINES.filter((line) => /^\s*(?:- )?uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toMatch(/@[0-9a-f]{40}\b/);
  });

  it('STORY-10.02 AC-8: stage 12 (E2E) is switched on and blocks merge, and stage 13 is still off', () => {
    const e2e = stepNamed('Stage 12: E2E');
    expect(e2e).not.toMatch(/^\s*if:/m);
    // The install moved to stage 12a (AQP-206), so stage 12 is the tests and nothing else.
    expect(e2e).not.toContain('playwright install');
    expect(e2e).toContain('npx playwright test');
    expect(stepNamed('Stage 13: image')).toContain('if: ${{ false }}');
    // It blocks merge because the shard jobs are needed by the required check (AQP-208 AC-4, below).
    expect(jobText('required')).toContain('needs: [verify, e2e]');
  });

  it('AQP-208 AC-4: three jobs, named as the story says; only the fan-in job has `needs`, so the first two start together', () => {
    expect(jobIds()).toEqual(['verify', 'e2e', 'required']);
    expect(jobText('verify')).toMatch(/^ {4}name: Stages 1 to 11b$/m);
    expect(jobText('e2e')).toContain('    name: "Stage 12: E2E (shard ${{ matrix.shard }} of ${{ strategy.job-total }})"');
    expect(jobText('required')).toMatch(/^ {4}name: Stages 1 to 11$/m);
    // The required check's name appears once as a job name, and the renamed job's name is not the required one.
    expect(WORKFLOW.match(/^ {4}name: Stages 1 to 11$/gm)).toHaveLength(1);
    // No `needs` between `Stages 1 to 11b` and the shards: only the fan-in has one, and it needs every other job.
    expect(WORKFLOW.match(/^\s+needs:/gm)).toHaveLength(1);
    expect(jobText('verify')).not.toMatch(/^\s+needs:/m);
    expect(jobText('e2e')).not.toMatch(/^\s+needs:/m);
    expect(jobText('required')).toMatch(/^ {4}needs: \[verify, e2e\]$/m);
  });

  it('AQP-208 AC-4: the fan-in job runs always, needs success from every needed job, and cannot be skipped past', () => {
    const required = jobText('required');
    expect(required).toMatch(/^ {4}if: \$\{\{ always\(\) \}\}$/m);
    expect(required).not.toContain('continue-on-error');
    // No `success()` or `!cancelled()` shortcut: those let a skipped or cancelled needed job through.
    expect(required).not.toMatch(/success\(\)|cancelled\(\)|failure\(\)/);
    // The results arrive through the environment (STD-01), one per needed job, for every job in `needs`.
    for (const id of ['verify', 'e2e']) {
      expect(required, id).toContain(`RESULT_${id.toUpperCase()}: \${{ needs.${id}.result }}`);
    }
    expect(required).toContain('for variable in RESULT_VERIFY RESULT_E2E; do');
    expect(required).toContain('[ "${result}" = "success" ]');
    expect(required.match(/needs\.[\w-]+\.result/g)).toHaveLength(2);
  });

  // The script of the fan-in step is run in bash, with each combination of results, in tests/unit/ci-fan-in.test.ts.

  it('AQP-208 STD-04: the fan-in job holds no permission at all, because it reads no repository content and calls no API', () => {
    const required = jobText('required');
    expect(required).toMatch(/^ {4}permissions: \{\}$/m);
    // No checkout, no action and no token in that job: only its own script runs.
    expect(required).not.toMatch(/^\s*uses:/m);
    expect(required).not.toMatch(/GITHUB_TOKEN|:\s*(read|write)\b/);
  });

  it('AQP-208 AC-4: the shards are one matrix job, every shard reports, and the command carries only --shard', () => {
    const e2e = jobText('e2e');
    expect(e2e).toMatch(/^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}shard: \[[\d, ]+\]$/m);
    const step = stepNamed('Stage 12: E2E');
    expect(step).toContain('SHARD_INDEX: ${{ matrix.shard }}');
    expect(step).toContain('SHARD_TOTAL: ${{ strategy.job-total }}');
    expect(step).toMatch(/^\s*npx playwright test --shard="\$\{SHARD_INDEX\}\/\$\{SHARD_TOTAL\}"\s*$/m);
    // The width, worker and retry settings live in playwright.config.ts (tests/unit/one-width-tag.test.ts reads them),
    // so a flag here would override them silently. `--shard` is the one flag this step adds.
    for (const flag of ['--workers', '--project', '--grep', '--retries', '--timeout', '--max-failures', '--last-failed']) {
      expect(step, flag).not.toContain(flag);
    }
    expect(step).not.toContain('continue-on-error');
    expect(step).not.toMatch(/^\s*if:/m);
  });

  it('AQP-227 AC-1 (AQP-208 AC-1): the shard count is one constant, the length of the matrix, and it is exactly [1, 2, 3]', () => {
    const list = /^ {8}shard: \[([\d, ]+)\]$/m.exec(jobText('e2e'))?.[1];
    const shards = (list ?? '').split(',').map((entry) => Number(entry.trim()));
    // Pinned to three shards (test strategy 10.5, "Three shards"): a silent return to two fails here, and a fourth shard
    // needs test strategy 10.5 to say so first, then this line.
    expect(shards).toEqual([1, 2, 3]);
    // The total is read from the matrix, never written a second time.
    expect(WORKFLOW).not.toMatch(/--shard[= ]"?\d/);
    expect(WORKFLOW).not.toMatch(/\bSHARD_TOTAL:\s*'?\d/);
  });

  it('AQP-208 AC-6: each shard builds for itself, has its own database, migrates it, and runs stage 12a before the tests', () => {
    const e2e = jobText('e2e');
    const names = stepsOf(e2e).map((line) => line.replace(/^\s*- name:\s*"?/, '').replace(/"$/, ''));
    const position = (prefix: string): number => {
      const index = names.findIndex((name) => name.startsWith(prefix));
      if (index === -1) throw new Error(`No step "${prefix}"`);
      return index;
    };
    expect(e2e).toContain('postgres:17@sha256:');
    expect(stepNamed('Shard: build')).toContain('npx next build');
    expect(stepNamed('Shard: migrations')).toContain('npx prisma migrate deploy');
    expect(position('Shard: install')).toBeLessThan(position('Shard: build'));
    expect(position('Shard: create the two database roles')).toBeLessThan(position('Shard: migrations'));
    expect(position('Shard: migrations')).toBeLessThan(position('Stage 12a'));
    expect(position('Shard: build')).toBeLessThan(position('Stage 12: E2E'));
    expect(position('Stage 12a')).toBeLessThan(position('Stage 12: E2E'));
    // Nothing passes between jobs.
    expect(WORKFLOW).not.toMatch(/upload-artifact|download-artifact|actions\/cache\/(save|restore)/);
    // The throwaway passwords are made in the job and masked before use, as in `verify`.
    const roles = stepNamed('Shard: create the two database roles');
    expect(roles.indexOf('::add-mask::${owner}')).toBeGreaterThan(roles.indexOf('openssl rand'));
    expect(roles).not.toContain('secrets.');
    // `verify` no longer runs stage 12: the shards do.
    expect(stepsOf(jobText('verify')).join('\n')).not.toContain('Stage 12');
  });

  it('AQP-208 AC-6: stages 1 to 11b are not repeated in the shards, and the shards are not repeated in `verify`', () => {
    const e2e = jobText('e2e');
    for (const stage of ['Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6', 'Stage 7', 'Stage 8', 'Stage 9', 'Stage 11']) {
      expect(e2e, stage).not.toContain(`- name: "${stage}`);
    }
    expect(jobText('verify')).not.toContain('playwright test');
  });

  it('AQP-199 AC-6: the workflow keeps least-privilege permissions, no repository secret and no fork-exposed trigger', () => {
    expect(WORKFLOW).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(WORKFLOW).not.toMatch(/\$\{\{\s*secrets\./);
    const withoutComments = LINES.filter((line) => !line.trimStart().startsWith('#')).join('\n');
    expect(withoutComments).not.toMatch(/:\s*write\b/);
    expect(withoutComments).not.toContain('pull_request_target');
  });

  it('STORY-10.10 AC-5: step 11b runs the JS budget inside the required job, after stage 11 and before stage 12, and blocks merge', () => {
    const budget = stepNamed('Stage 11b: JS budget');
    expect(budget).not.toMatch(/^\s*if:/m);
    expect(budget).not.toContain('continue-on-error');
    expect(budget).toContain('npx tsx scripts/ensure-measurement-user.ts');
    expect(budget).toContain('npx tsx scripts/check-js-budget.ts');
    expect(budget.indexOf('ensure-measurement-user')).toBeLessThan(budget.indexOf('check-js-budget'));
    expect(WORKFLOW.indexOf('Stage 11: coverage of changed code')).toBeLessThan(WORKFLOW.indexOf('name: "Stage 11b'));
    expect(WORKFLOW.indexOf('name: "Stage 11b')).toBeLessThan(WORKFLOW.indexOf('name: "Stage 12'));
    // The step is inside the job `Stages 1 to 11b`, which the required check `Stages 1 to 11` needs (AQP-208).
    expect(jobText('verify')).toContain('- name: "Stage 11b: JS budget');
    expect(jobText('required')).toContain('needs: [verify, e2e]');
  });

  it('STORY-10.10 AC-5: step 11b makes its password in the job, masks it, and uses no repository secret', () => {
    const budget = stepNamed('Stage 11b: JS budget');
    expect(budget).toContain('openssl rand -hex 16');
    expect(budget.indexOf('::add-mask::')).toBeGreaterThan(budget.indexOf('openssl rand'));
    expect(budget).not.toContain('secrets.');
    expect(WORKFLOW).not.toMatch(/\$\{\{\s*secrets\./);
  });

  it('#17 (PRF-02 of AQP-27, due with stage 12): the Next.js build cache and the Playwright browsers are cached, before the stages that use them', () => {
    const next = stepNamed('Cache the Next.js build cache');
    expect(next).toMatch(/uses: actions\/cache@[0-9a-f]{40}/);
    expect(next).toContain('path: .next/cache');
    expect(next).toContain("hashFiles('package-lock.json')");
    expect(WORKFLOW.indexOf('Cache the Next.js build cache')).toBeLessThan(WORKFLOW.indexOf('name: "Stage 9: build'));

    const browsers = stepNamed('Cache the Playwright browsers');
    expect(browsers).toMatch(/uses: actions\/cache@[0-9a-f]{40}/);
    expect(browsers).toContain('path: ~/.cache/ms-playwright');
    expect(WORKFLOW.indexOf('Cache the Playwright browsers')).toBeLessThan(WORKFLOW.indexOf('name: "Stage 12a'));
  });

  it('DEF-015 (AQP-206): the browser cache is keyed on the Playwright version, not on the whole lockfile', () => {
    const browsers = stepNamed('Cache the Playwright browsers');
    expect(browsers).toContain('key: playwright-${{ runner.os }}-${{ steps.versions.outputs.playwright }}');
    expect(browsers).not.toContain('hashFiles');
    // The version is read from the installed package, before any cache step uses it.
    const versions = stepNamed('Read the Playwright and runner image versions');
    expect(versions).toContain("require('@playwright/test/package.json').version");
    // The system-package key: the manual epoch, the runner image and the Playwright version.
    expect(versions).toContain('debs_key=playwright-debs-e${CACHE_EPOCH}-${ImageOS}-${ImageVersion}-${playwright}');
    expect(WORKFLOW.indexOf('Read the Playwright and runner image versions')).toBeLessThan(WORKFLOW.indexOf('name: "Cache the Playwright browsers'));
  });

  it('DEF-015 (AQP-206): the system packages are cached by runner image and Playwright version, with the same pinned cache action', () => {
    const debs = stepNamed('Cache the Playwright system packages');
    expect(debs).toMatch(/uses: actions\/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9/);
    expect(debs).toContain('id: debs');
    expect(debs).toContain('path: ${{ runner.temp }}/playwright-debs');
    expect(debs).toContain('key: ${{ steps.versions.outputs.debs_key }}');
    // No new action: every `uses:` in the workflow is one of the three already pinned before this change.
    const actions = new Set(LINES.filter((line) => /^\s*(?:- )?uses:/.test(line)).map((line) => line.replace(/^\s*(?:- )?uses:\s*/, '').split('@')[0]));
    expect([...actions].sort()).toEqual(['actions/cache', 'actions/checkout', 'actions/setup-node']);
  });

  it('DEF-015 (AQP-206): stage 12a installs the browser and system packages in its own bounded step, before stage 12', () => {
    const install = stepNamed('Stage 12a: Playwright browser and system packages');
    expect(install).toContain('timeout-minutes: 8');
    expect(install).toContain('PLAYWRIGHT_DEBS_CACHE_HIT: ${{ steps.debs.outputs.cache-hit }}');
    // The fallback warning prints this key (PRF-03 / QLT-81), so it is the same value the cache step used.
    expect(install).toContain('PLAYWRIGHT_DEBS_CACHE_KEY: ${{ steps.versions.outputs.debs_key }}');
    expect(install).toContain('bash scripts/ci/playwright-system-deps.sh');
    expect(install).not.toMatch(/^\s*if:/m);
    expect(install).not.toContain('continue-on-error');
    // The old unbounded command is gone from the whole workflow.
    expect(WORKFLOW.replace(/#.*$/gm, '')).not.toContain('--with-deps');
    expect(WORKFLOW.indexOf('Cache the Playwright system packages')).toBeLessThan(WORKFLOW.indexOf('name: "Stage 12a'));
    expect(WORKFLOW.indexOf('- name: "Stage 12a')).toBeLessThan(WORKFLOW.indexOf('- name: "Stage 12: E2E'));
    expect(WORKFLOW.indexOf('name: "Stage 11b')).toBeLessThan(WORKFLOW.indexOf('name: "Stage 12a'));
    // Stage 12a runs in every shard job (AQP-208 AC-6), and nowhere else.
    expect(jobText('e2e')).toContain('- name: "Stage 12a: Playwright browser and system packages"');
    expect(jobText('verify')).not.toContain('Stage 12a');
    expect(WORKFLOW.match(/^ {4}name: Stages 1 to 11$/gm)).toHaveLength(1);
  });

  it('PRF-03 / QLT-81 (AQP-206): CACHE_EPOCH is a single quoted constant in the job environment, raised by hand; there is no automatic re-save', () => {
    const epochs = LINES.filter((line) => /^\s*CACHE_EPOCH:/.test(line));
    expect(epochs).toHaveLength(1);
    expect(epochs[0]).toMatch(/^ {2}CACHE_EPOCH: '\d+'$/);
    expect(WORKFLOW.indexOf('CACHE_EPOCH:')).toBeLessThan(WORKFLOW.indexOf('jobs:'));
    // Not saved a second time under another key: the cache action is used as one step, never split into save steps.
    expect(WORKFLOW).not.toMatch(/actions\/cache\/(save|restore)/);
  });

  it('PRF-03 / QLT-81 (AQP-206): the README documents both ways to replace a bad system-package cache entry', () => {
    const readme = readFileSync(fileURLToPath(new URL('../../README.md', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
    const section = readme.slice(readme.indexOf('### Playwright install cache'), readme.indexOf('## Performance checks'));
    expect(section).toContain('gh cache delete');
    expect(section).toContain('CACHE_EPOCH');
    expect(section).toContain('actions: write');
  });

  it('DEF-015 (AQP-206): the script bounds apt on a miss and falls back to it when the cached install fails', () => {
    const script = readFileSync(fileURLToPath(new URL('../../scripts/ci/playwright-system-deps.sh', import.meta.url)), 'utf8');
    const code = script
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(code).toContain('Acquire::http::Timeout "20";');
    expect(code).toContain('Acquire::Retries "3";');
    expect(code).toContain('sudo dpkg -i');
    expect(code).toContain('npx playwright install-deps chromium');
    expect(code).toContain('npx playwright install chromium');
    expect(code).not.toContain('--with-deps');
    // AQP-216 AC-3 to AC-5, STD-02: the download is bounded, not the connection. The limits are READ from the script and
    // from the workflow, so a changed limit fails here: 45 s for the update, 90 s for the download, three tries, and the
    // 8-minute step cap above them as the last bound (three tries take 6.75 minutes at worst).
    const limit = (pattern: RegExp, text: string): number => Number(pattern.exec(text)?.[1] ?? Number.NaN);
    const updateLimit = limit(/^update_timeout="\$\{APT_UPDATE_TIMEOUT:-(\d+)\}"$/m, code);
    const downloadLimit = limit(/^download_timeout="\$\{APT_DOWNLOAD_TIMEOUT:-(\d+)\}"$/m, code);
    const tries = limit(/^max_tries=(\d+)$/m, code);
    const stepCapMinutes = limit(/timeout-minutes: (\d+)/, stepNamed('Stage 12a: Playwright browser and system packages'));
    expect([updateLimit, downloadLimit, tries, stepCapMinutes]).toEqual([45, 90, 3, 8]);
    expect(tries * (updateLimit + downloadLimit)).toBeLessThan(stepCapMinutes * 60);
    expect(code).toContain('apt-get install --download-only');
    expect(code).toContain('apt-get install -y --no-download');
    expect(code).toContain('fallback_mirror="archive.ubuntu.com"');
    // QLT-95: every apt command of a try takes the try's own view, and the update fails on a dead mirror.
    expect(code).toContain('--error-on=any');
    expect(code).toContain('Dir::Etc::SourceList=/dev/null');
    expect(code).toContain('Dir::State::Lists=');
    // tests/unit/playwright-system-deps.test.ts runs it against fake programs for the hit, miss and fallback paths.
  });

  it('STD-05: stage 9 checks the build output, so /design-system is shown to be a 404 in production on every run', () => {
    const build = stepNamed('Stage 9: build');
    expect(build).toContain('npx next build');
    expect(build.indexOf('npx tsx scripts/check-production-routes.ts')).toBeGreaterThan(build.indexOf('npx next build'));
  });

  it('STD-02: the README says stage 12 is on and blocks merge, not that it is disabled', () => {
    const readme = readFileSync(fileURLToPath(new URL('../../README.md', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
    const section = readme.slice(readme.indexOf('## Continuous integration'), readme.indexOf('## Secret scan and its baseline'));
    expect(section).toMatch(/stage 12 is on/i);
    expect(section).toMatch(/blocks merge/i);
    expect(section).not.toMatch(/stages 12 \(end-to-end\) and 13 \(image\) are present and disabled/);
  });

  it('STD-03: the name `Stages 1 to 11` is kept because it is the required check, and it also decides stage 12', () => {
    expect(WORKFLOW).toContain('name: Stages 1 to 11');
    expect(WORKFLOW).toMatch(/#.*required status check.*stage 12/is);
    expect(LINES[0]).toMatch(/stages 1 to 12/i);
    // The fan-in job's own comment says the same, so a reader of the job sees why the name must not change.
    expect(WORKFLOW).toMatch(/Its name is the required status check on master and must not change/);
  });

  it('AC-5: the secret scan runs with the accepted-findings baseline and --redact', () => {
    const step = stepNamed('Stage 2: secret scan');
    expect(step).toContain('--redact');
    expect(step).toContain('--baseline-path .gitleaks-baseline.json');
  });
});
