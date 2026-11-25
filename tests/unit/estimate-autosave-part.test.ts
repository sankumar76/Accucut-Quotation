import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePartValues, type UsePartValuesProps } from '@/components/features/estimate-workspace/use-part-form';
import type { FormField } from '@/lib/estimates/form-client';
import { createSaveGate } from '@/lib/estimates/save-gate';

import { renderHook } from '../support/hook-harness';
import { PART_ID, partServer } from '../support/part-server';

// The hook runs with no DOM: React's hooks are the harness's (`tests/support/hook-harness.ts`), and the server is an invented one (`tests/support/part-server.ts`).
vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);
vi.mock('@/lib/estimates/form-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/form-client')>();
  const { partServer: server } = await import('../support/part-server');
  return { ...original, loadPartInputs: server.load, savePartInputs: server.save };
});

/**
 * STORY-05.10 AC-1, AC-2, AC-3, AC-5, AC-6, AC-8 at the level of the part form's hook: an automatic save (`gate.flush('auto')`, what the page's 30-second tick asks for) goes through the part form's own
 * save, sends only what is unsaved and readable, never says anything under a field that is still being typed in, reports a failure once and quietly, and pauses while a conflict waits for the person.
 * Fields A, B and C hold 1.00 (C is blank). Invented ids only.
 */

const number = (id: string): FormField => ({
  id,
  letter: id.toUpperCase(),
  label: `Field ${id}`,
  kind: 'input',
  unit: null,
  hint: null,
  defaultValue: null,
  required: true,
  editable: true,
  visibleWhen: null,
  rule: { type: 'number', decimals: 2 },
});

const A = number('a');
const B = number('b');
const C = number('c');
const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const IST_TEN_FORTY_TWO = new Date('2026-11-20T05:12:00.000Z');

async function open(editable = true, onWrote: (at: string) => void = () => undefined) {
  partServer.reset({ a: '1.00', b: '1.00' });
  const gate = createSaveGate();
  const props: UsePartValuesProps = { estimateId: 'e', part: { id: PART_ID, slNo: '1', revision: 1 }, editable, fields: [A, B, C], onSaved: () => undefined, onChanged: () => undefined, onServerIgnored: () => undefined, onWrote, gate };
  const hook = renderHook(usePartValues, props);
  hook.render();
  await flushMicrotasks();
  return { gate, hook, tick: async () => { gate.flush('auto'); await gate.settle(); } };
}

// Only the date is faked, so the saves' own timers run as they do.
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: IST_TEN_FORTY_TWO }));
afterEach(() => vi.useRealTimers());

describe('AC-1: a typed value that is not saved is saved by the tick, through the part form\'s own save', () => {
  it('sends the typed value once, with the part\'s revision, and the part holds it', async () => {
    const wrote = vi.fn();
    const { gate, hook, tick } = await open(true, wrote);
    hook.render().setText('a', '2');
    expect(gate.isDirty()).toBe(true);
    await tick();
    expect(partServer.sent).toEqual([{ revision: 1, values: { a: '2.00' } }]);
    expect(partServer.inputs['a']).toBe('2.00');
    expect(gate.isDirty()).toBe(false);
    expect(wrote).toHaveBeenCalledTimes(1);
    expect(wrote).toHaveBeenCalledWith(IST_TEN_FORTY_TWO.toISOString());
  });

  it('sends each unsaved field, and a field that is blank over a stored value clears it', async () => {
    const { hook, tick } = await open();
    const form = hook.render();
    form.setText('a', '');
    form.setText('c', '4.5');
    await tick();
    expect(partServer.inputs).toEqual({ b: '1.00', c: '4.50' });
  });

  it('does nothing when the person may not edit the inputs', async () => {
    const { hook, tick } = await open(false);
    hook.render().setText('a', '2');
    await tick();
    expect(partServer.sent).toEqual([]);
  });
});

describe('AC-2: no false save', () => {
  it('sends nothing when nothing is unsaved', async () => {
    const { tick } = await open();
    await tick();
    expect(partServer.sent).toEqual([]);
  });

  it('sends nothing for a value that is equal to what the server holds after normalisation (1.0 against 1.00), and the field is not unsaved', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '1.0');
    expect(gate.isDirty()).toBe(false);
    await tick();
    expect(partServer.sent).toEqual([]);
    expect(partServer.revision).toBe(1);
  });
});

describe('AC-3: never in the way', () => {
  it('does not send a value the rule refuses, says nothing under the field, and keeps it unsaved so the warning on leaving still guards it', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', 'abc');
    await tick();
    await tick();
    expect(partServer.sent).toEqual([]);
    const form = hook.render();
    expect(form.errors['a']).toBeUndefined();
    expect(form.texts['a']).toBe('abc');
    expect(form.autosaveFailedAt).toBeNull();
    expect(gate.isDirty()).toBe(true);
  });

  it('sends a half-typed value once it passes its rule and does not rewrite what the person sees (1.5 stays 1.5 until the field is left)', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '1.5');
    await tick();
    expect(partServer.inputs['a']).toBe('1.50');
    const form = hook.render();
    expect(form.texts['a']).toBe('1.5');
    expect(form.errors['a']).toBeUndefined();
    expect(gate.isDirty()).toBe(false);
    form.commit(A);
    await gate.settle();
    expect(hook.render().texts['a']).toBe('1.50');
    expect(partServer.sent).toHaveLength(1);
  });

  it('typing again after a tick saved the field marks it unsaved again, and the next tick sends the new text', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '1.5');
    await tick();
    hook.render().setText('a', '1.55');
    expect(gate.isDirty()).toBe(true);
    await tick();
    expect(partServer.inputs['a']).toBe('1.55');
    expect(gate.isDirty()).toBe(false);
  });

  it('a field left with a message (a blur that the rule refused) is not sent by the tick and keeps its message', async () => {
    const { hook, tick } = await open();
    const form = hook.render();
    form.setText('a', 'abc');
    form.commit(A);
    await tick();
    expect(partServer.sent).toEqual([]);
    expect(hook.render().errors['a']).toBeDefined();
  });
});

describe('AC-5: a failure is one polite status, not an alert', () => {
  it('keeps what was typed and the unsaved mark, shows no alert, and reports the time of the failure', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '2');
    partServer.failNextSave();
    await tick();
    const form = hook.render();
    expect(form.autosaveFailedAt).toEqual(IST_TEN_FORTY_TWO);
    expect(form.problem).toBeNull();
    expect(form.texts['a']).toBe('2');
    expect(form.errors['a']).toBeUndefined();
    expect(gate.isDirty()).toBe(true);
    expect(partServer.inputs['a']).toBe('1.00');
  });

  it('is not repeated while the same failure continues: the time of the first failure stays', async () => {
    const { hook, tick } = await open();
    hook.render().setText('a', '2');
    partServer.failNextSave();
    await tick();
    vi.setSystemTime(new Date(IST_TEN_FORTY_TWO.getTime() + 30_000));
    partServer.failNextSave();
    await tick();
    expect(partServer.sent).toHaveLength(2);
    expect(hook.render().autosaveFailedAt).toEqual(IST_TEN_FORTY_TWO);
  });

  it('clears on the next success, and the value is saved', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '2');
    partServer.failNextSave();
    await tick();
    await tick();
    expect(partServer.inputs['a']).toBe('2.00');
    expect(hook.render().autosaveFailedAt).toBeNull();
    expect(gate.isDirty()).toBe(false);
  });

  it('clears when Save draft (a flush) is what saved the value', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '2');
    partServer.failNextSave();
    await tick();
    gate.flush();
    await gate.settle();
    expect(hook.render().autosaveFailedAt).toBeNull();
  });

  it('treats a 422 on a field as a failure: no message under the field, no alert, one status, and the same value is not sent again on every tick', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '2');
    partServer.refuseNextSave();
    await tick();
    const form = hook.render();
    expect(form.autosaveFailedAt).toEqual(IST_TEN_FORTY_TWO);
    expect(form.errors['a']).toBeUndefined();
    expect(form.problem).toBeNull();
    expect(gate.isDirty()).toBe(true);
    await tick();
    await tick();
    expect(partServer.sent).toHaveLength(1);
    hook.render().setText('a', '3');
    await tick();
    expect(partServer.inputs['a']).toBe('3.00');
    expect(hook.render().autosaveFailedAt).toBeNull();
  });

  it('a failed blur keeps its own alert: the tick\'s quiet words are for the tick\'s own saves', async () => {
    const { hook } = await open();
    const form = hook.render();
    form.setText('a', '2');
    partServer.failNextSave();
    form.commit(A);
    await flushMicrotasks();
    const after = hook.render();
    expect(after.problem).toEqual({ kind: 'failed' });
    expect(after.autosaveFailedAt).toBeNull();
  });
});

describe('AC-6: a conflict follows the rules of Save draft, and the tick pauses until it is resolved', () => {
  async function conflictOnB() {
    const opened = await open();
    const form = opened.hook.render();
    form.setText('a', '2');
    form.setText('b', '3');
    partServer.changeElsewhere({ b: '9.00' });
    await opened.tick();
    return opened;
  }

  it('never overwrites the newer value, keeps the typed text and shows the conflict choices', async () => {
    const { hook } = await conflictOnB();
    const form = hook.render();
    expect(form.problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 'b', newer: '9.00' }] });
    expect(form.texts['b']).toBe('3');
    expect(partServer.inputs).toEqual({ a: '2.00', b: '9.00' });
  });

  it('sends nothing while the conflict waits, even for another field, and goes on once the person has chosen', async () => {
    const { gate, hook, tick } = await conflictOnB();
    const sentBefore = partServer.sent.length;
    hook.render().setText('c', '5');
    await tick();
    await tick();
    expect(partServer.sent).toHaveLength(sentBefore);
    expect(partServer.inputs['c']).toBeUndefined();
    hook.render().resolveConflict('newer');
    await tick();
    expect(partServer.inputs['c']).toBe('5.00');
    expect(partServer.inputs['b']).toBe('9.00');
    expect(gate.isDirty()).toBe(false);
  });
});

describe('AC-8: with Save draft', () => {
  it('Save draft pressed while a tick\'s save is in flight joins it: one save, not two', async () => {
    const { gate, hook } = await open();
    hook.render().setText('a', '2');
    const release = partServer.holdNextSave();
    gate.flush('auto');
    await flushMicrotasks();
    expect(gate.isSaving()).toBe(true);
    gate.flush();
    release();
    await gate.settle();
    expect(partServer.sent).toHaveLength(1);
    expect(partServer.inputs['a']).toBe('2.00');
  });

  it('Calculate (settle) waits for the tick\'s save, so it never goes with older values than the screen shows', async () => {
    const { gate, hook } = await open();
    hook.render().setText('a', '2');
    const release = partServer.holdNextSave();
    gate.flush('auto');
    await flushMicrotasks();
    let settled = false;
    const waiting = gate.settle().then((clean) => {
      settled = true;
      return clean;
    });
    await flushMicrotasks();
    expect(settled).toBe(false);
    release();
    expect(await waiting).toBe(true);
    expect(partServer.inputs['a']).toBe('2.00');
  });
});

/**
 * STORY-05.10 AC-7a to AC-7f (amended 2026-11-25, QLT-F-05, #687) at the level of the part form's hook: `gate.flush('leave')` is what the page asks for when the tab becomes hidden or the page is left.
 * It is the tick's save (`autosaveField`: the same rules, the same one save, the same quiet failure), and its requests also survive the page going away (`keepalive`).
 */
describe('AC-7a to AC-7f: a save at once when the tab is hidden or the page is left', () => {
  const leave = async (gate: ReturnType<typeof createSaveGate>): Promise<void> => {
    gate.flush('leave');
    await gate.settle();
  };

  it('AC-7a, AC-7b: sends the typed value at once, with the part revision, through the part form own save, asking that the request survive the page going away', async () => {
    const { gate, hook } = await open();
    hook.render().setText('a', '2');
    await leave(gate);
    expect(partServer.sent).toEqual([{ revision: 1, values: { a: '2.00' } }]);
    expect(partServer.keepalive).toEqual([true]);
    expect(partServer.inputs['a']).toBe('2.00');
    expect(gate.isDirty()).toBe(false);
  });

  it('AC-7a, AC-4: the "Last saved" line follows that save, and nothing is said under the field', async () => {
    const wrote = vi.fn();
    const { gate, hook } = await open(true, wrote);
    hook.render().setText('a', '2');
    await leave(gate);
    expect(wrote).toHaveBeenCalledWith(IST_TEN_FORTY_TWO.toISOString());
    const form = hook.render();
    expect(form.errors['a']).toBeUndefined();
    expect(form.problem).toBeNull();
    expect(form.autosaveFailedAt).toBeNull();
  });

  it('the 30-second tick is not a leave: its request does not ask to survive the page going away, and a leave is not sticky', async () => {
    const { gate, hook, tick } = await open();
    const form = hook.render();
    form.setText('a', '2');
    await tick();
    form.setText('b', '3');
    await leave(gate);
    hook.render().setText('c', '4');
    await tick();
    expect(partServer.keepalive).toEqual([false, true, false]);
  });

  it('AC-7c: a hide followed by a leave (a tab that is closed) sends the same text once', async () => {
    const { gate, hook } = await open();
    hook.render().setText('a', '2');
    const release = partServer.holdNextSave();
    gate.flush('leave');
    await flushMicrotasks();
    gate.flush('leave');
    release();
    await gate.settle();
    expect(partServer.sent).toHaveLength(1);
    gate.flush('leave');
    await gate.settle();
    expect(partServer.sent).toHaveLength(1);
    expect(partServer.revision).toBe(2);
  });

  it('AC-7a: a save in flight is not raced: a text typed meanwhile is queued behind it, sent once with the revision the first made, and asked to survive', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    form.setText('a', '2');
    const release = partServer.holdNextSave();
    form.commit(A);
    await flushMicrotasks();
    expect(gate.isSaving()).toBe(true);
    form.setText('a', '3');
    gate.flush('leave');
    gate.flush('leave');
    release();
    await gate.settle();
    expect(partServer.sent).toEqual([
      { revision: 1, values: { a: '2.00' } },
      { revision: 2, values: { a: '3.00' } },
    ]);
    expect(partServer.keepalive).toEqual([false, true]);
    expect(partServer.inputs['a']).toBe('3.00');
  });

  it('AC-7f: nothing unsaved, nothing sent', async () => {
    const { gate } = await open();
    await leave(gate);
    await leave(gate);
    expect(partServer.sent).toEqual([]);
  });

  it('AC-7c, AC-2: a value equal to what the server holds after normalisation (1.0 against 1.00) is not sent, and no revision moves', async () => {
    const { gate, hook } = await open();
    hook.render().setText('a', '1.0');
    await leave(gate);
    expect(partServer.sent).toEqual([]);
    expect(partServer.revision).toBe(1);
  });

  it('AC-7f, AC-3: a text the rule refuses is not sent, says nothing, and stays unsaved so the warning on leaving still guards it', async () => {
    const { gate, hook } = await open();
    hook.render().setText('a', 'abc');
    await leave(gate);
    expect(partServer.sent).toEqual([]);
    const form = hook.render();
    expect(form.errors['a']).toBeUndefined();
    expect(gate.isDirty()).toBe(true);
  });

  it('AC-7f: nothing is sent when the person may not edit the inputs', async () => {
    const { gate, hook } = await open(false);
    hook.render().setText('a', '2');
    await leave(gate);
    expect(partServer.sent).toEqual([]);
  });

  it('AC-7d: a failed save on hide keeps the value and the unsaved mark, shows the one quiet status (not an alert), and the next automatic save sends it again and clears the status', async () => {
    const { gate, hook, tick } = await open();
    hook.render().setText('a', '2');
    partServer.failNextSave();
    await leave(gate);
    const form = hook.render();
    expect(form.autosaveFailedAt).toEqual(IST_TEN_FORTY_TWO);
    expect(form.problem).toBeNull();
    expect(form.texts['a']).toBe('2');
    expect(gate.isDirty()).toBe(true);
    expect(partServer.inputs['a']).toBe('1.00');
    await tick();
    expect(partServer.inputs['a']).toBe('2.00');
    expect(hook.render().autosaveFailedAt).toBeNull();
    expect(gate.isDirty()).toBe(false);
  });

  it('AC-7e: a hide save refused because the part changed elsewhere (409) never overwrites, keeps what was typed, shows the conflict, and pauses every automatic save until the person chooses', async () => {
    const { gate, hook, tick } = await open();
    const form = hook.render();
    form.setText('a', '2');
    form.setText('b', '3');
    partServer.changeElsewhere({ b: '9.00' });
    await leave(gate);
    const after = hook.render();
    expect(after.problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 'b', newer: '9.00' }] });
    expect(after.texts['b']).toBe('3');
    expect(partServer.inputs).toEqual({ a: '2.00', b: '9.00' });
    const sent = partServer.sent.length;
    await leave(gate);
    await tick();
    expect(partServer.sent).toHaveLength(sent);
    hook.render().resolveConflict('newer');
    expect(hook.render().problem).toBeNull();
  });

  it('AC-7e: while a conflict waits for the person, a hide sends nothing, even for another field', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    form.setText('b', '3');
    partServer.changeElsewhere({ b: '9.00' });
    await leave(gate);
    const sent = partServer.sent.length;
    hook.render().setText('c', '5');
    await leave(gate);
    expect(partServer.sent).toHaveLength(sent);
    expect(partServer.inputs['c']).toBeUndefined();
  });
});
