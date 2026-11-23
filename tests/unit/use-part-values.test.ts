import { describe, expect, it, vi } from 'vitest';

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
 * STORY-05.08 AC-5, AC-6, review SQR-01, SQR-02, SQR-04 of PR 424: the queue of saves and the re-read after a 409, at the level of the hook. Two fields, A and B, hold 1.00. Another tab changes B to 9.00
 * while this tab has typed into both: this tab's save of A is refused (409), the part is read again, A is sent again with the new revision, and B is in conflict. Nothing may send this tab's B over 9.00 until
 * the person chooses, whether it was queued before the 409 (SQR-01), whatever saves go through after it (SQR-02), or Save draft is pressed. Invented ids only.
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
const NOTHING = (): void => undefined;
const flushMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function open(held: Record<string, string> = { a: '1.00', b: '1.00' }, fields: ReadonlyArray<FormField> = [A, B, C]) {
  partServer.reset(held);
  const gate = createSaveGate();
  const props: UsePartValuesProps = { estimateId: 'e', part: { id: PART_ID, slNo: '1', revision: 1 }, editable: true, fields, onSaved: NOTHING, onChanged: NOTHING, onServerIgnored: NOTHING, onWrote: NOTHING, gate };
  const hook = renderHook(usePartValues, props);
  hook.render();
  await flushMicrotasks();
  return { gate, hook };
}

/** Types 2 into A and 3 into B, the other tab changes B to 9.00, and both fields are left: A's save is refused first, B's was queued behind it. */
async function disagreeOnB() {
  const opened = await open();
  const form = opened.hook.render();
  form.setText('a', '2');
  form.setText('b', '3');
  partServer.changeElsewhere({ b: '9.00' });
  form.commit(A);
  form.commit(B);
  await opened.gate.settle();
  return opened;
}

const sentForB = (): number => partServer.sent.filter((save) => 'b' in save.values).length;

describe('SQR-01: a save queued before the 409 does not overwrite the newer value', () => {
  it('sends A again with the new revision, never sends B, and leaves B in conflict with the typed text and the newer value', async () => {
    const { gate, hook } = await disagreeOnB();
    expect(partServer.sent).toEqual([
      { revision: 1, values: { a: '2.00' } },
      { revision: 2, values: { a: '2.00' } },
    ]);
    expect(partServer.inputs).toEqual({ a: '2.00', b: '9.00' });
    const form = hook.render();
    expect(form.texts['b']).toBe('3.00');
    expect(form.problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 'b', newer: '9.00' }] });
    expect(form.errors['b']).toBe('Changed somewhere else. The newer value is "9.00".');
    expect(gate.isDirty()).toBe(true);
  });

  it('leaving the field and Save draft (flush) send nothing over the newer value either', async () => {
    const { gate, hook } = await disagreeOnB();
    hook.render().commit(B);
    gate.flush();
    await gate.settle();
    expect(sentForB()).toBe(0);
    expect(partServer.inputs['b']).toBe('9.00');
    expect(await gate.settle()).toBe(false);
  });
});

describe('SQR-02: a later good save does not take the conflict away', () => {
  it('keeps the notice and the field unsaved after a save of another field goes through', async () => {
    const { gate, hook } = await disagreeOnB();
    const form = hook.render();
    form.setText('a', '5');
    form.commit(A);
    await gate.settle();
    expect(partServer.inputs['a']).toBe('5.00');
    const after = hook.render();
    expect(after.problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 'b', newer: '9.00' }] });
    expect(gate.isDirty()).toBe(true);
  });

  it('"Use the newer values" then shows 9.00, sends nothing, and the page is clean', async () => {
    const { gate, hook } = await disagreeOnB();
    hook.render().resolveConflict('newer');
    const after = hook.render();
    expect(after.texts['b']).toBe('9.00');
    expect(after.problem).toBeNull();
    expect(sentForB()).toBe(0);
    expect(gate.isDirty()).toBe(false);
  });

  it('"Keep what I typed" sends B once, with the revision the part has now, and then the page is clean', async () => {
    const { gate, hook } = await disagreeOnB();
    const revision = partServer.revision;
    hook.render().resolveConflict('mine');
    await gate.settle();
    expect(partServer.sent.at(-1)).toEqual({ revision, values: { b: '3.00' } });
    expect(partServer.inputs['b']).toBe('3.00');
    expect(hook.render().problem).toBeNull();
    expect(gate.isDirty()).toBe(false);
  });

  it('typing in the field is the choice to keep one\'s own: the conflict ends, and the next leave sends the typed text', async () => {
    const { gate, hook } = await disagreeOnB();
    const form = hook.render();
    form.setText('b', '4');
    expect(hook.render().problem).toBeNull();
    form.commit(B);
    await gate.settle();
    expect(partServer.inputs['b']).toBe('4.00');
  });
});

describe('SQR-13: a choice made while the re-read is still sending does not let an old queued save through', () => {
  /** A and B are left together; the other tab changed B; the re-read's second save of A (the resend) is held, so the notice is on screen while B's old save is still queued behind it. */
  async function noticeUpWhileResendIsHeld() {
    const opened = await open();
    const form = opened.hook.render();
    form.setText('a', '2');
    form.setText('b', '3');
    partServer.changeElsewhere({ b: '9.00' });
    const release = partServer.holdSaveNumber(2);
    form.commit(A);
    form.commit(B);
    await flushMicrotasks();
    expect(opened.hook.render().problem?.kind).toBe('conflict');
    return { ...opened, release };
  }

  it('"Use the newer values" before the resend is answered: B is not sent afterwards, the screen and the part agree on 9.00, and nothing is left unsaved', async () => {
    const { gate, hook, release } = await noticeUpWhileResendIsHeld();
    hook.render().resolveConflict('newer');
    release();
    await gate.settle();
    expect(sentForB()).toBe(0);
    expect(partServer.inputs['b']).toBe('9.00');
    expect(hook.render().texts['b']).toBe('9.00');
    expect(gate.isDirty()).toBe(false);
  });

  it('"Keep what I typed" before the resend is answered: B is sent once, by the choice, and not a second time by the old queued save', async () => {
    const { gate, hook, release } = await noticeUpWhileResendIsHeld();
    hook.render().resolveConflict('mine');
    release();
    await gate.settle();
    expect(sentForB()).toBe(1);
    expect(partServer.inputs['b']).toBe('3.00');
    expect(gate.isDirty()).toBe(false);
  });
});

describe('SQR-14: another field\'s failure is shown beside the conflict notice, not swallowed by it', () => {
  it('keeps the notice and adds the failure, which stays when the conflict is resolved', async () => {
    const { gate, hook } = await disagreeOnB();
    const form = hook.render();
    form.setText('c', '1');
    partServer.failNextSave();
    form.commit(C);
    await gate.settle();
    expect(hook.render().problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 'b', newer: '9.00' }], also: { kind: 'failed' } });
    expect(gate.isDirty()).toBe(true);
    hook.render().resolveConflict('newer');
    expect(hook.render().problem).toEqual({ kind: 'failed' });
    expect(gate.isDirty()).toBe(true);
  });

  it('a good save clears that failure but not the conflict', async () => {
    const { gate, hook } = await disagreeOnB();
    const form = hook.render();
    form.setText('c', '1');
    partServer.failNextSave();
    form.commit(C);
    await gate.settle();
    form.setText('a', '7');
    form.commit(A);
    await gate.settle();
    expect(hook.render().problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 'b', newer: '9.00' }], also: undefined });
  });
});

describe('AC-5: what only this tab changed is sent again, what only the other tab changed is shown', () => {
  it('a field nobody else touched is saved with the new revision, the other tab\'s value is shown, and there is no notice', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    form.setText('a', '2');
    partServer.changeElsewhere({ b: '9.00' });
    form.commit(A);
    await gate.settle();
    expect(partServer.inputs).toEqual({ a: '2.00', b: '9.00' });
    const after = hook.render();
    expect(after.texts['b']).toBe('9.00');
    expect(after.problem).toBeNull();
    expect(gate.isDirty()).toBe(false);
  });

  it('a part that keeps changing is told to the person after two re-reads, with the typed text kept and marked unsaved', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    form.setText('a', '2');
    // Somebody else saves just before every save of this tab arrives, so every save is refused, however often the part is read again.
    partServer.churn(true);
    form.commit(A);
    await gate.settle();
    expect(partServer.sent).toHaveLength(3);
    expect(hook.render().problem?.kind).toBe('refused');
    expect(hook.render().texts['a']).toBe('2.00');
    expect(gate.isDirty()).toBe(true);
  });
});

describe('SQR-04: a text that cannot be read keeps its mark when the refused save is settled', () => {
  it('the person typed something unreadable into A while its save was in flight: the 409 does not make it look saved', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    const release = partServer.holdNextSave();
    form.setText('a', '2');
    form.commit(A);
    partServer.changeElsewhere({ a: '9.00' });
    form.setText('a', 'abc');
    release();
    await gate.settle();
    expect(gate.isDirty()).toBe(true);
    expect(await gate.settle()).toBe(false);
    expect(partServer.inputs['a']).toBe('9.00');
  });
});

/**
 * AQP-407 (DEF-065), STORY-05.06 AC-1: a flag chosen and then chosen the other way inside one save round trip. The second choice is compared with the value already on its way, not only with what
 * the server held when the first was asked for, so the last choice is what the server ends up holding. `onToggle` of `part-fields.tsx` does `setText` and `commit` with the new text, with no waiting between.
 */
describe('AQP-407: a flag toggled twice within one save round trip', () => {
  const P: FormField = { ...number('p'), defaultValue: '0', required: false, rule: { type: 'flag' } };
  const openFlag = (held: Record<string, string>) => open(held, [P]);
  const toggle = (form: ReturnType<typeof usePartValues>, on: boolean): void => {
    const text = on ? '1' : '0';
    form.setText('p', text);
    form.commit(P, text);
  };

  // The second choice comes either at once (the first save is queued and has not been sent: it is made out of date and only the last is sent) or after the first request has reached the server and is waiting for its answer (both are sent).
  describe.each([
    { when: 'at once', arrived: false },
    { when: 'while the first save waits for its answer', arrived: true },
  ])('the second choice comes $when', ({ arrived }) => {
    const twoChoices = async (held: Record<string, string>, first: boolean) => {
      const { gate, hook } = await openFlag(held);
      const form = hook.render();
      const release = partServer.holdNextSave();
      toggle(form, first);
      if (arrived) await flushMicrotasks();
      toggle(form, !first);
      release();
      await gate.settle();
      return { gate, hook };
    };

    it('AC-1: ON then OFF with nothing stored ends with no 1 stored, and the screen agrees', async () => {
      const { gate, hook } = await twoChoices({}, true);
      expect(partServer.sent.at(-1)).toMatchObject({ values: { p: '0' } });
      expect(partServer.sent).toHaveLength(arrived ? 2 : 1);
      expect(partServer.inputs['p'] ?? '0').toBe('0');
      expect(hook.render().texts['p']).toBe('0');
      expect(gate.isDirty()).toBe(false);
    });

    it('AC-1: OFF then ON with 1 stored ends with 1 stored, and the screen agrees', async () => {
      const { gate, hook } = await twoChoices({ p: '1' }, false);
      expect(partServer.sent.at(-1)).toMatchObject({ values: { p: '1' } });
      expect(partServer.sent).toHaveLength(arrived ? 2 : 1);
      expect(partServer.inputs['p']).toBe('1');
      expect(hook.render().texts['p']).toBe('1');
      expect(gate.isDirty()).toBe(false);
    });
  });

  it('AC-1: with the first request in flight, ON then OFF sends both, the second with the revision the first made', async () => {
    const { gate, hook } = await openFlag({});
    const form = hook.render();
    const release = partServer.holdNextSave();
    toggle(form, true);
    await flushMicrotasks();
    toggle(form, false);
    release();
    await gate.settle();
    expect(partServer.sent).toEqual([
      { revision: 1, values: { p: '1' } },
      { revision: 2, values: { p: '0' } },
    ]);
  });

  it('AC-1: with the first request in flight, OFF then ON from a stored 1 sends both and ends with 1', async () => {
    const { gate, hook } = await openFlag({ p: '1' });
    const form = hook.render();
    const release = partServer.holdNextSave();
    toggle(form, false);
    await flushMicrotasks();
    toggle(form, true);
    release();
    await gate.settle();
    expect(partServer.sent).toEqual([
      { revision: 1, values: { p: '0' } },
      { revision: 2, values: { p: '1' } },
    ]);
    expect(partServer.inputs['p']).toBe('1');
  });

  it('AC-1: four choices in one round trip, the first on its way, end with the last one (OFF)', async () => {
    const { gate, hook } = await openFlag({});
    const form = hook.render();
    const release = partServer.holdNextSave();
    toggle(form, true);
    await flushMicrotasks();
    toggle(form, false);
    toggle(form, true);
    toggle(form, false);
    release();
    await gate.settle();
    expect(partServer.inputs['p'] ?? '0').toBe('0');
    expect(partServer.sent.at(-1)).toMatchObject({ values: { p: '0' } });
    expect(hook.render().texts['p']).toBe('0');
  });

  it('QLT-02: ON, OFF, ON with the first save lost after the others queue, then OFF while the third is in flight, ends OFF (only the latest save of the field clears what is on its way)', async () => {
    const { gate, hook } = await openFlag({});
    const form = hook.render();
    partServer.failAfterHold();
    const releaseFirst = partServer.holdNextSave();
    toggle(form, true);
    await flushMicrotasks();
    // The first request has reached the server and waits. The next request to arrive is the third choice: the second is made out of date by it and is never sent.
    const releaseThird = partServer.holdNextSave();
    toggle(form, false);
    toggle(form, true);
    releaseFirst();
    await flushMicrotasks();
    toggle(form, false);
    releaseThird();
    await gate.settle();
    expect(partServer.inputs['p'] ?? '0').toBe('0');
    expect(hook.render().texts['p']).toBe('0');
    expect(gate.isDirty()).toBe(false);
  });

  it('QLT-03: a save lost after a later choice was queued does not leave the field unsaved once the later one is stored', async () => {
    const { gate, hook } = await openFlag({});
    const form = hook.render();
    partServer.failAfterHold();
    const release = partServer.holdNextSave();
    toggle(form, true);
    await flushMicrotasks();
    toggle(form, false);
    release();
    await gate.settle();
    expect(partServer.inputs['p'] ?? '0').toBe('0');
    expect(hook.render().unstored.size).toBe(0);
    expect(hook.render().problem).toBeNull();
    expect(gate.isDirty()).toBe(false);
  });

  it('QLT-03: the same for a number field', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    partServer.failAfterHold();
    const release = partServer.holdNextSave();
    form.setText('a', '2');
    form.commit(A);
    await flushMicrotasks();
    form.setText('a', '3');
    form.commit(A);
    release();
    await gate.settle();
    expect(partServer.inputs['a']).toBe('3.00');
    expect(hook.render().unstored.size).toBe(0);
    expect(gate.isDirty()).toBe(false);
  });

  it('QLT-01: a 409 that adopts the other tab value for a flag does not send the queued second choice over it', async () => {
    const { gate, hook } = await openFlag({});
    const form = hook.render();
    const release = partServer.holdNextSave();
    toggle(form, true);
    await flushMicrotasks();
    toggle(form, false);
    partServer.changeElsewhere({ p: '1' });
    release();
    await gate.settle();
    expect(partServer.inputs['p']).toBe('1');
    expect(hook.render().texts['p']).toBe('1');
    expect(partServer.sent).toHaveLength(1);
    expect(gate.isDirty()).toBe(false);
  });

  it('QLT-01: the same for a number field (typed back to what the part held, while the other tab changed it)', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    const release = partServer.holdNextSave();
    form.setText('a', '2');
    form.commit(A);
    await flushMicrotasks();
    form.setText('a', '1');
    form.commit(A);
    partServer.changeElsewhere({ a: '5.00' });
    release();
    await gate.settle();
    expect(partServer.inputs['a']).toBe('5.00');
    expect(hook.render().texts['a']).toBe('5.00');
    expect(partServer.sent).toHaveLength(1);
    expect(gate.isDirty()).toBe(false);
  });

  it('the same choice made twice within one round trip is still one request', async () => {
    const { gate, hook } = await openFlag({});
    const form = hook.render();
    const release = partServer.holdNextSave();
    toggle(form, true);
    toggle(form, true);
    release();
    await gate.settle();
    expect(partServer.sent).toEqual([{ revision: 1, values: { p: '1' } }]);
  });

  it('a choice of the default with nothing on its way sends nothing (as before)', async () => {
    const { gate, hook } = await openFlag({});
    toggle(hook.render(), false);
    await gate.settle();
    expect(partServer.sent).toEqual([]);
  });

  it('a text typed back to what the server holds while its save is on its way is still unsaved, so the 30-second save mends it', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    const release = partServer.holdNextSave();
    form.setText('a', '2');
    form.commit(A);
    form.setText('a', '1');
    release();
    await gate.settle();
    expect(partServer.inputs['a']).toBe('2.00');
    expect(gate.isDirty()).toBe(true);
    gate.flush('auto');
    await gate.settle();
    expect(partServer.inputs['a']).toBe('1.00');
    expect(gate.isDirty()).toBe(false);
  });

  it('a text typed back to what the server holds while its save is on its way is sent when the field is left', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    const release = partServer.holdNextSave();
    form.setText('a', '2');
    form.commit(A);
    form.setText('a', '1');
    form.commit(A);
    release();
    await gate.settle();
    expect(partServer.inputs['a']).toBe('1.00');
    expect(gate.isDirty()).toBe(false);
  });
});

/**
 * AQP-408 (DEF-066) and the clearing half of AQP-407: Fasteners (S, a text with the default "None") with Qty and Cost (T, U) that watch it, as in `fasteners-none-requests.test.ts`. The save that follows a change of S sends
 * the watchers' typed text itself (`syncWatchers`), so a watcher left in the same round trip must not be sent a second time by its own queued save, and S cleared while its first save is on its way is a choice that is sent.
 */
describe('AQP-408: Fasteners and its watchers within one save round trip', () => {
  const S: FormField = { ...number('s'), defaultValue: 'None', rule: { type: 'text', maxLength: 100, multiline: false } };
  const watcher = (id: string): FormField => ({ ...number(id), visibleWhen: { fieldId: 's', values: ['None'] } });
  const T = watcher('t');
  const U = watcher('u');
  const openFasteners = () => open({}, [S, T, U]);
  const sentFor = (fieldId: string): number => partServer.sent.filter((save) => fieldId in save.values).length;

  it('DEF-066: Qty and Cost typed and left right after Fasteners are sent once each, not a second time by their own saves', async () => {
    const { gate, hook } = await openFasteners();
    const release = partServer.holdNextSave();
    for (const [field, typed] of [
      [S, 'M6 bolt'],
      [T, '5'],
      [U, '3.5'],
    ] as const) {
      hook.render().setText(field.id, typed);
      hook.render().commit(field);
    }
    release();
    await gate.settle();
    expect(sentFor('s')).toBe(1);
    expect(sentFor('t')).toBe(1);
    expect(sentFor('u')).toBe(1);
    expect(partServer.inputs).toEqual({ s: 'M6 bolt', t: '5.00', u: '3.50' });
    expect(gate.isDirty()).toBe(false);
  });

  it('DEF-066: Qty left while the save that follows Fasteners is on its way is not sent again', async () => {
    const { gate, hook } = await openFasteners();
    // Qty is typed while it is hidden, and kept; Fasteners then makes it show, and that save sends it.
    hook.render().setText('t', '5');
    const release = partServer.holdSaveNumber(2);
    hook.render().setText('s', 'M6 bolt');
    hook.render().commit(S);
    await flushMicrotasks();
    expect(sentFor('t')).toBe(1);
    hook.render().commit(T);
    release();
    await gate.settle();
    expect(sentFor('t')).toBe(1);
    expect(partServer.inputs['t']).toBe('5.00');
  });

  it('DEF-066: a Qty typed since the one a queued save carries is sent, and the earlier one is not sent after it', async () => {
    const { gate, hook } = await openFasteners();
    const release = partServer.holdNextSave();
    hook.render().setText('s', 'M6 bolt');
    hook.render().commit(S);
    hook.render().setText('t', '5');
    hook.render().commit(T);
    hook.render().setText('t', '6');
    release();
    await gate.settle();
    expect(partServer.inputs['t']).toBe('6.00');
    expect(partServer.sent.filter((save) => 't' in save.values).at(-1)?.values['t']).toBe('6.00');
  });

  describe.each([
    { when: 'at once', arrived: false },
    { when: 'while the first save waits for its answer', arrived: true },
  ])('AQP-407: Fasteners cleared $when', ({ arrived }) => {
    it('the clearing is what the server holds (nothing), and the screen shows "None" again', async () => {
      const { gate, hook } = await openFasteners();
      const release = partServer.holdNextSave();
      hook.render().setText('s', 'M6 bolt');
      hook.render().commit(S);
      if (arrived) await flushMicrotasks();
      hook.render().setText('s', '');
      hook.render().commit(S);
      release();
      await gate.settle();
      expect(partServer.sent.at(-1)).toMatchObject({ values: { s: '' } });
      expect(partServer.sent).toHaveLength(arrived ? 2 : 1);
      expect(partServer.inputs['s']).toBeUndefined();
      expect(hook.render().texts['s']).toBe('None');
      expect(gate.isDirty()).toBe(false);
    });
  });
});
