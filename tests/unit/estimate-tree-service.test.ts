import { describe, expect, it, vi } from 'vitest';

import { ConflictError, FieldValidationError, NotFoundError, TREE_CHANGED_CODE, TreeChangedError } from '@/lib/errors';
import type { PartView } from '@/lib/estimate/part-view';
import { createEstimateService, ESTIMATE_NOT_EDITABLE_CODE, type EstimateViewer } from '@/server/services/estimate-service';

import { buildTree500 } from '../support/builders/tree500';
import { defined } from '../support/defined';
import { createFakeEstimateWorld, type FakeEstimate, type FakeNode } from '../support/fake-estimates';

/**
 * STORY-05.02 T2 to T4 (AC-1 to AC-8): the rules of the parts tree over in-memory storage. Who may call is `tests/security`; the real queries, the row lock and the
 * triggers are `tests/integration/estimates/tree.test.ts`. The tree is built through the service itself, so the rules that make a tree are the ones under test.
 * Every name and ID here is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const PRIYA = '00000000-0000-4000-8000-0000000000a2';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const OTHER_ESTIMATE = '00000000-0000-4000-8000-0000000000e2';
const MISSING = '00000000-0000-4000-8000-0000000000ff';
const FOREIGN_NODE = '00000000-0000-4000-8000-0000000000f1';

const estimate = (overrides: Partial<FakeEstimate> = {}): FakeEstimate => ({
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
  ...overrides,
});

const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const priya: EstimateViewer = { id: PRIYA, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const admin: EstimateViewer = { id: '00000000-0000-4000-8000-0000000000c1', role: 'ADMIN' };

function setUp(initial: ReadonlyArray<FakeEstimate> = [estimate()], nodes: ReadonlyArray<FakeNode> = []) {
  const world = createFakeEstimateWorld(() => [], initial, nodes);
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, transactions: world.transactions });
  const revision = (): number => world.estimates.find((candidate) => candidate.id === ESTIMATE)?.inputsRevision ?? -1;
  return { world, service, revision };
}

type Setup = ReturnType<typeof setUp>;

const numbers = (nodes: ReadonlyArray<PartView>): string[] => nodes.map((node) => node.slNo);
const idOf = (nodes: ReadonlyArray<PartView>, slNo: string): string => {
  const found = nodes.find((node) => node.slNo === slNo);
  if (found === undefined) throw new Error(`no part ${slNo} in ${numbers(nodes).join(', ')}`);
  return found.id;
};
const revisionOf = (nodes: ReadonlyArray<PartView>, slNo: string): number => nodes.find((node) => node.slNo === slNo)?.revision ?? -1;

/** The tree of the story: 1, 1.1, 1.1.1, 1.1.2, 1.2, 1.3, 1.4, 1.5 and 2, made by the service with the Engineer's own requests. */
async function storyTree({ service }: Setup): Promise<PartView[]> {
  const first = await service.addPart(arjun, ESTIMATE, { kind: 'item' });
  const one = first.nodeId;
  const oneOne = (await service.addPart(arjun, ESTIMATE, { kind: 'sub-part', nodeId: one })).nodeId;
  await service.addPart(arjun, ESTIMATE, { kind: 'sub-part', nodeId: oneOne });
  const deep = await service.addPart(arjun, ESTIMATE, { kind: 'sub-part', nodeId: oneOne });
  await service.addPart(arjun, ESTIMATE, { kind: 'beside', nodeId: oneOne });
  for (let sibling = 0; sibling < 3; sibling += 1) await service.addPart(arjun, ESTIMATE, { kind: 'sub-part', nodeId: one });
  const last = await service.addPart(arjun, ESTIMATE, { kind: 'item' });
  expect(numbers(last.nodes)).toEqual(['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.3', '1.4', '1.5', '2']);
  expect(deep.nodes.length).toBe(4);
  return [...last.nodes];
}

describe('AC-1: adding a part', () => {
  it('"New item" adds a top-level part with empty inputs, last, and the Sl. No is read from the tree and never stored', async () => {
    const setUpped = setUp();
    const { service, world } = setUpped;
    await service.addPart(arjun, ESTIMATE, { kind: 'item' });
    const added = await service.addPart(arjun, ESTIMATE, { kind: 'item' });
    expect(numbers(added.nodes)).toEqual(['1', '2']);
    expect(world.nodes).toHaveLength(2);
    for (const node of world.nodes) {
      expect(node.inputs).toEqual({});
      expect(node.revision).toBe(1);
      expect(Object.keys(node).sort()).toEqual(['estimateId', 'id', 'inputs', 'parentId', 'revision', 'sortIndex']);
    }
  });

  it('"Sub-part" adds a part last under the one named, and "Part beside" adds one right after it, whatever the depth', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const { service } = setUpped;
    const deepest = idOf(tree, '1.1.2');
    const sub = await service.addPart(arjun, ESTIMATE, { kind: 'sub-part', nodeId: deepest });
    expect(numbers(sub.nodes)).toContain('1.1.2.1');
    const beside = await service.addPart(arjun, ESTIMATE, { kind: 'beside', nodeId: idOf(sub.nodes, '1.1.1') });
    expect(beside.nodes.find((node) => node.id === beside.nodeId)?.slNo).toBe('1.1.2');
    expect(beside.nodes.find((node) => node.id === deepest)?.slNo).toBe('1.1.3');
  });

  it('answers each node with the same six facts and no figure: ID, parent, Sl. No, label, completeness and revision', async () => {
    const setUpped = setUp();
    const { nodes } = await setUpped.service.addPart(arjun, ESTIMATE, { kind: 'item' });
    expect(Object.keys(nodes[0] ?? {}).sort()).toEqual(['completeness', 'id', 'label', 'parentId', 'revision', 'slNo']);
    expect(nodes[0]).toMatchObject({ parentId: null, slNo: '1', label: '', completeness: 'EMPTY', revision: 1 });
  });

  it('a target part that does not exist in this estimate is 404, also when it is a real part of another estimate', async () => {
    const setUpped = setUp([estimate(), estimate({ id: OTHER_ESTIMATE, code: 'Q-2026-0319' })]);
    const { service, world } = setUpped;
    const foreign: FakeNode = { id: FOREIGN_NODE, estimateId: OTHER_ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs: {} };
    world.nodes.push(foreign);
    await expect(service.addPart(arjun, ESTIMATE, { kind: 'sub-part', nodeId: foreign.id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.addPart(arjun, ESTIMATE, { kind: 'beside', nodeId: MISSING })).rejects.toBeInstanceOf(NotFoundError);
    expect(world.nodes.filter((node) => node.estimateId === ESTIMATE)).toHaveLength(0);
  });
});

describe('AC-2: Sl. No renumbers after every change', () => {
  it('moves up and down by one place inside the parent: 1.3 up is 1.2, and the part that was 1.2 is 1.3', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const up = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.3'), revision: revisionOf(tree, '1.3'), parentId: idOf(tree, '1'), index: 1 });
    expect(up.find((node) => node.id === idOf(tree, '1.3'))?.slNo).toBe('1.2');
    expect(up.find((node) => node.id === idOf(tree, '1.2'))?.slNo).toBe('1.3');
    const down = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.3'), revision: 2, parentId: idOf(tree, '1'), index: 2 });
    expect(down.find((node) => node.id === idOf(tree, '1.3'))?.slNo).toBe('1.3');
    expect(numbers(down)).toEqual(numbers(tree));
  });

  it('moves a part to another parent with its sub-parts, and leaves no gap behind', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const moved = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.1'), revision: 1, parentId: idOf(tree, '2'), index: 0 });
    expect(moved.find((node) => node.id === idOf(tree, '1.1'))?.slNo).toBe('2.1');
    expect(moved.find((node) => node.id === idOf(tree, '1.1.2'))?.slNo).toBe('2.1.2');
    expect(moved.find((node) => node.id === idOf(tree, '1.2'))?.slNo).toBe('1.1');
    expect(numbers(moved)).toEqual(['1', '1.1', '1.2', '1.3', '1.4', '2', '2.1', '2.1.1', '2.1.2']);
  });

  it('a part moved to the top level (parent null) takes a top-level number', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const moved = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.1.2'), revision: 1, parentId: null, index: 1 });
    expect(moved.find((node) => node.id === idOf(tree, '1.1.2'))?.slNo).toBe('2');
  });

  it('after a delete the next sibling takes the number of the one that went', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const left = await setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.2'), revision: 1, parts: 1 });
    expect(numbers(left)).toEqual(['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.3', '1.4', '2']);
    expect(left.find((node) => node.id === idOf(tree, '1.3'))?.slNo).toBe('1.2');
  });

  it('keeps the stored places 0, 1, 2, ... in every sibling group after any change, so the numbering never drifts', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.1'), revision: 1, parentId: idOf(tree, '2'), index: 0 });
    await setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.4'), revision: 1, parts: 1 });
    const groups = new Map<string | null, number[]>();
    for (const node of setUpped.world.nodes) groups.set(node.parentId, [...(groups.get(node.parentId) ?? []), node.sortIndex]);
    for (const places of groups.values()) expect(places.sort((a, b) => a - b)).toEqual(places.map((_, place) => place));
  });
});

describe('AC-3: deleting a part deletes its sub-parts, and only the person who saw how many may', () => {
  it('deletes a part with 2 sub-parts and all they hold in one transaction, when the count confirmed is 3', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const left = await setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.1'), revision: 1, parts: 3 });
    expect(numbers(left)).toEqual(['1', '1.1', '1.2', '1.3', '1.4', '2']);
    expect(setUpped.world.nodes).toHaveLength(6);
  });

  it('a part with no sub-parts deletes when the count confirmed is 1', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    await setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '2'), revision: 1, parts: 1 });
    expect(setUpped.world.nodes).toHaveLength(8);
  });

  it('refuses with 409 and the fresh tree, and deletes nothing, when sub-parts were added after the person looked (the count no longer matches)', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    await setUpped.service.addPart(lead, ESTIMATE, { kind: 'sub-part', nodeId: idOf(tree, '1.2') });
    const refused = await setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.2'), revision: 1, parts: 1 }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(TreeChangedError);
    expect(refused).toBeInstanceOf(ConflictError);
    expect(refused).toMatchObject({ code: TREE_CHANGED_CODE, httpStatus: 409 });
    expect((refused as TreeChangedError).tree).toHaveLength(10);
    expect(setUpped.world.nodes).toHaveLength(10);
  });

  it('refuses with 409 when the part itself was changed after the person looked', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const node = setUpped.world.nodes.find((candidate) => candidate.id === idOf(tree, '2'));
    if (node === undefined) throw new Error('no node');
    node.revision = 5;
    await expect(setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '2'), revision: 1, parts: 1 })).rejects.toBeInstanceOf(TreeChangedError);
    expect(setUpped.world.nodes).toHaveLength(9);
  });

  it('a delete that fails part way puts every part back, and the inputs revision is not raised (one transaction)', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const before = setUpped.revision();
    vi.spyOn(setUpped.world.repository, 'bumpInputsRevision').mockRejectedValueOnce(new Error('the last write failed'));
    await expect(setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.1'), revision: 1, parts: 3 })).rejects.toThrow('the last write failed');
    expect(setUpped.world.nodes).toHaveLength(9);
    expect(setUpped.revision()).toBe(before);
  });
});

describe('AC-4: a move cannot cut a part off, and changes no input', () => {
  it('refuses 422 under parentId for a move under itself, under a child and under a deep descendant, and changes nothing', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const before = JSON.stringify(setUpped.world.nodes);
    for (const under of ['1', '1.1', '1.1.2']) {
      const refused = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1'), revision: 1, parentId: idOf(tree, under), index: 0 }).catch((error: unknown) => error);
      expect(refused, `under ${under}`).toBeInstanceOf(FieldValidationError);
      expect((refused as FieldValidationError).fields[0]?.field).toBe('parentId');
    }
    expect(JSON.stringify(setUpped.world.nodes)).toBe(before);
  });

  it('refuses 422 under parentId for a parent that is not in this estimate', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    await expect(setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.2'), revision: 1, parentId: MISSING, index: 0 })).rejects.toBeInstanceOf(FieldValidationError);
  });

  it('changes no input: the typed values of every part are the same after a move, and only the moved part has a new revision', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    for (const node of setUpped.world.nodes) node.inputs = { typed: `value of ${node.id}` };
    const before = setUpped.world.nodes.map((node) => ({ id: node.id, inputs: node.inputs, revision: node.revision }));
    await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.4'), revision: 1, parentId: idOf(tree, '2'), index: 0 });
    for (const was of before) {
      const now = setUpped.world.nodes.find((node) => node.id === was.id);
      expect(now?.inputs).toEqual(was.inputs);
      expect(now?.revision).toBe(was.id === idOf(tree, '1.4') ? was.revision + 1 : was.revision);
    }
  });

  it('a move to the place the part already has writes nothing and raises nothing', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const writes = setUpped.world.nodeWrites();
    const revision = setUpped.revision();
    const same = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.2'), revision: 1, parentId: idOf(tree, '1'), index: 1 });
    expect(numbers(same)).toEqual(numbers(tree));
    expect(setUpped.world.nodeWrites()).toBe(writes);
    expect(setUpped.revision()).toBe(revision);
  });
});

describe('AC-5: every change to the tree raises the inputs revision by one, in the same transaction', () => {
  it('an add, a move and a delete each raise it by exactly one', async () => {
    const setUpped = setUp();
    const { service, revision } = setUpped;
    const first = await service.addPart(arjun, ESTIMATE, { kind: 'item' });
    expect(revision()).toBe(1);
    const second = await service.addPart(arjun, ESTIMATE, { kind: 'beside', nodeId: first.nodeId });
    expect(revision()).toBe(2);
    await service.moveNode(arjun, ESTIMATE, { nodeId: second.nodeId, revision: 1, parentId: first.nodeId, index: 0 });
    expect(revision()).toBe(3);
    await service.deleteNode(arjun, ESTIMATE, { nodeId: first.nodeId, revision: 1, parts: 2 });
    expect(revision()).toBe(4);
  });

  it('a refused request raises nothing: a stale move, a move under itself, a delete with the wrong count and a read', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const revision = setUpped.revision();
    await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1.2'), revision: 9, parentId: idOf(tree, '1'), index: 0 }).catch(() => undefined);
    await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1'), revision: 1, parentId: idOf(tree, '1.1'), index: 0 }).catch(() => undefined);
    await setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '1'), revision: 1, parts: 2 }).catch(() => undefined);
    await setUpped.service.getTree(arjun, ESTIMATE);
    expect(setUpped.revision()).toBe(revision);
  });

  it('an add that fails when the revision is raised leaves no part behind (the part and the revision commit together)', async () => {
    const setUpped = setUp();
    vi.spyOn(setUpped.world.repository, 'bumpInputsRevision').mockRejectedValueOnce(new Error('the revision write failed'));
    await expect(setUpped.service.addPart(arjun, ESTIMATE, { kind: 'item' })).rejects.toThrow('the revision write failed');
    expect(setUpped.world.nodes).toHaveLength(0);
    expect(setUpped.revision()).toBe(0);
  });
});

describe('AC-6: two edits with a stale revision', () => {
  it('the second gets 409 with the fresh tree and the first stands', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const target = idOf(tree, '1.2');
    await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: target, revision: 1, parentId: idOf(tree, '2'), index: 0 });
    const second = await setUpped.service.moveNode(lead, ESTIMATE, { nodeId: target, revision: 1, parentId: idOf(tree, '1'), index: 0 }).catch((error: unknown) => error);
    expect(second).toBeInstanceOf(TreeChangedError);
    const fresh = (second as TreeChangedError).tree;
    expect(fresh.find((node) => node.id === target)).toMatchObject({ slNo: '2.1', revision: 2 });
    expect(setUpped.world.nodes.find((node) => node.id === target)?.parentId).toBe(idOf(tree, '2'));
  });

  it('a request that names the current revision goes through, and the revision it answers with is one higher', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const target = idOf(tree, '1.3');
    const moved = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: target, revision: 1, parentId: idOf(tree, '1'), index: 0 });
    expect(revisionOf(moved, '1.1')).toBe(2);
  });
});

describe('AC-7: who may write, and when', () => {
  it('refuses the Engineer on a SUBMITTED and an APPROVED estimate with 409 ESTIMATE_NOT_EDITABLE for an add, a move and a delete, and changes nothing', async () => {
    for (const status of ['SUBMITTED', 'APPROVED'] as const) {
      const setUpped = setUp();
      const tree = await storyTree(setUpped);
      const estimateRow = setUpped.world.estimates[0];
      if (estimateRow === undefined) throw new Error('no estimate');
      estimateRow.status = status;
      const before = JSON.stringify(setUpped.world.nodes);
      const requests = [
        () => setUpped.service.addPart(arjun, ESTIMATE, { kind: 'item' }),
        () => setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: idOf(tree, '2'), revision: 1, parentId: null, index: 0 }),
        () => setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: idOf(tree, '2'), revision: 1, parts: 1 }),
      ];
      for (const request of requests) await expect(request()).rejects.toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE, httpStatus: 409 });
      expect(JSON.stringify(setUpped.world.nodes)).toBe(before);
    }
  });

  it('a Lead and an Admin may still change a SUBMITTED estimate (the shared rule, STORY-06.01), and nobody may change an APPROVED one', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const estimateRow = defined(setUpped.world.estimates[0]);
    estimateRow.status = 'SUBMITTED';
    const added = await setUpped.service.addPart(lead, ESTIMATE, { kind: 'item' });
    expect(numbers(added.nodes)).toContain('3');
    expect(numbers(await setUpped.service.moveNode(admin, ESTIMATE, { nodeId: idOf(tree, '2'), revision: 1, parentId: null, index: 0 }))[0]).toBe('1');
    estimateRow.status = 'APPROVED';
    const before = JSON.stringify(setUpped.world.nodes);
    for (const viewer of [lead, admin]) {
      await expect(setUpped.service.addPart(viewer, ESTIMATE, { kind: 'item' })).rejects.toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE });
      await expect(setUpped.service.deleteNode(viewer, ESTIMATE, { nodeId: idOf(tree, '2'), revision: 9, parts: 1 })).rejects.toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE });
    }
    expect(JSON.stringify(setUpped.world.nodes)).toBe(before);
  });

  it('another Engineer, and an estimate that does not exist, are the same 404 for every write and for the reads, even when the estimate is submitted', async () => {
    const setUpped = setUp([estimate({ status: 'SUBMITTED' })]);
    const attempts = (viewer: EstimateViewer, estimateId: string) => [
      () => setUpped.service.addPart(viewer, estimateId, { kind: 'item' }),
      () => setUpped.service.moveNode(viewer, estimateId, { nodeId: MISSING, revision: 1, parentId: null, index: 0 }),
      () => setUpped.service.deleteNode(viewer, estimateId, { nodeId: MISSING, revision: 1, parts: 1 }),
      () => setUpped.service.getTree(viewer, estimateId),
      () => setUpped.service.getNode(viewer, estimateId, MISSING),
    ];
    for (const request of [...attempts(priya, ESTIMATE), ...attempts(arjun, MISSING), ...attempts(arjun, 'not-a-uuid')]) await expect(request()).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a Lead and an Admin may change any draft, and an Engineer only their own', async () => {
    const setUpped = setUp();
    await setUpped.service.addPart(lead, ESTIMATE, { kind: 'item' });
    await setUpped.service.addPart(admin, ESTIMATE, { kind: 'item' });
    expect(setUpped.world.nodes).toHaveLength(2);
    await expect(setUpped.service.addPart(priya, ESTIMATE, { kind: 'item' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a part that does not exist is 404 for a move and a delete, after the estimate checks (so a submitted estimate says 409 first)', async () => {
    const setUpped = setUp();
    await expect(setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: MISSING, revision: 1, parentId: null, index: 0 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: MISSING, revision: 1, parts: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('reads of a submitted tree are allowed to its owner and to a Lead', async () => {
    const setUpped = setUp();
    await storyTree(setUpped);
    const estimateRow = setUpped.world.estimates[0];
    if (estimateRow === undefined) throw new Error('no estimate');
    estimateRow.status = 'SUBMITTED';
    expect((await setUpped.service.getTree(arjun, ESTIMATE)).length).toBe(9);
    expect((await setUpped.service.getTree(lead, ESTIMATE)).length).toBe(9);
  });
});

describe('AC-8: one schema for every role, and a 500-node tree', () => {
  it('gives the same answer to an Engineer, a Lead and an Admin, with no key beyond the six', async () => {
    const setUpped = setUp();
    await storyTree(setUpped);
    const asEngineer = await setUpped.service.getTree(arjun, ESTIMATE);
    expect(await setUpped.service.getTree(lead, ESTIMATE)).toEqual(asEngineer);
    expect(await setUpped.service.getTree(admin, ESTIMATE)).toEqual(asEngineer);
    for (const node of asEngineer) expect(Object.keys(node).sort()).toEqual(['completeness', 'id', 'label', 'parentId', 'revision', 'slNo']);
  });

  it('reads one part with its typed inputs, and the same for every role', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const detail = await setUpped.service.getNode(arjun, ESTIMATE, idOf(tree, '1.1.2'));
    expect(detail).toMatchObject({ id: idOf(tree, '1.1.2'), slNo: '1.1.2', revision: 1, inputs: {}, completeness: 'EMPTY' });
    expect(await setUpped.service.getNode(lead, ESTIMATE, idOf(tree, '1.1.2'))).toEqual(detail);
  });

  it('says PARTIAL for a part that has something typed and EMPTY for one that has nothing', async () => {
    const setUpped = setUp();
    const tree = await storyTree(setUpped);
    const typed = setUpped.world.nodes.find((node) => node.id === idOf(tree, '2'));
    if (typed === undefined) throw new Error('no node');
    typed.inputs = { typed: 'x' };
    const read = await setUpped.service.getTree(arjun, ESTIMATE);
    expect(read.find((node) => node.slNo === '2')?.completeness).toBe('PARTIAL');
    expect(read.find((node) => node.slNo === '1')?.completeness).toBe('EMPTY');
  });

  it('numbers a 500-node tree the same as the independent builder, in well under a second (NFR-008)', async () => {
    const { nodes: built } = buildTree500();
    const counts = new Map<number | null, number>();
    const flat: FakeNode[] = built.map((entry) => {
      const place = counts.get(entry.parentIndex) ?? 0;
      counts.set(entry.parentIndex, place + 1);
      return { id: `00000000-0000-4000-8000-${String(entry.index).padStart(12, '0')}`, estimateId: ESTIMATE, parentId: entry.parentIndex === null ? null : `00000000-0000-4000-8000-${String(entry.parentIndex).padStart(12, '0')}`, sortIndex: place, revision: 1, inputs: {} };
    });
    const setUpped = setUp([estimate()], flat);
    const started = performance.now();
    const read = await setUpped.service.getTree(arjun, ESTIMATE);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(read).toHaveLength(500);
    const bySl = new Map(read.map((node) => [node.id, node.slNo]));
    for (const entry of built) expect(bySl.get(`00000000-0000-4000-8000-${String(entry.index).padStart(12, '0')}`)).toBe(entry.sl);
  });
});
