import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * AQP-208 AC-4: the fan-in job `Stages 1 to 11` passes only when every job it needs has the result `success`. A workflow
 * cannot run in a unit test, so the step's own script is cut out of `ci.yml` and run in bash with each combination of
 * results, against the three negative controls that were run for real on a throwaway pull request.
 *
 * Every scenario runs once, in `beforeAll`, under the shared hook limit (vitest.config.ts, DL-057), all at the same time,
 * and the tests read the recorded outcomes. Starting a bash is slow on a Windows checkout (QLT-80, QLT-85), and that
 * cost belongs in a hook, not in a test with the 5 s test limit. The structure of the job is checked in ci-workflow.test.ts.
 */

const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8').replaceAll('\r\n', '\n');
const BASH_AVAILABLE = spawnSync('bash', ['--version']).error === undefined;

/** The script of the fan-in step, dedented the way YAML dedents a block scalar. */
function fanInScript(): string {
  const lines = WORKFLOW.split('\n');
  const start = lines.findIndex((line) => line.includes('- name: Require every needed job to have succeeded'));
  if (start === -1) throw new Error('No fan-in step');
  const run = lines.findIndex((line, index) => index > start && /^\s*run: \|\s*$/.test(line));
  if (run === -1) throw new Error('No script in the fan-in step');
  const runIndent = (lines[run] ?? '').length - (lines[run] ?? '').trimStart().length;
  const body: string[] = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() !== '' && line.length - line.trimStart().length <= runIndent) break;
    body.push(line);
  }
  const indent = Math.min(...body.filter((line) => line.trim() !== '').map((line) => line.length - line.trimStart().length));
  return body.map((line) => line.slice(indent)).join('\n');
}

interface Outcome {
  readonly status: number | null;
  readonly output: string;
}

/** Runs the script as the runner does (`bash -e`) with the results of the two needed jobs. */
function fanIn(script: string, verify: string, e2e: string): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-e', '-c', script], { env: { ...process.env, RESULT_VERIFY: verify, RESULT_E2E: e2e } });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({ status, output });
    });
  });
}

const NOT_SUCCESS = ['failure', 'cancelled', 'skipped', ''] as const;

describe.skipIf(!BASH_AVAILABLE)('AQP-208 AC-4: the fan-in script, run in bash', () => {
  const outcomes = new Map<string, Outcome>();
  const key = (verify: string, e2e: string): string => `${verify}|${e2e}`;
  const outcome = (verify: string, e2e: string): Outcome => {
    const found = outcomes.get(key(verify, e2e));
    if (found === undefined) throw new Error(`No outcome recorded for verify=${verify}, e2e=${e2e}`);
    return found;
  };

  beforeAll(async () => {
    const script = fanInScript();
    const combinations: Array<[string, string]> = [['success', 'success']];
    for (const bad of NOT_SUCCESS) combinations.push(['success', bad], [bad, 'success'], [bad, bad]);
    const results = await Promise.all(combinations.map(([verify, e2e]) => fanIn(script, verify, e2e)));
    combinations.forEach(([verify, e2e], index) => {
      const result = results[index];
      if (result !== undefined) outcomes.set(key(verify, e2e), result);
    });
  });

  it('passes only when every needed job succeeded', () => {
    expect(outcome('success', 'success').status).toBe(0);
  });

  it('fails when any needed job failed, was cancelled or was skipped, or has no result', () => {
    for (const bad of NOT_SUCCESS) {
      expect(outcome('success', bad).status, `E2E ${bad}`).toBe(1);
      expect(outcome(bad, 'success').status, `VERIFY ${bad}`).toBe(1);
      expect(outcome(bad, bad).status, `both ${bad}`).toBe(1);
    }
  });

  it('names the job that did not succeed, and the result', () => {
    const { output } = outcome('success', 'cancelled');
    expect(output).toContain("::error::E2E finished as 'cancelled', not 'success'");
    expect(output).toContain('VERIFY: success');
    expect(outcome('skipped', 'success').output).toContain("::error::VERIFY finished as 'skipped', not 'success'");
  });
});
