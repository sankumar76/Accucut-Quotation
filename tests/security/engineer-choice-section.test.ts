import { describe, expect, it } from 'vitest';

import { insertFields } from '@/lib/config/field-insert';
import { buildFormSections } from '@/lib/estimate/form-fields';
import type { ConfigDocument } from '@/lib/fields/schema';
import { MATERIAL_RATE_KEY } from '@/lib/fields/types';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { forbiddenStrings } from '../support/canary-masters';
import { CANARY_PLANTED_RATE } from '../support/canary-part-inputs';
import { choiceSectionVersion } from '../support/choice-section-version';
import { defined } from '../support/defined';
import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld } from '../support/fake-estimates';
import { fieldIdAt, newOutput } from '../support/insert-specs';
import { SEED_PROCESS_ITEMS } from '../support/seed-config';

/**
 * STORY-08.08 AC-5 (NFR-002; STORY-01.03): the Engineer's form, projection and every answer they can call carry no rate, cost or formula **in a new section either**. The registry here is the worst the stored
 * data could be: an output placed in the new section and flagged visible, Material Rate / Kg moved into it and flagged visible, an input the registry hides, and the planted canary price stored in the part
 * under each of them. The allow-list (`isEngineerVisibleAllowed`), the flag and the field kind are all still asked, so none of them is drawn, none can be saved, and the canary price is in no answer for any role.
 * The only new thing an Engineer can read is the choice input the Admin added and the value they chose. Every name and value is invented.
 */

const RATES = SEED_PROCESS_ITEMS.map(({ id, name }) => ({ id, name }));
const OWNER = '00000000-0000-4000-8000-0000000000a1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const NODE = '00000000-0000-4000-8000-0000000000b1';
const engineer: EstimateViewer = { id: OWNER, role: 'ENGINEER' };
const lead: EstimateViewer = { id: '00000000-0000-4000-8000-0000000000b2', role: 'LEAD' };
const admin: EstimateViewer = { id: '00000000-0000-4000-8000-0000000000c1', role: 'ADMIN' };

const version = choiceSectionVersion();

/** The registry as a wrong stored version could leave it. */
function worstCase(): { readonly document: ConfigDocument; readonly outputId: string; readonly rateId: string; readonly hiddenId: string } {
  const withOutput = insertFields({ document: version.document, rates: RATES, spec: { kind: 'output', afterFieldId: fieldIdAt('AX'), output: newOutput({ label: 'Invented Planted Cost' }) } });
  if (!withOutput.ok) throw new Error('The invented output insert must succeed.');
  const outputId = defined(withOutput.inserted[0]).id;
  const rateId = defined(withOutput.document.fields.find((field) => field.key === MATERIAL_RATE_KEY)).id;
  const hidden = insertFields({
    document: withOutput.document,
    rates: RATES,
    spec: { kind: 'input', afterFieldId: fieldIdAt('AX'), input: { ...choiceInputOf(), label: 'Invented Hidden Input', newSection: null, sectionId: version.sectionId, choices: 'Left\nRight' } },
  });
  if (!hidden.ok) throw new Error('The invented hidden input insert must succeed.');
  const hiddenId = defined(hidden.inserted[0]).id;
  const document: ConfigDocument = {
    ...hidden.document,
    fields: hidden.document.fields.map((field) => {
      if (field.id === outputId || field.id === rateId) return { ...field, sectionId: version.sectionId, engineerVisible: true } as typeof field;
      if (field.id === hiddenId) return { ...field, engineerVisible: false } as typeof field;
      return field;
    }),
  };
  return { document, outputId, rateId, hiddenId };
}

function choiceInputOf() {
  const field = defined(version.document.fields.find((candidate) => candidate.id === version.fieldId));
  if (field.kind !== 'input') throw new Error('The choice must be an input.');
  return { label: field.label, dataType: 'select' as const, defaultValue: '', sectionId: version.sectionId, unit: '', hint: '', width: 12, numFmt: '@', watchFieldId: null, choices: 'Left\nRight' };
}

const world = worstCase();

function setUp() {
  const planted = { [world.outputId]: CANARY_PLANTED_RATE, [world.rateId]: CANARY_PLANTED_RATE, [world.hiddenId]: CANARY_PLANTED_RATE, [version.fieldId]: 'Fine' };
  const fake = createFakeEstimateWorld(
    () => [],
    [
      {
        id: ESTIMATE,
        code: 'Q-9999-0009',
        engineerId: OWNER,
        assignedByName: 'Invented Lead',
        folderPath: '\\\\invented\\share',
        deadlineAt: new Date('2099-01-01T00:00:00.000Z'),
        title: null,
        notes: null,
        status: 'DRAFT',
        customerId: null,
        inputsRevision: 1,
      },
    ],
    [{ id: NODE, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs: planted }],
  );
  const dependencies = { ...inputsDependencies(), currentConfiguration: () => Promise.resolve(world.document), configurationById: () => Promise.resolve(world.document) };
  const service = createEstimateService({ estimates: fake.repository, nodes: fake.nodeRepository, images: fake.imageRepository, transactions: fake.transactions, ...dependencies });
  return { service, fake };
}

describe('AC-5: nothing but the choice reaches the Engineer from a new section', () => {
  it('draws the choice of the new section and none of the output, the rate or the hidden input', () => {
    const ids = buildFormSections(world.document).flatMap((section) => section.fields.map((field) => field.id));
    expect(ids).toContain(version.fieldId);
    for (const forbidden of [world.outputId, world.rateId, world.hiddenId]) expect(ids).not.toContain(forbidden);
  });

  it('sends the form and the part to every role with the choice and its value only, and the canary price in no answer', async () => {
    const { service } = setUp();
    for (const viewer of [engineer, lead, admin]) {
      const form = JSON.stringify(await service.getForm(viewer, ESTIMATE));
      const part = await service.getNode(viewer, ESTIMATE, NODE);
      expect(part.inputs, viewer.role).toEqual({ [version.fieldId]: 'Fine' });
      for (const answer of [form, JSON.stringify(part)]) {
        expect(answer, viewer.role).not.toContain(CANARY_PLANTED_RATE);
        for (const forbidden of forbiddenStrings()) expect(answer, `${viewer.role}: ${forbidden.text}`).not.toContain(forbidden.text);
        for (const id of [world.outputId, world.rateId, world.hiddenId]) expect(answer, viewer.role).not.toContain(id);
        expect(answer, viewer.role).not.toContain('Invented Planted Cost');
      }
    }
  });

  it('refuses a save that names the output, the rate or the hidden input, and the stored canary price stays where it was', async () => {
    const { service, fake } = setUp();
    for (const fieldId of [world.outputId, world.rateId, world.hiddenId]) {
      await expect(service.saveInputs(engineer, ESTIMATE, { nodeId: NODE, revision: 1, values: { [fieldId]: '1' } })).rejects.toMatchObject({ fields: [{ field: fieldId, message: 'This field cannot be saved.' }] });
    }
    const saved = await service.saveInputs(engineer, ESTIMATE, { nodeId: NODE, revision: 1, values: { [version.fieldId]: 'Coarse' } });
    expect(JSON.stringify(saved)).not.toContain(CANARY_PLANTED_RATE);
    expect(fake.nodes[0]?.inputs[world.outputId]).toBe(CANARY_PLANTED_RATE);
    expect(fake.nodes[0]?.inputs[version.fieldId]).toBe('Coarse');
  });
});
