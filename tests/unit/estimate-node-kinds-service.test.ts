import { describe, expect, it } from 'vitest';

import { FieldValidationError, NotFoundError } from '@/lib/errors';
import { ALLOWED_CHILDREN, NODE_KINDS, nodeKindLabel, type NodeKind, type ParentKind } from '@/lib/estimate/node-kinds';
import { subtreeFingerprint } from '@/lib/estimate/subtree-fingerprint';
import { createEstimateService, ESTIMATE_NOT_EDITABLE_CODE, MOVE_ACROSS_PARENTS_CODE, NODE_KIND_NOT_ALLOWED_CODE, type EstimateViewer } from '@/server/services/estimate-service';

import { inputsDependencies } from '../support/estimate-inputs-deps';
import { createFakeEstimateWorld, type FakeEstimate, type FakeNode } from '../support/fake-estimates';

/**
 * AQP-403 (CR-01 item 3A; SPEC 6.1, tests 14.30 to 14.35): the kinds of the parts tree over in-memory storage. Which kind may go under which (`NODE_KIND_NOT_ALLOWED`), that a new row goes last,
 * that a row is reordered only among rows with the same parent (`MOVE_ACROSS_PARENTS`, A-CR01-5), that a legacy tree deeper than the kinds allow stays as it is, and that the structure actions
 * follow `canEditInputs`. The pure table is `tests/unit/estimate/node-kinds.test.ts`; the real SQL and the backfill are `tests/integration/estimates/node-kinds.test.ts`. Every ID is invented.
 */

const ARJUN = '00000000-0000-4000-8000-0000000000a1';
const LEAD = '00000000-0000-4000-8000-0000000000b1';
const ADMIN = '00000000-0000-4000-8000-0000000000c1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const OTHER_ESTIMATE = '00000000-0000-4000-8000-0000000000e2';
const FOREIGN_NODE = '00000000-0000-4000-8000-0000000000f1';

const arjun: EstimateViewer = { id: ARJUN, role: 'ENGINEER' };
const lead: EstimateViewer = { id: LEAD, role: 'LEAD' };
const admin: EstimateViewer = { id: ADMIN, role: 'ADMIN' };

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

function setUp(initial: ReadonlyArray<FakeEstimate> = [estimate()], nodes: ReadonlyArray<FakeNode> = []) {
  const world = createFakeEstimateWorld(() => [], initial, nodes);
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
  const revision = (): number => world.estimates.find((candidate) => candidate.id === ESTIMATE)?.inputsRevision ?? -1;
  return { world, service, revision };
}

type Setup = ReturnType<typeof setUp>;

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A tree of every kind: 1 Main (id 1), 1.1 Sub-Assembly (2), 1.1.1 Part (3), 1.1.1.1 Fastener (4), 1.2 Part (5), 1.3 Fastener (6). Seeded with their kinds, as a migrated database holds them. */
const KINDED: ReadonlyArray<FakeNode> = [
  { id: id(1), estimateId: ESTIMATE, parentId: null, sortIndex: 0, nodeKind: 'MAIN_ASSEMBLY', revision: 1, inputs: {} },
  { id: id(2), estimateId: ESTIMATE, parentId: id(1), sortIndex: 0, nodeKind: 'SUB_ASSEMBLY', revision: 1, inputs: {} },
  { id: id(3), estimateId: ESTIMATE, parentId: id(2), sortIndex: 0, nodeKind: 'PART', revision: 1, inputs: {} },
  { id: id(4), estimateId: ESTIMATE, parentId: id(3), sortIndex: 0, nodeKind: 'FASTENER', revision: 1, inputs: {} },
  { id: id(5), estimateId: ESTIMATE, parentId: id(1), sortIndex: 1, nodeKind: 'PART', revision: 1, inputs: {} },
  { id: id(6), estimateId: ESTIMATE, parentId: id(1), sortIndex: 2, nodeKind: 'FASTENER', revision: 1, inputs: {} },
];

/** The row of each kind in `KINDED` that serves as a parent of that kind; the top level has none. */
const PARENT_OF_KIND: Readonly<Record<ParentKind, string | null>> = { TOP: null, MAIN_ASSEMBLY: id(1), SUB_ASSEMBLY: id(2), PART: id(3), FASTENER: id(4) };

const PAIRS = (Object.keys(PARENT_OF_KIND) as ParentKind[]).flatMap((parent) => NODE_KINDS.map((child) => ({ parent, child, allowed: ALLOWED_CHILDREN[parent].includes(child) })));

async function refusal(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('AC-3 (14.30): an add names the parent and the kind, and the parent\'s kind decides', () => {
  it.each(PAIRS)('a $child under $parent is allowed: $allowed', async ({ parent, child, allowed }) => {
    const setUpped = setUp([estimate()], KINDED);
    const before = setUpped.world.nodes.length;
    const revision = setUpped.revision();
    const result = await refusal(setUpped.service.addPart(arjun, ESTIMATE, { parentId: PARENT_OF_KIND[parent], nodeKind: child }));
    if (allowed) {
      expect(result).toBeUndefined();
      expect(setUpped.world.nodes).toHaveLength(before + 1);
      expect(setUpped.revision()).toBe(revision + 1);
    } else {
      expect(result).toBeInstanceOf(FieldValidationError);
      expect(result).toMatchObject({ code: NODE_KIND_NOT_ALLOWED_CODE, httpStatus: 422 });
      expect((result as FieldValidationError).fields.map((field) => field.field)).toEqual(['nodeKind']);
      // The tree is unchanged and no revision rose.
      expect(setUpped.world.nodes).toHaveLength(before);
      expect(setUpped.revision()).toBe(revision);
    }
  });

  it('stores the kind that was asked for, and puts the new row LAST under its parent, after every sibling', async () => {
    const setUpped = setUp([estimate()], KINDED);
    const added = await setUpped.service.addPart(arjun, ESTIMATE, { parentId: id(1), nodeKind: 'SUB_ASSEMBLY' });
    const row = setUpped.world.nodes.find((node) => node.id === added.nodeId);
    expect(row).toMatchObject({ nodeKind: 'SUB_ASSEMBLY', parentId: id(1), sortIndex: 3 });
    expect(added.nodes.find((node) => node.id === added.nodeId)).toMatchObject({ slNo: '1.4', nodeKind: 'SUB_ASSEMBLY' });
    // The top level: parent null, last among the Main Assemblies.
    const top = await setUpped.service.addPart(arjun, ESTIMATE, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' });
    expect(top.nodes.find((node) => node.id === top.nodeId)?.slNo).toBe('2');
  });

  it('says what cannot go where, in words a person can read, under nodeKind', async () => {
    const setUpped = setUp([estimate()], KINDED);
    const toTop = await refusal(setUpped.service.addPart(arjun, ESTIMATE, { parentId: null, nodeKind: 'PART' }));
    expect((toTop as FieldValidationError).fields).toEqual([{ field: 'nodeKind', message: 'A Part cannot be added at the top of the tree.' }]);
    const underFastener = await refusal(setUpped.service.addPart(arjun, ESTIMATE, { parentId: id(6), nodeKind: 'FASTENER' }));
    expect((underFastener as FieldValidationError).fields).toEqual([{ field: 'nodeKind', message: 'A Fastener cannot be added under a Fastener.' }]);
  });

  it('a parent that is not in this estimate is 404, also when it is a real row of another estimate, and nothing is written', async () => {
    const setUpped = setUp([estimate(), estimate({ id: OTHER_ESTIMATE, code: 'Q-2026-0319' })], [...KINDED, { id: FOREIGN_NODE, estimateId: OTHER_ESTIMATE, parentId: null, sortIndex: 0, nodeKind: 'MAIN_ASSEMBLY', revision: 1, inputs: {} }]);
    await expect(setUpped.service.addPart(arjun, ESTIMATE, { parentId: FOREIGN_NODE, nodeKind: 'SUB_ASSEMBLY' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(setUpped.service.addPart(arjun, ESTIMATE, { parentId: 'not-an-id', nodeKind: 'SUB_ASSEMBLY' })).rejects.toBeInstanceOf(NotFoundError);
    expect(setUpped.world.nodes.filter((node) => node.estimateId === ESTIMATE)).toHaveLength(KINDED.length);
  });
});

describe('AC-4 (14.31): Part or Sub-part is derived from the siblings and never stored', () => {
  it('names the only PART "Part", two or more "Sub-part", and "Part" again after one is deleted, with the stored kind PART all along', async () => {
    const setUpped = setUp();
    const main = (await setUpped.service.addPart(arjun, ESTIMATE, { parentId: null, nodeKind: 'MAIN_ASSEMBLY' })).nodeId;
    const first = await setUpped.service.addPart(arjun, ESTIMATE, { parentId: main, nodeKind: 'PART' });
    const labelOf = (nodes: ReadonlyArray<{ id: string; parentId: string | null; nodeKind: NodeKind }>, row: string): string => nodeKindLabel(nodes.find((node) => node.id === row) ?? { id: row, parentId: null, nodeKind: 'PART' }, nodes);
    expect(labelOf(first.nodes, first.nodeId)).toBe('Part');

    const second = await setUpped.service.addPart(arjun, ESTIMATE, { parentId: main, nodeKind: 'PART' });
    expect(labelOf(second.nodes, first.nodeId)).toBe('Sub-part');
    expect(labelOf(second.nodes, second.nodeId)).toBe('Sub-part');

    const subtree = subtreeFingerprint(setUpped.world.nodes.filter((node) => node.id === second.nodeId));
    const left = await setUpped.service.deleteNode(arjun, ESTIMATE, { nodeId: second.nodeId, revision: 1, parts: 1, subtree });
    expect(labelOf(left, first.nodeId)).toBe('Part');
    // No row ever stored a Sub-part kind, and the kind of the first row did not change.
    expect(setUpped.world.nodes.every((node) => (NODE_KINDS as ReadonlyArray<string>).includes(node.nodeKind ?? ''))).toBe(true);
    expect(setUpped.world.nodes.find((node) => node.id === first.nodeId)?.nodeKind).toBe('PART');
  });
});

describe('AC-5 (A-CR01-5, 14.32): a row is reordered only among rows with the same parent', () => {
  async function moveTo(setUpped: Setup, row: string, parentId: string | null, index: number, revision = 1): Promise<unknown> {
    return refusal(setUpped.service.moveNode(lead, ESTIMATE, { nodeId: row, revision, parentId, index }));
  }

  it.each([
    ['a Part under another Sub-Assembly branch (a different parent)', id(5), id(2)],
    ['a Fastener under a Part', id(6), id(3)],
    ['a Sub-Assembly to the top level', id(2), null],
    ['a top-level Main Assembly under a Sub-Assembly (its own descendant)', id(1), id(2)],
    ['a Part under itself', id(5), id(5)],
  ])('refuses %s with 422 MOVE_ACROSS_PARENTS under parentId, and changes nothing', async (_name, row, parentId) => {
    const setUpped = setUp([estimate()], KINDED);
    const before = JSON.stringify(setUpped.world.nodes);
    const revision = setUpped.revision();
    const result = await moveTo(setUpped, row, parentId, 0);
    expect(result).toBeInstanceOf(FieldValidationError);
    expect(result).toMatchObject({ code: MOVE_ACROSS_PARENTS_CODE, httpStatus: 422 });
    expect((result as FieldValidationError).fields.map((field) => field.field)).toEqual(['parentId']);
    expect(JSON.stringify(setUpped.world.nodes)).toBe(before);
    expect(setUpped.revision()).toBe(revision);
  });

  it('also refuses a parent of another estimate and one that does not exist, with the same code', async () => {
    const setUpped = setUp([estimate(), estimate({ id: OTHER_ESTIMATE, code: 'Q-2026-0319' })], [...KINDED, { id: FOREIGN_NODE, estimateId: OTHER_ESTIMATE, parentId: null, sortIndex: 0, nodeKind: 'MAIN_ASSEMBLY', revision: 1, inputs: {} }]);
    for (const parentId of [FOREIGN_NODE, id(99)]) expect(await moveTo(setUpped, id(5), parentId, 0)).toMatchObject({ code: MOVE_ACROSS_PARENTS_CODE });
  });

  it('a move within the same parent works, raises inputs_revision by one (the figures wait for a recalculation), bumps only the moved row, and changes no kind', async () => {
    const setUpped = setUp([estimate()], KINDED);
    const revision = setUpped.revision();
    const kinds = setUpped.world.nodes.map((node) => [node.id, node.nodeKind]);
    const moved = await setUpped.service.moveNode(lead, ESTIMATE, { nodeId: id(6), revision: 1, parentId: id(1), index: 0 });
    expect(moved.find((node) => node.id === id(6))?.slNo).toBe('1.1');
    expect(setUpped.revision()).toBe(revision + 1);
    expect(setUpped.world.nodes.map((node) => [node.id, node.nodeKind])).toEqual(kinds);
    expect(setUpped.world.nodes.find((node) => node.id === id(6))?.revision).toBe(2);
    expect(setUpped.world.nodes.find((node) => node.id === id(5))?.revision).toBe(1);
  });

  it('a move to the place the row already has, under its own parent, writes nothing', async () => {
    const setUpped = setUp([estimate()], KINDED);
    const revision = setUpped.revision();
    await setUpped.service.moveNode(lead, ESTIMATE, { nodeId: id(5), revision: 1, parentId: id(1), index: 1 });
    expect(setUpped.revision()).toBe(revision);
  });

  it('the parent is compared as the database writes it: the same ID in upper case is the same parent', async () => {
    const setUpped = setUp([estimate()], KINDED);
    const moved = await setUpped.service.moveNode(lead, ESTIMATE, { nodeId: id(6), revision: 1, parentId: id(1).toUpperCase(), index: 0 });
    expect(moved.find((node) => node.id === id(6))?.slNo).toBe('1.1');
  });
});

describe('AC-6 (14.34): a legacy tree deeper than the kinds allow stays as it is', () => {
  /** What the backfill leaves: 1 Main, 1.1 Sub-Assembly (it has children), 1.1.1 Part, 1.1.1.1 Part and 1.1.1.1.1 Part under it (a Part holding Parts, as an Engineer could build before). */
  const LEGACY: ReadonlyArray<FakeNode> = [
    { id: id(1), estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs: {} },
    { id: id(2), estimateId: ESTIMATE, parentId: id(1), sortIndex: 0, revision: 1, inputs: {} },
    { id: id(3), estimateId: ESTIMATE, parentId: id(2), sortIndex: 0, revision: 1, inputs: {} },
    { id: id(4), estimateId: ESTIMATE, parentId: id(3), sortIndex: 0, revision: 1, inputs: {} },
    { id: id(5), estimateId: ESTIMATE, parentId: id(4), sortIndex: 0, revision: 1, inputs: {} },
    { id: id(6), estimateId: ESTIMATE, parentId: id(4), sortIndex: 1, revision: 1, inputs: {} },
  ];

  it('is read as it is, in the same order, with the shape\'s kinds', async () => {
    const setUpped = setUp([estimate()], LEGACY);
    const tree = await setUpped.service.getTree(arjun, ESTIMATE);
    expect(tree.map((node) => [node.slNo, node.nodeKind])).toEqual([
      ['1', 'MAIN_ASSEMBLY'],
      ['1.1', 'SUB_ASSEMBLY'],
      ['1.1.1', 'PART'],
      ['1.1.1.1', 'PART'],
      ['1.1.1.1.1', 'PART'],
      ['1.1.1.1.2', 'PART'],
    ]);
  });

  it('a move within one parent works in a deep legacy tree and never changes its shape; the other rows keep their parents and their kinds', async () => {
    const setUpped = setUp([estimate()], LEGACY);
    const parents = setUpped.world.nodes.map((node) => [node.id, node.parentId, node.nodeKind]);
    const moved = await setUpped.service.moveNode(arjun, ESTIMATE, { nodeId: id(6), revision: 1, parentId: id(4), index: 0 });
    expect(moved.find((node) => node.id === id(6))?.slNo).toBe('1.1.1.1.1');
    expect(setUpped.world.nodes.map((node) => [node.id, node.parentId, node.nodeKind])).toEqual(parents);
  });

  it('only NEW adds are checked: a Part under a legacy Part is refused, a Fastener under it is allowed, and the legacy rows are untouched', async () => {
    const setUpped = setUp([estimate()], LEGACY);
    const refused = await refusal(setUpped.service.addPart(arjun, ESTIMATE, { parentId: id(4), nodeKind: 'PART' }));
    expect(refused).toMatchObject({ code: NODE_KIND_NOT_ALLOWED_CODE });
    await setUpped.service.addPart(arjun, ESTIMATE, { parentId: id(4), nodeKind: 'FASTENER' });
    expect(setUpped.world.nodes).toHaveLength(LEGACY.length + 1);
  });
});

describe('who may change the structure (PM ruling): the same rule as the inputs, `canEditInputs`', () => {
  const actions = (setUpped: Setup, viewer: EstimateViewer) => ({
    add: () => setUpped.service.addPart(viewer, ESTIMATE, { parentId: id(1), nodeKind: 'PART' }),
    move: () => setUpped.service.moveNode(viewer, ESTIMATE, { nodeId: id(6), revision: 1, parentId: id(1), index: 0 }),
  });

  it.each([
    ['an Engineer on their own Draft', arjun, 'DRAFT', true],
    ['a Lead on a Draft', lead, 'DRAFT', true],
    ['an Admin on a Draft', admin, 'DRAFT', true],
    ['an Engineer on a Prepared estimate (submitted)', arjun, 'SUBMITTED', false],
    ['a Lead on a Prepared estimate (submitted)', lead, 'SUBMITTED', true],
    ['an Admin on a Prepared estimate (submitted)', admin, 'SUBMITTED', true],
    ['an Engineer on an Approved estimate', arjun, 'APPROVED', false],
    ['a Lead on an Approved estimate', lead, 'APPROVED', false],
    ['an Admin on an Approved estimate', admin, 'APPROVED', false],
  ] as const)('%s: add and reorder allowed is %s', async (_name, viewer, status, allowed) => {
    const setUpped = setUp([estimate({ status })], KINDED);
    const revision = setUpped.revision();
    const { add, move } = actions(setUpped, viewer);
    for (const act of [add, move]) {
      const result = await refusal(act());
      if (allowed) expect(result).toBeUndefined();
      else expect(result).toMatchObject({ code: ESTIMATE_NOT_EDITABLE_CODE, httpStatus: 409 });
    }
    // A structure change on a Prepared estimate raises inputs_revision, which is what clears the figures and asks for a recalculation; a refused one raises nothing.
    expect(setUpped.revision()).toBe(allowed ? revision + 2 : revision);
  });
});
