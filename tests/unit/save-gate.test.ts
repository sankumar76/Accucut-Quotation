import { describe, expect, it } from 'vitest';

import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * Review SQR-01 of AQP-317 (STORY-05.09 AC-2): Calculate waits for the part form's saves before it sends anything, and does not send while a field shows a value that is not saved. The gate is the
 * pure part of that: `useCalculate` awaits `settle()` and sends only when it says true, so what these tests pin is "no request until the save has resolved". Invented ids only.
 */

const PART = '00000000-0000-4000-8000-0000000000b1';
const OTHER_PART = '00000000-0000-4000-8000-0000000000b2';

/** A save that finishes when the test says so. */
function pendingSave(): { readonly promise: Promise<void>; readonly finish: () => void; readonly fail: () => void } {
  let finish: () => void = () => undefined;
  let fail: () => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = () => reject(new Error('the save failed'));
  });
  return { promise, finish, fail };
}

/** Records, in order, what happened: that the wait ended is the point at which Calculate would send. */
async function settleAndNote(gate: ReturnType<typeof createSaveGate>, events: string[]): Promise<void> {
  const mayGo = await gate.settle();
  events.push(mayGo ? 'send' : 'hold');
}

describe('SQR-01: Calculate waits for the saves in flight', () => {
  it('with nothing in flight and nothing unsaved it may go at once', async () => {
    await expect(createSaveGate().settle()).resolves.toBe(true);
  });

  it('a save that resolves later means nothing is sent until it does', async () => {
    const gate = createSaveGate();
    const save = pendingSave();
    gate.track(save.promise);
    const events: string[] = [];
    const waiting = settleAndNote(gate, events);
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual([]);
    events.push('save resolved');
    save.finish();
    await waiting;
    expect(events).toEqual(['save resolved', 'send']);
  });

  it('every save in a queue is waited for, including one tracked while the wait is on', async () => {
    const gate = createSaveGate();
    const first = pendingSave();
    const second = pendingSave();
    gate.track(first.promise);
    const events: string[] = [];
    const waiting = settleAndNote(gate, events);
    gate.track(second.promise);
    first.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual([]);
    second.finish();
    await waiting;
    expect(events).toEqual(['send']);
  });

  it('a save that fails does not reject the wait, and the field it was for is marked, so nothing is sent', async () => {
    const gate = createSaveGate();
    const save = pendingSave();
    gate.track(save.promise);
    const waiting = gate.settle();
    gate.mark(PART, 'field-j', true);
    save.fail();
    await expect(waiting).resolves.toBe(false);
  });
});

describe('SQR-01: nothing is sent while a field shows a value that is not saved', () => {
  it('a refused or unreadable value holds the press, and fixing the field lets it go', async () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    await expect(gate.settle()).resolves.toBe(false);
    gate.mark(PART, 'field-j', false);
    await expect(gate.settle()).resolves.toBe(true);
  });

  it('two fields are two marks: both must be fixed', async () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    gate.mark(PART, 'field-k', true);
    gate.mark(PART, 'field-j', false);
    await expect(gate.settle()).resolves.toBe(false);
    gate.mark(PART, 'field-k', false);
    await expect(gate.settle()).resolves.toBe(true);
  });

  it('a part that is off the screen (or read again) takes its marks with it, and no other part loses its own', async () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    gate.mark(OTHER_PART, 'field-j', true);
    gate.forget(PART);
    await expect(gate.settle()).resolves.toBe(false);
    gate.forget(OTHER_PART);
    await expect(gate.settle()).resolves.toBe(true);
  });
});
