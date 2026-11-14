import { describe, expect, it } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError, TreeChangedError } from '@/lib/errors';
import { NUMBER_RULE_MESSAGE, TEXT_TOO_LONG_MESSAGE } from '@/lib/estimate/validation';
import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { descendantIds } from '@/lib/estimate/tree';
import { createEstimateService, ESTIMATE_NOT_EDITABLE_CODE, type EstimateViewer } from '@/server/services/estimate-service';
import { CHOOSE_MATERIAL_MESSAGE, FIELD_NOT_SAVABLE_MESSAGE, PART_CHANGED_CODE } from '@/server/services/estimate-inputs';

import { defined } from '../support/defined';
import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimate, type FakeNode } from '../support/fake-estimates';
import { createFakeMasterRepository } from '../support/fake-masters';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { seedConfig, seedFieldAt } from '../support/seed-config';

/**
 * STORY-05.03 T3 (AC-3, AC-4, AC-7, AC-8): saving what a person typed into a part, and reading the form, over in-memory storage. Who may call is `tests/security`; the
 * real queries, the row lock and the transaction are `tests/integration/estimates/form.test.ts`. Every name and ID here is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const PRIYA = '00000000-0000-4000-8000-0000000000a2';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const OTHER_ESTIMATE = '00000000-0000-4000-8000-0000000000e2';
const PART = '00000000-0000-4000-8000-0000000000d1';
const CHILD = '00000000-0000-4000-8000-0000000000d2';
const FOREIGN_PART = '00000000-0000-4000-8000-0000000000d9';
const MISSING = '00000000-0000-4000-8000-0000000000ff';
const MATERIAL = defined(MATERIAL_CANARIES[0]);
const FIRST_MATERIAL = MATERIAL.id;
const FOLDER = '\\\\invented-server\\invented-share\\RFQ-123';

const field = (letter: string): string => seedFieldAt(letter).id;
const PART_NO = field('B');
const DESCRIPTION = field('D');
const QTY = field('H');
const MATERIAL_FIELD = field('E');
const LENGTH = field('J');
const WIDTH = field('K');
const RATE_FIELD = field('I');

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: FOLDER,
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: null,
  notes: null,
  status: 'DRAFT',
  customerId: null,
  inputsRevision: 0,
  ...overrides,
});

const node = (id: string, overrides: Partial<FakeNode> = {}): FakeNode => ({ id, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs: {}, ...overrides });

const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const priya: EstimateViewer = { id: PRIYA, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const admin: EstimateViewer = { id: '00000000-0000-4000-8000-0000000000c1', role: 'ADMIN' };

function setUp(initial: ReadonlyArray<FakeEstimate> = [estimate()], nodes: ReadonlyArray<FakeNode> = [node(PART), node(CHILD, { parentId: PART })]) {
  const world = createFakeEstimateWorld(() => [], initial, nodes);
  const masters = createFakeMasterRepository(undefined, MATERIAL_CANARIES);
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, transactions: world.transactions, ...inputsDependencies(masters) });
  const stored = (id = PART): FakeNode => defined(world.nodes.find((candidate) => candidate.id === id));
  const inputsRevision = (): number => defined(world.estimates.find((candidate) => candidate.id === ESTIMATE)).inputsRevision;
  return { world, masters, service, stored, inputsRevision };
}

const save = (setup: ReturnType<typeof setUp>, values: Record<string, string>, overrides: { viewer?: EstimateViewer; nodeId?: string; revision?: number; estimateId?: string } = {}) =>
  setup.service.saveInputs(overrides.viewer ?? arjun, overrides.estimateId ?? ESTIMATE, { nodeId: overrides.nodeId ?? PART, revision: overrides.revision ?? 1, values });

async function problemsOf(promise: Promise<unknown>): Promise<ReadonlyArray<{ field: string; message: string }>> {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(FieldValidationError);
  return error instanceof FieldValidationError ? error.fields : [];
}

describe('AC-4, AC-7: a value saved with a real change', () => {
  it('stores a typed number as normalised decimal text, raises the part revision and the estimate inputs_revision by one, and answers with the part', async () => {
    const setup = setUp();
    const saved = await save(setup, { [LENGTH]: '12.5' });
    expect(setup.stored().inputs).toEqual({ [LENGTH]: '12.50' });
    expect(setup.stored().revision).toBe(2);
    expect(setup.inputsRevision()).toBe(1);
    expect(saved).toEqual({ id: PART, revision: 2, completeness: 'PARTIAL', inputs: { [LENGTH]: '12.50' } });
  });

  it('stores several values of one save as one change: one revision of the part and one of the estimate', async () => {
    const setup = setUp();
    await save(setup, { [PART_NO]: '  FR-1  ', [LENGTH]: '10', [WIDTH]: '0', [MATERIAL_FIELD]: FIRST_MATERIAL });
    expect(setup.stored().inputs).toEqual({ [PART_NO]: 'FR-1', [LENGTH]: '10.00', [WIDTH]: '0.00', [MATERIAL_FIELD]: FIRST_MATERIAL });
    expect(setup.stored().revision).toBe(2);
    expect(setup.inputsRevision()).toBe(1);
  });

  it('keeps what was typed before: a save of one field leaves the others as they were', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [LENGTH]: '10.00' } })]);
    await save(setup, { [WIDTH]: '5' });
    expect(setup.stored().inputs).toEqual({ [LENGTH]: '10.00', [WIDTH]: '5.00' });
  });

  it('a value that is equal after normalisation changes nothing: no write, the same part revision, and inputs_revision does not move', async () => {
    const setup = setUp([estimate({ inputsRevision: 4 })], [node(PART, { inputs: { [LENGTH]: '1.50' }, revision: 3 })]);
    const writes = setup.world.nodeWrites();
    const saved = await save(setup, { [LENGTH]: '1.5' }, { revision: 3 });
    await save(setup, { [LENGTH]: '01.50' }, { revision: 3 });
    expect(setup.world.nodeWrites()).toBe(writes);
    expect(setup.stored().revision).toBe(3);
    expect(setup.inputsRevision()).toBe(4);
    expect(saved).toEqual({ id: PART, revision: 3, completeness: 'PARTIAL', inputs: { [LENGTH]: '1.50' } });
  });

  it('a repeated save of the same material and text changes nothing either', async () => {
    const setup = setUp();
    await save(setup, { [MATERIAL_FIELD]: FIRST_MATERIAL.toUpperCase(), [DESCRIPTION]: 'Base frame' });
    const writes = setup.world.nodeWrites();
    await save(setup, { [MATERIAL_FIELD]: FIRST_MATERIAL, [DESCRIPTION]: ' Base frame ' }, { revision: 2 });
    expect(setup.world.nodeWrites()).toBe(writes);
    expect(setup.inputsRevision()).toBe(1);
  });

  it('changing a value and changing it back is two changes: the figures stay cleared', async () => {
    const setup = setUp();
    await save(setup, { [LENGTH]: '1' });
    await save(setup, { [LENGTH]: '2' }, { revision: 2 });
    await save(setup, { [LENGTH]: '1' }, { revision: 3 });
    expect(setup.inputsRevision()).toBe(3);
    expect(setup.stored().revision).toBe(4);
  });

  it('an empty save changes nothing', async () => {
    const setup = setUp();
    expect(await save(setup, {})).toEqual({ id: PART, revision: 1, completeness: 'EMPTY', inputs: {} });
    expect(setup.inputsRevision()).toBe(0);
  });
});

describe('review SQR-01: a save changes only the keys it names', () => {
  const NOT_BUILT = field('Z');
  const stored = (): Record<string, unknown> => ({ [LENGTH]: '1.00', [NOT_BUILT]: '7.00', invented: true, [field('I')]: '917373.37' });

  it('a stored value of a field that is not on the form (another story\'s, one not built yet, one that is not text) survives a save of another field; the answer lists only the form\'s', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: stored() })]);
    const saved = await save(setup, { [WIDTH]: '2' });
    expect(setup.stored().inputs).toEqual({ ...stored(), [WIDTH]: '2.00' });
    expect(saved.inputs).toEqual({ [LENGTH]: '1.00', [WIDTH]: '2.00' });
    expect(saved.revision).toBe(2);
    expect(JSON.stringify(saved)).not.toContain('917373.37');
  });

  it('clearing one field removes only its own key', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: stored() })]);
    const saved = await save(setup, { [LENGTH]: '' });
    expect(setup.stored().inputs).toEqual({ [NOT_BUILT]: '7.00', invented: true, [field('I')]: '917373.37' });
    expect(saved).toMatchObject({ completeness: 'EMPTY', inputs: {} });
  });

  it('the no-change check looks at the submitted fields only: the same value spelled another way writes nothing, whatever else is stored', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [LENGTH]: '1.50', [NOT_BUILT]: '7.00', invented: true } })]);
    const writes = setup.world.nodeWrites();
    await save(setup, { [LENGTH]: '1.5' });
    expect(setup.world.nodeWrites()).toBe(writes);
    expect(setup.stored().revision).toBe(1);
    expect(setup.inputsRevision()).toBe(0);
  });

  it('naming a field that is not on the form is still refused, and the stored value of it is untouched', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [LENGTH]: '1.50', [NOT_BUILT]: '7.00' } })]);
    await problemsOf(save(setup, { [LENGTH]: '2', [NOT_BUILT]: '9' }));
    expect(setup.stored().inputs).toEqual({ [LENGTH]: '1.50', [NOT_BUILT]: '7.00' });
  });
});

describe('STORY-05.04 AC-1, AC-2, AC-4, AC-5: the fields of sections 03 to 08', () => {
  const COST_FIELDS = ['U', 'AP', 'AU', 'BM'].map(field);
  const NUMBER_FIELDS = ['P', 'Q', 'R', 'T', 'V', 'W', 'X', 'Y'].map(field);
  const REMARKS = field('AJ');
  const FASTENERS = field('S');

  it('saves a number in every one of them as two-decimal text in one write, with one new revision of the part and of the estimate', async () => {
    const setup = setUp();
    const typed = Object.fromEntries([...NUMBER_FIELDS, ...COST_FIELDS].map((id, index) => [id, `${index + 1}.5`]));
    const saved = await save(setup, { ...typed, [FASTENERS]: ' M6 bolt ', [REMARKS]: 'Line one\r\nLine two' });
    expect(saved.revision).toBe(2);
    expect(setup.inputsRevision()).toBe(1);
    expect(saved.inputs).toEqual({
      ...Object.fromEntries([...NUMBER_FIELDS, ...COST_FIELDS].map((id, index) => [id, `${index + 1}.50`])),
      [FASTENERS]: 'M6 bolt',
      [REMARKS]: 'Line one\nLine two',
    });
  });

  it('AC-2: the typed Machining, Plating, Tool and Fasteners Cost come back as typed, to the person who typed them and to a Lead, and are no calculated value (FR-008)', async () => {
    const setup = setUp();
    const typed = { [field('AP')]: '1234.50', [field('AU')]: '678.25', [field('BM')]: '45678.75', [field('U')]: '3.50' };
    await save(setup, typed);
    for (const viewer of [arjun, lead, admin]) {
      const part = await setup.service.getNode(viewer, ESTIMATE, PART);
      expect(part.inputs).toEqual(typed);
    }
  });

  it('AC-3: Fasteners left alone is not stored, so a part with nothing typed stays EMPTY; "None" typed is stored like any text', async () => {
    const setup = setUp();
    await save(setup, { [LENGTH]: '' });
    expect(setup.stored().inputs).toEqual({});
    const saved = await save(setup, { [FASTENERS]: 'None' });
    expect(saved).toMatchObject({ completeness: 'PARTIAL', inputs: { [FASTENERS]: 'None' } });
  });

  it('AC-4 (A-1): Remarks takes 1,000 characters and is refused over that with "Use 1,000 characters or fewer."; Part No., Description and Fasteners stop at 200', async () => {
    const setup = setUp();
    expect((await save(setup, { [REMARKS]: 'x'.repeat(1000) })).inputs[REMARKS]).toHaveLength(1000);
    expect(await problemsOf(save(setup, { [REMARKS]: 'x'.repeat(1001) }, { revision: 2 }))).toEqual([{ field: REMARKS, message: 'Use 1,000 characters or fewer.' }]);
    for (const id of [PART_NO, DESCRIPTION, FASTENERS]) {
      expect(await problemsOf(save(setup, { [id]: 'x'.repeat(201) }, { revision: 2 })), id).toEqual([{ field: id, message: TEXT_TOO_LONG_MESSAGE }]);
    }
  });

  it('AC-5: a number of a new section follows the same rule as before: -1, 1.234 and abc are refused together, each under its own field, and nothing is stored', async () => {
    const setup = setUp();
    const problems = await problemsOf(save(setup, { [field('P')]: '-1', [field('AP')]: '1.234', [field('BM')]: 'abc', [field('Q')]: '5' }));
    expect(problems).toEqual([field('P'), field('AP'), field('BM')].map((id) => ({ field: id, message: NUMBER_RULE_MESSAGE })));
    expect(setup.stored().inputs).toEqual({});
  });

  it('AC-5: the real-change rule is unchanged: the same number spelled another way writes nothing and raises no revision', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [field('BM')]: '4.50' } })]);
    const writes = setup.world.nodeWrites();
    await save(setup, { [field('BM')]: '4.5' });
    expect(setup.world.nodeWrites()).toBe(writes);
    expect(setup.stored().revision).toBe(1);
    expect(setup.inputsRevision()).toBe(0);
  });

  it('a text that is a lone surrogate or holds a control character is 422 in Remarks too, not stored', async () => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [REMARKS]: 'bad\uD800text' }))).toEqual([{ field: REMARKS, message: 'Use letters, numbers and punctuation only.' }]);
    expect(setup.stored().inputs).toEqual({});
  });

  it('a stored Restricted value and an unknown key are read back by nobody: only what the form offers leaves, with the typed costs among it', async () => {
    const stored = { [field('BM')]: '45678.75', [RATE_FIELD]: '917373.37', invented: 'x', [field('Z')]: '1.00' };
    const setup = setUp([estimate()], [node(PART, { inputs: stored })]);
    for (const viewer of [arjun, lead, admin]) {
      const part = await setup.service.getNode(viewer, ESTIMATE, PART);
      expect(part.inputs).toEqual({ [field('BM')]: '45678.75' });
      expect(JSON.stringify(part)).not.toContain('917373.37');
    }
  });
});

describe('review SQR-02: the write is conditional on the revision that was read', () => {
  it('a writer that overtook the read (the part changed after it) is a 409 PART_CHANGED and nothing is raised', async () => {
    const setup = setUp();
    const write = setup.world.nodeRepository.saveInputs;
    setup.world.nodeRepository.saveInputs = (estimateId, nodeId, _expected, inputs, tx) => write(estimateId, nodeId, 99, inputs, tx);
    await expect(save(setup, { [LENGTH]: '1' })).rejects.toMatchObject({ code: PART_CHANGED_CODE, httpStatus: 409 });
    expect(setup.stored().inputs).toEqual({});
    expect(setup.stored().revision).toBe(1);
    expect(setup.inputsRevision()).toBe(0);
  });
});

describe('AC-4: a blank is allowed while saving', () => {
  it('a blank clears the value, so a part with nothing typed is EMPTY again', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [LENGTH]: '10.00' } })]);
    const saved = await save(setup, { [LENGTH]: '  ' });
    expect(setup.stored().inputs).toEqual({});
    expect(saved).toMatchObject({ revision: 2, completeness: 'EMPTY', inputs: {} });
    expect(setup.inputsRevision()).toBe(1);
  });

  it('a blank for a value that is not there is no change', async () => {
    const setup = setUp();
    await save(setup, { [LENGTH]: '' });
    expect(setup.stored().revision).toBe(1);
    expect(setup.inputsRevision()).toBe(0);
  });
});

describe('AC-4: what is refused is a 422 under the field, with nothing written', () => {
  it.each([['-1'], ['1.234'], ['abc'], ['1e3']])('a number of %j is refused with the words of the rule', async (typed) => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [LENGTH]: typed }))).toEqual([{ field: LENGTH, message: NUMBER_RULE_MESSAGE }]);
    expect(setup.stored().revision).toBe(1);
    expect(setup.inputsRevision()).toBe(0);
  });

  it('names every field at fault in one answer, and saves none of the others', async () => {
    const setup = setUp();
    const problems = await problemsOf(save(setup, { [LENGTH]: '1.234', [WIDTH]: '5', [PART_NO]: 'x'.repeat(201), [QTY]: '-2' }));
    expect(problems).toEqual([
      { field: LENGTH, message: NUMBER_RULE_MESSAGE },
      { field: PART_NO, message: TEXT_TOO_LONG_MESSAGE },
      { field: QTY, message: NUMBER_RULE_MESSAGE },
    ]);
    expect(setup.stored().inputs).toEqual({});
  });

  it('a material that is not in the Material Master is refused, and the answer does not say whether the ID is real', async () => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [MATERIAL_FIELD]: MISSING }))).toEqual([{ field: MATERIAL_FIELD, message: CHOOSE_MATERIAL_MESSAGE }]);
    expect(await problemsOf(save(setup, { [MATERIAL_FIELD]: 'not-an-id' }))).toEqual([{ field: MATERIAL_FIELD, message: CHOOSE_MATERIAL_MESSAGE }]);
  });

  it('a material that was deleted is refused', async () => {
    const setup = setUp();
    setup.masters.materials.splice(0, setup.masters.materials.length);
    expect(await problemsOf(save(setup, { [MATERIAL_FIELD]: FIRST_MATERIAL }))).toEqual([{ field: MATERIAL_FIELD, message: CHOOSE_MATERIAL_MESSAGE }]);
  });

  it('a blank material clears the choice', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [MATERIAL_FIELD]: FIRST_MATERIAL } })]);
    await save(setup, { [MATERIAL_FIELD]: '' });
    expect(setup.stored().inputs).toEqual({});
  });
});

describe('AC-3, AC-7: a field that is unknown or Restricted is a 422', () => {
  it.each([
    ['Material Rate / Kg (I)', () => RATE_FIELD],
    ['Blank Weight (M), a calculated field', () => field('M')],
    ['Material Cost (AK), a calculated field', () => field('AK')],
    ['Sl. No. (A), which is the tree', () => field('A')],
    ['Material Considered (F), which follows the material', () => field('F')],
    ['Part Model (C), the picture of story 05.07', () => field('C')],
    ['Treatment / Color (G), story 05.06', () => field('G')],
    ['Hot Dip Galvanizing (Z), a surface treatment that story 05.06 builds', () => field('Z')],
    ['Total Process Cost (AY), the calculated twin of Machining Cost', () => field('AY')],
    ['Approved Quote Price (BO), entered at approval', () => field('BO')],
    ['an ID the registry does not have', () => MISSING],
  ])('%s is refused with one message that says only that it cannot be saved', async (_name, idOf) => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [idOf()]: '5' }))).toEqual([{ field: idOf(), message: FIELD_NOT_SAVABLE_MESSAGE }]);
    expect(setup.stored().inputs).toEqual({});
    expect(setup.inputsRevision()).toBe(0);
  });

  it('refuses the whole save when one value is not savable: nothing of it is stored', async () => {
    const setup = setUp();
    await problemsOf(save(setup, { [LENGTH]: '5', [RATE_FIELD]: '5' }));
    expect(setup.stored().inputs).toEqual({});
  });
});

describe('AC-7: a stale revision is 409', () => {
  it('refuses a revision that is not the part\'s, whatever is in the save, and writes nothing', async () => {
    const setup = setUp();
    await save(setup, { [LENGTH]: '1' });
    const error = await save(setup, { [LENGTH]: '2' }, { revision: 1 }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: PART_CHANGED_CODE, httpStatus: 409 });
    expect(setup.stored().inputs).toEqual({ [LENGTH]: '1.00' });
    expect(setup.inputsRevision()).toBe(1);
  });

  it('a stale revision is refused before the values are read: an invalid value does not turn it into a 422', async () => {
    const setup = setUp([estimate()], [node(PART, { revision: 5 })]);
    await expect(save(setup, { [LENGTH]: 'abc' }, { revision: 4 })).rejects.toMatchObject({ code: PART_CHANGED_CODE });
  });

  it('a save raises the revision of the part, so a delete confirmed for the part as it was is refused (review SQR-01 (b))', async () => {
    const setup = setUp();
    const members = (id: string) => {
      const ids = new Set([id, ...descendantIds(setup.world.nodes, id)]);
      return setup.world.nodes.filter((candidate) => ids.has(candidate.id));
    };
    const seen = subtreeFingerprint(members(PART));
    await save(setup, { [LENGTH]: '5' }, { nodeId: CHILD });
    const error = await setup.service.deleteNode(arjun, ESTIMATE, { nodeId: PART, revision: 1, parts: 2, subtree: seen }).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(TreeChangedError);
    expect(setup.world.nodes.map((candidate) => candidate.id).sort()).toEqual([CHILD, PART].sort());
  });
});

describe('AC-7: who may save, and in what order the refusals come', () => {
  it('an Engineer may not save into another Engineer\'s estimate, or into one that does not exist: the same 404', async () => {
    const setup = setUp();
    await expect(save(setup, { [LENGTH]: '1' }, { viewer: priya })).rejects.toBeInstanceOf(NotFoundError);
    await expect(save(setup, { [LENGTH]: '1' }, { estimateId: MISSING })).rejects.toBeInstanceOf(NotFoundError);
    await expect(save(setup, { [LENGTH]: '1' }, { estimateId: 'not-an-id' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a part that is not in this estimate, or does not exist, is a 404', async () => {
    const setup = setUp([estimate(), estimate({ id: OTHER_ESTIMATE, code: 'Q-2026-0319' })], [node(PART), node(FOREIGN_PART, { estimateId: OTHER_ESTIMATE })]);
    await expect(save(setup, { [LENGTH]: '1' }, { nodeId: FOREIGN_PART })).rejects.toBeInstanceOf(NotFoundError);
    await expect(save(setup, { [LENGTH]: '1' }, { nodeId: MISSING })).rejects.toBeInstanceOf(NotFoundError);
    await expect(save(setup, { [LENGTH]: '1' }, { nodeId: 'not-an-id' })).rejects.toBeInstanceOf(NotFoundError);
    expect(setup.stored(FOREIGN_PART).inputs).toEqual({});
  });

  it('an Engineer may not save once the estimate is submitted, and nobody once it is approved; a Lead and an Admin may while it is submitted', async () => {
    const submitted = setUp([estimate({ status: 'SUBMITTED' })]);
    await expect(save(submitted, { [LENGTH]: '1' })).rejects.toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE });
    await save(submitted, { [LENGTH]: '1' }, { viewer: lead });
    await save(submitted, { [WIDTH]: '1' }, { viewer: admin, revision: 2 });
    expect(submitted.inputsRevision()).toBe(2);
    const approved = setUp([estimate({ status: 'APPROVED' })]);
    for (const viewer of [arjun, lead, admin]) await expect(save(approved, { [LENGTH]: '1' }, { viewer })).rejects.toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE });
    expect(approved.stored().inputs).toEqual({});
  });

  it('the refusals come in order: not found, not editable, a stale revision, then the values', async () => {
    const approved = setUp([estimate({ status: 'APPROVED' })]);
    await expect(save(approved, { [RATE_FIELD]: 'abc' }, { revision: 99 })).rejects.toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE });
    await expect(save(approved, { [LENGTH]: '1' }, { viewer: priya, revision: 99 })).rejects.toBeInstanceOf(NotFoundError);
    const draft = setUp();
    await expect(save(draft, { [RATE_FIELD]: 'abc' }, { nodeId: MISSING })).rejects.toBeInstanceOf(NotFoundError);
    await expect(save(draft, { [RATE_FIELD]: 'abc' }, { revision: 99 })).rejects.toMatchObject({ code: PART_CHANGED_CODE });
  });

  it('is one transaction: when the estimate\'s inputs_revision cannot be raised, the part is not changed either', async () => {
    const setup = setUp();
    setup.world.repository.bumpInputsRevision = () => Promise.reject(new Error('The estimate could not be changed.'));
    await expect(save(setup, { [LENGTH]: '1' })).rejects.toThrow('could not be changed');
    expect(setup.stored().inputs).toEqual({});
    expect(setup.stored().revision).toBe(1);
  });
});

describe('AC-8: the form, and the part read back, carry no cost', () => {
  it('answers every role with the same sections, in the same shape, and the time of the last save', async () => {
    const setup = setUp();
    const forEngineer = await setup.service.getForm(arjun, ESTIMATE);
    expect(await setup.service.getForm(lead, ESTIMATE)).toEqual(forEngineer);
    expect(await setup.service.getForm(admin, ESTIMATE)).toEqual(forEngineer);
    expect(forEngineer.sections.map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(forEngineer.lastSavedAt === null || typeof forEngineer.lastSavedAt === 'string').toBe(true);
    expect(Object.keys(forEngineer).sort()).toEqual(['lastSavedAt', 'sections']);
  });

  it('is built from the registry the service was given, and offers no rate, no calculated field and no formula', async () => {
    const setup = setUp();
    const form = await setup.service.getForm(arjun, ESTIMATE);
    const ids = form.sections.flatMap((section) => section.fields.map((candidate) => candidate.id));
    expect(ids).not.toContain(RATE_FIELD);
    expect(ids.every((id) => seedConfig.fields.find((candidate) => candidate.id === id)?.kind !== 'output')).toBe(true);
    // "cost" is in the labels of the four inputs an Engineer types and in the name of section 08, and nowhere else (STORY-05.04 AC-7).
    const rest = ['Fasteners Cost', 'Machining Cost', 'Plating Cost', 'Tool Cost', 'Other Costs and Remarks'].reduce((left, words) => left.replaceAll(words, ''), JSON.stringify(form));
    expect(rest).not.toMatch(/\{\{|formula|price|cost|rate/i);
  });

  it('a form that is not the Engineer\'s is a 404, the same as an estimate that does not exist', async () => {
    const setup = setUp();
    await expect(setup.service.getForm(priya, ESTIMATE)).rejects.toBeInstanceOf(NotFoundError);
    await expect(setup.service.getForm(arjun, MISSING)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('has no last-saved time for an estimate with no part', async () => {
    const setup = setUp([estimate()], []);
    expect((await setup.service.getForm(arjun, ESTIMATE)).lastSavedAt).toBeNull();
  });

  it('reads a part back with only the fields of the form: a value that is not one of them is not sent', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [LENGTH]: '10.00', [RATE_FIELD]: '917373.37', [field('M')]: '1.00', [MISSING]: 'x' } })]);
    const part = await setup.service.getNode(arjun, ESTIMATE, PART);
    expect(part.inputs).toEqual({ [LENGTH]: '10.00' });
    expect(JSON.stringify(part)).not.toContain('917373.37');
  });

  it('reads the typed inputs, the revision and how complete the part is', async () => {
    const setup = setUp([estimate()], [node(PART, { inputs: { [PART_NO]: 'FR-1' }, revision: 3 })]);
    expect(await setup.service.getNode(arjun, ESTIMATE, PART)).toMatchObject({ id: PART, slNo: '1', revision: 3, completeness: 'PARTIAL', inputs: { [PART_NO]: 'FR-1' } });
  });
});
