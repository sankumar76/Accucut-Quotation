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

async function open(held: Record<string, string> = { a: '1.00', b: '1.00' }) {
  partServer.reset(held);
  const gate = createSaveGate();
  const props: UsePartValuesProps = { estimateId: 'e', part: { id: PART_ID, slNo: '1', revision: 1 }, editable: true, fields: [A, B, C], onSaved: NOTHING, onChanged: NOTHING, onWrote: NOTHING, gate };
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
