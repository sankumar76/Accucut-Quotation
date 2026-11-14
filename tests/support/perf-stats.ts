import { arch, cpus, platform, release, totalmem } from 'node:os';

/**
 * Statistics and machine description for the timing tests under `tests/perf/` (test strategy sections 8 and 10.3). The p95 is the
 * **nearest-rank** one: the value at rank `ceil(0.95 x n)` of the sorted samples, so with 20 runs it is the second slowest.
 */

/** The value at the given percentile by nearest rank. Throws for no samples or a percentile outside 1 to 100. */
export function nearestRank(samples: ReadonlyArray<number>, percentile: number): number {
  if (samples.length === 0) throw new Error('There are no samples.');
  if (!(percentile >= 1 && percentile <= 100)) throw new Error('The percentile must be from 1 to 100.');
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  const value = sorted[rank - 1];
  if (value === undefined) throw new Error('The rank is outside the samples.');
  return value;
}

/** The median: the middle sample, or the mean of the two middle ones. */
export function median(samples: ReadonlyArray<number>): number {
  if (samples.length === 0) throw new Error('There are no samples.');
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[sorted.length - 1 - middle];
  if (upper === undefined || lower === undefined) throw new Error('The middle is outside the samples.');
  return (upper + lower) / 2;
}

export interface TimingSummary {
  readonly runs: number;
  readonly p95Ms: number;
  readonly medianMs: number;
  readonly maxMs: number;
}

export function summarise(samplesMs: ReadonlyArray<number>): TimingSummary {
  return { runs: samplesMs.length, p95Ms: nearestRank(samplesMs, 95), medianMs: median(samplesMs), maxMs: Math.max(...samplesMs) };
}

/** The machine a run was measured on (AC-2): CPU model and count, memory, Node version, platform. Describes the host; holds no secret. */
export function describeMachine(): string {
  const processors = cpus();
  const model = processors[0]?.model.trim() ?? 'unknown CPU';
  const gigabytes = (totalmem() / 1024 ** 3).toFixed(1);
  return `${model} x ${processors.length}, ${gigabytes} GB memory, Node ${process.version}, ${platform()} ${release()} ${arch()}`;
}

/** One printable report: the machine, the number of runs, and the p95, median and max in milliseconds. */
export function formatReport(title: string, summary: TimingSummary): string {
  const ms = (value: number): string => `${value.toFixed(1)} ms`;
  return [
    `${title}`,
    `  machine: ${describeMachine()}`,
    `  runs: ${summary.runs}, p95 (nearest rank): ${ms(summary.p95Ms)}, median: ${ms(summary.medianMs)}, max: ${ms(summary.maxMs)}`,
    '',
  ].join('\n');
}
