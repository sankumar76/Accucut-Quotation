import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CalculateBlockedError, FieldValidationError } from '@/lib/errors';
import { createConfigRepository } from '@/server/repositories/config-repository';
import { createImageRepository } from '@/server/repositories/image-repository';
import { createConfigStructureService, type ConfigStructureService } from '@/server/services/config-structure-service';
import { createConfigVersionCache, getCurrentVersion, getVersionById } from '@/server/services/config-service';
import type { ConfigEditCaller } from '@/server/services/config-edit-service';
import { createEstimateService, type EstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { adminOf, engineerOf, leadOf } from '../../support/approval-helpers';
import { approvedEstimateOf, approvedValuesOf, exportCellsOf, openApprovedWorld, type ApprovedWorld } from '../../support/approved-world';
import { CHOICE_LABEL, CHOICE_OPTIONS, choiceInput, NEW_SECTION_NAME } from '../../support/choice-section-version';
import { defined } from '../../support/defined';
import { inputAfterAx } from '../../support/insert-specs';

/**
 * STORY-08.08 AC-1 to AC-5 and AC-8 (FR-074, FR-077, NFR-026) against real PostgreSQL in a throwaway database, as the runtime role, through the real services: an estimate is **approved first**, then the Admin's
 * own service inserts a choice input into **a new section** (one new version), and what the Engineer sees and stores is read: the new card after section 08 with the choice, a saved choice that is the option's text
 * in the part's `jsonb` and survives a reload, a value that is none of the options refused 422 with nothing stored, Calculate refused with the existing missing-input refusal while the choice is blank and
 * accepted when it is set, the chosen text in the stored row and in the exported file's new column, and the approved estimate's form, figures and every cell of its file exactly as they were. Every name is invented.
 */

let world: ApprovedWorld;
let estimates: EstimateService;
let structure: ConfigStructureService;
let admin: ConfigEditCaller;
let choiceId: string;
let approvedId: string;
let approvedBefore: Awaited<ReturnType<typeof approvedValuesOf>>;
let formBefore: Awaited<ReturnType<EstimateService['getForm']>>;

const configurations = () => createConfigRepository(world.db.prisma);
const engineer = (): EstimateViewer => engineerOf(world.db);
const lead = (): EstimateViewer => leadOf(world.db);

async function storedInputs(nodeId: string): Promise<Record<string, unknown>> {
  const { rows } = await world.db.owner.query<{ inputs: Record<string, unknown> }>('SELECT inputs FROM estimate_nodes WHERE id = $1::uuid', [nodeId]);
  return defined(rows[0]).inputs;
}

/** A complete Draft of the engineer, made after the insert: the one part's ID and revision. */
async function newDraft(): Promise<{ estimateId: string; nodeId: string; revision: number }> {
  const estimateId = await world.db.addCompleteEstimate();
  const node = defined((await world.db.nodes.listNodes(estimateId))[0]);
  return { estimateId, nodeId: node.id, revision: node.revision };
}

const save = (draft: { estimateId: string; nodeId: string }, revision: number, value: string) => estimates.saveInputs(engineer(), draft.estimateId, { nodeId: draft.nodeId, revision, values: { [choiceId]: value } });

beforeAll(async () => {
  world = await openApprovedWorld();
  const { db } = world;
  const cache = createConfigVersionCache();
  estimates = createEstimateService({
    estimates: db.estimates,
    nodes: db.nodes,
    images: createImageRepository(db.prisma),
    transactions: db.transactions,
    materials: db.masterRepository,
    currentConfiguration: async () => (await getCurrentVersion(configurations(), cache)).document,
    configurationById: async (id) => (await getVersionById(configurations(), id, cache)).document,
  });
  structure = createConfigStructureService({
    configurations: configurations(),
    masters: db.masterRepository,
    stepUp: { verifyStepUp: () => Promise.reject(new Error('An insert must not ask for a password.')) },
    transactions: db.transactions,
    audit: db.audit,
    cache: createConfigVersionCache(),
  });
  admin = { user: { id: world.admin.actorId, name: world.admin.actorLabel, role: 'ADMIN' }, requestId: 'req-0000beef' };

  // Before the insert: an approved estimate, what it shows and stores, and its form.
  approvedId = (await approvedEstimateOf(world)).estimateId;
  approvedBefore = await approvedValuesOf(world, approvedId);
  formBefore = await estimates.getForm(lead(), approvedId);

  // The Admin inserts a choice input with no default into a new section: one new version.
  await structure.insertFields(admin, { spec: inputAfterAx(choiceInput()), baseVersion: 1 });
  const latest = await getCurrentVersion(configurations(), createConfigVersionCache());
  choiceId = defined(latest.document.fields.find((field) => field.label === CHOICE_LABEL)).id;
}, 240_000);

afterAll(async () => {
  await world.db.close();
});

describe('AC-7 (the stored version): one version holds the section and the field', () => {
  it('is version 2, with the new section (number 9, cards) and the choice input holding the options in the order typed', async () => {
    const { rows } = await world.db.owner.query<{ number: number }>('SELECT number FROM config_versions ORDER BY number');
    expect(rows.map((row) => row.number)).toEqual([1, 2]);
    const latest = await getCurrentVersion(configurations(), createConfigVersionCache());
    const field = defined(latest.document.fields.find((candidate) => candidate.id === choiceId));
    const section = defined(latest.document.sections.find((candidate) => candidate.id === field.sectionId));
    expect(section).toMatchObject({ number: 9, name: NEW_SECTION_NAME, displayMode: 'cards' });
    expect(field).toMatchObject({ kind: 'input', dataType: 'select', options: [...CHOICE_OPTIONS], mandatory: true, engineerVisible: true });
  });
});

describe('AC-1, AC-4: the Engineer opens the form', () => {
  it('draws the new card after section 08 with the choice, its letter and its options, for every role alike', async () => {
    const draft = await newDraft();
    for (const viewer of [engineer(), lead(), adminOf(world.db)]) {
      const form = await estimates.getForm(viewer, draft.estimateId);
      expect(form.sections.map((section) => section.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const card = defined(form.sections[8]);
      expect(card).toMatchObject({ number: 9, name: NEW_SECTION_NAME, columnRange: 'AY' });
      expect(card.fields).toEqual([expect.objectContaining({ id: choiceId, letter: 'AY', label: CHOICE_LABEL, rule: { type: 'choice', options: [...CHOICE_OPTIONS] } })]);
    }
  });
});

describe('AC-2: a choice is saved as the option text, and refused when it is none of them', () => {
  it('stores the option for an exact match (trimmed), survives a reload, and a blank clears it', async () => {
    const draft = await newDraft();
    const saved = await save(draft, draft.revision, '  Fine ');
    expect(saved.inputs[choiceId]).toBe('Fine');
    expect((await storedInputs(draft.nodeId))[choiceId]).toBe('Fine');
    expect((await estimates.getNode(engineer(), draft.estimateId, draft.nodeId)).inputs[choiceId]).toBe('Fine');
    const cleared = await save(draft, saved.revision, '');
    expect((await storedInputs(draft.nodeId))[choiceId]).toBeUndefined();
    expect(cleared.completeness).not.toBe('COMPLETE');
  });

  it('refuses another value and another letter case with 422 on the field, and stores nothing', async () => {
    const draft = await newDraft();
    for (const typed of ['Smooth', 'fine', 'Fine,Coarse']) {
      const failure = await save(draft, draft.revision, typed).catch((error: unknown) => error);
      expect(failure, typed).toBeInstanceOf(FieldValidationError);
      expect((failure as FieldValidationError).fields).toEqual([{ field: choiceId, message: 'Choose one of the listed options.' }]);
    }
    expect((await storedInputs(draft.nodeId))[choiceId]).toBeUndefined();
    expect((defined((await world.db.nodes.listNodes(draft.estimateId))[0])).revision).toBe(draft.revision);
  });
});

describe('AC-3, AC-8: Calculate, and the chosen text in the record and the file', () => {
  it('refuses a Draft whose mandatory choice is blank with the existing refusal naming the part and the field, and writes nothing', async () => {
    const draft = await newDraft();
    const error = await world.db.service.calculate(engineer(), draft.estimateId).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CalculateBlockedError);
    expect(error instanceof CalculateBlockedError && error.parts.map((part) => [part.slNo, part.fields.map((field) => field.label)])).toEqual([['1', [CHOICE_LABEL]]]);
    const { rows } = await world.db.owner.query<{ count: string }>('SELECT count(*) FROM calculations WHERE estimate_id = $1::uuid', [draft.estimateId]);
    expect(rows).toEqual([{ count: '0' }]);
  });

  it('calculates once the choice is set, stores the chosen text with the row, and the file holds it in the new field\'s column (AY)', async () => {
    const draft = await newDraft();
    await save(draft, draft.revision, 'Mirror');
    const answer = await world.db.service.calculate(engineer(), draft.estimateId);
    expect(answer.status).toBe('PREPARED');
    const { rows } = await world.db.owner.query<{ chosen: string | null }>(
      'SELECT r.inputs ->> $2 AS chosen FROM calculation_rows r JOIN calculations c ON c.id = r.calculation_id WHERE c.estimate_id = $1::uuid',
      [draft.estimateId, choiceId],
    );
    expect(rows.map((row) => row.chosen)).toContain('Mirror');
    const cells = await exportCellsOf(world, draft.estimateId);
    // Column AY is the 51st; the header names it and the part's row holds the chosen text.
    expect(cells.rows[0]?.[50]).toBe(CHOICE_LABEL);
    expect(cells.rows.slice(1).map((row) => row[50])).toContain('Mirror');
  });
});

describe('AC-8: an estimate approved before the insert does not change', () => {
  it('shows no new section and no new field on its form, whoever opens it', async () => {
    for (const viewer of [engineer(), lead()]) {
      const form = await estimates.getForm(viewer, approvedId);
      expect(form.sections).toEqual(formBefore.sections);
      expect(form.sections.flatMap((section) => section.fields.map((field) => field.id))).not.toContain(choiceId);
    }
  });

  it('keeps its figures, its records and every cell of its file exactly as they were, on configuration version 1', async () => {
    const after = await approvedValuesOf(world, approvedId);
    expect(after.costs.configurationNumber).toBe(1);
    expect(after).toEqual(approvedBefore);
  });
});
