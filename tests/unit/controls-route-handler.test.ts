import { describe, expect, it } from 'vitest';

import { answerChunk, isDroppedRequest, type ChunkRoute, type FetchedChunk } from '../support/controls-route-handler';

/**
 * AQP-444, DEF-088 (#732): the route that holds or refuses the code of the resizable tree's controls (`tests/e2e/support/tree-width.ts`) threw "route.fetch: Request context disposed" when its context closed with a
 * fetch still in flight, outside any test, and the worker stopped (CI run 45631761004). What the handler does with a fault is `answerChunk`; it is proved here with plain objects for the route, no browser. Every
 * name is invented.
 */

const CONTROLS_CHUNK = 'export const x = { "data-tree-hit": "" };';
const OTHER_CHUNK = 'export const y = 1;';

interface Fake {
  readonly route: ChunkRoute<FetchedChunk>;
  readonly answers: Array<{ status?: number; body?: string; response?: FetchedChunk }>;
}

function fakeRoute(source: string, faults: { fetch?: string; text?: string; fulfill?: string } = {}): Fake {
  const answers: Fake['answers'] = [];
  const fetched: FetchedChunk = {
    text: () => (faults.text === undefined ? Promise.resolve(source) : Promise.reject(new Error(faults.text))),
  };
  return {
    answers,
    route: {
      fetch: () => (faults.fetch === undefined ? Promise.resolve(fetched) : Promise.reject(new Error(faults.fetch))),
      fulfill: (options) => {
        if (faults.fulfill !== undefined) return Promise.reject(new Error(faults.fulfill));
        answers.push(options);
        return Promise.resolve();
      },
    },
  };
}

const never = new Promise<void>(() => undefined);
const settled = Promise.resolve();

describe('answerChunk', () => {
  it('lets a chunk that is not the controls\' through at once, even while the controls\' code is held', async () => {
    const { route, answers } = fakeRoute(OTHER_CHUNK);
    await answerChunk(route, 'hold', never);
    expect(answers).toHaveLength(1);
    expect(answers[0]?.body).toBe(OTHER_CHUNK);
  });

  it('holds the controls\' code until it is released, then lets it through', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { route, answers } = fakeRoute(CONTROLS_CHUNK);
    const running = answerChunk(route, 'hold', held);
    await Promise.resolve();
    await Promise.resolve();
    expect(answers, 'nothing is answered while it is held').toHaveLength(0);
    release();
    await running;
    expect(answers).toHaveLength(1);
    expect(answers[0]?.body).toBe(CONTROLS_CHUNK);
  });

  it('refuses the controls\' code with a 503 and does not wait', async () => {
    const { route, answers } = fakeRoute(CONTROLS_CHUNK);
    await answerChunk(route, 'refuse', never);
    expect(answers).toEqual([{ status: 503, contentType: 'text/plain', body: 'refused' }]);
  });
});

describe('a request the browser has dropped (DEF-088)', () => {
  it.each([
    ['the fetch, when the context is disposed under it', { fetch: 'route.fetch: Request context disposed' }],
    ['reading the body, when the response is disposed', { text: 'apiResponse.text: Response has been disposed' }],
    ['the answer, when a reload has already handled the route', { fulfill: 'route.fulfill: Route is already handled!' }],
  ])('ends the handler quietly: %s', async (_name, faults) => {
    const { route, answers } = fakeRoute(OTHER_CHUNK, faults);
    await expect(answerChunk(route, 'hold', settled)).resolves.toBeUndefined();
    expect(answers).toEqual([]);
  });

  it('ends quietly in the hold and the refuse paths too', async () => {
    await expect(answerChunk(fakeRoute(CONTROLS_CHUNK, { fulfill: 'route.fulfill: Route is already handled!' }).route, 'hold', settled)).resolves.toBeUndefined();
    await expect(answerChunk(fakeRoute(CONTROLS_CHUNK, { fulfill: 'route.fulfill: Route is already handled!' }).route, 'refuse', settled)).resolves.toBeUndefined();
  });

  it('is told by those exact messages only', () => {
    expect(isDroppedRequest(new Error('route.fetch: Request context disposed'))).toBe(true);
    expect(isDroppedRequest(new Error('apiResponse.text: Response has been disposed'))).toBe(true);
    expect(isDroppedRequest(new Error('route.fulfill: Route is already handled!'))).toBe(true);
    expect(isDroppedRequest(new Error('boom'))).toBe(false);
    expect(isDroppedRequest(new Error('Target page, context or browser has been closed'))).toBe(false);
    expect(isDroppedRequest('Request context disposed')).toBe(false);
  });

  it('throws every other fault, from the fetch, the body and the answer, so a real fault is never hidden', async () => {
    await expect(answerChunk(fakeRoute(OTHER_CHUNK, { fetch: 'net::ERR_CONNECTION_REFUSED' }).route, 'hold', settled)).rejects.toThrow('ERR_CONNECTION_REFUSED');
    await expect(answerChunk(fakeRoute(OTHER_CHUNK, { text: 'boom' }).route, 'hold', settled)).rejects.toThrow('boom');
    await expect(answerChunk(fakeRoute(OTHER_CHUNK, { fulfill: 'boom' }).route, 'hold', settled)).rejects.toThrow('boom');
  });

  it('is what the handler of master did not do: its pattern did not match "Request context disposed", so it rethrew it', () => {
    const before = /already handled|has been closed|closed/i;
    expect(before.test('route.fetch: Request context disposed')).toBe(false);
    expect(before.test('apiResponse.text: Response has been disposed')).toBe(false);
  });
});
