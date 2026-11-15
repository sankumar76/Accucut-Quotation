import { describe, expect, it } from 'vitest';

import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * STORY-05.08 AC-4, AC-5: the same gate that makes Calculate wait also says whether anything typed is not saved, so the page is not left (a link, the back button, a closed tab, a sign-out) while it
 * is. "Dirty" is a save in flight or a field that shows a value the server does not hold. Save draft asks every part form to send what it shows again (`flush`). Invented ids only.
 */

const PART = '00000000-0000-4000-8000-0000000000c1';
const OTHER_PART = '00000000-0000-4000-8000-0000000000c2';

function pendingSave(): { readonly promise: Promise<void>; readonly finish: () => void } {
  let finish: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

describe('AC-4: dirty means a save in flight or a value that is not saved', () => {
  it('is clean when nothing was typed', () => {
    expect(createSaveGate().isDirty()).toBe(false);
  });

  it('is dirty while a field shows a value that is not saved, and clean once it does not', () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    expect(gate.isDirty()).toBe(true);
    gate.mark(PART, 'field-j', false);
    expect(gate.isDirty()).toBe(false);
  });

  it('is dirty while a save is in flight, and clean when it has finished', async () => {
    const gate = createSaveGate();
    const save = pendingSave();
    gate.track(save.promise);
    expect(gate.isDirty()).toBe(true);
    save.finish();
    await gate.settle();
    expect(gate.isDirty()).toBe(false);
  });

  it('is dirty after a save that failed, until the field is marked saved (nothing typed is dropped without a word)', async () => {
    const gate = createSaveGate();
    const failing = Promise.reject(new Error('the save failed'));
    gate.track(failing);
    gate.mark(PART, 'field-j', true);
    await gate.settle();
    expect(gate.isDirty()).toBe(true);
  });

  it('a part that is off the screen takes its marks with it, and no other part loses its own', () => {
    const gate = createSaveGate();
    gate.mark(PART, 'field-j', true);
    gate.mark(PART, 'field-k', true);
    gate.mark(OTHER_PART, 'field-j', true);
    gate.forget(PART);
    expect(gate.isDirty()).toBe(true);
    gate.forget(OTHER_PART);
    expect(gate.isDirty()).toBe(false);
  });
});

describe('AC-4: a listener hears every change of what is dirty', () => {
  it('is told when a field is marked, cleared, forgotten and when a save starts and ends', async () => {
    const gate = createSaveGate();
    const heard: boolean[] = [];
    const stop = gate.subscribe(() => heard.push(gate.isDirty()));
    gate.mark(PART, 'field-j', true);
    gate.mark(PART, 'field-j', false);
    const save = pendingSave();
    gate.track(save.promise);
    save.finish();
    await gate.settle();
    await Promise.resolve();
    expect(heard).toEqual([true, false, true, false]);
    stop();
    gate.mark(PART, 'field-j', true);
    expect(heard).toHaveLength(4);
  });

  it('is not told twice for a mark that changes nothing', () => {
    const gate = createSaveGate();
    let calls = 0;
    gate.subscribe(() => (calls += 1));
    gate.mark(PART, 'field-j', false);
    gate.mark(PART, 'field-j', true);
    gate.mark(PART, 'field-j', true);
    expect(calls).toBe(1);
  });
});

describe('AC-1, AC-5: Save draft asks every part form to send again what it shows', () => {
  it('calls each offered flush once, and not one that was withdrawn', () => {
    const gate = createSaveGate();
    const calls: string[] = [];
    gate.offerFlush(() => calls.push('first'));
    const withdraw = gate.offerFlush(() => calls.push('second'));
    withdraw();
    gate.flush();
    expect(calls).toEqual(['first']);
  });

  it('flush with nothing offered does nothing', () => {
    expect(() => createSaveGate().flush()).not.toThrow();
  });
});
