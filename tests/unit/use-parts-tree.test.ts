import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TREE_CHANGE_LIMIT_MS, TREE_STATUS_DELAY_MS, usePartsTree } from '@/components/features/estimate-workspace/use-parts-tree';
import { TREE_CHANGING } from '@/components/features/estimate-workspace/estimate-texts';
import type { Outcome } from '@/lib/api-client';
import type { PartItem, TreeAnswer } from '@/lib/estimates/tree-client';

import { renderHook } from '../support/hook-harness';

// The hook runs with no DOM: React's hooks are the harness's (`tests/support/hook-harness.ts`), and the server's answers are the test's own.
vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);

const calls = vi.hoisted(() => ({ load: vi.fn(), move: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/estimates/tree-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/estimates/tree-client')>();
  return {
    ...original,
    loadTree: (...args: unknown[]) => calls.load(...args) as unknown,
    movePart: (...args: unknown[]) => calls.move(...args) as unknown,
    addPart: (...args: unknown[]) => calls.add(...args) as unknown,
    deletePart: (...args: unknown[]) => calls.remove(...args) as unknown,
  };
});

/**
 * AQP-343 (DEF-040, DL-340, DL-341): what the parts tree does when a change to it (a move, an add, a delete) is never answered, and while one is on its way. Fake timers stand in for the 20 s limit and the 300 ms
 * delay; the server is the test: a request that never answers ends only when its signal aborts it, as `fetch` does. Every ID and name is invented.
 */

const ESTIMATE = 'e1';
const part = (id: string, parentId: string | null, slNo: string, revision = 1): PartItem => ({ id, parentId, slNo, label: '', nodeKind: 'PART', completeness: 'EMPTY', revision });

/** 1 with two parts under it: 1.1 and 1.2. */
const BEFORE: ReadonlyArray<PartItem> = [part('m1', null, '1'), part('s1', 'm1', '1.1'), part('p1', 'm1', '1.2')];
/** The same tree after 1.2 went up: it is 1.1 now, with a new revision, and the other is 1.2. */
const MOVED: ReadonlyArray<PartItem> = [part('m1', null, '1'), part('p1', 'm1', '1.1', 2), part('s1', 'm1', '1.2')];
/** Someone else's change: another row, and nothing of ours. */
const OTHER: ReadonlyArray<PartItem> = [...BEFORE, part('x1', 'm1', '1.3')];

const ok = (nodes: ReadonlyArray<PartItem>, nodeId: string | null = null): Outcome<TreeAnswer> => ({ status: 'ok', value: { nodes, nodeId } });
const failed: Outcome<TreeAnswer> = { status: 'failed' };
const refused = (httpStatus: number, code: string, title: string, body: Record<string, unknown> = {}): Outcome<TreeAnswer> => ({ status: 'refused', httpStatus, code, title, fields: {}, body });

/** What `fetch` does with a request nothing answers: it stays open until its signal aborts it, and then the call's answer is "failed". */
const neverAnswers = (...args: unknown[]): Promise<Outcome<TreeAnswer>> => {
  const signal = args.find((arg): arg is AbortSignal => arg instanceof AbortSignal);
  return new Promise((resolve) => signal?.addEventListener('abort', () => resolve(failed)));
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const tick = (ms: number): Promise<unknown> => vi.advanceTimersByTimeAsync(ms);

/** The tree is open on 1.2, with the tree read once. */
async function open(readAgain: Outcome<TreeAnswer> | Promise<Outcome<TreeAnswer>> = ok(BEFORE)) {
  calls.load.mockReset().mockResolvedValueOnce(ok(BEFORE)).mockImplementation(() => Promise.resolve(readAgain));
  const hook = renderHook(usePartsTree, ESTIMATE);
  hook.render();
  await tick(0);
  hook.render().select('p1');
  return { hook, state: () => hook.render() };
}

const signalOf = (mock: { mock: { calls: unknown[][] } }): AbortSignal => {
  const signal = mock.mock.calls[0]?.find((arg): arg is AbortSignal => arg instanceof AbortSignal);
  if (signal === undefined) throw new Error('the call carried no signal');
  return signal;
};

beforeEach(() => {
  vi.useFakeTimers();
  for (const mock of [calls.move, calls.add, calls.remove]) mock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AC-a: a time limit on every change, longer than the server\'s own bound', () => {
  it('is more than 20 s, which is more than the server\'s worst case of about 15 s', () => {
    expect(TREE_CHANGE_LIMIT_MS).toBeGreaterThanOrEqual(20_000);
  });

  it('aborts a move that nothing answers at the limit, and not before', async () => {
    const { state } = await open();
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    await tick(TREE_CHANGE_LIMIT_MS - 1);
    expect(signalOf(calls.move).aborted).toBe(false);
    expect(state().busy).toBe(true);
    await tick(1);
    expect(signalOf(calls.move).aborted).toBe(true);
  });

  it('gives an add the same limit', async () => {
    const { hook } = await open();
    calls.add.mockImplementation(neverAnswers);
    hook.render().addUnder('m1', 'PART');
    await tick(TREE_CHANGE_LIMIT_MS);
    expect(signalOf(calls.add).aborted).toBe(true);
  });

  it('gives a delete the same limit', async () => {
    const { hook } = await open();
    calls.remove.mockImplementation(neverAnswers);
    hook.render().askDelete('s1');
    void hook.render().confirmDelete();
    await tick(TREE_CHANGE_LIMIT_MS);
    expect(signalOf(calls.remove).aborted).toBe(true);
  });
});

describe('AC-b: when the limit fires, the tree is read again and the screen says only what that shows', () => {
  it('announces a move that the tree shows was made, with no Notice, and keeps busy until the tree has been read', async () => {
    const reread = deferred<Outcome<TreeAnswer>>();
    const { state } = await open(reread.promise);
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    await tick(TREE_CHANGE_LIMIT_MS);
    // Aborted, and the tree is being read: not free yet, so no press goes out on a revision that is out of date.
    expect(calls.load).toHaveBeenCalledTimes(2);
    expect(state().busy).toBe(true);
    reread.resolve(ok(MOVED));
    await tick(0);
    const after = state();
    expect(after.busy).toBe(false);
    expect(after.problem).toBeNull();
    expect(after.nodes).toEqual(MOVED);
    expect(after.announcement).toBe('Part renumbered to 1.1');
  });

  it('says "The change was not made" only when the tree read again is the tree the change was sent from', async () => {
    const { state } = await open(ok(BEFORE));
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    await tick(TREE_CHANGE_LIMIT_MS);
    const after = state();
    expect(after.problem).toEqual({ kind: 'failed' });
    expect(after.busy).toBe(false);
    expect(after.announcement).toBe('');
  });

  it('says that the parts were changed by someone else when the tree shows neither our change nor the old tree', async () => {
    const { state } = await open(ok(OTHER));
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    await tick(TREE_CHANGE_LIMIT_MS);
    const after = state();
    expect(after.problem).toEqual({ kind: 'changed' });
    expect(after.nodes).toEqual(OTHER);
  });

  it('says nothing about the change when the tree cannot be read either: the parts could not be loaded, and busy is cleared', async () => {
    const { state } = await open(failed);
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    await tick(TREE_CHANGE_LIMIT_MS);
    const after = state();
    expect(after.problem).toEqual({ kind: 'unconfirmed' });
    expect(after.busy).toBe(false);
  });

  it('gives the read its own limit: a read that nothing answers ends in the same state, and busy is not left set', async () => {
    const { state } = await open(new Promise<Outcome<TreeAnswer>>(() => undefined));
    calls.load.mockImplementation(neverAnswers);
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    await tick(TREE_CHANGE_LIMIT_MS);
    expect(state().busy).toBe(true);
    await tick(TREE_CHANGE_LIMIT_MS);
    const after = state();
    expect(after.busy).toBe(false);
    expect(after.problem).toEqual({ kind: 'unconfirmed' });
  });

  it('shows an add that the tree shows exactly once: announced, and the new row takes the focus', async () => {
    const added = [...BEFORE, part('n1', 'm1', '1.3')];
    const { state, hook } = await open(ok(added));
    calls.add.mockImplementation(neverAnswers);
    hook.render().addUnder('m1', 'PART');
    await tick(TREE_CHANGE_LIMIT_MS);
    const after = state();
    expect(after.problem).toBeNull();
    expect(after.announcement).toBe('Part 1.3 added');
    expect(after.wantsFocus('n1')).toBe(true);
  });

  it('does not take an add for ours when the tree shows two new rows: the parts were changed by someone else', async () => {
    const { state, hook } = await open(ok([...BEFORE, part('n1', 'm1', '1.3'), part('n2', 'm1', '1.4')]));
    calls.add.mockImplementation(neverAnswers);
    hook.render().addUnder('m1', 'PART');
    await tick(TREE_CHANGE_LIMIT_MS);
    expect(state().problem).toEqual({ kind: 'changed' });
  });

  it('announces a delete that the tree shows was made', async () => {
    const { state, hook } = await open(ok([BEFORE[0] as PartItem, BEFORE[2] as PartItem]));
    calls.remove.mockImplementation(neverAnswers);
    hook.render().askDelete('s1');
    void hook.render().confirmDelete();
    await tick(TREE_CHANGE_LIMIT_MS);
    const after = state();
    expect(after.problem).toBeNull();
    expect(after.announcement).toBe('Row deleted');
  });

  it('does nothing to a screen that has gone: leaving the page aborts the request, and no Notice is drawn', async () => {
    const { state, hook } = await open();
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    hook.unmount();
    await tick(0);
    expect(signalOf(calls.move).aborted).toBe(true);
    expect(calls.load).toHaveBeenCalledTimes(1);
    expect(state().problem).toBeNull();
  });
});

describe('AC-c, AC-d: a change on its way is shown, and no press is dropped without a word', () => {
  it('says nothing extra for a change that answers within 300 ms, and says "Updating the parts" for one that is still open after it', async () => {
    const answer = deferred<Outcome<TreeAnswer>>();
    const { state } = await open();
    calls.move.mockReturnValue(answer.promise);
    state().move('up');
    await tick(TREE_STATUS_DELAY_MS - 1);
    expect(state().waiting).toBe(false);
    expect(state().announcement).toBe('');
    await tick(1);
    const slow = state();
    expect(slow.busy).toBe(true);
    expect(slow.waiting).toBe(true);
    expect(slow.announcement).toBe(TREE_CHANGING);
    expect(TREE_CHANGING).toBe('Updating the parts. This takes a moment.');
    answer.resolve(ok(MOVED));
    await tick(0);
    const done = state();
    expect(done.waiting).toBe(false);
    expect(done.busy).toBe(false);
    expect(done.announcement).toBe('Part renumbered to 1.1');
  });

  it('never shows the line for a quick change', async () => {
    const { state } = await open();
    calls.move.mockResolvedValue(ok(MOVED));
    state().move('up');
    await tick(0);
    await tick(TREE_STATUS_DELAY_MS * 2);
    expect(state().waiting).toBe(false);
    expect(state().announcement).toBe('Part renumbered to 1.1');
  });

  it('refuses a second change while one is open: nothing is sent, and the line says why', async () => {
    const answer = deferred<Outcome<TreeAnswer>>();
    const { state, hook } = await open();
    calls.move.mockReturnValue(answer.promise);
    state().move('up');
    await tick(TREE_STATUS_DELAY_MS);
    hook.render().addUnder('m1', 'PART');
    hook.render().move('down');
    expect(calls.add).not.toHaveBeenCalled();
    expect(calls.move).toHaveBeenCalledTimes(1);
    const during = state();
    expect(during.busy).toBe(true);
    expect(during.waiting).toBe(true);
    answer.resolve(ok(MOVED));
    await tick(0);
  });

  it('refuses a delete dialog while a change is open', async () => {
    const { state, hook } = await open();
    calls.move.mockImplementation(neverAnswers);
    state().move('up');
    hook.render().askDelete('s1');
    expect(state().deleting).toBeNull();
    await tick(TREE_CHANGE_LIMIT_MS);
  });
});

describe('AC-e: the answers that already gave feedback are unchanged', () => {
  it('shows the new tree and announces it for an ok answer', async () => {
    const { state } = await open();
    calls.move.mockResolvedValue(ok(MOVED));
    state().move('up');
    await tick(0);
    const after = state();
    expect(after.nodes).toEqual(MOVED);
    expect(after.announcement).toBe('Part renumbered to 1.1');
    expect(after.busy).toBe(false);
    expect(calls.load).toHaveBeenCalledTimes(1);
  });

  it('shows the fresh tree with the usual notice for a 409 TREE_CHANGED', async () => {
    const { state } = await open();
    calls.move.mockResolvedValue(refused(409, 'TREE_CHANGED', 'The parts were changed.', { tree: OTHER }));
    state().move('up');
    await tick(0);
    const after = state();
    expect(after.problem).toEqual({ kind: 'changed' });
    expect(after.nodes).toEqual(OTHER);
    expect(calls.load).toHaveBeenCalledTimes(1);
  });

  it('reads the tree again for a 404', async () => {
    const { state } = await open();
    calls.move.mockResolvedValue(refused(404, 'NOT_FOUND', 'Not found.'));
    state().move('up');
    await tick(0);
    state();
    await tick(0);
    expect(state().problem).toEqual({ kind: 'changed' });
    expect(calls.load).toHaveBeenCalledTimes(2);
  });

  it('shows the server\'s words for another refusal, 503 among them', async () => {
    const { state } = await open();
    calls.move.mockResolvedValue(refused(503, 'DATABASE_BUSY', 'The system is busy. Try again.'));
    state().move('up');
    await tick(0);
    expect(state().problem).toEqual({ kind: 'refused', message: 'The system is busy. Try again.' });
  });

  it('says "failed" for a network failure that came before the limit, with no second read', async () => {
    const { state } = await open();
    calls.move.mockResolvedValue(failed);
    state().move('up');
    await tick(0);
    expect(state().problem).toEqual({ kind: 'failed' });
    expect(calls.load).toHaveBeenCalledTimes(1);
  });

  it('treats an answer that arrives with the limit as the answer it is', async () => {
    const { state } = await open();
    calls.move.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(ok(MOVED)), TREE_CHANGE_LIMIT_MS - 1)));
    state().move('up');
    await tick(TREE_CHANGE_LIMIT_MS);
    expect(state().announcement).toBe('Part renumbered to 1.1');
    expect(calls.load).toHaveBeenCalledTimes(1);
  });

  it('tells a later read that fails, once the tree has been shown: "Try again" gives the same answer', async () => {
    const { state } = await open(failed);
    calls.move.mockResolvedValue(refused(404, 'NOT_FOUND', 'Not found.'));
    state().move('up');
    await tick(0);
    state();
    await tick(0);
    expect(state().problem).toEqual({ kind: 'unconfirmed' });
    state().readAgain();
    expect(state().problem).toBeNull();
    await tick(0);
    state();
    await tick(0);
    expect(state().problem).toEqual({ kind: 'unconfirmed' });
  });
});
