import { describe, expect, it } from 'vitest';

import { FieldValidationError } from '@/lib/errors';
import { CHOOSE_TREATMENT_MESSAGE, encodeTreatment, FLAG_MESSAGE, OTHER_TREATMENT_REQUIRED_MESSAGE, treatmentChoiceOf } from '@/lib/estimate/treatment-value';
import { textTooLongMessage } from '@/lib/estimate/validation';
import { NOT_APPLICABLE_NAME, NOT_APPLICABLE_TREATMENT_ID, OTHER_TREATMENT_ID } from '@/lib/masters/system-entries';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { defined } from '../support/defined';
import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimate, type FakeNode } from '../support/fake-estimates';
import { createFakeMasterRepository } from '../support/fake-masters';
import { MATERIAL_CANARIES } from '../support/material-master-canary';
import { seedFieldAt } from '../support/seed-config';

/**
 * STORY-05.06 AC-1, AC-3, AC-4, AC-5, AC-7 (FR-049, FR-050, FR-018; architecture section 5.1 "A treatment on an estimate"): saving the eight surface treatments and Treatment / Color over
 * in-memory storage. A flag is stored as 1 or 0; G is stored as `{ id, text }`, where a listed entry and "Not applicable" take the row's name and ignore what the client sent, "Other" keeps the typed
 * words, an unknown ID is 422 under G, and the one a part already holds is kept even when its treatment was deleted. The real queries, and "a delete of a treatment a draft uses", are
 * `tests/integration/estimates/treatment.test.ts` against PostgreSQL. Every name and ID is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const PART = '00000000-0000-4000-8000-0000000000d1';
const POWDER_ID = '00000000-0000-4000-8000-000700000c01';
const GONE_ID = '00000000-0000-4000-8000-000700000c99';
const MISSING_ID = '00000000-0000-4000-8000-000700000caa';
const POWDER_NAME = 'Invented powder finish';

const G = seedFieldAt('G').id;
const PRIMER = seedFieldAt('AA').id;
const FOAM = seedFieldAt('AF').id;
const HOT_DIP = seedFieldAt('Z').id;
const LENGTH = seedFieldAt('J').id;

const estimate = (): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0318',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-123',
  deadlineAt: new Date('2026-11-12T11:30:00.000Z'),
  title: null,
  notes: null,
  status: 'DRAFT',
  customerId: null,
  inputsRevision: 0,
});
const node = (inputs: Record<string, unknown> = {}): FakeNode => ({ id: PART, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs });
const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };

function setUp(inputs: Record<string, unknown> = {}) {
  const world = createFakeEstimateWorld(() => [], [estimate()], [node(inputs)]);
  const masters = createFakeMasterRepository(undefined, MATERIAL_CANARIES);
  masters.treatments.push({ id: POWDER_ID, name: POWDER_NAME, locked: false });
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies(masters) });
  const stored = (): FakeNode => defined(world.nodes.find((candidate) => candidate.id === PART));
  return { world, masters, service, stored };
}

const save = (setup: ReturnType<typeof setUp>, values: Record<string, string>, revision = 1) => setup.service.saveInputs(arjun, ESTIMATE, { nodeId: PART, revision, values });

async function problemsOf(promise: Promise<unknown>): Promise<ReadonlyArray<{ field: string; message: string }>> {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(FieldValidationError);
  return error instanceof FieldValidationError ? error.fields : [];
}

describe('AC-1: a surface treatment is a flag, 1 chosen and 0 not', () => {
  it('stores 1 for a chosen treatment and answers with it; the others stay unsaid', async () => {
    const setup = setUp();
    const saved = await save(setup, { [PRIMER]: '1' });
    expect(setup.stored().inputs).toEqual({ [PRIMER]: '1' });
    expect(saved.inputs).toEqual({ [PRIMER]: '1' });
    expect(saved.revision).toBe(2);
  });

  it('several are saved one after the other, each on its own, and leaving one stores 0 (none chosen is a valid part)', async () => {
    const setup = setUp();
    await save(setup, { [PRIMER]: '1' });
    await save(setup, { [FOAM]: '1' }, 2);
    expect(setup.stored().inputs).toEqual({ [PRIMER]: '1', [FOAM]: '1' });
    const left = await save(setup, { [PRIMER]: '0', [FOAM]: '0' }, 3);
    expect(setup.stored().inputs).toEqual({ [PRIMER]: '0', [FOAM]: '0' });
    expect(left.inputs).toEqual({ [PRIMER]: '0', [FOAM]: '0' });
  });

  it('a blank clears the flag: its key is removed, and the same flag again writes nothing', async () => {
    const setup = setUp({ [HOT_DIP]: '1' });
    await save(setup, { [HOT_DIP]: '' });
    expect(setup.stored().inputs).toEqual({});
    const writes = setup.world.nodeWrites();
    await save(setup, { [HOT_DIP]: '' }, 2);
    expect(setup.world.nodeWrites()).toBe(writes);
  });

  it.each([['2'], ['yes'], ['1.00'], ['true']])('%j is 422 under the flag, with one sentence, and nothing is stored', async (typed) => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [PRIMER]: typed }))).toEqual([{ field: PRIMER, message: FLAG_MESSAGE }]);
    expect(setup.stored().inputs).toEqual({});
  });
});

describe('AC-4: Treatment / Color is saved as { id, text }', () => {
  it('a listed entry is stored with the row\'s name, whatever words the client sent', async () => {
    const setup = setUp();
    const saved = await save(setup, { [G]: encodeTreatment({ id: POWDER_ID, text: 'Words the client made up' }) });
    expect(setup.stored().inputs).toEqual({ [G]: { id: POWDER_ID, text: POWDER_NAME } });
    expect(saved.inputs).toEqual({ [G]: encodeTreatment({ id: POWDER_ID, text: POWDER_NAME }) });
  });

  it('the ID is read in any letter case and stored in lower case', async () => {
    const setup = setUp();
    await save(setup, { [G]: encodeTreatment({ id: POWDER_ID.toUpperCase(), text: '' }) });
    expect(setup.stored().inputs).toEqual({ [G]: { id: POWDER_ID, text: POWDER_NAME } });
  });

  it('"Not applicable" is stored with its own name (FR-018, D-17), and is no list entry of the Admin', async () => {
    const setup = setUp();
    await save(setup, { [G]: encodeTreatment({ id: NOT_APPLICABLE_TREATMENT_ID, text: 'Something else' }) });
    expect(setup.stored().inputs).toEqual({ [G]: { id: NOT_APPLICABLE_TREATMENT_ID, text: NOT_APPLICABLE_NAME } });
    expect((await setup.masters.listTreatments()).map((treatment) => treatment.id)).not.toContain(NOT_APPLICABLE_TREATMENT_ID);
  });

  it('"Other" is stored with the typed words, trimmed', async () => {
    const setup = setUp();
    await save(setup, { [G]: encodeTreatment({ id: OTHER_TREATMENT_ID, text: '  Invented matt black  ' }) });
    expect(setup.stored().inputs).toEqual({ [G]: { id: OTHER_TREATMENT_ID, text: 'Invented matt black' } });
  });

  it('"Other" with no words is 422 under G and nothing is stored (AC-3: required)', async () => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [G]: encodeTreatment({ id: OTHER_TREATMENT_ID, text: '   ' }) }))).toEqual([{ field: G, message: OTHER_TREATMENT_REQUIRED_MESSAGE }]);
    expect(setup.stored().inputs).toEqual({});
  });

  it('"Other" takes 100 characters and refuses 101 (AC-3)', async () => {
    const setup = setUp();
    await save(setup, { [G]: encodeTreatment({ id: OTHER_TREATMENT_ID, text: 'x'.repeat(100) }) });
    expect(treatmentChoiceOf(setup.stored().inputs[G])?.text).toHaveLength(100);
    expect(await problemsOf(save(setup, { [G]: encodeTreatment({ id: OTHER_TREATMENT_ID, text: 'x'.repeat(101) }) }, 2))).toEqual([{ field: G, message: textTooLongMessage(100) }]);
  });

  it('an ID with no row is 422 under G, and the typed values of the same save are not stored', async () => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [G]: encodeTreatment({ id: MISSING_ID, text: 'x' }), [LENGTH]: '5' }))).toEqual([{ field: G, message: CHOOSE_TREATMENT_MESSAGE }]);
    expect(setup.stored().inputs).toEqual({});
  });

  it.each([['Invented powder finish'], ['{"id":"x"}'], ['[]']])('text that is not a choice (%j) is 422 under G', async (typed) => {
    const setup = setUp();
    expect(await problemsOf(save(setup, { [G]: typed }))).toEqual([{ field: G, message: CHOOSE_TREATMENT_MESSAGE }]);
  });

  it('a blank clears Treatment / Color: its key is removed', async () => {
    const setup = setUp({ [G]: { id: POWDER_ID, text: POWDER_NAME } });
    const saved = await save(setup, { [G]: '' });
    expect(setup.stored().inputs).toEqual({});
    expect(saved).toMatchObject({ completeness: 'EMPTY', inputs: {} });
  });

  it('the same choice again writes nothing: no new revision, and nothing is raised for the estimate', async () => {
    const setup = setUp({ [G]: { id: POWDER_ID, text: POWDER_NAME } });
    const writes = setup.world.nodeWrites();
    const saved = await save(setup, { [G]: encodeTreatment({ id: POWDER_ID, text: POWDER_NAME }) });
    expect(setup.world.nodeWrites()).toBe(writes);
    expect(saved.revision).toBe(1);
  });
});

describe('architecture section 5.1: a part keeps its words when the treatment changes', () => {
  it('a treatment that was renamed changes no part; choosing the entry again takes the new name', async () => {
    const setup = setUp();
    await save(setup, { [G]: encodeTreatment({ id: POWDER_ID, text: POWDER_NAME }) });
    defined(setup.masters.treatments.find((treatment) => treatment.id === POWDER_ID)).name = 'Invented powder finish, renamed';
    expect(setup.stored().inputs[G]).toEqual({ id: POWDER_ID, text: POWDER_NAME });
    await save(setup, { [G]: encodeTreatment({ id: POWDER_ID, text: '' }) }, 2);
    expect(setup.stored().inputs[G]).toEqual({ id: POWDER_ID, text: 'Invented powder finish, renamed' });
  });

  it('a treatment that was deleted leaves the part with its words, and the part is read back with them', async () => {
    const setup = setUp({ [G]: { id: GONE_ID, text: 'Invented gone finish' }, [LENGTH]: '1.00' });
    expect((await setup.service.getNode(arjun, ESTIMATE, PART)).inputs[G]).toBe(encodeTreatment({ id: GONE_ID, text: 'Invented gone finish' }));
  });

  it('saving the part again with the deleted treatment unchanged is accepted, and writes nothing for G', async () => {
    const setup = setUp({ [G]: { id: GONE_ID, text: 'Invented gone finish' } });
    const writes = setup.world.nodeWrites();
    const saved = await save(setup, { [G]: encodeTreatment({ id: GONE_ID, text: 'Words the client made up' }) });
    expect(setup.world.nodeWrites()).toBe(writes);
    expect(saved.revision).toBe(1);
    expect(setup.stored().inputs[G]).toEqual({ id: GONE_ID, text: 'Invented gone finish' });
  });

  it('a save of another field leaves the deleted treatment as it was', async () => {
    const setup = setUp({ [G]: { id: GONE_ID, text: 'Invented gone finish' } });
    await save(setup, { [LENGTH]: '5' });
    expect(setup.stored().inputs).toEqual({ [G]: { id: GONE_ID, text: 'Invented gone finish' }, [LENGTH]: '5.00' });
  });

  it('choosing a deleted ID that the part does not hold is 422 under G', async () => {
    const setup = setUp({ [G]: { id: POWDER_ID, text: POWDER_NAME } });
    expect(await problemsOf(save(setup, { [G]: encodeTreatment({ id: GONE_ID, text: 'x' }) }))).toEqual([{ field: G, message: CHOOSE_TREATMENT_MESSAGE }]);
    expect(setup.stored().inputs).toEqual({ [G]: { id: POWDER_ID, text: POWDER_NAME } });
  });
});

describe('what is read back', () => {
  it('a stored value that is not a choice does not go out, and a flag does', async () => {
    const stored = { [G]: 'plain text', [PRIMER]: '1' };
    const setup = setUp(stored);
    expect((await setup.service.getNode(arjun, ESTIMATE, PART)).inputs).toEqual({ [PRIMER]: '1' });
  });

  it('the form is the same for every role: G and the flags carry a rule, an ID, a letter and a label, and no list of treatments', async () => {
    const setup = setUp();
    const form = await setup.service.getForm(arjun, ESTIMATE);
    const fields = form.sections.flatMap((section) => section.fields);
    expect(fields.find((field) => field.id === G)?.rule).toEqual({ type: 'treatment', maxLength: 100 });
    expect(fields.find((field) => field.id === PRIMER)?.rule).toEqual({ type: 'flag' });
    expect(JSON.stringify(form)).not.toContain(POWDER_NAME);
  });
});
