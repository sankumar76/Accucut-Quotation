import { describe, expect, it } from 'vitest';

import { describeMachine, formatReport, median, nearestRank, summarise } from '../support/perf-stats';

/** STORY-03.06 AC-1 and AC-2: the statistics the timing test uses are right, and the report names the machine. No timing here. */

describe('nearestRank', () => {
  const twenty = Array.from({ length: 20 }, (_, index) => index + 1);

  it('the p95 of 20 runs is the second slowest, whatever the order', () => {
    expect(nearestRank(twenty, 95)).toBe(19);
    expect(nearestRank([...twenty].reverse(), 95)).toBe(19);
  });

  it('p100 is the maximum, p1 the minimum, and one sample is every percentile', () => {
    expect(nearestRank(twenty, 100)).toBe(20);
    expect(nearestRank(twenty, 1)).toBe(1);
    expect(nearestRank([42], 95)).toBe(42);
  });

  it('does not change the samples it is given', () => {
    const samples = [3, 1, 2];
    nearestRank(samples, 50);
    expect(samples).toEqual([3, 1, 2]);
  });

  it('refuses no samples and a percentile outside 1 to 100', () => {
    expect(() => nearestRank([], 95)).toThrow('no samples');
    expect(() => nearestRank([1], 0)).toThrow('percentile');
    expect(() => nearestRank([1], 101)).toThrow('percentile');
    expect(() => nearestRank([1], Number.NaN)).toThrow('percentile');
  });
});

describe('median and summarise', () => {
  it('the median of an odd count is the middle sample, of an even count the mean of the two middle ones', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow('no samples');
  });

  it('gives the runs, p95, median and max', () => {
    const summary = summarise(Array.from({ length: 20 }, (_, index) => (index + 1) * 10));
    expect(summary).toEqual({ runs: 20, p95Ms: 190, medianMs: 105, maxMs: 200 });
  });
});

describe('the report (AC-2)', () => {
  it('names the CPU, the memory, the Node version, the runs, and the p95, median and max', () => {
    const machine = describeMachine();
    expect(machine).toContain(process.version);
    expect(machine).toMatch(/GB memory/);
    const report = formatReport('Invented timing', { runs: 20, p95Ms: 190, medianMs: 105, maxMs: 200 });
    expect(report).toContain('Invented timing');
    expect(report).toContain(machine);
    expect(report).toContain('runs: 20, p95 (nearest rank): 190.0 ms, median: 105.0 ms, max: 200.0 ms');
  });
});
