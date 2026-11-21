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

/** DEF-038 (AQP-341): the requests the part form sends for the journey of `estimate-fasteners.spec.ts:113`: one per field left, in the order left, and none more. Invented ids only. */

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

describe('AQP-341: the journey of the Fasteners test sends exactly four saves', () => {
  it('Fasteners, Qty, Cost and "None" are four requests, each with the revision the one before answered', async () => {
    partServer.reset({});
    const gate = createSaveGate();
    const props: UsePartValuesProps = { estimateId: 'e', part: { id: PART_ID, slNo: '1', revision: 1 }, editable: true, fields: [S, T, U], onSaved: () => undefined, onChanged: () => undefined, onWrote: () => undefined, gate };
    const hook = renderHook(usePartValues, props);
    hook.render();
    await settle();
    for (const [field, typed] of [[S, 'M6 bolt'], [T, '5'], [U, '3.5'], [S, 'None']] as const) {
      const form = hook.render();
      form.setText(field.id, typed);
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
