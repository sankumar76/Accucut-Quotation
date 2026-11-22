import { describe, expect, it } from 'vitest';

import type { LineSummary } from '../perf/load/closed-loop';
import { NFR_010_LINE_MS, OWN_PASSWORD_LINE_MS, breachesOf, formatReport, judgeLine, judgePhase, type PhaseResult } from '../perf/load/judge';

/** STORY-10.09 AC-1 to AC-4 and AC-9 (NFR-010, NFR-011): what the load script judges, what it only reports, and the message of a breach. */

function summary(overrides: Partial<LineSummary> = {}): LineSummary {
  return { name: 'tree', requests: 1_000, errors: 0, unexpected: new Map(), p50Ms: 40, p95Ms: 120, maxMs: 300, answerBytes: 51_200, ...overrides };
}

const line500 = (name: string): ReadonlyMap<string, number> => new Map([[name, NFR_010_LINE_MS]]);

describe('AC-1: the lines are 500 ms, and 1,000 ms for the own-password change', () => {
  it('holds the figures of NFR-010', () => {
    expect(NFR_010_LINE_MS).toBe(500);
    expect(OWN_PASSWORD_LINE_MS).toBe(1_000);
  });
});

describe('AC-1: a line passes at its limit and fails above it, naming the phase, the line and the figure', () => {
  it('passes with a p95 of exactly 500 ms and fails with 501 ms', () => {
    expect(judgeLine('NFR-010, 25 users', summary({ p95Ms: 500 }), 500, false).passed).toBe(true);
    const over = judgeLine('NFR-010, 25 users', summary({ p95Ms: 501 }), 500, false);
    expect(over.passed).toBe(false);
    expect(over.breaches).toEqual(['NFR-010, 25 users: line "tree" p95 501 ms is over the 500 ms line']);
  });

  it('fails on any error even when its p95 is far inside the line, and says how many and which status', () => {
    const bad = judgeLine('NFR-011, 50 users', summary({ errors: 3, unexpected: new Map([[500, 2], [0, 1]]) }), 500, false);
    expect(bad.passed).toBe(false);
    expect(bad.breaches[0]).toBe('NFR-011, 50 users: line "tree" had 3 of 1000 requests that were not as expected (2 x HTTP 500, 1 x no answer)');
  });

  it('fails a line that made no request, so a silent skip cannot pass', () => {
    const none = judgeLine('NFR-010, 25 users', summary({ requests: 0, p50Ms: null, p95Ms: null, maxMs: null, answerBytes: null }), 500, false);
    expect(none.passed).toBe(false);
    expect(none.breaches[0]).toContain('made no request');
  });
});

describe('AC-2 and AC-3: a figure that is only reported never fails on its p95, but an error still fails it', () => {
  it('lets a report-only phase run over its line (the 50-user load, the own-password change on the CI runner)', () => {
    expect(judgeLine('NFR-010, own-password change', summary({ name: 'own-password change', p95Ms: 1_800 }), 1_000, true).passed).toBe(true);
  });

  it('still fails a report-only phase that had an error', () => {
    expect(judgeLine('NFR-011, 50 users', summary({ errors: 1, unexpected: new Map([[0, 1]]) }), null, true).passed).toBe(false);
  });

  it('has no line for a line the phase does not name, so it is reported and passes', () => {
    const result: PhaseResult = { phase: 'NFR-010, 25 users', summaries: [summary({ name: 'costs (review, extra)', p95Ms: 900 })], limitsMs: line500('tree') };
    expect(judgePhase(result)[0]?.passed).toBe(true);
    expect(judgePhase(result)[0]?.limitMs).toBeNull();
  });
});

describe('AC-9: a breach fails the job and names the line and the figure', () => {
  it('lists the breaches of every phase in order and nothing when every line holds', () => {
    const ok: PhaseResult = { phase: 'A', summaries: [summary()], limitsMs: line500('tree') };
    const bad: PhaseResult = { phase: 'B', summaries: [summary({ name: 'queue', p95Ms: 612.4 })], limitsMs: line500('queue') };
    expect(breachesOf([ok])).toEqual([]);
    expect(breachesOf([ok, bad])).toEqual(['B: line "queue" p95 612 ms is over the 500 ms line']);
  });
});

describe('AC-3: the report carries the figures and the notes, and no secret', () => {
  const result: PhaseResult = {
    phase: 'NFR-010, 25 users',
    summaries: [summary({ name: 'tree', p95Ms: 120.4, answerBytes: 51_200 }), summary({ name: 'costs (review, extra)', p95Ms: 300 })],
    limitsMs: line500('tree'),
    notes: ['the tree answer is 50.0 KB (decoded)'],
  };

  it('has a row per line with p95, the line, the answer size and pass, or reported when no line is set', () => {
    const report = formatReport([result]);
    expect(report).toContain('### NFR-010, 25 users');
    expect(report).toContain('| tree | 1000 | 0 | 40 | 120 | 300 | 500 | 50.0 KB | pass |');
    expect(report).toContain('| costs (review, extra) | 1000 | 0 | 40 | 300 | 300 | - | 50.0 KB | reported |');
    expect(report).toContain('\n\n- the tree answer is 50.0 KB (decoded)');
  });

  it('marks a report-only phase and a failing row', () => {
    const failing: PhaseResult = { ...result, reportOnly: true, summaries: [summary({ errors: 1, unexpected: new Map([[500, 1]]) })] };
    const report = formatReport([failing]);
    expect(report).toContain('(reported, not judged)');
    expect(report).toContain('| FAIL |');
  });
});
