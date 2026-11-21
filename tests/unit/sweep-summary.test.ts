import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { firstErrorLine, markdown, outcomeOf, summarise } from '../../scripts/lib/sweep-summary';

/**
 * STORY-10.08 AC-6 and AC-7: the summary of the sweep run reads Playwright's JSON report and counts, by project and by engine, the tests that passed, failed, were flaky or were skipped, and names each
 * failure. It is what the pull request body and the NFR-016/018/019 evidence quote, so a miscount would be a wrong claim. The reports below have the shape of Playwright 1.65's JSON reporter.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = `${ROOT}scripts/summarise-sweep.ts`;

type TestStatus = 'expected' | 'unexpected' | 'flaky' | 'skipped';
const result = (status: string, message?: string) => ({ status, duration: 10, ...(message === undefined ? {} : { error: { message } }) });
const entry = (projectName: string, status: TestStatus, results = [result(status === 'unexpected' ? 'failed' : 'passed')]) => ({ projectName, status, results });

const REPORT = {
  suites: [
    {
      title: 'screens.spec.ts',
      specs: [{ title: 'SCR-03 as LEAD', file: 'screens.spec.ts', tests: [entry('chromium-360', 'expected'), entry('chromium-768', 'expected'), entry('chromium-1366', 'expected')] }],
      suites: [
        {
          title: 'AC-6: the five journeys',
          specs: [
            {
              title: 'sign-in',
              file: 'browsers.spec.ts',
              tests: [
                entry('chromium-1366', 'expected'),
                entry('firefox-1366', 'expected'),
                entry('webkit-1366', 'unexpected', [result('failed', '\u001B[31mError: expect(received).toBe(expected)\u001B[39m\n\nExpected: true'), result('failed', 'Error: the session cookie was not kept\nmore')]),
                entry('webkit-360', 'skipped', [result('skipped')]),
                entry('firefox-360', 'flaky', [result('failed', 'Error: timeout of 15000ms exceeded'), result('passed')]),
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('outcomeOf', () => {
  it('maps the four statuses of the JSON reporter, and anything unknown to failed', () => {
    expect(outcomeOf('expected')).toBe('passed');
    expect(outcomeOf('unexpected')).toBe('failed');
    expect(outcomeOf('flaky')).toBe('flaky');
    expect(outcomeOf('skipped')).toBe('skipped');
    expect(outcomeOf('timedOut')).toBe('failed');
  });
});

describe('firstErrorLine', () => {
  it('takes the last attempt that has an error, strips colour codes and blank lines, and cuts a long line', () => {
    expect(firstErrorLine([result('failed', 'Error: first attempt'), result('failed', '\u001B[31m\n  Error: last attempt\u001B[39m\nmore')])).toBe('Error: last attempt');
    expect(firstErrorLine([result('failed', 'x'.repeat(400))])).toBe(`${'x'.repeat(300)}...`);
  });

  it('says so when the report holds no message, rather than printing an empty cell', () => {
    expect(firstErrorLine([result('failed')])).toBe('no message in the report');
    expect(firstErrorLine([])).toBe('no message in the report');
  });
});

describe('summarise', () => {
  const summary = summarise(REPORT);

  it('counts each project, in the order the projects first appear', () => {
    expect([...summary.projects.keys()]).toEqual(['chromium-360', 'chromium-768', 'chromium-1366', 'firefox-1366', 'webkit-1366', 'webkit-360', 'firefox-360']);
    expect(summary.projects.get('chromium-1366')).toEqual({ passed: 2, failed: 0, flaky: 0, skipped: 0 });
    expect(summary.projects.get('webkit-1366')).toEqual({ passed: 0, failed: 1, flaky: 0, skipped: 0 });
    expect(summary.projects.get('webkit-360')).toEqual({ passed: 0, failed: 0, flaky: 0, skipped: 1 });
    expect(summary.projects.get('firefox-360')).toEqual({ passed: 0, failed: 0, flaky: 1, skipped: 0 });
  });

  it('adds the projects up by engine, so the browser matrix reads per browser', () => {
    expect(summary.engines.get('chromium')).toEqual({ passed: 4, failed: 0, flaky: 0, skipped: 0 });
    expect(summary.engines.get('firefox')).toEqual({ passed: 1, failed: 0, flaky: 1, skipped: 0 });
    expect(summary.engines.get('webkit')).toEqual({ passed: 0, failed: 1, flaky: 0, skipped: 1 });
  });

  it('names a failure by project, file, describe and test, with the first line of its last error', () => {
    expect(summary.failures).toEqual([{ project: 'webkit-1366', test: 'screens.spec.ts > AC-6: the five journeys > sign-in', message: 'Error: the session cookie was not kept' }]);
  });

  it('reports a test that passed only on the retry, so the retry is not hidden', () => {
    expect(summary.flaky).toEqual([{ project: 'firefox-360', test: 'screens.spec.ts > AC-6: the five journeys > sign-in', message: 'Error: timeout of 15000ms exceeded' }]);
  });

  it('refuses a document that is not a report, so a wrong file is not read as a clean run', () => {
    expect(() => summarise({ nothing: true })).toThrow();
    expect(() => summarise(null)).toThrow();
  });

  it('counts an empty report as nothing at all', () => {
    const none = summarise({ suites: [] });
    expect(none.projects.size).toBe(0);
    expect(none.failures).toEqual([]);
  });
});

describe('markdown', () => {
  const text = markdown(summarise(REPORT));

  it('has a table by engine and one by project, with the four counts', () => {
    expect(text).toContain('#### By engine');
    expect(text).toContain('| webkit | 0 | 1 | 0 | 1 |');
    expect(text).toContain('| chromium-1366 | 2 | 0 | 0 | 0 |');
  });

  it('lists the failures and the retries, and escapes a pipe so a cell cannot break the table', () => {
    expect(text).toContain('#### Failures');
    expect(text).toContain('| webkit-1366 | screens.spec.ts > AC-6: the five journeys > sign-in | Error: the session cookie was not kept |');
    expect(text).toContain('#### Passed only on the retry');
    const piped = markdown(summarise({ suites: [{ title: 'a|b', specs: [{ title: 't', tests: [entry('chromium-360', 'unexpected', [result('failed', 'Error: a | b')])] }] }] }));
    expect(piped).toContain('a\\|b > t');
    expect(piped).toContain('Error: a \\| b');
  });

  it('has no failures section for a clean run', () => {
    const clean = markdown(summarise({ suites: [{ title: 'f', specs: [{ title: 't', tests: [entry('chromium-360', 'expected')] }] }] }));
    expect(clean).not.toContain('#### Failures');
    expect(clean).not.toContain('#### Passed only on the retry');
  });
});

describe('scripts/summarise-sweep.ts', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'sweep-summary-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } });

  it('prints the summary and appends it to the job summary file', () => {
    const report = join(scratch, 'report.json');
    const summaryFile = join(scratch, 'summary.md');
    writeFileSync(report, JSON.stringify(REPORT));
    writeFileSync(summaryFile, '');
    const finished = run([report], { GITHUB_STEP_SUMMARY: summaryFile });
    expect(finished.status).toBe(0);
    expect(finished.stdout).toContain('### Sweep, keyboard flows and browser matrix (NFR-016, NFR-018, NFR-019)');
    expect(readFileSync(summaryFile, 'utf8')).toBe(finished.stdout);
  });

  it('exits 1, naming the problem, when the report is missing or is not a report', () => {
    expect(run([join(scratch, 'absent.json')]).status).toBe(1);
    const bad = join(scratch, 'bad.json');
    writeFileSync(bad, '{"nothing":true}');
    const finished = run([bad]);
    expect(finished.status).toBe(1);
    expect(finished.stderr).toContain('The sweep summary could not be written');
    expect(run([]).stderr).toContain('The path of the JSON report is required');
  });
});
