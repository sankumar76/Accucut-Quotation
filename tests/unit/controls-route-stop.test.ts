import { describe, expect, it } from 'vitest';

import { isClosedTarget, stopRoutes } from '../support/controls-route-handler';

/**
 * AQP-444, DEF-088 reopened (#732, duplicate #DEF-126; DL-419 (B)): `holdControlsCode().stop()` waits for the running route handlers with `page.unrouteAll({ behavior: 'wait' })`. When the page or the context is already
 * gone, which happens in a slow window when the case has timed out, Playwright answers "page.unrouteAll: Target page, context or browser has been closed" from the teardown and the worker reports it as a second failure on
 * top of the real one (master push 6085f71e). That one message, and no other, is ignored at teardown: nothing is left to unroute once the page is gone. Every other fault is rethrown. Proved with plain objects, no browser.
 */

const CLOSED = 'page.unrouteAll: Target page, context or browser has been closed';

describe('isClosedTarget', () => {
  it('is told by that message, with or without the name of the call in front of it', () => {
    expect(isClosedTarget(new Error(CLOSED))).toBe(true);
    expect(isClosedTarget(new Error('Target page, context or browser has been closed'))).toBe(true);
  });

  it('is not told by anything else, however alike', () => {
    for (const message of ['boom', 'Request context disposed', 'Response has been disposed', 'Route is already handled', 'Target closed', 'Test timeout of 30000ms exceeded', 'browser has been closed']) {
      expect(isClosedTarget(new Error(message)), message).toBe(false);
    }
  });

  it('is not told by a value that is not an error', () => {
    expect(isClosedTarget(CLOSED)).toBe(false);
    expect(isClosedTarget(undefined)).toBe(false);
    expect(isClosedTarget({ message: CLOSED })).toBe(false);
  });
});

describe('stopRoutes', () => {
  it('waits for the unroute and answers when it is done', async () => {
    const seen: string[] = [];
    await stopRoutes(async () => {
      await Promise.resolve();
      seen.push('unrouted');
    });
    expect(seen).toEqual(['unrouted']);
  });

  it('ignores exactly the error of a page, context or browser that is already closed', async () => {
    await expect(stopRoutes(() => Promise.reject(new Error(CLOSED)))).resolves.toBeUndefined();
  });

  it('rethrows every other fault, so a real one is never hidden', async () => {
    await expect(stopRoutes(() => Promise.reject(new Error('route.fetch: Request context disposed')))).rejects.toThrow('Request context disposed');
    await expect(stopRoutes(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(stopRoutes(() => Promise.reject(new Error('Test timeout of 30000ms exceeded')))).rejects.toThrow('Test timeout');
  });
});
