import type { LineSummary } from './closed-loop';

/**
 * What the load script says about its figures (STORY-10.09 AC-1 to AC-4, AC-9). A figure is **judged** against a line, **reported** with no line (the 50-user p95, the size of the tree answer, the
 * saturation reading), and an error is always a failure: the lines of NFR-010 and NFR-011 say "no response other than the expected one". A breach message names the phase, the line and the figure,
 * so the failed job says what to look at (AC-9). The p95 is nearest-rank (`closed-loop.ts`).
 */

export const NFR_010_LINE_MS = 500;
/** PROPOSED (PRD NFR-010 v0.26): the own-password change, two argon2id operations in series. */
export const OWN_PASSWORD_LINE_MS = 1_000;

export interface PhaseResult {
  /** For example `NFR-010, 25 users`. */
  readonly phase: string;
  readonly summaries: ReadonlyArray<LineSummary>;
  /** The p95 line in milliseconds of each judged line, by line name. A line that is not here is reported only. */
  readonly limitsMs: ReadonlyMap<string, number>;
  /** True when the p95 of the phase is only reported (the own-password line on a CI runner; the 50-user load). */
  readonly reportOnly?: boolean;
  /** Facts to print under the table: the wall time, the requests a second, the export times. Figures and names only. */
  readonly notes?: ReadonlyArray<string>;
}

export interface Verdict {
  readonly phase: string;
  readonly summary: LineSummary;
  readonly limitMs: number | null;
  readonly passed: boolean;
  /** Why it failed; empty when it passed. */
  readonly breaches: ReadonlyArray<string>;
}

const ms = (value: number): string => `${Math.round(value)} ms`;

function statusWords(unexpected: ReadonlyMap<number, number>): string {
  return [...unexpected].map(([status, count]) => `${count} x ${status === 0 ? 'no answer' : `HTTP ${status}`}`).join(', ');
}

/** The failures of one line: any error, no answer at all, a p95 over its line. A phase that is report-only never fails on the p95. */
export function judgeLine(phase: string, summary: LineSummary, limitMs: number | null, reportOnly: boolean): Verdict {
  const breaches: string[] = [];
  if (summary.errors > 0) breaches.push(`${phase}: line "${summary.name}" had ${summary.errors} of ${summary.requests} requests that were not as expected (${statusWords(summary.unexpected)})`);
  if (summary.requests === 0) breaches.push(`${phase}: line "${summary.name}" made no request`);
  if (limitMs !== null && !reportOnly && summary.p95Ms !== null && summary.p95Ms > limitMs) {
    breaches.push(`${phase}: line "${summary.name}" p95 ${ms(summary.p95Ms)} is over the ${ms(limitMs)} line`);
  }
  return { phase, summary, limitMs, passed: breaches.length === 0, breaches };
}

export function judgePhase(result: PhaseResult): ReadonlyArray<Verdict> {
  return result.summaries.map((summary) => judgeLine(result.phase, summary, result.limitsMs.get(summary.name) ?? null, result.reportOnly === true));
}

const cell = (value: number | null): string => (value === null ? 'n/a' : String(Math.round(value)));

function kilobytes(bytes: number | null): string {
  return bytes === null ? 'n/a' : `${(bytes / 1024).toFixed(1)} KB`;
}

function resultWord(verdict: Verdict, reportOnly: boolean): string {
  if (!verdict.passed) return 'FAIL';
  if (verdict.limitMs === null || reportOnly) return 'reported';
  return 'pass';
}

/** A markdown table of every phase: for the job summary, and for the pull request body. Holds figures and names only. */
export function formatReport(results: ReadonlyArray<PhaseResult>): string {
  const lines: string[] = [];
  for (const result of results) {
    lines.push(`### ${result.phase}${result.reportOnly === true ? ' (reported, not judged)' : ''}`, '');
    lines.push('| Line | Requests | Errors | p50 ms | p95 ms | max ms | Line ms | Answer | Result |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const verdict of judgePhase(result)) {
      const s = verdict.summary;
      const limit = verdict.limitMs === null ? '-' : String(verdict.limitMs);
      lines.push(`| ${s.name} | ${s.requests} | ${s.errors} | ${cell(s.p50Ms)} | ${cell(s.p95Ms)} | ${cell(s.maxMs)} | ${limit} | ${kilobytes(s.answerBytes)} | ${resultWord(verdict, result.reportOnly === true)} |`);
    }
    if ((result.notes ?? []).length > 0) lines.push('');
    for (const note of result.notes ?? []) lines.push(`- ${note}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Every breach of every phase, in order. Empty when the run holds every line. */
export function breachesOf(results: ReadonlyArray<PhaseResult>): ReadonlyArray<string> {
  return results.flatMap((result) => judgePhase(result).flatMap((verdict) => verdict.breaches));
}
