import { describe, expect, it, vi } from 'vitest';

import { usePartValues, type UsePartValuesProps } from '@/components/features/estimate-workspace/use-part-form';
import type { FormField } from '@/lib/estimates/form-client';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';
import { createSaveGate, type FlushMode } from '@/lib/estimates/save-gate';

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
 * DEF-148 (AQP-505, DL-472), STORY-05.08 AC-5 and AC-6: a save always sends the revision of the values the form holds (the seed's, the load's, its own saves' and the conflict re-read's), never the revision
 * the tree's row shows. A tree re-read (`tree.readAgain`: an add, a delete, a move) that shows a newer revision for the open part used to move the revision a save sends while the form kept the older values: the next
 * save then went through with no 409, and Save draft, a tab hide or the 30-second save sent the old text back over every other field the other person had changed.
 *
 * S1 (the grade): the other person changes two fields, A and B; this person edits one, C. The tree is read again. Save draft, a tab hide and one 30-second tick are each a separate case, and each reads the server.
 * Invented ids and values only.
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
const HELD = { a: '1.00', b: '1.00', c: '1.00' };

/** The part target the tree hands the form, whose revision a test moves the way a tree re-read does. */
interface TreeRow {
  id: string;
  slNo: string;
  revision: number;
}

async function open(held: Record<string, string> = HELD, seed?: PartFormSeed) {
  partServer.reset(held);
  const gate = createSaveGate();
  const row: TreeRow = { id: PART_ID, slNo: '1', revision: 1 };
  const props: UsePartValuesProps = { estimateId: 'e', part: row, editable: true, fields: [A, B, C], onSaved: NOTHING, onChanged: NOTHING, onNamed: NOTHING, onServerIgnored: NOTHING, onWrote: NOTHING, gate, seed };
  const hook = renderHook(usePartValues, props);
  hook.render();
  await flushMicrotasks();
  return { gate, hook, row };
}

/** The tree is read again and shows the part's revision as the server has it now: what `onChanged: tree.readAgain` does after an add, a delete or a move. */
function treeReadAgain(row: TreeRow): void {
  row.revision = partServer.revision;
}

/** S1 up to the first save: the other person saves A and B in one save, the tree is read again, then this person types into C and leaves it. */
async function otherChangesTwoThisEditsOne() {
  const opened = await open();
  const form = opened.hook.render();
  partServer.changeElsewhere({ a: '9.00', b: '8.00' });
  treeReadAgain(opened.row);
  opened.hook.render();
  form.setText('c', '5');
  form.commit(C);
  await opened.gate.settle();
  return opened;
}

describe('DEF-148: a tree re-read never changes the revision a save sends', () => {
  it('S1 first save: C goes out with the revision the form holds (1), the server answers 409, and the other person\'s A and B are shown and kept (AC-5, AC-6)', async () => {
    const { hook } = await otherChangesTwoThisEditsOne();
    expect(partServer.sent[0]).toEqual({ revision: 1, values: { c: '5.00' } });
    // The 409 read the part again: A and B are adopted as the server holds them, and C is sent again with the new revision.
    expect(partServer.sent).toEqual([
      { revision: 1, values: { c: '5.00' } },
      { revision: 2, values: { c: '5.00' } },
    ]);
    expect(partServer.inputs).toEqual({ a: '9.00', b: '8.00', c: '5.00' });
    const form = hook.render();
    expect(form.texts).toMatchObject({ a: '9.00', b: '8.00', c: '5.00' });
    expect(form.problem).toBeNull();
  });

  const everyLater: ReadonlyArray<readonly [string, FlushMode]> = [
    ['Save draft', 'draft'],
    ['a tab hide (leave)', 'leave'],
    ['one 30-second save (auto)', 'auto'],
  ];

  it.each(everyLater)('S1 then %s: the server still holds the other person\'s A and B, and this person\'s C (nothing sent back over them)', async (_name, mode) => {
    const { gate } = await otherChangesTwoThisEditsOne();
    gate.flush(mode);
    await gate.settle();
    expect(partServer.inputs).toEqual({ a: '9.00', b: '8.00', c: '5.00' });
    expect(partServer.sent.filter((save) => 'a' in save.values || 'b' in save.values)).toEqual([]);
  });

  it('a tree row that moved on does not move the save: with nothing else done, the next save still carries the revision of the values the form holds, and the 409 is the answer', async () => {
    const { gate, hook, row } = await open();
    const form = hook.render();
    partServer.changeElsewhere({ a: '9.00' });
    treeReadAgain(row);
    hook.render();
    form.setText('a', '3');
    form.commit(A);
    await gate.settle();
    expect(partServer.sent[0]?.revision).toBe(1);
    // The same field changed on both sides: the person's text is kept under the notice and the other person's value is not overwritten.
    expect(partServer.inputs['a']).toBe('9.00');
    expect(hook.render().problem).toEqual({ kind: 'conflict', fields: [{ fieldId: 'a', newer: '9.00' }] });
  });
});

describe('DEF-148: the revision is the one of the values the form holds, from the start', () => {
  it('the load: a tree row behind the load (the part moved before the form was read) sends the load\'s revision, not the row\'s', async () => {
    partServer.reset(HELD);
    partServer.changeElsewhere({ a: '7.00' });
    const gate = createSaveGate();
    const row: TreeRow = { id: PART_ID, slNo: '1', revision: 1 };
    const hook = renderHook(usePartValues, { estimateId: 'e', part: row, editable: true, fields: [A, B, C], onSaved: NOTHING, onChanged: NOTHING, onNamed: NOTHING, onServerIgnored: NOTHING, onWrote: NOTHING, gate } satisfies UsePartValuesProps);
    hook.render();
    await flushMicrotasks();
    const form = hook.render();
    form.setText('c', '5');
    form.commit(C);
    await gate.settle();
    expect(partServer.sent).toEqual([{ revision: 2, values: { c: '5.00' } }]);
    expect(partServer.inputs).toEqual({ a: '7.00', b: '1.00', c: '5.00' });
  });

  it('the seed: a form started from a seed of revision 3 sends 3 even when the tree row has since shown 4, and the 409 is the answer', async () => {
    partServer.reset({ a: '4.00' });
    partServer.changeElsewhere({});
    partServer.changeElsewhere({});
    expect(partServer.revision).toBe(3);
    const seed = {
      estimateId: 'e',
      partId: PART_ID,
      form: { sections: [{ id: 's1', number: 1, name: 'Part details', shortName: 'Part', columnRange: 'A to C', fields: [{ ...A }] }], lastSavedAt: '2026-11-27T10:00:00.000Z' },
      part: { id: PART_ID, revision: 3, completeness: 'PARTIAL', inputs: [{ fieldId: 'a', value: '4.00' }], picture: null },
      materials: { options: [] },
      treatments: { options: [] },
    } satisfies PartFormSeed;
    const gate = createSaveGate();
    const row: TreeRow = { id: PART_ID, slNo: '1', revision: 3 };
    const hook = renderHook(usePartValues, { estimateId: 'e', part: row, editable: true, fields: [A, B, C], onSaved: NOTHING, onChanged: NOTHING, onNamed: NOTHING, onServerIgnored: NOTHING, onWrote: NOTHING, gate, seed } satisfies UsePartValuesProps);
    hook.render();
    await flushMicrotasks();
    const form = hook.render();
    partServer.changeElsewhere({ b: '6.00' });
    treeReadAgain(row);
    hook.render();
    form.setText('c', '5');
    form.commit(C);
    await gate.settle();
    expect(partServer.sent[0]).toEqual({ revision: 3, values: { c: '5.00' } });
    expect(partServer.inputs).toEqual({ a: '4.00', b: '6.00', c: '5.00' });
  });
});

describe('DEF-148: a picture change is one of the form\'s own saves only when it moved the revision by one', () => {
  it('a picture saved with the next revision (nobody else changed the part) is followed by a save with that revision', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    form.pictureSaved({ revision: 2, completeness: 'PARTIAL' });
    partServer.changeElsewhere({});
    form.setText('c', '5');
    form.commit(C);
    await gate.settle();
    expect(partServer.sent[0]).toEqual({ revision: 2, values: { c: '5.00' } });
  });

  it('a picture saved with a revision two or more ahead (somebody else changed the part too) leaves the revision of the held values: the next save is answered 409 and the other person\'s A is kept', async () => {
    const { gate, hook } = await open();
    const form = hook.render();
    partServer.changeElsewhere({ a: '9.00' });
    partServer.changeElsewhere({});
    form.pictureSaved({ revision: partServer.revision, completeness: 'PARTIAL' });
    form.setText('c', '5');
    form.commit(C);
    await gate.settle();
    expect(partServer.sent[0]).toEqual({ revision: 1, values: { c: '5.00' } });
    expect(partServer.inputs).toEqual({ a: '9.00', b: '1.00', c: '5.00' });
    expect(hook.render().texts['a']).toBe('9.00');
  });
});
