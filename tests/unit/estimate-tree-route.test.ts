import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { partsTreeSchema } from '@/server/views/schemas';

import { defined } from '../support/defined';
import { harness, holdSessionClock, releaseSessionClock } from '../support/session-harness';

/**
 * STORY-05.02 T5 (AC-1 to AC-8), through the real `withRoute`, the real session and the real estimate service over in-memory storage: what each body, query and
 * path must look like, what each refusal answers (404 the same for an estimate or a part that is not the Engineer's and one that does not exist, 409 with the tree,
 * 422 under `parentId`), and that every answer is one strict shape, with the same six facts per part for every role and no figure. Who may call is `tests/security`.
 * Every name and ID is invented.
 */

vi.mock('next-auth', async () => ({ getServerSession: (await import('../support/session-harness')).harness.getServerSession }));
vi.mock('next/headers', async () => ({ headers: (await import('../support/session-harness')).harness.headers }));
vi.mock('next/navigation', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { redirect: shared.redirect, forbidden: shared.forbidden, notFound: shared.notFound };
});
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T>(fn: T): T => fn }));
vi.mock('@/server/composition', async () => {
  const { harness: shared } = await import('../support/session-harness');
  return { getAuthOptions: () => ({}), getUserRepository: () => shared.users, getEstimateService: () => shared.estimateService };
});

const ORIGIN = 'https://portal.example.test';
const UNKNOWN_ID = '00000000-0000-4000-8000-00000000dead';
const { GET: getTree } = await import('@/app/api/v1/estimates/[id]/tree/route');
const { POST: moveTree } = await import('@/app/api/v1/estimates/[id]/tree/move/route');
const { POST: addNode } = await import('@/app/api/v1/estimates/[id]/nodes/route');
const { GET: getNode, PUT: putNode, DELETE: deleteNode } = await import('@/app/api/v1/estimates/[id]/nodes/[nodeId]/route');

const record = z.record(z.string(), z.unknown());
const treeBody = z.strictObject({ nodes: z.array(record) });
const SIX_KEYS = ['completeness', 'id', 'label', 'parentId', 'revision', 'slNo'];

const estimate = () => defined(harness.estimateWorld.estimates[0]);
const owned = (): string => estimate().id;
/** The one part the recipe makes: the estimate's own ID, first at the top, revision 1. */
const canary = (): string => owned();

function request(method: string, path: string, body?: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const forEstimate = (id: string) => ({ params: Promise.resolve({ id }) });
const forNode = (id: string, nodeId: string) => ({ params: Promise.resolve({ id, nodeId }) });
const base = (id = owned()): string => `/api/v1/estimates/${id}`;

async function add(body: unknown, id = owned()): Promise<Response> {
  return addNode(request('POST', `${base(id)}/nodes`, body), forEstimate(id));
}

/** Adds a part by the route, and returns its ID and the tree. */
async function added(body: unknown): Promise<{ readonly nodeId: string; readonly nodes: ReadonlyArray<Record<string, unknown>> }> {
  const response = await add(body);
  expect(response.status).toBe(201);
  return z.strictObject({ nodeId: z.string(), nodes: z.array(record) }).parse(await response.json());
}

const slOf = (nodes: ReadonlyArray<Record<string, unknown>>, id: string): unknown => nodes.find((node) => node['id'] === id)?.['slNo'];

beforeAll(holdSessionClock);
afterAll(releaseSessionClock);

beforeEach(() => {
  vi.stubEnv('APP_ORIGIN', ORIGIN);
  harness.signInAs('ENGINEER');
});

/** Puts the harness estimate and its one part back as the recipe made them, whatever a test did. */
afterEach(() => {
  const held = estimate();
  held.status = 'DRAFT';
  held.inputsRevision = 0;
  held.engineerId = harness.idOf.ENGINEER;
  harness.estimateWorld.nodes.splice(0, harness.estimateWorld.nodes.length, { id: held.id, estimateId: held.id, parentId: null, sortIndex: 0, revision: 1, inputs: {} });
});

describe('AC-1: the Engineer adds a part to their own tree', () => {
  it('"New item" answers 201 with the new part and the tree: the part is last at the top, with empty inputs', async () => {
    const answer = await added({ kind: 'item' });
    expect(answer.nodes.map((node) => node['slNo'])).toEqual(['1', '2']);
    expect(slOf(answer.nodes, answer.nodeId)).toBe('2');
    expect(harness.estimateWorld.nodes.find((node) => node.id === answer.nodeId)?.inputs).toEqual({});
  });

  it('"Sub-part" and "Part beside" name the part they are for, and number the new part from the tree', async () => {
    const sub = await added({ kind: 'sub-part', nodeId: canary() });
    expect(slOf(sub.nodes, sub.nodeId)).toBe('1.1');
    const beside = await added({ kind: 'beside', nodeId: sub.nodeId });
    expect(slOf(beside.nodes, beside.nodeId)).toBe('1.2');
  });

  it.each([
    ['a kind that is not offered', { kind: 'cousin', nodeId: 'x' }],
    ['no kind', {}],
    ['a sub-part with no part named', { kind: 'sub-part' }],
    ['a part named for a new item', { kind: 'item', nodeId: 'x' }],
    ['a key the route does not offer', { kind: 'item', inputs: { typed: '1' } }],
    ['a part ID that is too long', { kind: 'beside', nodeId: 'x'.repeat(101) }],
  ])('%s is 422 and nothing is added', async (_name, body) => {
    expect((await add(body)).status).toBe(422);
    expect(harness.estimateWorld.nodes).toHaveLength(1);
    expect(estimate().inputsRevision).toBe(0);
  });

  it('a body that is not JSON is 400', async () => {
    const notJson = new Request(`${ORIGIN}${base()}/nodes`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{' });
    expect((await addNode(notJson, forEstimate(owned()))).status).toBe(400);
  });
});

describe('AC-2 and AC-4: moves', () => {
  it('PUT and POST /tree/move move the same way: 1.2 up is 1.1, and the answer is the tree', async () => {
    const second = await added({ kind: 'item' });
    const moved = await putNode(request('PUT', `${base()}/nodes/${second.nodeId}`, { revision: 1, parentId: null, index: 0 }), forNode(owned(), second.nodeId));
    expect(moved.status).toBe(200);
    expect(slOf(treeBody.parse(await moved.json()).nodes, second.nodeId)).toBe('1');
    const back = await moveTree(request('POST', `${base()}/tree/move`, { nodeId: second.nodeId, revision: 2, parentId: null, index: 1 }), forEstimate(owned()));
    expect(back.status).toBe(200);
    expect(slOf(treeBody.parse(await back.json()).nodes, second.nodeId)).toBe('2');
  });

  it('a move under itself or its own sub-part is 422 under parentId, in words a person can read, and changes nothing', async () => {
    const sub = await added({ kind: 'sub-part', nodeId: canary() });
    const revision = estimate().inputsRevision;
    for (const parentId of [canary(), sub.nodeId]) {
      const refused = await moveTree(request('POST', `${base()}/tree/move`, { nodeId: canary(), revision: 1, parentId, index: 0 }), forEstimate(owned()));
      expect(refused.status).toBe(422);
      expect(record.parse(await refused.json())['errors']).toEqual([{ field: 'parentId', message: 'A part cannot be moved under itself or under one of its own sub-parts.' }]);
    }
    expect(estimate().inputsRevision).toBe(revision);
  });

  it.each([
    ['a revision that is not a number', { revision: '1', parentId: null, index: 0 }],
    ['a revision of 0', { revision: 0, parentId: null, index: 0 }],
    ['a negative place', { revision: 1, parentId: null, index: -1 }],
    ['a place that is not whole', { revision: 1, parentId: null, index: 0.5 }],
    ['no parent given (null is the top)', { revision: 1, index: 0 }],
    ['a key the route does not offer', { revision: 1, parentId: null, index: 0, inputs: {} }],
  ])('%s is 422 and nothing is moved', async (_name, body) => {
    expect((await putNode(request('PUT', `${base()}/nodes/${canary()}`, body), forNode(owned(), canary()))).status).toBe(422);
    expect(estimate().inputsRevision).toBe(0);
  });
});

describe('AC-3: delete', () => {
  it('needs the revision and the count in the query: with neither, a text, or a count of 0, it is 422 and deletes nothing', async () => {
    for (const query of ['', '?revision=1', '?parts=1', '?revision=x&parts=1', '?revision=1&parts=0', '?revision=1&parts=1&extra=1']) {
      const answer = await deleteNode(request('DELETE', `${base()}/nodes/${canary()}${query}`), forNode(owned(), canary()));
      expect(answer.status, query).toBe(422);
    }
    expect(harness.estimateWorld.nodes).toHaveLength(1);
  });

  it('deletes the part with its sub-parts when the count is right, and answers with the tree that is left', async () => {
    const sub = await added({ kind: 'sub-part', nodeId: canary() });
    await added({ kind: 'sub-part', nodeId: sub.nodeId });
    const answer = await deleteNode(request('DELETE', `${base()}/nodes/${canary()}?revision=1&parts=3`), forNode(owned(), canary()));
    expect(answer.status).toBe(200);
    expect(treeBody.parse(await answer.json()).nodes).toEqual([]);
    expect(harness.estimateWorld.nodes).toHaveLength(0);
  });

  it('a count that is no longer right is 409 TREE_CHANGED with the tree in the body, in the same six facts per part, and deletes nothing (AC-6)', async () => {
    await added({ kind: 'sub-part', nodeId: canary() });
    const answer = await deleteNode(request('DELETE', `${base()}/nodes/${canary()}?revision=1&parts=1`), forNode(owned(), canary()));
    expect(answer.status).toBe(409);
    const problem = record.parse(await answer.json());
    expect(problem).toMatchObject({ code: 'TREE_CHANGED', status: 409 });
    const tree = z.array(record).parse(problem['tree']);
    expect(tree.map((part) => part['slNo'])).toEqual(['1', '1.1']);
    for (const part of tree) expect(Object.keys(part).sort()).toEqual(SIX_KEYS);
    expect(harness.estimateWorld.nodes).toHaveLength(2);
  });

  it('a part that is not in the estimate is 404', async () => {
    const answer = await deleteNode(request('DELETE', `${base()}/nodes/${UNKNOWN_ID}?revision=1&parts=1`), forNode(owned(), UNKNOWN_ID));
    expect(answer.status).toBe(404);
  });
});

describe('AC-6: two edits with a stale revision', () => {
  it('the second move gets 409 with the fresh tree in the body, and the first stands', async () => {
    const second = await added({ kind: 'item' });
    const first = await moveTree(request('POST', `${base()}/tree/move`, { nodeId: second.nodeId, revision: 1, parentId: canary(), index: 0 }), forEstimate(owned()));
    expect(first.status).toBe(200);
    const stale = await moveTree(request('POST', `${base()}/tree/move`, { nodeId: second.nodeId, revision: 1, parentId: null, index: 0 }), forEstimate(owned()));
    expect(stale.status).toBe(409);
    const problem = record.parse(await stale.json());
    expect(problem['code']).toBe('TREE_CHANGED');
    expect(z.array(record).parse(problem['tree']).find((part) => part['id'] === second.nodeId)?.['slNo']).toBe('1.1');
    expect(harness.estimateWorld.nodes.find((node) => node.id === second.nodeId)?.parentId).toBe(canary());
  });
});

describe('AC-7: who may write, and when', () => {
  it.each(['SUBMITTED', 'APPROVED'] as const)('a %s estimate is 409 ESTIMATE_NOT_EDITABLE for an add, a move and a delete, and nothing changes', async (status) => {
    estimate().status = status;
    const answers = [
      await add({ kind: 'item' }),
      await putNode(request('PUT', `${base()}/nodes/${canary()}`, { revision: 1, parentId: null, index: 0 }), forNode(owned(), canary())),
      await deleteNode(request('DELETE', `${base()}/nodes/${canary()}?revision=1&parts=1`), forNode(owned(), canary())),
    ];
    for (const answer of answers) {
      expect(answer.status).toBe(409);
      expect(record.parse(await answer.json())).toMatchObject({ code: 'ESTIMATE_NOT_EDITABLE' });
    }
    expect(harness.estimateWorld.nodes).toHaveLength(1);
    expect(estimate().inputsRevision).toBe(0);
  });

  it('another Engineer\'s estimate, one that does not exist and a malformed ID are the same 404 on every route, apart from the request ID', async () => {
    estimate().engineerId = harness.targetId;
    const strip = async (response: Response) => {
      const { requestId, ...rest } = record.parse(await response.json());
      expect(requestId).toMatch(/^req-[0-9a-f]{8}$/);
      return rest;
    };
    for (const attempt of [
      (id: string) => getTree(request('GET', `${base(id)}/tree`), forEstimate(id)),
      (id: string) => getNode(request('GET', `${base(id)}/nodes/${canary()}`), forNode(id, canary())),
      (id: string) => add({ kind: 'item' }, id),
      (id: string) => moveTree(request('POST', `${base(id)}/tree/move`, { nodeId: canary(), revision: 1, parentId: null, index: 0 }), forEstimate(id)),
      (id: string) => putNode(request('PUT', `${base(id)}/nodes/${canary()}`, { revision: 1, parentId: null, index: 0 }), forNode(id, canary())),
      (id: string) => deleteNode(request('DELETE', `${base(id)}/nodes/${canary()}?revision=1&parts=1`), forNode(id, canary())),
    ]) {
      const answers = [await attempt(owned()), await attempt(UNKNOWN_ID), await attempt('not-an-id')];
      expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404]);
      const [a, b, c] = [await strip(answers[0] as Response), await strip(answers[1] as Response), await strip(answers[2] as Response)];
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    }
    expect(harness.estimateWorld.nodes).toHaveLength(1);
    expect(estimate().inputsRevision).toBe(0);
  });

  it('a Lead and an Admin may change any draft, the Engineer\'s included', async () => {
    for (const role of ['LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      expect((await add({ kind: 'item' })).status).toBe(201);
    }
  });
});

describe('AC-8 (NFR-002): one strict shape for every role, with no figure', () => {
  it.each(['ENGINEER', 'LEAD', 'ADMIN'] as const)('as %s the tree is the same: six facts per part and nothing else', async (role) => {
    await added({ kind: 'sub-part', nodeId: canary() });
    harness.signInAs(role);
    const response = await getTree(request('GET', `${base()}/tree`), forEstimate(owned()));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { nodes } = treeBody.parse(await response.json());
    expect(nodes).toHaveLength(2);
    for (const part of nodes) expect(Object.keys(part).sort()).toEqual(SIX_KEYS);
    expect(nodes[1]).toMatchObject({ slNo: '1.1', parentId: canary(), label: '', completeness: 'EMPTY', revision: 1 });
  });

  it('one part is read with its inputs, the same for every role, and an empty object', async () => {
    const answers = [];
    for (const role of ['ENGINEER', 'LEAD', 'ADMIN'] as const) {
      harness.signInAs(role);
      const response = await getNode(request('GET', `${base()}/nodes/${canary()}`), forNode(owned(), canary()));
      expect(response.status).toBe(200);
      answers.push(record.parse(await response.json()));
    }
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    expect(answers[0]).toEqual({ id: canary(), parentId: null, slNo: '1', label: '', completeness: 'EMPTY', revision: 1, inputs: {} });
  });

  it('a part whose inputs hold anything fails closed (500 with the generic body) until the part form names the fields that may leave', async () => {
    defined(harness.estimateWorld.nodes[0]).inputs = { invented: 'typed text' };
    const response = await getNode(request('GET', `${base()}/nodes/${canary()}`), forNode(owned(), canary()));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('typed text');
  });

  it('the tree, move and delete routes all answer with the one tree schema, so a key planted into one is refused on every one', async () => {
    for (const handler of [getTree, moveTree, putNode, deleteNode]) expect(handler.responseSchema).toBe(partsTreeSchema);
    expect(partsTreeSchema.safeParse({ nodes: [], planted: 1 }).success).toBe(false);
    expect(partsTreeSchema.safeParse({ nodes: [{ id: 'a', parentId: null, slNo: '1', label: '', completeness: 'EMPTY', revision: 1, planted: 1 }] }).success).toBe(false);
  });
});
