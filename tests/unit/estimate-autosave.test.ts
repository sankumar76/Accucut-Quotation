import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTOSAVE_INTERVAL_MS, useAutosave, type UseAutosaveOptions } from '@/components/features/estimate-workspace/use-autosave';
import { saveStatusText } from '@/components/features/estimate-workspace/save-texts';
import { createSaveGate, type FlushMode } from '@/lib/estimates/save-gate';

import { renderHook } from '../support/hook-harness';

// The hook runs with no DOM: React's hooks are the harness's (`tests/support/hook-harness.ts`), and time is Vitest's fake clock, so no test waits 30 real seconds (AQP-344).
vi.mock('react', async () => (await import('../support/hook-harness')).reactHooks);

/**
 * STORY-05.10 AC-1, AC-2, AC-7, AC-8: the one timer of the estimate page. Every tick asks the gate to send again what the part forms show (`flush('auto')`), but only while the person may edit,
 * the tab is shown, no save or Calculate is in flight, and something is unsaved. Invented ids only.
 */

const PART = '00000000-0000-4000-8000-0000000000f1';

function open(overrides: Partial<UseAutosaveOptions> = {}) {
  const gate = createSaveGate();
  const modes: FlushMode[] = [];
  gate.offerFlush((mode) => modes.push(mode));
  const props = { gate, options: { enabled: true, ...overrides } };
  const hook = renderHook(({ gate: given, options }: typeof props) => useAutosave(given, options), props);
  hook.render();
  return { gate, hook, modes };
}

const tick = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS);
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('AC-1: a fixed 30 second tick', () => {
  it('is 30 seconds', () => {
    expect(AUTOSAVE_INTERVAL_MS).toBe(30_000);
  });

  it('asks the part forms to send what they show on a tick, as an automatic save and not a press of Save draft', async () => {
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1);
    expect(modes).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(modes).toEqual(['auto']);
  });

  it('keeps ticking at a fixed interval, not 30 seconds after the last keystroke', async () => {
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    await tick();
    gate.mark(PART, 'b', true);
    await vi.advanceTimersByTimeAsync(10_000);
    gate.mark(PART, 'c', true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(modes).toEqual(['auto', 'auto']);
  });

  it('uses one timer for the whole page', () => {
    open();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('can be given another interval (so a test controls time)', async () => {
    const { gate, modes } = open({ intervalMs: 1_000 });
    gate.mark(PART, 'a', true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(modes).toEqual(['auto']);
  });
});

describe('AC-2: a tick with nothing unsaved sends nothing', () => {
  it('does not ask the forms to send anything while nothing is unsaved', async () => {
    const { modes } = open();
    await tick();
    await tick();
    expect(modes).toEqual([]);
  });

  it('stops asking once what was unsaved has been saved', async () => {
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    await tick();
    gate.mark(PART, 'a', false);
    await tick();
    expect(modes).toEqual(['auto']);
  });
});

describe('AC-7: when it runs', () => {
  it('runs nothing when the person may not edit the inputs, and starts no timer', async () => {
    const { gate, modes } = open({ enabled: false });
    gate.mark(PART, 'a', true);
    expect(vi.getTimerCount()).toBe(0);
    await tick();
    expect(modes).toEqual([]);
  });

  it('stops the timer when the estimate stops being editable (Calculate prepared it) and starts it again when it is', async () => {
    const gate = createSaveGate();
    const modes: FlushMode[] = [];
    gate.offerFlush((mode) => modes.push(mode));
    gate.mark(PART, 'a', true);
    const props = { gate, options: { enabled: true } as UseAutosaveOptions };
    const hook = renderHook(({ gate: given, options }: typeof props) => useAutosave(given, options), props);
    hook.render();
    props.options = { enabled: false };
    hook.render();
    expect(vi.getTimerCount()).toBe(0);
    await tick();
    expect(modes).toEqual([]);
    props.options = { enabled: true };
    hook.render();
    await tick();
    expect(modes).toEqual(['auto']);
  });

  it('runs nothing while the tab is hidden, and does not queue the missed ticks: one run when it is shown again', async () => {
    let hidden = true;
    const { gate, modes } = open({ isHidden: () => hidden });
    gate.mark(PART, 'a', true);
    await tick();
    await tick();
    await tick();
    expect(modes).toEqual([]);
    hidden = false;
    await tick();
    expect(modes).toEqual(['auto']);
  });

  it('skips a tick while a save is in flight and never queues it', async () => {
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    let finish: () => void = () => undefined;
    gate.track(new Promise<void>((resolve) => (finish = resolve)));
    await tick();
    await tick();
    expect(modes).toEqual([]);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(modes).toEqual([]);
    await tick();
    expect(modes).toEqual(['auto']);
  });

  it('skips a tick while Calculate is in flight', async () => {
    let calculating = true;
    const { gate, modes } = open({ isBlocked: () => calculating });
    gate.mark(PART, 'a', true);
    await tick();
    expect(modes).toEqual([]);
    calculating = false;
    await tick();
    expect(modes).toEqual(['auto']);
  });

  it('clears the timer on leaving: no request after the page is gone', async () => {
    const { gate, hook, modes } = open();
    gate.mark(PART, 'a', true);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
    await tick();
    expect(modes).toEqual([]);
  });
});

describe('the gate carries the two facts a tick reads (AC-7, AC-8)', () => {
  it('says whether a save is in flight, apart from whether something is unsaved', async () => {
    const gate = createSaveGate();
    expect(gate.isSaving()).toBe(false);
    gate.mark(PART, 'a', true);
    expect(gate.isSaving()).toBe(false);
    let finish: () => void = () => undefined;
    gate.track(new Promise<void>((resolve) => (finish = resolve)));
    expect(gate.isSaving()).toBe(true);
    finish();
    await gate.settle();
    expect(gate.isSaving()).toBe(false);
    expect(gate.isDirty()).toBe(true);
  });

  it('flush says which kind of send it asks for: Save draft by default, an automatic one when told', () => {
    const gate = createSaveGate();
    const modes: FlushMode[] = [];
    gate.offerFlush((mode) => modes.push(mode));
    gate.flush();
    gate.flush('auto');
    expect(modes).toEqual(['draft', 'auto']);
  });
});

describe('AC-4, AC-5: the one status line says when it was saved, that it saves on its own, and, once, that it could not', () => {
  const LAST_SAVED = 'Last saved 20 Nov 2026, 10:41 IST';
  const FAILED_AT = new Date('2026-11-20T05:12:00.000Z');

  it('gains "Auto-save every 30 s." and keeps the time of the last save', () => {
    expect(saveStatusText(LAST_SAVED, true, null)).toBe('Last saved 20 Nov 2026, 10:41 IST. Auto-save every 30 s.');
  });

  it('says the same under "Nothing saved yet"', () => {
    expect(saveStatusText('Nothing saved yet', true, null)).toBe('Nothing saved yet. Auto-save every 30 s.');
  });

  it('does not promise an automatic save when the person may not edit (a prepared estimate saves nothing)', () => {
    expect(saveStatusText(LAST_SAVED, false, null)).toBe(LAST_SAVED);
    expect(saveStatusText(LAST_SAVED, false, FAILED_AT)).toBe(LAST_SAVED);
  });

  it('adds the failure sentence with the time of the failure, in IST', () => {
    expect(saveStatusText(LAST_SAVED, true, FAILED_AT)).toBe('Last saved 20 Nov 2026, 10:41 IST. Auto-save every 30 s. Auto-save could not save at 10:42 IST. What you typed is kept. Press Save draft to try again.');
  });
});
