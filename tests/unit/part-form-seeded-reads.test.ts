import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFormDefinition } from '@/components/features/estimate-workspace/use-form-definition';
import { usePartsTree } from '@/components/features/estimate-workspace/use-parts-tree';
import { usePartValues, type UsePartValuesProps } from '@/components/features/estimate-workspace/use-part-form';
import { TreatmentSeedContext, useTreatmentOptions } from '@/components/features/estimate-workspace/use-treatment-options';
import type { FormField } from '@/lib/estimates/form-client';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';
import { createSaveGate } from '@/lib/estimates/save-gate';

import { renderHook } from '../support/hook-harness';
import { PART_ID, partServer } from '../support/part-server';

/**
 * DEF-141 (DL-455 2 (b)): the Lead's review page hands the part form its definition, the materials, the part's values and the treatments as props, so the form reads **nothing** from the server to start, and every
 * read after that (Try again, a conflict, a part the seed does not name, the Engineer's form, which has no seed) is a read from the server as ever. A new set of props after `router.refresh()` does not wipe what was
 * typed: the seed is the start of the form, not its life. The hooks run with no DOM (`tests/support/hook-harness.ts`); the readers are the real ones, the server is an invented one. Invented ids only.
 */

const loads = vi.hoisted(() => ({ form: vi.fn(), materials: vi.fn(), part: vi.fn(), treatments: vi.fn(), tree: vi.fn() }));
vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);
vi.mock('@/lib/estimates/form-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/form-client')>();
  const { partServer: server } = await import('../support/part-server');
  return {
    ...original,
    loadForm: (...args: unknown[]) => loads.form(...args),
    loadMaterialOptions: (...args: unknown[]) => loads.materials(...args),
    loadPartInputs: (...args: unknown[]) => {
      loads.part(...args);
      return server.load();
    },
    savePartInputs: server.save,
  };
});
vi.mock('@/lib/estimates/tree-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/tree-client')>();
  return { ...original, loadTree: (...args: unknown[]) => loads.tree(...args) };
});
vi.mock('@/lib/estimates/treatment-options-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/treatment-options-client')>();
  return { ...original, loadTreatmentOptions: (...args: unknown[]) => loads.treatments(...args) };
});

// The harness's context is its current value (there is no tree to provide one): the value the fields' provider would hand to the control.
const treatmentContext = TreatmentSeedContext as unknown as { value: unknown };
const NOTHING = (): void => undefined;
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const FIELD_ID = 'a';

const field = (id: string): FormField => ({ id, letter: id.toUpperCase(), label: `Field ${id}`, kind: 'input', unit: null, hint: null, defaultValue: null, required: true, editable: true, visibleWhen: null, rule: { type: 'number', decimals: 2 } });
const wireField = (id: string) => ({ ...field(id) });
const FORM_BODY = { sections: [{ id: 's1', number: 1, name: 'Part details', shortName: 'Part', columnRange: 'A to C', fields: [wireField(FIELD_ID)] }], lastSavedAt: '2026-11-27T10:00:00.000Z' };
const MATERIALS_BODY = { options: [{ id: 'm1', name: 'Invented steel', materialConsidered: 'Steel' }] };
const TREATMENTS_BODY = { options: [{ id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented coat' }] };
const TREE_BODY = { nodes: [{ id: PART_ID, parentId: null, slNo: '1', label: 'Invented', nodeKind: 'MAIN_ASSEMBLY', completeness: 'PARTIAL', revision: 3 }] };
const PART_BODY = { id: PART_ID, revision: 3, completeness: 'PARTIAL', inputs: [{ fieldId: FIELD_ID, value: '4.00' }], picture: null };

const seed = (over: Partial<PartFormSeed> = {}): PartFormSeed => ({ estimateId: 'e', partId: PART_ID, form: FORM_BODY, part: PART_BODY, materials: MATERIALS_BODY, treatments: TREATMENTS_BODY, tree: TREE_BODY, ...over });

beforeEach(() => {
  for (const spy of Object.values(loads)) spy.mockReset();
  loads.form.mockResolvedValue({ status: 'ok', value: { sections: [], lastSavedAt: null } });
  loads.materials.mockResolvedValue({ status: 'ok', value: [] });
  loads.treatments.mockResolvedValue({ status: 'ok', value: [] });
  loads.tree.mockResolvedValue({ status: 'ok', value: { nodes: [], nodeId: null } });
  partServer.reset({ a: '1.00' });
  treatmentContext.value = undefined;
});

describe('useFormDefinition: the definition and the materials', () => {
  it('starts ready from the seed, reads nothing, and holds the last-saved time the form body carries', async () => {
    const view = renderHook((estimateId: string) => useFormDefinition(estimateId, seed()), 'e');
    const first = view.render();
    await flush();
    expect(first.form.status).toBe('ready');
    expect(first.materials).toEqual({ status: 'ready', value: [{ id: 'm1', name: 'Invented steel', materialConsidered: 'Steel' }] });
    expect(first.lastSavedAt).toBe('2026-11-27T10:00:00.000Z');
    expect(loads.form).not.toHaveBeenCalled();
    expect(loads.materials).not.toHaveBeenCalled();
  });

  it('reads from the server for "read again", as it always did', async () => {
    const view = renderHook((estimateId: string) => useFormDefinition(estimateId, seed()), 'e');
    view.render().readAgain();
    view.render();
    await flush();
    expect(loads.form).toHaveBeenCalledTimes(1);
    expect(loads.materials).toHaveBeenCalledTimes(1);
  });

  it('reads from the server with no seed (the Engineer\'s form), with a seed of another estimate, and with a body the reader refuses', async () => {
    for (const given of [undefined, seed({ estimateId: 'another' }), seed({ form: { sections: 'x', lastSavedAt: null } }), seed({ materials: { options: 5 } })]) {
      loads.form.mockClear();
      loads.materials.mockClear();
      const view = renderHook((estimateId: string) => useFormDefinition(estimateId, given), 'e');
      expect(view.render().form.status).toBe('loading');
      await flush();
      expect(loads.form).toHaveBeenCalledTimes(1);
      expect(loads.materials).toHaveBeenCalledTimes(1);
    }
  });
});

describe('usePartValues: the part\'s values', () => {
  const props = (over: Partial<UsePartValuesProps> = {}): UsePartValuesProps => ({
    estimateId: 'e',
    part: { id: PART_ID, slNo: '1', revision: 3 },
    editable: true,
    fields: [field(FIELD_ID)],
    onSaved: NOTHING,
    onChanged: NOTHING,
    onNamed: NOTHING,
    onServerIgnored: NOTHING,
    onWrote: NOTHING,
    gate: createSaveGate(),
    ...over,
  });

  it('shows the seeded values at once and reads nothing', async () => {
    const view = renderHook(usePartValues, props({ seed: seed() }));
    const first = view.render();
    await flush();
    expect(first.stored.status).toBe('ready');
    expect(first.texts).toEqual({ a: '4.00' });
    expect(loads.part).not.toHaveBeenCalled();
  });

  it('keeps what was typed when the page is drawn again with new props (router.refresh): the seed is a start, not the form\'s life', async () => {
    const given = props({ seed: seed() });
    const view = renderHook(usePartValues, given);
    const form = view.render();
    form.setText('a', '7');
    // The same mounted form, the page drawn again with a seed holding other values: nothing typed is lost and nothing is read.
    (given as { seed?: PartFormSeed }).seed = seed({ part: { ...PART_BODY, inputs: [{ fieldId: FIELD_ID, value: '9.00' }] } });
    expect(view.render().texts).toEqual({ a: '7' });
    expect(loads.part).not.toHaveBeenCalled();
  });

  it('still reads the part from the server when another tab changed it (the 409 path) and when the person chooses Try again', async () => {
    const gate = createSaveGate();
    const view = renderHook(usePartValues, props({ seed: seed({ part: { ...PART_BODY, revision: 1, inputs: [{ fieldId: FIELD_ID, value: '1.00' }] } }), part: { id: PART_ID, slNo: '1', revision: 1 }, gate }));
    const form = view.render();
    form.setText('a', '2');
    partServer.changeElsewhere({ a: '9.00' });
    form.commit(field(FIELD_ID));
    await gate.settle();
    expect(loads.part).toHaveBeenCalled();
    expect(partServer.sent[0]).toEqual({ revision: 1, values: { a: '2.00' } });
  });

  it('QLT-836-01: a seed whose revision is not the tree\'s is not the form\'s start: the part is read from the server, and the save carries the revision of the values shown', async () => {
    // The values are revision 1 (the invented server's), the tree row (what a save is sent with) says 2: the part moved on between the two reads.
    const atOne = seed({ part: { ...PART_BODY, revision: 1, inputs: [{ fieldId: FIELD_ID, value: '1.00' }] } });
    const view = renderHook(usePartValues, props({ seed: atOne, part: { id: PART_ID, slNo: '1', revision: 2 } }));
    expect(view.render().stored.status).toBe('loading');
    await flush();
    expect(loads.part).toHaveBeenCalledTimes(1);
    // The same revision on both: the seed starts the form and nothing is read (the test above), and a save is sent with that revision.
    loads.part.mockClear();
    const gate = createSaveGate();
    const same = renderHook(usePartValues, props({ seed: atOne, part: { id: PART_ID, slNo: '1', revision: 1 }, gate }));
    const form = same.render();
    form.setText('a', '6');
    form.commit(field(FIELD_ID));
    await gate.settle();
    expect(loads.part).not.toHaveBeenCalled();
    expect(partServer.sent[0]).toEqual({ revision: 1, values: { a: '6.00' } });
  });

  it('a form that cannot save keeps its seed whatever the row\'s revision says (the locked review passes a placeholder 0) and reads nothing', async () => {
    const view = renderHook(usePartValues, props({ seed: seed(), editable: false, part: { id: PART_ID, slNo: '1', revision: 0 } }));
    const first = view.render();
    await flush();
    expect(first.stored.status).toBe('ready');
    expect(first.texts).toEqual({ a: '4.00' });
    expect(loads.part).not.toHaveBeenCalled();
  });

  it('reads from the server when the seed names another part, when it is absent, and when its part body is refused', async () => {
    for (const given of [seed({ partId: 'another' }), undefined, seed({ part: { id: PART_ID } })]) {
      loads.part.mockClear();
      const view = renderHook(usePartValues, props({ seed: given }));
      expect(view.render().stored.status).toBe('loading');
      await flush();
      expect(loads.part).toHaveBeenCalledTimes(1);
    }
  });
});

describe('useTreatmentOptions: the treatments', () => {
  it('starts ready in the list\'s order from the body the page handed over, and reads nothing', async () => {
    treatmentContext.value = TREATMENTS_BODY;
    const view = renderHook(useTreatmentOptions, undefined);
    const first = view.render();
    await flush();
    expect(first.options).toEqual({ status: 'ready', value: [{ id: '00000000-0000-4000-8000-0000000000a1', name: 'Invented coat' }] });
    expect(loads.treatments).not.toHaveBeenCalled();
  });

  it('reads from the server with no seed and with a body the reader refuses; and for "read again"', async () => {
    for (const given of [undefined, { options: 'x' }]) {
      loads.treatments.mockClear();
      treatmentContext.value = given;
      const view = renderHook(useTreatmentOptions, undefined);
      expect(view.render().options.status).toBe('loading');
      await flush();
      expect(loads.treatments).toHaveBeenCalledTimes(1);
    }
    loads.treatments.mockClear();
    treatmentContext.value = TREATMENTS_BODY;
    const seeded = renderHook(useTreatmentOptions, undefined);
    seeded.render().readAgain();
    seeded.render();
    await flush();
    expect(loads.treatments).toHaveBeenCalledTimes(1);
  });
});

describe('usePartsTree: the parts tree of the Lead\'s island (DEF-131 stage 2T, DEF-141)', () => {
  const treeWith = (given: PartFormSeed | undefined) => renderHook((estimateId: string) => usePartsTree(estimateId, undefined, { seed: given }), 'e');

  it('starts with the rows of the seed, with the first row open and its revision, and reads nothing', async () => {
    const view = treeWith(seed());
    const first = view.render();
    await flush();
    expect(first.nodes).toEqual([{ id: PART_ID, parentId: null, slNo: '1', label: 'Invented', nodeKind: 'MAIN_ASSEMBLY', completeness: 'PARTIAL', revision: 3 }]);
    expect(first.selected?.id).toBe(PART_ID);
    expect(first.selected?.revision).toBe(3);
    expect(loads.tree).not.toHaveBeenCalled();
  });

  it('reads from the server with no seed, with a seed of another estimate, with no tree in it and with a tree the reader refuses', async () => {
    for (const given of [undefined, seed({ estimateId: 'another' }), seed({ tree: undefined }), seed({ tree: { nodes: 'x' } })]) {
      loads.tree.mockClear();
      const view = treeWith(given);
      expect(view.render().nodes).toBeNull();
      await flush();
      expect(loads.tree).toHaveBeenCalledTimes(1);
    }
  });

  it('reads the tree again when asked (Try again, a change somewhere else): the seed is the start, not the life', async () => {
    const view = treeWith(seed());
    view.render().readAgain();
    view.render();
    await flush();
    expect(loads.tree).toHaveBeenCalledTimes(1);
  });
});
