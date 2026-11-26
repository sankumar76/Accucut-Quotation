import { describe, expect, it } from 'vitest';

import type { ConfigDocument } from '@/lib/fields/schema';
import { ConflictError } from '@/lib/errors';
import type { EstimateStatus } from '@/server/repositories/task-repository';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { defined } from '../../support/defined';
import { inputsDependencies } from '../../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimate } from '../../support/fake-estimates';
import { DELETED_FIELD, laterVersion } from '../../support/later-version';
import { seedConfig } from '../../support/seed-config';

/**
 * STORY-08.05 AC-5 and AC-6 (FR-065, FR-077; SPEC section 8.4): the part form of an APPROVED estimate is built from the registry that estimate was approved with (the version of its current calculation), so a
 * field inserted later does not appear on it and a field deleted later is still shown with its stored value. A Draft (a new one, one unlocked, one after a cancelled approval) and a Prepared estimate that
 * was never approved use the latest version. Which version served the form is never in the answer (NFR-002). Over in-memory storage; the same chain against PostgreSQL is
 * `tests/integration/config/version-pinning.test.ts`. Every name and ID is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ADMIN = '00000000-0000-4000-8000-0000000000c1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const PART = '00000000-0000-4000-8000-0000000000d1';
const CALCULATION = '00000000-0000-4000-8000-0000000000ca';
const VERSION_ONE = '00000000-0000-4000-8000-0000000000f1';
const VERSION_THREE = '00000000-0000-4000-8000-0000000000f3';

const later = laterVersion();
/** The document each version ID stands for: the estimate was calculated on version 1, the latest is version 3. */
const DOCUMENTS: Readonly<Record<string, ConfigDocument>> = { [VERSION_ONE]: seedConfig, [VERSION_THREE]: later.document };

const engineer: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const viewers: ReadonlyArray<readonly [string, EstimateViewer]> = [
  ['Engineer', engineer],
  ['Lead', lead],
  ['Admin', { id: ADMIN, role: 'ADMIN' }],
];

const estimate = (status: EstimateStatus, overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
  id: ESTIMATE,
  code: 'Q-2026-0501',
  engineerId: ARJUN,
  assignedByName: 'Kiran Bose',
  folderPath: '\\\\invented-server\\invented-share\\RFQ-501',
  deadlineAt: new Date('2026-12-12T11:30:00.000Z'),
  title: null,
  notes: null,
  status,
  customerId: null,
  inputsRevision: 2,
  currentCalculationId: CALCULATION,
  configVersionId: VERSION_ONE,
  ...overrides,
});

function setUp(initial: FakeEstimate) {
  const world = createFakeEstimateWorld(() => [], [initial], [{ id: PART, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs: { [DELETED_FIELD.id]: 'PN-4711' } }]);
  const asked: string[] = [];
  const service = createEstimateService({
    estimates: world.repository,
    nodes: world.nodeRepository,
    images: world.imageRepository,
    transactions: world.transactions,
    ...inputsDependencies(),
    // The latest version is the later document; a version by its ID is the one that ID names, and each such read is counted.
    currentConfiguration: () => Promise.resolve(later.document),
    configurationById: (id) => {
      asked.push(id);
      return Promise.resolve(defined(DOCUMENTS[id], `no invented version ${id}`));
    },
  });
  return { world, service, asked };
}

const fieldIdsOf = (form: Awaited<ReturnType<ReturnType<typeof setUp>['service']['getForm']>>): string[] => form.sections.flatMap((section) => section.fields.map((field) => field.id));

describe('AC-5: an APPROVED estimate reads its form from the version of its calculation', () => {
  it.each(viewers)('%s: the field inserted later is not on the form, and the field deleted later is, with its stored value', async (_role, viewer) => {
    const { service } = setUp(estimate('APPROVED'));
    const ids = fieldIdsOf(await service.getForm(viewer, ESTIMATE));
    expect(ids).toContain(later.deletedId);
    expect(ids).not.toContain(later.insertedId);
    const part = await service.getNode(viewer, ESTIMATE, PART);
    expect(part.inputs).toEqual({ [later.deletedId]: 'PN-4711' });
  });

  it('reads the version by the ID the calculation names, and the same version for the form and for the part read back', async () => {
    const { service, asked } = setUp(estimate('APPROVED'));
    await service.getForm(engineer, ESTIMATE);
    await service.getNode(engineer, ESTIMATE, PART);
    // The form, then the part twice: the values by the version, and the name the tree row carries (AQP-446), which is read from the estimate's own version too.
    expect(asked).toEqual([VERSION_ONE, VERSION_ONE, VERSION_ONE]);
  });

  it('answers the Engineer with no version number and no version ID: the same two keys as for a Draft', async () => {
    const { service } = setUp(estimate('APPROVED'));
    const form = await service.getForm(engineer, ESTIMATE);
    expect(Object.keys(form).sort()).toEqual(['lastSavedAt', 'sections']);
    const text = JSON.stringify([form, await service.getNode(engineer, ESTIMATE, PART)]);
    expect(text).not.toContain(VERSION_ONE);
    expect(text).not.toContain(VERSION_THREE);
    expect(text.toLowerCase()).not.toContain('version');
  });

  it('still refuses a save into an APPROVED estimate (nothing about the pin makes it editable)', async () => {
    const { service } = setUp(estimate('APPROVED'));
    await expect(service.saveInputs(lead, ESTIMATE, { nodeId: PART, revision: 1, values: { [later.insertedId]: '1' } })).rejects.toBeInstanceOf(ConflictError);
  });

  it('falls back to the latest version for an APPROVED estimate that names no calculation (an inconsistent row is never an error)', async () => {
    const { service, asked } = setUp(estimate('APPROVED', { currentCalculationId: null }));
    const ids = fieldIdsOf(await service.getForm(engineer, ESTIMATE));
    expect(ids).toContain(later.insertedId);
    expect(asked).toEqual([]);
  });
});

describe('AC-5 and AC-6: every other estimate reads the latest version', () => {
  // A Draft is also what an unlocked estimate and an estimate whose approval was cancelled are (FR-107: the status goes back to DRAFT), each with its calculation still stored on the older version.
  it.each([
    ['a Draft with a stored calculation on an older version (also an unlocked one, or one after a cancelled approval)', 'DRAFT'],
    ['a Prepared estimate that was never approved', 'PREPARED'],
  ] as const)('%s', async (_name, status) => {
    for (const [role, viewer] of viewers) {
      const { service, asked } = setUp(estimate(status));
      const ids = fieldIdsOf(await service.getForm(viewer, ESTIMATE));
      expect(ids, role).toContain(later.insertedId);
      expect(ids, role).not.toContain(later.deletedId);
      expect(asked, role).toEqual([]);
    }
  });

  it('a Draft that was never calculated reads the latest version too', async () => {
    const { service } = setUp(estimate('DRAFT', { currentCalculationId: null, configVersionId: null }));
    expect(fieldIdsOf(await service.getForm(engineer, ESTIMATE))).toContain(later.insertedId);
  });

  it('the same estimate reads the later form again as soon as it is unlocked (the status is read each time, nothing is remembered)', async () => {
    const { service, world } = setUp(estimate('APPROVED'));
    expect(fieldIdsOf(await service.getForm(lead, ESTIMATE))).not.toContain(later.insertedId);
    defined(world.estimates[0]).status = 'DRAFT';
    expect(fieldIdsOf(await service.getForm(lead, ESTIMATE))).toContain(later.insertedId);
  });
});
