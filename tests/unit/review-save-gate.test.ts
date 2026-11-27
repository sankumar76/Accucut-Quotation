import { afterEach, describe, expect, it, vi } from 'vitest';

import { createClearedRefresh } from '@/lib/estimates/cleared-refresh';
import { press, RECALCULATE_UNSAVED_TITLE } from '@/lib/estimates/recalculate-client';
import { reviewSaveGate } from '@/lib/estimates/review-save-gate';

/**
 * DEF-131 stage 2, the one save gate of the review page and the one refresh (architecture note lead-admin-input-edit-2026-11-27 6a A-4, A-7; UX ruling `lead-admin-edit-inputs-2026-11-27.md` 4.3; ED-3, ED-7). The
 * inputs island and the Recalculate press share `reviewSaveGate`, so a press never reaches the server before the save of the value typed just before it: it asks every form to send again what it shows, waits for the saves, and
 * goes only when nothing is left unsaved. The page is asked to be drawn again once, when a save takes the figures from current to cleared, and not for each save after that. `fetch` is replaced. Every ID is invented.
 */

const ESTIMATE = '00000000-0000-4000-8000-0000000000e2';
const PART = '00000000-0000-4000-8000-0000000000e3';

afterEach(() => {
  reviewSaveGate.forget(PART);
  vi.unstubAllGlobals();
});

const good = (): Response => new Response(JSON.stringify({ state: 'current' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('ED-7: Recalculate saves first, then calculates', () => {
  it('asks the forms to send what they show, waits for the save in flight, and only then sends the request', async () => {
    const doFetch = vi.fn(() => Promise.resolve(good()));
    vi.stubGlobal('fetch', doFetch);
    const asked: string[] = [];
    const withdraw = reviewSaveGate.offerFlush((mode) => asked.push(mode));
    let finish: () => void = () => undefined;
    reviewSaveGate.track(new Promise<void>((resolve) => (finish = resolve)));

    const pressed = press(ESTIMATE);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked).toEqual(['draft']);
    expect(doFetch).not.toHaveBeenCalled();

    finish();
    expect(await pressed).toEqual({ status: 'ok', value: true });
    expect(doFetch).toHaveBeenCalledTimes(1);
    withdraw();
  });

  it('goes at once when nothing is typed and nothing is in flight', async () => {
    const doFetch = vi.fn(() => Promise.resolve(good()));
    vi.stubGlobal('fetch', doFetch);
    expect(await press(ESTIMATE)).toEqual({ status: 'ok', value: true });
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('does not send when a field still shows a value that could not be saved, and says so in words', async () => {
    const doFetch = vi.fn(() => Promise.resolve(good()));
    vi.stubGlobal('fetch', doFetch);
    reviewSaveGate.mark(PART, 'field-1', true);
    const outcome = await press(ESTIMATE);
    expect(doFetch).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: 'refused', title: RECALCULATE_UNSAVED_TITLE });
    expect(RECALCULATE_UNSAVED_TITLE).toBe('A field shows a value that could not be saved. Fix it, then press Recalculate.');
  });

  it('"Recalculate anyway" waits the same way', async () => {
    const doFetch = vi.fn(() => Promise.resolve(good()));
    vi.stubGlobal('fetch', doFetch);
    reviewSaveGate.mark(PART, 'field-1', true);
    expect((await press(ESTIMATE, 7)).status).toBe('refused');
    expect(doFetch).not.toHaveBeenCalled();
  });
});

describe('ED-3: the page is drawn again once when the figures go from current to cleared', () => {
  it('asks on the first real write while the figures are current, and not on the next ones', () => {
    const refresh = createClearedRefresh();
    expect(refresh.wrote(true)).toBe(true);
    expect(refresh.wrote(true)).toBe(false);
    expect(refresh.wrote(true)).toBe(false);
  });

  it('never asks while the figures are already cleared or were never calculated', () => {
    const refresh = createClearedRefresh();
    expect(refresh.wrote(false)).toBe(false);
    expect(refresh.wrote(false)).toBe(false);
  });

  it('asks again after a Recalculate has made the figures current again', () => {
    const refresh = createClearedRefresh();
    expect(refresh.wrote(true)).toBe(true);
    refresh.sync(false);
    expect(refresh.wrote(false)).toBe(false);
    refresh.sync(true);
    expect(refresh.wrote(true)).toBe(true);
  });
});
