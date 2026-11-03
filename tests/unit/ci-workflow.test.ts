import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * AC-4 and the review findings on the workflow (STD-01, STD-12, QLT-05). The workflow cannot run in a
 * unit test, so these read its text: a regression here would otherwise be noticed only on a runner.
 */

const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8');
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

  it('AC-5: the secret scan runs with the accepted-findings baseline and --redact', () => {
    const step = stepNamed('Stage 2: secret scan');
    expect(step).toContain('--redact');
    expect(step).toContain('--baseline-path .gitleaks-baseline.json');
  });
});
