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
  const start = LINES.findIndex((line) => line.includes(`name: "${prefix}`));
  if (start === -1) throw new Error(`No step named "${prefix}..."`);
  const rest = LINES.slice(start + 1);
  const end = rest.findIndex((line) => /^\s*- name:/.test(line));
  return [LINES[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

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
    expect(e2e).toContain('npx playwright install --with-deps chromium');
    expect(e2e).toContain('npx playwright test');
    expect(stepNamed('Stage 13: image')).toContain('if: ${{ false }}');
  });

  it('AQP-199 AC-4: stage 12 runs the whole suite in the one required job, with no flag that narrows or reshapes it', () => {
    const e2e = stepNamed('Stage 12: E2E');
    // The width, worker and retry settings live in playwright.config.ts (tests/unit/one-width-tag.test.ts reads them),
    // so a flag here would override them silently.
    for (const flag of ['--workers', '--project', '--grep', '--shard', '--retries', '--timeout', '--max-failures', '--last-failed']) {
      expect(e2e, flag).not.toContain(flag);
    }
    expect(e2e).toMatch(/^\s*npx playwright test\s*$/m);
    expect(e2e).not.toContain('continue-on-error');
    // One job, still named for the required check, and no job that `needs` another (a shard job would need a fan-in job).
    expect(LINES.slice(LINES.indexOf('jobs:') + 1).filter((line) => /^ {2}[\w-]+:\s*$/.test(line))).toEqual(['  verify:']);
    expect(WORKFLOW.match(/^ {4}name: Stages 1 to 11$/gm)).toHaveLength(1);
    expect(WORKFLOW).not.toMatch(/^\s+needs:/m);
    expect(WORKFLOW).not.toMatch(/^\s+strategy:/m);
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
    // One job, so the step is inside the job named "Stages 1 to 11", the required check.
    expect(LINES.slice(LINES.indexOf('jobs:') + 1).filter((line) => /^ {2}[\w-]+:\s*$/.test(line))).toEqual(['  verify:']);
    expect(WORKFLOW).toContain('name: Stages 1 to 11');
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
    expect(browsers).toContain("hashFiles('package-lock.json')");
    expect(WORKFLOW.indexOf('Cache the Playwright browsers')).toBeLessThan(WORKFLOW.indexOf('name: "Stage 12: E2E'));
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

  it('STD-03: the job name is kept because it is the required check, and says that it now also runs stage 12', () => {
    expect(WORKFLOW).toContain('name: Stages 1 to 11');
    expect(WORKFLOW).toMatch(/#.*required status check.*stage 12/is);
    expect(LINES[0]).toMatch(/stages 1 to 12/i);
  });

  it('AC-5: the secret scan runs with the accepted-findings baseline and --redact', () => {
    const step = stepNamed('Stage 2: secret scan');
    expect(step).toContain('--redact');
    expect(step).toContain('--baseline-path .gitleaks-baseline.json');
  });
});
