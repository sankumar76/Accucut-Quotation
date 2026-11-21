import { describe, expect, it, vi } from 'vitest';

import { usePartValues, type UsePartValuesProps } from '@/components/features/estimate-workspace/use-part-form';
import type { FormField } from '@/lib/estimates/form-client';
import { createSaveGate } from '@/lib/estimates/save-gate';

import { renderHook } from '../support/hook-harness';
import { PART_ID, partServer } from '../support/part-server';

vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);
vi.mock('@/lib/estimates/form-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/form-client')>();
  const { partServer: server } = await import('../support/part-server');
  return { ...original, loadPartInputs: server.load, savePartInputs: server.save };
});

/**
 * DEF-038 (AQP-341): the requests the part form sends for the journey of `estimate-fasteners.spec.ts:113` (one per field left, in the order left, and none more), and what the form does when another
 * writer makes the save of "None" fail with a 409 (DL-277): it shows the conflict or sends "None" again on the newer revision, and never leaves the screen at "None" over a part that does not hold it.
 * Invented ids only.
 */

const text = (id: string, defaultValue: string | null): FormField => ({
  id,
  letter: id.toUpperCase(),
  label: `Field ${id}`,
  kind: 'input',
  unit: null,
  hint: null,
  defaultValue,
  required: true,
  editable: true,
  visibleWhen: null,
  rule: { type: 'text', maxLength: 100, multiline: false },
});
const number = (id: string): FormField => ({ ...text(id, null), visibleWhen: { fieldId: 's', values: ['None'] }, rule: { type: 'number', decimals: 2 } });

const S = text('s', 'None');
const T = number('t');
const U = number('u');
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const NOTHING = (): void => undefined;

async function open(held: Record<string, string>) {
  partServer.reset(held);
  const gate = createSaveGate();
  const props: UsePartValuesProps = { estimateId: 'e', part: { id: PART_ID, slNo: '1', revision: 1 }, editable: true, fields: [S, T, U], onSaved: NOTHING, onChanged: NOTHING, onWrote: NOTHING, gate };
  const hook = renderHook(usePartValues, props);
  hook.render();
  await settle();
  return { gate, hook };
}

describe('AQP-341: the journey of the Fasteners test sends exactly four saves', () => {
  it('Fasteners, Qty, Cost and "None" are four requests, each with the revision the one before answered', async () => {
    const { gate, hook } = await open({});
    for (const [field, typed] of [
      [S, 'M6 bolt'],
      [T, '5'],
      [U, '3.5'],
      [S, 'None'],
    ] as const) {
      hook.render().setText(field.id, typed);
      hook.render().commit(field);
      await gate.settle();
      await settle();
    }
    expect(partServer.sent).toEqual([
      { revision: 1, values: { s: 'M6 bolt' } },
      { revision: 2, values: { t: '5.00' } },
      { revision: 3, values: { u: '3.50' } },
      { revision: 4, values: { s: 'None' } },
    ]);
  });
});

describe('DL-277: another writer makes the save of "None" fail with a 409', () => {
  const HELD = { s: 'M6 bolt', t: '5.00', u: '3.50' };

  it('the part is read again, the other writer\'s Fasteners is not overwritten, and the screen shows the conflict with the typed "None" kept and unsaved', async () => {
    const { gate, hook } = await open(HELD);
    hook.render().setText('s', 'None');
    partServer.changeElsewhere({ s: 'Rivets' });
    hook.render().commit(S);
    await gate.settle();
    // One request only: the 409. "None" is not sent again over "Rivets".
    expect(partServer.sent).toEqual([{ revision: 1, values: { s: 'None' } }]);
    expect(partServer.inputs['s']).toBe('Rivets');
    const form = hook.render();
    expect(form.texts['s']).toBe('None');
    expect(form.problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 's', newer: 'Rivets' }] });
    expect(form.errors['s']).toBe('Changed somewhere else. The newer value is "Rivets".');
    expect(gate.isDirty()).toBe(true);
  });

  it('when the other writer changed another field, the part is read again (the newer value is shown) and "None" is sent again with the new revision, with no notice', async () => {
    const { gate, hook } = await open(HELD);
    hook.render().setText('s', 'None');
    partServer.changeElsewhere({ u: '9.00' });
    hook.render().commit(S);
    await gate.settle();
    expect(partServer.sent).toEqual([
      { revision: 1, values: { s: 'None' } },
      { revision: 2, values: { s: 'None' } },
    ]);
    expect(partServer.inputs['s']).toBe('None');
    const form = hook.render();
    expect(form.texts['u']).toBe('9.00');
    expect(form.problem).toBeNull();
    expect(gate.isDirty()).toBe(false);
  });
});
