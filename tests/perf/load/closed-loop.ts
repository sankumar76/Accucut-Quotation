import { nearestRank } from '../../support/perf-stats';

import type { Reply } from './client';

/**
 * The closed loop of test strategy 8.1 and 8.2 (STORY-10.09 AC-1, AC-3): every virtual user sends one request, reads the whole answer, waits the think time (1 s) and sends the next, going round
 * the lines in order. The first rounds are a warm-up and are dropped (`next start` loads a route's module on its first request; at least 25 requests per line). The p95 is nearest-rank.
 *
 * Pure of the network: a line is a function that makes one request, and the clock is injected, so a unit test holds the rules (what is dropped, what counts as an error, what a window keeps).
 */

/** The warm-up of test strategy 8.1: this many requests of each read are dropped before any is counted. */
export const WARMUP_REQUESTS_PER_LINE = 25;

export interface LoadLine {
  /** The name the report and a breach message use. */
  readonly name: string;
  /** The only status that is not an error. */
  readonly expectedStatus: number;
  /** One request by one user in one round. */
  readonly request: (user: number, round: number) => Promise<Reply>;
}

export interface Sample {
  readonly ms: number;
  readonly status: number;
  readonly bytes: number;
  readonly startedAt: number;
}

export interface LineSamples {
  readonly line: LoadLine;
  readonly samples: ReadonlyArray<Sample>;
}

export interface LoopPlan {
  readonly users: number;
  /** Rounds that are counted: each user makes this many requests per line. */
  readonly rounds: number;
  /** Rounds that are made first and dropped. */
  readonly warmupRounds: number;
  readonly thinkMs: number;
  /** Checked before each counted round: when it says true the user stops (the export has finished). */
  readonly stopWhen?: () => boolean;
}

export interface LoopClock {
  readonly sleep: (ms: number) => Promise<void>;
}

const realClock: LoopClock = { sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };

/** The rounds that drop at least `WARMUP_REQUESTS_PER_LINE` requests of each line for this many users. */
export function warmupRoundsFor(users: number): number {
  return Math.max(1, Math.ceil(WARMUP_REQUESTS_PER_LINE / Math.max(1, users)));
}

async function runUser(user: number, plan: LoopPlan, lines: ReadonlyArray<LoadLine>, sink: Sample[][], clock: LoopClock): Promise<void> {
  const total = plan.warmupRounds + plan.rounds;
  for (let round = 0; round < total; round += 1) {
    const counted = round >= plan.warmupRounds;
    if (counted && plan.stopWhen?.() === true) return;
    for (const [index, line] of lines.entries()) {
      const reply = await line.request(user, round);
      if (counted) sink[index]?.push({ ms: reply.ms, status: reply.status, bytes: reply.bytes, startedAt: reply.startedAt });
      if (plan.thinkMs > 0) await clock.sleep(plan.thinkMs);
    }
  }
}

/** Runs every user at once and returns the counted samples of each line. */
export async function runClosedLoop(plan: LoopPlan, lines: ReadonlyArray<LoadLine>, clock: LoopClock = realClock): Promise<ReadonlyArray<LineSamples>> {
  const sinks: Sample[][] = lines.map(() => []);
  await Promise.all(Array.from({ length: plan.users }, (_, user) => runUser(user, plan, lines, sinks, clock)));
  return lines.map((line, index) => ({ line, samples: sinks[index] ?? [] }));
}

/** Only the samples whose request left inside the window (the time the export was running). */
export function withinWindow(results: ReadonlyArray<LineSamples>, from: number, until: number): ReadonlyArray<LineSamples> {
  return results.map(({ line, samples }) => ({ line, samples: samples.filter((sample) => sample.startedAt >= from && sample.startedAt < until) }));
}

export interface LineSummary {
  readonly name: string;
  readonly requests: number;
  /** Requests whose status was not the expected one, a timeout or a network failure included. */
  readonly errors: number;
  /** The statuses that were not expected, with how many of each (0 is no answer), for the message. */
  readonly unexpected: ReadonlyMap<number, number>;
  /** Over the requests that were answered as expected; `null` when there are none. */
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly maxMs: number | null;
  /** The size of the answer in bytes (median of the requests that were answered as expected). */
  readonly answerBytes: number | null;
}

export function summariseLine({ line, samples }: LineSamples): LineSummary {
  const good = samples.filter((sample) => sample.status === line.expectedStatus);
  const unexpected = new Map<number, number>();
  for (const sample of samples) if (sample.status !== line.expectedStatus) unexpected.set(sample.status, (unexpected.get(sample.status) ?? 0) + 1);
  const times = good.map((sample) => sample.ms);
  return {
    name: line.name,
    requests: samples.length,
    errors: samples.length - good.length,
    unexpected,
    p50Ms: times.length === 0 ? null : nearestRank(times, 50),
    p95Ms: times.length === 0 ? null : nearestRank(times, 95),
    maxMs: times.length === 0 ? null : Math.max(...times),
    answerBytes: good.length === 0 ? null : nearestRank(good.map((sample) => sample.bytes), 50),
  };
}
