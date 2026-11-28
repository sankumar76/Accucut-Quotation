import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePartsTree } from '@/components/features/estimate-workspace/use-parts-tree';
import type { PartFormSeed } from '@/lib/estimates/part-form-seed';

import { renderHook } from '../support/hook-harness';

/**
 * DEF-085 (DL-469, DL-470): the Engineer's page hands its parts tree to the tree hook as part of the seed (the body `GET /estimates/{id}/tree` answers), so after hydration the browser reads no tree, the first row is open
 * with its revision from the first render, and the form (which waits for its part) is drawn at once. A read after that (Try again, a change, a 409) goes to the server as ever. The hook runs with no DOM
 * (`tests/support/hook-harness.ts`). Invented ids only.
 */

const loads = vi.hoisted(() => ({ tree: vi.fn() }));
vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);
vi.mock('@/lib/estimates/tree-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/tree-client')>();
  return { ...original, loadTree: (...args: unknown[]) => loads.tree(...args) };
});

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const ROW = { id: '00000000-0000-4000-8000-0000000000f1', parentId: null, slNo: '1', label: 'Invented', nodeKind: 'MAIN_ASSEMBLY', completeness: 'PARTIAL', revision: 3 };
const SECOND = { id: '00000000-0000-4000-8000-0000000000f2', parentId: ROW.id, slNo: '1.1', label: 'Another', nodeKind: 'PART', completeness: 'EMPTY', revision: 1 };
const seed = (over: Partial<PartFormSeed> = {}): PartFormSeed => ({ estimateId: 'e', partId: ROW.id, form: {}, part: {}, materials: {}, treatments: {}, tree: { nodes: [ROW, SECOND] }, ...over });
const treeWith = (given: PartFormSeed | undefined) => renderHook((estimateId: string) => usePartsTree(estimateId, undefined, { seed: given }), 'e');

beforeEach(() => {
  loads.tree.mockReset();
  loads.tree.mockResolvedValue({ status: 'ok', value: { nodes: [], nodeId: null } });
});

describe('the Engineer\'s tree starts from the page\'s seed', () => {
  it('has the rows from the first render, the first row open with its revision, and reads nothing', async () => {
    const view = treeWith(seed());
    const first = view.render();
    await flush();
    expect(first.nodes).toEqual([ROW, SECOND]);
    expect(first.selected?.id).toBe(ROW.id);
    expect(first.selected?.revision).toBe(3);
    expect(first.loadFailed).toBe(false);
    expect(loads.tree).not.toHaveBeenCalled();
  });

  it('reads from the server when there is no seed, the seed names another estimate, carries no tree or a tree the reader refuses', async () => {
    for (const given of [undefined, seed({ estimateId: 'another' }), seed({ tree: undefined }), seed({ tree: { nodes: 'x' } })]) {
      loads.tree.mockClear();
      const view = treeWith(given);
      expect(view.render().nodes).toBeNull();
      await flush();
      expect(loads.tree).toHaveBeenCalledTimes(1);
    }
  });

  it('reads the tree again when asked (Try again, a refresh after a 409): the seed is the start, not the life', async () => {
    const view = treeWith(seed());
    view.render().readAgain();
    view.render();
    await flush();
    expect(loads.tree).toHaveBeenCalledTimes(1);
  });
});

describe('the Engineer\'s workspace gives the tree hook the page\'s seed', () => {
  const source = readFileSync(fileURLToPath(new URL('../../src/components/features/estimate-workspace/estimate-workspace.tsx', import.meta.url)), 'utf8');

  it('calls usePartsTree with the seed it was handed, so the tree is not read from the browser', () => {
    expect(source).toMatch(/usePartsTree\(estimateId, serverIgnored, \{ seed \}\)/);
  });
});
