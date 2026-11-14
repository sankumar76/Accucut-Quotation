import { describe, expect, it, vi } from 'vitest';

import { addPart, deletePart, loadTree, movePart, treeFromRefusal } from '@/lib/estimates/tree-client';

/**
 * STORY-05.02 T6 (AC-1 to AC-6): the browser's calls to the parts-tree routes and the reading of their answers. `fetch` is replaced, so the test answers for the
 * server. Every name and ID is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e1';
const NODE = '00000000-0000-4000-8000-0000000000d1';
const PART = { id: NODE, parentId: null, slNo: '1', label: '', completeness: 'EMPTY', revision: 1 };

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } });
}

function fetching(response: Response | Error) {
  return vi.fn((...args: Parameters<typeof fetch>) => {
    void args;
    return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
  });
}

describe('loadTree', () => {
  it('reads GET /tree as the parts in order, with no part added', async () => {
    const doFetch = fetching(answer({ nodes: [PART] }));
    expect(await loadTree(ESTIMATE, doFetch)).toEqual({ status: 'ok', value: { nodes: [PART], nodeId: null } });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/tree`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it.each([
    ['a body that is not the tree', answer({ nope: true })],
    ['a part with no Sl. No', answer({ nodes: [{ ...PART, slNo: '' }] })],
    ['a part with an unknown completeness', answer({ nodes: [{ ...PART, completeness: 'DONE' }] })],
    ['a part with a revision that is not a number', answer({ nodes: [{ ...PART, revision: '1' }] })],
    ['a part that is not an object', answer({ nodes: ['1'] })],
    ['a body that is not JSON', new Response('<html>', { status: 200 })],
  ])('is "failed" for %s, never a tree that might be wrong', async (_name, response) => {
    expect(await loadTree(ESTIMATE, fetching(response))).toEqual({ status: 'failed' });
  });

  it('is "failed" when the network fails or the server faults', async () => {
    expect(await loadTree(ESTIMATE, fetching(new Error('offline')))).toEqual({ status: 'failed' });
    expect(await loadTree(ESTIMATE, fetching(answer({ code: 'INTERNAL_ERROR', title: 'x' }, 500)))).toEqual({ status: 'failed' });
  });
});

describe('addPart', () => {
  it('posts the kind and the part it is for, and reads the part added', async () => {
    const doFetch = fetching(answer({ nodeId: NODE, nodes: [PART] }, 201));
    expect(await addPart(ESTIMATE, { kind: 'sub-part', nodeId: NODE }, doFetch)).toEqual({ status: 'ok', value: { nodes: [PART], nodeId: NODE } });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/nodes`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ kind: 'sub-part', nodeId: NODE }) });
  });
});

describe('movePart and deletePart', () => {
  it('moves with POST /tree/move, sending the revision the person saw', async () => {
    const doFetch = fetching(answer({ nodes: [PART] }));
    await movePart(ESTIMATE, { nodeId: NODE, revision: 3, parentId: null, index: 1 }, doFetch);
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/tree/move`);
    expect(JSON.parse(String(doFetch.mock.calls[0]?.[1]?.body))).toEqual({ nodeId: NODE, revision: 3, parentId: null, index: 1 });
  });

  it('deletes with DELETE and the revision and the count in the query, and no body', async () => {
    const doFetch = fetching(answer({ nodes: [] }));
    expect(await deletePart(ESTIMATE, { nodeId: NODE, revision: 2, parts: 3 }, doFetch)).toEqual({ status: 'ok', value: { nodes: [], nodeId: null } });
    expect(doFetch.mock.calls[0]?.[0]).toBe(`/api/v1/estimates/${ESTIMATE}/nodes/${NODE}?revision=2&parts=3`);
    expect(doFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(doFetch.mock.calls[0]?.[1]?.body).toBeUndefined();
  });
});

describe('treeFromRefusal (AC-6)', () => {
  const problem = (tree: unknown, code = 'TREE_CHANGED', status = 409) => answer({ type: 'about:blank', title: 'The parts were changed.', status, code, requestId: 'req-0a0b0c0d', tree }, status);

  it('reads the tree a 409 TREE_CHANGED carries', async () => {
    const outcome = await movePart(ESTIMATE, { nodeId: NODE, revision: 1, parentId: null, index: 0 }, fetching(problem([PART])));
    expect(outcome.status).toBe('refused');
    if (outcome.status === 'refused') expect(treeFromRefusal(outcome)).toEqual([PART]);
  });

  it('is null for another refusal, and for a tree of the wrong shape', async () => {
    const other = await movePart(ESTIMATE, { nodeId: NODE, revision: 1, parentId: null, index: 0 }, fetching(problem([PART], 'ESTIMATE_NOT_EDITABLE')));
    const wrong = await movePart(ESTIMATE, { nodeId: NODE, revision: 1, parentId: null, index: 0 }, fetching(problem([{ id: 'x' }])));
    for (const outcome of [other, wrong]) {
      expect(outcome.status).toBe('refused');
      if (outcome.status === 'refused') expect(treeFromRefusal(outcome)).toBeNull();
    }
  });
});
