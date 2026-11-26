import { afterEach, describe, expect, it, vi } from 'vitest';

import { removedElsewhereLine, TREE_CALCULATING, TREE_CLEARED_STATUS } from '@/components/features/estimate-review/review-texts';
import { withoutFilled } from '@/lib/estimates/calculate-missing';
import { createClearedRefresh } from '@/lib/estimates/cleared-refresh';
import { press } from '@/lib/estimates/recalculate-client';
import { addressWithRow, joinRows, removedElsewhere } from '@/lib/estimates/review-tree-edit';
import { reviewBlocked, reviewCalculating } from '@/lib/estimates/review-save-gate';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * DEF-131 stage 2T, the plain rules of the review's editing island (UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.7 (c), (d); ED-21, ED-24, ED-27, ED-31): the figures follow the row by its ID, the chosen row is in the
 * address, a row removed by someone else is told and one removed by this person is not, one page read follows a change that clears the figures, and the Recalculate press says it is running. Every name is invented.
 */

const item = (id: string, slNo: string, parentId: string | null = null): PartItem => ({ id, parentId, slNo, label: `Name ${slNo}`, nodeKind: 'PART', completeness: 'EMPTY', revision: 1 });
const page = (id: string, count: string | null, unitPrice: string | null) => ({ id, count, figures: { unitPrice, unitPriceUsd: null, unitPriceEur: null } });

describe('joinRows: the page\'s figures follow the row by its ID, never by its place or its number', () => {
  it('gives a row that was moved or renumbered its own figures', () => {
    // The tree now has row "b" first, as 1, and row "a" second, as 2; the page was drawn the other way round.
    const joined = joinRows([item('b', '1'), item('a', '2')], [page('a', '2', '10.00'), page('b', '6', '20.00')]);
    expect(joined.get('a')?.figures?.unitPrice).toBe('10.00');
    expect(joined.get('b')?.figures?.unitPrice).toBe('20.00');
    expect(joined.get('b')?.count).toBe('6');
  });

  it('gives a row the page has not seen yet no row at all (a dash and no count), and drops a row the tree no longer holds', () => {
    const joined = joinRows([item('a', '1'), item('new', '2')], [page('a', '2', '10.00'), page('gone', '1', '5.00')]);
    expect(joined.get('new')).toBeNull();
    expect(joined.has('gone')).toBe(false);
    expect([...joined.keys()]).toEqual(['a', 'new']);
  });
});

describe('addressWithRow: the chosen row is in the address and nothing else is lost', () => {
  it('adds ?row= to an address that has none', () => {
    expect(addressWithRow('https://invented.example.test/estimates/Q-2026-0318', '1.4')).toBe('/estimates/Q-2026-0318?row=1.4');
  });

  it('replaces a row and keeps the other parts of the query and the hash', () => {
    expect(addressWithRow('https://invented.example.test/estimates/Q-2026-0318?row=1.1&x=1#row-inputs', '2')).toBe('/estimates/Q-2026-0318?row=2&x=1#row-inputs');
  });

  it('writes a Sl. No with characters of an address as an encoded one, never as it came', () => {
    expect(addressWithRow('https://invented.example.test/estimates/Q-1', '1&row=9')).toBe('/estimates/Q-1?row=1%26row%3D9');
  });
});

describe('ED-27: removedElsewhere says it only when the open row is gone and this person did not remove it', () => {
  const open = { id: 'a', slNo: '1.4' };
  it.each([
    ['the row is still there (renumbered by a move)', [item('b', '1.1'), item('a', '1.2')], [], false],
    ['the row is gone and nobody here removed it', [item('b', '1.1')], [], true],
    ['the row is gone with this person\'s own delete (a row above it, or itself)', [item('b', '1.1')], ['a', 'c'], false],
    ['the tree is empty (nothing to show instead)', [], [], false],
  ] as const)('%s', (_name, tree, own, said) => {
    expect(removedElsewhere(open, tree, own)).toBe(said);
  });

  it('says nothing when no row was open yet', () => {
    expect(removedElsewhere(null, [item('b', '1.1')], [])).toBe(false);
  });

  it('has the words of the ruling', () => {
    expect(removedElsewhereLine('1.4', '1.1')).toBe('1.4 was removed by someone else. Showing 1.1.');
  });
});

describe('ED-24: the page is drawn again once when a change to the parts takes the figures from current to cleared, and said once', () => {
  it('asks for the page once for a run of changes, and again after a Recalculate made the figures current again', () => {
    const refresh = createClearedRefresh();
    refresh.sync(true);
    expect(refresh.wrote(true)).toBe(true);
    expect(refresh.wrote(true)).toBe(false);
    refresh.sync(false);
    expect(refresh.wrote(false)).toBe(false);
    refresh.sync(true);
    expect(refresh.wrote(true)).toBe(true);
  });

  it('has the words of the ruling', () => {
    expect(TREE_CLEARED_STATUS).toBe('The parts changed. Every calculated figure is cleared. Press Recalculate to see them again.');
  });
});

describe('ED-31: the tree\'s buttons wait while Recalculate runs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    reviewCalculating.set(false);
  });

  it('has the words of the ruling', () => {
    expect(TREE_CALCULATING).toBe('Calculating. This takes a moment.');
  });

  it('tells its listeners when it changes, and only then', () => {
    const heard: boolean[] = [];
    const stop = reviewCalculating.subscribe(() => heard.push(reviewCalculating.get()));
    reviewCalculating.set(true);
    reviewCalculating.set(true);
    reviewCalculating.set(false);
    stop();
    reviewCalculating.set(true);
    expect(heard).toEqual([true, false]);
  });

  it('is set while the press is waiting for the server and cleared when it answers', async () => {
    const seen: boolean[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        seen.push(reviewCalculating.get());
        return new Response(JSON.stringify({ state: 'current' }), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    expect(reviewCalculating.get()).toBe(false);
    await press('00000000-0000-4000-8000-000000000001');
    expect(seen).toEqual([true]);
    expect(reviewCalculating.get()).toBe(false);
  });

  it('is cleared when the request fails, too: the buttons are never left waiting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await press('00000000-0000-4000-8000-000000000001');
    expect(reviewCalculating.get()).toBe(false);
  });
});

describe('ED-25: a refused Recalculate names the parts and fields, and the island shows them', () => {
  const BLOCKED = { type: 'about:blank', title: 'Nothing was submitted. 1 part has missing inputs.', status: 422, code: 'CALCULATE_BLOCKED', parts: [{ nodeId: 'p1', slNo: '2.1', name: null, fields: [{ fieldId: 'f1', label: 'Length' }, { fieldId: 'f2', label: 'Width' }] }] };
  const respond = (body: unknown, status: number): void => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/problem+json' } })));
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    reviewBlocked.update(null);
    reviewCalculating.set(false);
  });

  it('keeps the parts of a 422 CALCULATE_BLOCKED, asks for the focus once, and clears them when the next press starts', async () => {
    respond(BLOCKED, 422);
    const heard: number[] = [];
    const stop = reviewBlocked.subscribe(() => heard.push(reviewBlocked.get()?.length ?? 0));
    await press('00000000-0000-4000-8000-000000000001');
    expect(reviewBlocked.get()).toEqual([{ nodeId: 'p1', slNo: '2.1', name: null, fields: [{ fieldId: 'f1', label: 'Length' }, { fieldId: 'f2', label: 'Width' }] }]);
    const first = reviewBlocked.request();
    respond({ state: 'current' }, 200);
    await press('00000000-0000-4000-8000-000000000001');
    stop();
    expect(reviewBlocked.get()).toBeNull();
    expect(heard).toEqual([1, 0]);
    expect(first).toBeGreaterThan(0);
  });

  it('takes no refusal of another kind for a list of parts', async () => {
    respond({ type: 'about:blank', title: 'This estimate can no longer be changed.', status: 409, code: 'ESTIMATE_APPROVED_IS_LOCKED' }, 409);
    await press('00000000-0000-4000-8000-000000000001');
    expect(reviewBlocked.get()).toBeNull();
  });

  it('strikes a field once it holds a value and asks for no focus again', () => {
    reviewBlocked.refuse([{ nodeId: 'p1', slNo: '2.1', name: null, fields: [{ fieldId: 'f1', label: 'Length' }, { fieldId: 'f2', label: 'Width' }] }]);
    const request = reviewBlocked.request();
    reviewBlocked.update(withoutFilled(reviewBlocked.get() ?? [], 'p1', { f1: '4' }));
    expect(reviewBlocked.get()?.[0]?.fields.map((field) => field.fieldId)).toEqual(['f2']);
    expect(reviewBlocked.request()).toBe(request);
    reviewBlocked.update(withoutFilled(reviewBlocked.get() ?? [], 'p1', { f2: '5' }));
    expect(reviewBlocked.get()).toBeNull();
  });
});
