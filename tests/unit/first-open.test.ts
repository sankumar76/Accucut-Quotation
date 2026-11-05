import { describe, expect, it } from 'vitest';

import {
  hasFirstOpenFailed,
  INITIAL_FIRST_OPEN,
  isFirstOpenPending,
  reduceFirstOpen,
  shouldOpenOverlay,
  shouldRequestCode,
  type FirstOpenEvent,
  type FirstOpenState,
} from '@/lib/ui/first-open';

/**
 * AQP-188 AC-8: the state of a control that loads its overlay on the first open. idle, loading, ready, failed, retry,
 * double activation, cancel. The request itself is the hook's (`use-first-open.ts`); this is the pure part.
 */

function run(events: ReadonlyArray<FirstOpenEvent>, from: FirstOpenState = INITIAL_FIRST_OPEN): FirstOpenState {
  return events.reduce(reduceFirstOpen, from);
}

describe('first-open state', () => {
  it('AC-8 idle: nothing is pending, failed or shown, and no code has been asked for', () => {
    expect(INITIAL_FIRST_OPEN).toEqual({ phase: 'idle', wanted: false, shown: false });
    expect(isFirstOpenPending(INITIAL_FIRST_OPEN)).toBe(false);
    expect(hasFirstOpenFailed(INITIAL_FIRST_OPEN)).toBe(false);
  });

  it('AC-8 loading: the first activation asks for the code and the control is pending', () => {
    const loading = run(['activate']);
    expect(loading).toEqual({ phase: 'loading', wanted: true, shown: false });
    expect(isFirstOpenPending(loading)).toBe(true);
    expect(shouldRequestCode(INITIAL_FIRST_OPEN, loading)).toBe(true);
    expect(shouldOpenOverlay(INITIAL_FIRST_OPEN, loading, 'activate')).toBe(false);
  });

  it('AC-8 ready: when the code arrives for a person who still wants it, the overlay opens and stays shown', () => {
    const loading = run(['activate']);
    const ready = reduceFirstOpen(loading, 'loaded');
    expect(ready).toEqual({ phase: 'ready', wanted: true, shown: true });
    expect(isFirstOpenPending(ready)).toBe(false);
    expect(shouldOpenOverlay(loading, ready, 'loaded')).toBe(true);
    // Once shown it stays shown, whatever happens next.
    expect(run(['cancel', 'dismiss', 'activate'], ready).shown).toBe(true);
  });

  it('AC-8 double activation: a second activation while loading changes nothing and sends no second request', () => {
    const loading = run(['activate']);
    const again = reduceFirstOpen(loading, 'activate');
    expect(again).toBe(loading);
    expect(shouldRequestCode(loading, again)).toBe(false);
  });

  it('AC-8 cancel: Escape while loading leaves the panel closed when the code arrives, and the code is kept', () => {
    const cancelled = run(['activate', 'cancel']);
    expect(cancelled).toEqual({ phase: 'loading', wanted: false, shown: false });
    expect(isFirstOpenPending(cancelled)).toBe(false);
    const arrived = reduceFirstOpen(cancelled, 'loaded');
    expect(arrived).toEqual({ phase: 'ready', wanted: false, shown: false });
    expect(shouldOpenOverlay(cancelled, arrived, 'loaded')).toBe(false);
    // The next press opens at once, with no new request.
    const reopened = reduceFirstOpen(arrived, 'activate');
    expect(reopened.shown).toBe(true);
    expect(shouldRequestCode(arrived, reopened)).toBe(false);
    expect(shouldOpenOverlay(arrived, reopened, 'activate')).toBe(true);
  });

  it('AC-8 cancel, then press again before the code arrives: wanted again, still one request', () => {
    const cancelled = run(['activate', 'cancel']);
    const pressed = reduceFirstOpen(cancelled, 'activate');
    expect(pressed).toEqual({ phase: 'loading', wanted: true, shown: false });
    expect(shouldRequestCode(cancelled, pressed)).toBe(false);
  });

  it('AC-8 failed: the open stops, the control is usable and shows the failure', () => {
    const failed = run(['activate', 'failed']);
    expect(failed).toEqual({ phase: 'failed', wanted: false, shown: false });
    expect(hasFirstOpenFailed(failed)).toBe(true);
    expect(isFirstOpenPending(failed)).toBe(false);
  });

  it('AC-8 retry: activating after a failure clears the line and sends a new request; a later success opens the panel', () => {
    const failed = run(['activate', 'failed']);
    const retrying = reduceFirstOpen(failed, 'activate');
    expect(retrying).toEqual({ phase: 'loading', wanted: true, shown: false });
    expect(hasFirstOpenFailed(retrying)).toBe(false);
    expect(shouldRequestCode(failed, retrying)).toBe(true);
    const ready = reduceFirstOpen(retrying, 'loaded');
    expect(ready.shown).toBe(true);
    expect(shouldOpenOverlay(retrying, ready, 'loaded')).toBe(true);
  });

  it('AC-8: Escape and a page change clear a failure; a page change does not cancel a pending open', () => {
    const failed = run(['activate', 'failed']);
    expect(reduceFirstOpen(failed, 'cancel')).toEqual({ phase: 'idle', wanted: false, shown: false });
    expect(reduceFirstOpen(failed, 'dismiss')).toEqual({ phase: 'idle', wanted: false, shown: false });
    const loading = run(['activate']);
    expect(reduceFirstOpen(loading, 'dismiss')).toBe(loading);
  });

  it('AC-8: events that mean nothing in a state leave it as it is', () => {
    expect(reduceFirstOpen(INITIAL_FIRST_OPEN, 'cancel')).toBe(INITIAL_FIRST_OPEN);
    expect(reduceFirstOpen(INITIAL_FIRST_OPEN, 'dismiss')).toBe(INITIAL_FIRST_OPEN);
    expect(reduceFirstOpen(INITIAL_FIRST_OPEN, 'loaded')).toBe(INITIAL_FIRST_OPEN);
    expect(reduceFirstOpen(INITIAL_FIRST_OPEN, 'failed')).toBe(INITIAL_FIRST_OPEN);
    const ready = run(['activate', 'loaded']);
    expect(reduceFirstOpen(ready, 'loaded')).toBe(ready);
    expect(reduceFirstOpen(ready, 'failed')).toBe(ready);
    expect(reduceFirstOpen(ready, 'cancel')).toBe(ready);
  });

  it('AC-4, AC-5: after the code is here every activation opens the overlay (the drawer reopens from its button)', () => {
    const ready = run(['activate', 'loaded']);
    const again = reduceFirstOpen(ready, 'activate');
    expect(shouldOpenOverlay(ready, again, 'activate')).toBe(true);
    expect(shouldRequestCode(ready, again)).toBe(false);
  });

});
