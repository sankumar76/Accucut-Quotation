/**
 * The summary of the sweep run (STORY-10.08 AC-6, AC-7; test strategy 10.9): from Playwright's JSON report of `playwright.sweep.config.ts` it counts, for each project (an engine at a
 * width), the tests that passed, failed, were flaky (failed, then passed on the one retry) and were skipped, adds them up by engine, and names each failure with its project, test and first
 * line of error. The pull request body and the Done evidence of NFR-016, NFR-018 and NFR-019 are this table. The functions are pure: the file is read by `scripts/summarise-sweep.ts`.
 */
import { z } from 'zod';

const resultShape = z.object({ status: z.string(), duration: z.number().optional(), error: z.object({ message: z.string().optional() }).optional() });
const testShape = z.object({ projectName: z.string(), status: z.string(), results: z.array(resultShape) });
const specShape = z.object({ title: z.string(), file: z.string().optional(), tests: z.array(testShape) });

interface SuiteJson {
  readonly title: string;
  readonly specs?: ReadonlyArray<z.infer<typeof specShape>> | undefined;
  readonly suites?: ReadonlyArray<SuiteJson> | undefined;
}

const suiteShape: z.ZodType<SuiteJson> = z.lazy(() => z.object({ title: z.string(), specs: z.array(specShape).optional(), suites: z.array(suiteShape).optional() }));
const reportShape = z.object({ suites: z.array(suiteShape) });

/** What Playwright calls the four outcomes of a test: `expected` passed, `unexpected` failed, `flaky` passed on a retry, `skipped`. */
export type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface Counts {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
}

export interface Failure {
  readonly project: string;
  readonly test: string;
  readonly message: string;
}

export interface SweepSummary {
  /** Counts by project, in the order the projects first appear. */
  readonly projects: ReadonlyMap<string, Counts>;
  /** Counts by engine (`chromium`, `firefox`, `webkit`, and `setup`). */
  readonly engines: ReadonlyMap<string, Counts>;
  readonly failures: ReadonlyArray<Failure>;
  /** Names of the tests that passed only on the retry: the retry is reported, not hidden (AC-8). */
  readonly flaky: ReadonlyArray<Failure>;
}

const ANSI = /\u001B\[[0-9;]*m/g;
const MESSAGE_LIMIT = 300;

export function outcomeOf(status: string): Outcome {
  if (status === 'expected') return 'passed';
  if (status === 'flaky') return 'flaky';
  if (status === 'skipped') return 'skipped';
  return 'failed';
}

/** The first line of the last attempt's error that says something, without colour codes and cut to a readable length. */
export function firstErrorLine(results: ReadonlyArray<z.infer<typeof resultShape>>): string {
  const message = [...results].reverse().find((result) => (result.error?.message ?? '') !== '')?.error?.message ?? 'no message in the report';
  const line = message
    .replace(ANSI, '')
    .split('\n')
    .map((text) => text.trim())
    .find((text) => text !== '');
  const text = line ?? 'no message in the report';
  return text.length > MESSAGE_LIMIT ? `${text.slice(0, MESSAGE_LIMIT)}...` : text;
}

const empty = (): Counts => ({ passed: 0, failed: 0, flaky: 0, skipped: 0 });
const engineOf = (project: string): string => project.split('-')[0] ?? project;

export function summarise(json: unknown): SweepSummary {
  const report = reportShape.parse(json);
  const projects = new Map<string, Counts>();
  const engines = new Map<string, Counts>();
  const failures: Failure[] = [];
  const flaky: Failure[] = [];

  const walk = (suite: SuiteJson, path: ReadonlyArray<string>): void => {
    const here = suite.title === '' ? path : [...path, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const outcome = outcomeOf(test.status);
        for (const [map, key] of [
          [projects, test.projectName],
          [engines, engineOf(test.projectName)],
        ] as const) {
          const counts = map.get(key) ?? empty();
          counts[outcome] += 1;
          map.set(key, counts);
        }
        const entry = { project: test.projectName, test: [...here, spec.title].join(' > '), message: firstErrorLine(test.results) };
        if (outcome === 'failed') failures.push(entry);
        if (outcome === 'flaky') flaky.push(entry);
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites) walk(suite, []);
  return { projects, engines, failures, flaky };
}

const row = (name: string, counts: Counts): string => `| ${name} | ${counts.passed} | ${counts.failed} | ${counts.flaky} | ${counts.skipped} |`;
const escapeCell = (text: string): string => text.replaceAll('|', '\\|');

export function markdown(summary: SweepSummary): string {
  const head = ['| | passed | failed | flaky (passed on the retry) | skipped |', '| --- | ---: | ---: | ---: | ---: |'];
  const lines: string[] = ['#### By engine', '', ...head, ...[...summary.engines].map(([name, counts]) => row(name, counts)), '', '#### By project (engine and width)', '', ...head];
  for (const [name, counts] of summary.projects) lines.push(row(name, counts));
  if (summary.failures.length > 0) {
    lines.push('', '#### Failures', '', '| project | test | first line of the error |', '| --- | --- | --- |');
    for (const failure of summary.failures) lines.push(`| ${failure.project} | ${escapeCell(failure.test)} | ${escapeCell(failure.message)} |`);
  }
  if (summary.flaky.length > 0) {
    lines.push('', '#### Passed only on the retry', '', '| project | test | first line of the first error |', '| --- | --- | --- |');
    for (const failure of summary.flaky) lines.push(`| ${failure.project} | ${escapeCell(failure.test)} | ${escapeCell(failure.message)} |`);
  }
  return `${lines.join('\n')}\n`;
}
