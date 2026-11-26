import { describe, expect, it } from 'vitest';

import { findFieldByKey } from '@/lib/fields/registry';
import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimate, type FakeNode } from '../support/fake-estimates';
import { seedConfig } from '../support/seed-config';

/**
 * AQP-446 (DEF-089; UX ruling `parts-tree-scr05-conformance-2026-11-26.md` checks NAME-1, NAME-2, NAME-5, NAME-6): the tree answer carries each row's name as `label`: its Description, else its Part No., else an
 * empty text (the screen then draws the kind's own name). It is an input typed by the person, never a figure, so every role's tree has it. Over in-memory storage; every ID and name is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };

const DESCRIPTION = findFieldByKey(seedConfig, 'description')?.id ?? 'missing';
const PART_NO = findFieldByKey(seedConfig, 'part-no')?.id ?? 'missing';

const estimate: FakeEstimate = {
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
};

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const node = (n: number, inputs: Record<string, unknown>, nodeKind: FakeNode['nodeKind'] = 'PART'): FakeNode => ({ id: id(n), estimateId: ESTIMATE, parentId: n === 1 ? null : id(1), sortIndex: n, nodeKind, revision: 1, inputs });

function setUp(nodes: ReadonlyArray<FakeNode>) {
  const world = createFakeEstimateWorld(() => [], [estimate], nodes);
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
  return { world, service };
}

const labelsOf = (tree: ReadonlyArray<{ readonly id: string; readonly label: string }>): string[] => tree.map((row) => row.label);

describe('the name of a row in the tree answer', () => {
  it('is the Description when one was typed (NAME-1), the Part No. when there is no Description (NAME-2), and empty when neither (NAME-3)', async () => {
    const { service } = setUp([
      node(1, { [DESCRIPTION]: 'Base frame', [PART_NO]: 'XP-1' }, 'MAIN_ASSEMBLY'),
      node(2, { [PART_NO]: 'XP-1101' }),
      node(3, {}),
      node(4, { [DESCRIPTION]: '  Cover plate  ', [PART_NO]: 'XP-2' }),
    ]);
    expect(labelsOf(await service.getTree(arjun, ESTIMATE))).toEqual(['Base frame', 'XP-1101', '', 'Cover plate']);
  });

  it('counts a Description of only spaces as empty, so the Part No. names the row (NAME-5)', async () => {
    const { service } = setUp([node(1, { [DESCRIPTION]: '   ', [PART_NO]: 'XP-7' }, 'MAIN_ASSEMBLY')]);
    expect(labelsOf(await service.getTree(arjun, ESTIMATE))).toEqual(['XP-7']);
  });

  it('is the same for a Lead as for the Engineer: typed text, no figure (NAME-6)', async () => {
    const { service } = setUp([node(1, { [DESCRIPTION]: 'Base frame' }, 'MAIN_ASSEMBLY')]);
    const [forEngineer, forLead] = await Promise.all([service.getTree(arjun, ESTIMATE), service.getTree(lead, ESTIMATE)]);
    expect(labelsOf(forEngineer)).toEqual(['Base frame']);
    expect(forLead).toEqual(forEngineer);
    expect(Object.keys(forEngineer[0] ?? {}).sort()).toEqual(['completeness', 'id', 'label', 'nodeKind', 'parentId', 'revision', 'slNo']);
  });

  it('is on the answer to an add, with the new row empty and the others as they were', async () => {
    const { service } = setUp([node(1, { [DESCRIPTION]: 'Base frame' }, 'MAIN_ASSEMBLY')]);
    const added = await service.addPart(arjun, ESTIMATE, { parentId: id(1), nodeKind: 'SUB_ASSEMBLY' });
    expect(labelsOf(added.nodes)).toEqual(['Base frame', '']);
  });

  it('is on the node answer, so a reload shows the saved name (NAME-4)', async () => {
    const { service } = setUp([node(1, { [DESCRIPTION]: 'Base frame' }, 'MAIN_ASSEMBLY')]);
    expect((await service.getNode(arjun, ESTIMATE, id(1))).label).toBe('Base frame');
  });
});
