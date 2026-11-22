import { describe, expect, it } from 'vitest';

import type { Reply } from '../perf/load/client';
import { runClosedLoop, summariseLine, warmupRoundsFor, withinWindow, type LoadLine, type LoopClock } from '../perf/load/closed-loop';

/**
 * STORY-10.09 AC-1 and AC-3 (test strategy 8.1): the closed loop of the load script. The network and the clock are injected, so each rule is held without a timing: the warm-up is dropped, every
 * user makes the counted number of requests per line, a user waits the think time after each request, a status other than the expected one (or no answer) is an error and is not a latency, and the
 * p95 is nearest-rank.
 */

function reply(status: number, ms: number, startedAt = 0, bytes = 100): Reply {
  return { status, ms, bytes, body: '', startedAt };
}

function fixedLine(name: string, answer: (user: number, round: number) => Reply, calls: Array<[number, number]> = []): LoadLine {
  return {
    name,
    expectedStatus: 200,
    request: (user, round) => {
      calls.push([user, round]);
      return Promise.resolve(answer(user, round));
    },
  };
}

const instantClock = (sleeps: number[] = []): LoopClock => ({
  sleep: (ms) => {
    sleeps.push(ms);
    return Promise.resolve();
  },
});

describe('AC-1: the warm-up drops at least 25 requests of each line', () => {
  it('is one round for 25 or more users and more rounds for fewer, never none', () => {
    expect(warmupRoundsFor(25)).toBe(1);
    expect(warmupRoundsFor(50)).toBe(1);
    expect(warmupRoundsFor(10)).toBe(3);
    expect(warmupRoundsFor(1)).toBe(25);
    expect(warmupRoundsFor(0)).toBe(25);
  });
});

describe('AC-1: the closed loop counts 40 requests per user per line after the warm-up', () => {
  it('makes warm-up plus counted rounds of requests, counts only the counted ones, and so gives 1,000 samples at 25 users', async () => {
    const calls: Array<[number, number]> = [];
    const results = await runClosedLoop({ users: 25, rounds: 40, warmupRounds: 1, thinkMs: 1_000 }, [fixedLine('queue', () => reply(200, 10), calls)], instantClock());
    expect(calls).toHaveLength(25 * 41);
    expect(results[0]?.samples).toHaveLength(1_000);
  });

  it('does not count the warm-up round: the samples of round 0 are absent and the next rounds are present', async () => {
    const results = await runClosedLoop(
      { users: 2, rounds: 2, warmupRounds: 1, thinkMs: 0 },
      [fixedLine('queue', (_user, round) => reply(200, round === 0 ? 9_999 : 5))],
      instantClock(),
    );
    expect(results[0]?.samples.map((sample) => sample.ms)).toEqual([5, 5, 5, 5]);
  });

  it('goes round the lines in order for each user, and waits the think time after every request, warm-up included', async () => {
    const order: string[] = [];
    const sleeps: number[] = [];
    const line = (name: string): LoadLine => ({
      name,
      expectedStatus: 200,
      request: () => {
        order.push(name);
        return Promise.resolve(reply(200, 1));
      },
    });
    await runClosedLoop({ users: 1, rounds: 1, warmupRounds: 1, thinkMs: 1_000 }, [line('a'), line('b')], instantClock(sleeps));
    expect(order).toEqual(['a', 'b', 'a', 'b']);
    expect(sleeps).toEqual([1_000, 1_000, 1_000, 1_000]);
  });

  it('waits no time at all when the think time is 0 (the saturation reading)', async () => {
    const sleeps: number[] = [];
    await runClosedLoop({ users: 1, rounds: 3, warmupRounds: 0, thinkMs: 0 }, [fixedLine('a', () => reply(200, 1))], instantClock(sleeps));
    expect(sleeps).toEqual([]);
  });

  it('stops a user before a counted round when the stop test says so, and never during the warm-up', async () => {
    const calls: Array<[number, number]> = [];
    let stop = false;
    const line: LoadLine = {
      name: 'a',
      expectedStatus: 200,
      request: (user, round) => {
        calls.push([user, round]);
        if (round === 1) stop = true;
        return Promise.resolve(reply(200, 1));
      },
    };
    await runClosedLoop({ users: 1, rounds: 10, warmupRounds: 1, thinkMs: 0, stopWhen: () => stop }, [line], instantClock());
    expect(calls).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });
});

describe('AC-1: a response other than the expected one is an error, not a latency', () => {
  it('counts a wrong status and a call that got no answer as errors, names them, and leaves them out of the p95', async () => {
    const answers = [reply(200, 100), reply(500, 1), reply(0, 30_000), reply(200, 300)];
    const results = await runClosedLoop({ users: 1, rounds: 4, warmupRounds: 0, thinkMs: 0 }, [fixedLine('tree', (_u, round) => answers[round] ?? reply(200, 1))], instantClock());
    const summary = summariseLine(results[0] ?? { line: fixedLine('x', () => reply(200, 1)), samples: [] });
    expect(summary.requests).toBe(4);
    expect(summary.errors).toBe(2);
    expect([...summary.unexpected]).toEqual([
      [500, 1],
      [0, 1],
    ]);
    expect(summary.p95Ms).toBe(300);
    expect(summary.maxMs).toBe(300);
  });

  it('gives no figure at all, and still says how many requests failed, when every request failed', () => {
    const line = fixedLine('queue', () => reply(401, 1));
    const summary = summariseLine({ line, samples: [{ ms: 1, status: 401, bytes: 0, startedAt: 0 }] });
    expect(summary).toMatchObject({ requests: 1, errors: 1, p50Ms: null, p95Ms: null, maxMs: null, answerBytes: null });
  });

  it('takes the line\'s own expected status: 204 for the own-password change', () => {
    const line: LoadLine = { name: 'own-password change', expectedStatus: 204, request: () => Promise.resolve(reply(204, 1)) };
    const summary = summariseLine({ line, samples: [{ ms: 400, status: 204, bytes: 0, startedAt: 0 }] });
    expect(summary.errors).toBe(0);
    expect(summary.p95Ms).toBe(400);
  });
});

describe('AC-1: the p95 is nearest-rank', () => {
  it('of 1,000 samples is the 950th, and of 20 samples the 19th', () => {
    const line = fixedLine('x', () => reply(200, 1));
    const thousand = Array.from({ length: 1_000 }, (_, n) => ({ ms: n + 1, status: 200, bytes: 10, startedAt: 0 }));
    expect(summariseLine({ line, samples: thousand }).p95Ms).toBe(950);
    expect(summariseLine({ line, samples: thousand.slice(0, 20) }).p95Ms).toBe(19);
  });

  it('reports the size of the answer as the median of the answers that were expected', () => {
    const line = fixedLine('tree', () => reply(200, 1));
    const samples = [10, 20, 30].map((bytes) => ({ ms: 1, status: 200, bytes, startedAt: 0 }));
    expect(summariseLine({ line, samples }).answerBytes).toBe(20);
  });
});

describe('AC-4: only the requests that left while the export ran are counted', () => {
  it('keeps the samples started inside the window, from its start up to but not including its end', () => {
    const line = fixedLine('tree', () => reply(200, 1));
    const sample = (startedAt: number) => ({ ms: 1, status: 200, bytes: 1, startedAt });
    const kept = withinWindow([{ line, samples: [sample(99), sample(100), sample(150), sample(200), sample(201)] }], 100, 200);
    expect(kept[0]?.samples.map((s) => s.startedAt)).toEqual([100, 150]);
  });
});
