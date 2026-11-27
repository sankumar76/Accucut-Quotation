import { describe, expect, it, vi } from 'vitest';

import { usePartValues, type UsePartValuesProps } from '@/components/features/estimate-workspace/use-part-form';
import type { FormField } from '@/lib/estimates/form-client';
import { createSaveGate } from '@/lib/estimates/save-gate';

import { renderHook } from '../support/hook-harness';
import { PART_ID, partServer } from '../support/part-server';

// The hook runs with no DOM: React's hooks are the harness's, and the server is an invented one (`tests/support/part-server.ts`), as in `use-part-values.test.ts`.
vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);
vi.mock('@/lib/estimates/form-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/form-client')>();
  const { partServer: server } = await import('../support/part-server');
  return { ...original, loadPartInputs: server.load, savePartInputs: server.save };
});

/**
 * AQP-447 (DEF-090; UX ruling `parts-tree-scr05-conformance-2026-11-26.md` item 2, checks NAME-4 and NAME-5): the row in the tree takes its name when the person leaves Description or Part No. with a changed text,
 * not on each key and without waiting for the save. The name is the first of the two that holds a text. Invented ids only.
 */

const text = (id: string, letter: string, nameKey?: 'description' | 'part-no'): FormField => ({
  id,
  letter,
  label: `Field ${id}`,
  kind: 'input',
  unit: null,
  hint: null,
  defaultValue: null,
  required: true,
  editable: true,
  ...(nameKey === undefined ? {} : { nameKey }),
  visibleWhen: null,
  rule: { type: 'text', maxLength: 200, multiline: false },
});

const PART_NO = text('partno', 'B', 'part-no');
const DESCRIPTION = text('desc', 'D', 'description');
const MODEL = text('model', 'M');
const NOTHING = (): void => undefined;
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function open(held: Record<string, string>) {
  partServer.reset(held);
  const onNamed = vi.fn();
  const props: UsePartValuesProps = { estimateId: 'e', part: { id: PART_ID, slNo: '1', revision: 1 }, editable: true, fields: [PART_NO, DESCRIPTION, MODEL], onSaved: NOTHING, onChanged: NOTHING, onNamed, onServerIgnored: NOTHING, onWrote: NOTHING, gate: createSaveGate() };
  const hook = renderHook(usePartValues, props);
  hook.render();
  await flush();
  return { hook, onNamed };
}

describe('the name of the row when a field is left', () => {
  it('is not told while the person types, only when the field is left (NAME-4)', async () => {
    const { hook, onNamed } = await open({});
    hook.render().setText('desc', 'Base frame');
    expect(onNamed).not.toHaveBeenCalled();
    hook.render().commit(DESCRIPTION);
    expect(onNamed).toHaveBeenCalledExactlyOnceWith(PART_ID, 'Base frame');
  });

  it('is told before the save has answered', async () => {
    const { hook, onNamed } = await open({});
    hook.render().setText('desc', 'Base frame');
    hook.render().commit(DESCRIPTION);
    expect(onNamed).toHaveBeenCalledTimes(1);
    expect(partServer.sent).toHaveLength(0);
    await flush();
  });

  it('is the Description rather than the Part No. when both are typed, and the trimmed text', async () => {
    const { hook, onNamed } = await open({ partno: 'XP-1101' });
    hook.render().setText('desc', '  Base frame  ');
    hook.render().commit(DESCRIPTION);
    expect(onNamed).toHaveBeenLastCalledWith(PART_ID, 'Base frame');
  });

  it('is the Part No. when there is no Description (NAME-2)', async () => {
    const { hook, onNamed } = await open({});
    hook.render().setText('partno', 'XP-1101');
    hook.render().commit(PART_NO);
    expect(onNamed).toHaveBeenLastCalledWith(PART_ID, 'XP-1101');
  });

  it('falls back to the Part No. when the Description is cleared, and to nothing when both are empty (NAME-5)', async () => {
    const { hook, onNamed } = await open({ partno: 'XP-1101', desc: 'Base frame' });
    hook.render().setText('desc', '');
    hook.render().commit(DESCRIPTION);
    expect(onNamed).toHaveBeenLastCalledWith(PART_ID, 'XP-1101');
    hook.render().setText('partno', '');
    hook.render().commit(PART_NO);
    expect(onNamed).toHaveBeenLastCalledWith(PART_ID, '');
  });

  it('is not told for a field that does not name the row, or when the text did not change', async () => {
    const { hook, onNamed } = await open({ desc: 'Base frame' });
    hook.render().setText('model', 'Invented');
    hook.render().commit(MODEL);
    hook.render().commit(DESCRIPTION);
    expect(onNamed).not.toHaveBeenCalled();
  });
});
