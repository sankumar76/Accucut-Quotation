import { describe, expect, it } from 'vitest';

import { createEstimateService, type EstimateViewer } from '@/server/services/estimate-service';

import { defined } from '../../support/defined';
import { inputsDependencies } from '../../support/estimate-inputs-deps';
import { createFakeEstimateWorld } from '../../support/fake-estimates';
import { seedFieldAt } from '../../support/seed-config';

/**
 * STORY-05.05 AC-1, AC-3, AC-4, AC-5 (FR-048; SPEC section 14.4; A-03) through the real estimate service over the in-memory world: the SERVER applies the rule of Fasteners Qty (T) and Cost (U),
 * not only the browser. While Fasteners (S) is "None" (any letter case, spaces around it) or blank, a Qty and a Cost that the part holds are stored as 0 and read as 0, whatever was typed
 * before; a hidden field takes no value from a save; a change of them to 0 by the rule is a real change (the part's revision and the estimate's `inputs_revision` both rise); and a part with
 * nothing typed stays `{}` and `EMPTY`. What only PostgreSQL shows (the stored JSON and the row lock) is in `tests/integration/estimates/fasteners.test.ts`. Every value is invented.
 */

const OWNER = '00000000-0000-4000-8000-0000000000a1';
const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const NODE = '00000000-0000-4000-8000-0000000000b1';
const S = seedFieldAt('S').id;
const T = seedFieldAt('T').id;
const U = seedFieldAt('U').id;
const LENGTH = seedFieldAt('J').id;
const engineer: EstimateViewer = { id: OWNER, role: 'ENGINEER' };
const lead: EstimateViewer = { id: '00000000-0000-4000-8000-0000000000c1', role: 'LEAD' };

/** One draft estimate with one part holding `inputs`, and the service over it. */
function setUp(inputs: Record<string, unknown> = {}) {
  const world = createFakeEstimateWorld(
    () => [],
    [{ id: ESTIMATE, code: 'Q-9999-0005', engineerId: OWNER, assignedByName: 'Invented Lead', folderPath: '\\\\invented\\share', deadlineAt: new Date('2099-01-01T00:00:00.000Z'), title: null, notes: null, status: 'DRAFT', customerId: null, inputsRevision: 0 }],
    [{ id: NODE, estimateId: ESTIMATE, parentId: null, sortIndex: 0, revision: 1, inputs }],
  );
  const service = createEstimateService({ estimates: world.repository, nodes: world.nodeRepository, images: world.imageRepository, transactions: world.transactions, ...inputsDependencies() });
  const node = () => defined(world.nodes[0]);
  const estimate = () => defined(world.estimates[0]);
  const save = (values: Record<string, string>) => service.saveInputs(engineer, ESTIMATE, { nodeId: NODE, revision: node().revision, values });
  return { world, service, node, estimate, save };
}

describe('AC-3: Fasteners becoming "None" or blank stores Qty and Cost as 0, on the server', () => {
  it('a Qty and a Cost typed under Fasteners "M6 bolt" are stored as 0.00 once Fasteners is saved as "None", and the answer says 0.00; both revisions rise', async () => {
    const { save, node, estimate } = setUp();
    await save({ [S]: 'M6 bolt', [T]: '5', [U]: '3.5' });
    expect(node().inputs).toEqual({ [S]: 'M6 bolt', [T]: '5.00', [U]: '3.50' });
    const partRevision = node().revision;
    const estimateRevision = estimate().inputsRevision;
    const saved = await save({ [S]: 'None' });
    expect(node().inputs).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00' });
    expect(saved.inputs).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00' });
    expect(saved.revision).toBe(partRevision + 1);
    expect(estimate().inputsRevision).toBe(estimateRevision + 1);
  });

  it.each([['none'], [' NONE '], ['None'], ['']])('Fasteners saved as %j stores the typed Qty and Cost as 0.00', async (fasteners) => {
    const { save, node } = setUp({ [S]: 'Bolts', [T]: '5.00', [U]: '3.50' });
    await save({ [S]: fasteners });
    expect(node().inputs[T]).toBe('0.00');
    expect(node().inputs[U]).toBe('0.00');
  });

  it('the same save that makes Fasteners "None" and carries a Qty stores the Qty as 0.00: the rule is the server\'s, whatever the browser sent', async () => {
    const { save, node } = setUp({ [S]: 'Bolts', [T]: '5.00', [U]: '3.50' });
    await save({ [S]: 'None', [T]: '9', [U]: '8' });
    expect(node().inputs).toMatchObject({ [S]: 'None', [T]: '0.00', [U]: '0.00' });
  });

  it('any other save of a part whose Fasteners is "None" stores a Qty it holds as 0.00 too, and a value typed into a hidden field is not stored', async () => {
    const { save, node } = setUp({ [S]: 'None', [T]: '5.00' });
    await save({ [LENGTH]: '10', [U]: '4' });
    expect(node().inputs).toEqual({ [S]: 'None', [T]: '0.00', [LENGTH]: '10.00' });
  });

  it('a hidden field alone in a save is no change: nothing is written and neither revision moves', async () => {
    const { save, node, estimate, world } = setUp({ [S]: 'None' });
    const before = world.nodeWrites();
    const saved = await save({ [T]: '5', [U]: '3' });
    expect(node().inputs).toEqual({ [S]: 'None' });
    expect(saved.revision).toBe(1);
    expect(estimate().inputsRevision).toBe(0);
    expect(world.nodeWrites()).toBe(before);
  });

  it('a part with nothing typed stays {} and EMPTY: saving a blank, or a value and then clearing it, leaves no 0 behind', async () => {
    const { save, node } = setUp();
    const blank = await save({ [S]: '' });
    expect(blank).toMatchObject({ completeness: 'EMPTY', inputs: {} });
    await save({ [LENGTH]: '10' });
    expect(node().inputs).toEqual({ [LENGTH]: '10.00' });
    const cleared = await save({ [LENGTH]: '' });
    expect(cleared).toMatchObject({ completeness: 'EMPTY', inputs: {} });
    expect(node().inputs).toEqual({});
  });
});

describe('AC-2: Fasteners becoming anything else shows Qty and Cost again, and they take new values', () => {
  it('after "None" they hold 0.00, which is a value the person types over; a save of them is a real change', async () => {
    const { save, node } = setUp({ [S]: 'Bolts', [T]: '5.00', [U]: '3.50' });
    await save({ [S]: 'None' });
    await save({ [S]: 'Rivets' });
    expect(node().inputs).toEqual({ [S]: 'Rivets', [T]: '0.00', [U]: '0.00' });
    const saved = await save({ [T]: '7.5', [U]: '1' });
    expect(node().inputs).toEqual({ [S]: 'Rivets', [T]: '7.50', [U]: '1.00' });
    expect(saved.inputs).toEqual({ [S]: 'Rivets', [T]: '7.50', [U]: '1.00' });
  });

  it('while Fasteners is anything else, a Qty and a Cost are stored as typed', async () => {
    const { save, node } = setUp();
    await save({ [S]: 'Nonesuch', [T]: '2', [U]: '0' });
    expect(node().inputs).toEqual({ [S]: 'Nonesuch', [T]: '2.00', [U]: '0.00' });
  });
});

describe('AC-5 (A-03): a hidden Qty or Cost is never sent back as it was stored', () => {
  const stale = { [S]: 'None', [T]: '5.00', [U]: '3.50', [LENGTH]: '10.00' };

  it('the read of a part with a stale Qty and Cost answers 0.00 for both, for an Engineer and for a Lead', async () => {
    const { service } = setUp(stale);
    for (const viewer of [engineer, lead]) {
      const part = await service.getNode(viewer, ESTIMATE, NODE);
      expect(part.inputs, viewer.role).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00', [LENGTH]: '10.00' });
      expect(JSON.stringify(part), viewer.role).not.toContain('5.00');
      expect(JSON.stringify(part), viewer.role).not.toContain('3.50');
    }
  });

  it('a stale part is read as 0.00 while Fasteners is blank or absent too, and as stored once Fasteners is something else', async () => {
    for (const held of [{ [T]: '5.00' }, { [S]: '', [T]: '5.00' }, { [S]: ' none ', [T]: '5.00' }]) {
      expect((await setUp(held).service.getNode(engineer, ESTIMATE, NODE)).inputs[T]).toBe('0.00');
    }
    expect((await setUp({ [S]: 'Bolts', [T]: '5.00' }).service.getNode(engineer, ESTIMATE, NODE)).inputs[T]).toBe('5.00');
  });

  it('a save that changes nothing answers with the stale values as 0.00 and writes nothing', async () => {
    const { save, node, world } = setUp(stale);
    const before = world.nodeWrites();
    const saved = await save({ [LENGTH]: '10' });
    expect(saved.inputs).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00', [LENGTH]: '10.00' });
    expect(node().inputs[T]).toBe('5.00');
    expect(world.nodeWrites()).toBe(before);
  });

  it('a save that changes something else stores the stale values as 0.00, a real change that raises both revisions', async () => {
    const { save, node, estimate } = setUp(stale);
    const saved = await save({ [LENGTH]: '11' });
    expect(node().inputs).toEqual({ [S]: 'None', [T]: '0.00', [U]: '0.00', [LENGTH]: '11.00' });
    expect(saved.revision).toBe(2);
    expect(estimate().inputsRevision).toBe(1);
  });
});
