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

/** The two places the hook listens: the document (`visibilitychange`) and the window (`pagehide`). The hook runs with no DOM, so both are faked. */
function fakePage() {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  return {
    doc,
    win,
    hide(): void {
      doc.visibilityState = 'hidden';
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    show(): void {
      doc.visibilityState = 'visible';
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    leave(): void {
      win.dispatchEvent(new Event('pagehide'));
    },
    restoreFromCache(): void {
      win.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    },
  };
}

// The page's effects run in a browser, where the document and the window exist: the hook's listeners go on these fakes, and the tests that use them dispatch the events.
beforeEach(() => {
  vi.useFakeTimers();
  fakePage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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

/**
 * STORY-05.10 AC-7a to AC-7f (amended 2026-11-25, QLT-F-05, #687): the page also asks for one automatic save at once when the tab becomes hidden (`visibilitychange`) and when the page is left (`pagehide`).
 * It is the same `gate.flush`, asked in the `'leave'` way (the part forms send what is unsaved through their own save, and the request survives the page going away). The hook never reads a part form:
 * what is sent, once, and what is not, is proved with the forms' own tests (`estimate-autosave-part.test.ts`). Here: when the hook asks, and when it does not.
 */
describe('AC-7a to AC-7f: a save at once when the tab is hidden or the page is left', () => {
  it('AC-7a: asks the part forms to send what is unsaved at once when the tab becomes hidden, not at the next tick', () => {
    const page = fakePage();
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    page.hide();
    expect(modes).toEqual(['leave']);
  });

  it('AC-7a: becoming visible again asks for nothing', () => {
    const page = fakePage();
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    page.show();
    expect(modes).toEqual([]);
  });

  it('AC-7b: asks the same way when the page is left (pagehide)', () => {
    const page = fakePage();
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    page.leave();
    expect(modes).toEqual(['leave']);
  });

  it('AC-7f: asks nothing when nothing is unsaved, on a hide or on a leave', () => {
    const page = fakePage();
    const { modes } = open();
    page.hide();
    page.leave();
    expect(modes).toEqual([]);
  });

  it('AC-7c: a page restored from the back/forward cache (pageshow) asks for nothing', () => {
    const page = fakePage();
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    page.restoreFromCache();
    expect(modes).toEqual([]);
  });

  it('AC-7f: nothing is listened to when the person may not edit the inputs (SUBMITTED, APPROVED), and listening stops when that becomes true', () => {
    const page = fakePage();
    const { gate, modes } = open({ enabled: false });
    gate.mark(PART, 'a', true);
    page.hide();
    page.leave();
    expect(modes).toEqual([]);

    const gateOn = createSaveGate();
    const modesOn: FlushMode[] = [];
    gateOn.offerFlush((mode) => modesOn.push(mode));
    gateOn.mark(PART, 'a', true);
    const props = { gate: gateOn, options: { enabled: true } as UseAutosaveOptions };
    const hook = renderHook(({ gate: given, options }: typeof props) => useAutosave(given, options), props);
    hook.render();
    props.options = { enabled: false };
    hook.render();
    page.hide();
    page.leave();
    expect(modesOn).toEqual([]);
  });

  it('AC-7f: one set of listeners for the whole page, however often the page renders, and none left after it unmounts', () => {
    const page = fakePage();
    const onDocument = vi.spyOn(page.doc, 'addEventListener');
    const onWindow = vi.spyOn(page.win, 'addEventListener');
    const { gate, hook, modes } = open();
    hook.render();
    hook.render();
    expect(onDocument.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);
    expect(onWindow.mock.calls.filter(([type]) => type === 'pagehide')).toHaveLength(1);
    gate.mark(PART, 'a', true);
    hook.unmount();
    page.hide();
    page.leave();
    expect(modes).toEqual([]);
  });

  it('AC-7f: no second send after a remount: the old listeners went with the old page', () => {
    const page = fakePage();
    const first = open();
    first.hook.unmount();
    const second = open();
    second.gate.mark(PART, 'a', true);
    page.hide();
    expect(first.modes).toEqual([]);
    expect(second.modes).toEqual(['leave']);
  });

  it('AC-7a: a Calculate in flight is not raced; when it ends and the tab is still hidden, what is unsaved is asked for once', () => {
    const page = fakePage();
    let calculating = true;
    const gate = createSaveGate();
    const modes: FlushMode[] = [];
    gate.offerFlush((mode) => modes.push(mode));
    gate.mark(PART, 'a', true);
    const props = { gate, options: { enabled: true, isBlocked: () => calculating } as UseAutosaveOptions };
    const hook = renderHook(({ gate: given, options }: typeof props) => useAutosave(given, options), props);
    hook.render();
    page.hide();
    expect(modes).toEqual([]);
    hook.render();
    expect(modes).toEqual([]);
    calculating = false;
    hook.render();
    expect(modes).toEqual(['leave']);
    hook.render();
    expect(modes).toEqual(['leave']);
  });

  it('AC-7a: a Calculate that ends after the tab is visible again leaves the changes to the next tick', () => {
    const page = fakePage();
    let calculating = true;
    const gate = createSaveGate();
    const modes: FlushMode[] = [];
    gate.offerFlush((mode) => modes.push(mode));
    gate.mark(PART, 'a', true);
    const props = { gate, options: { enabled: true, isBlocked: () => calculating } as UseAutosaveOptions };
    const hook = renderHook(({ gate: given, options }: typeof props) => useAutosave(given, options), props);
    hook.render();
    page.hide();
    page.show();
    calculating = false;
    hook.render();
    expect(modes).toEqual([]);
  });

  it('AC-7a: a save in flight is not skipped: the forms queue behind it and send each text once, so the hook asks', () => {
    const page = fakePage();
    const { gate, modes } = open();
    gate.mark(PART, 'a', true);
    gate.track(new Promise<void>(() => undefined));
    page.hide();
    expect(modes).toEqual(['leave']);
  });

  it('AC-7d: a failed save on hide leaves the changes unsaved, and the next tick once the tab is visible asks again, as an ordinary automatic save', async () => {
    const page = fakePage();
    let hidden = false;
    const { gate, modes } = open({ isHidden: () => hidden });
    gate.mark(PART, 'a', true);
    hidden = true;
    page.hide();
    await tick();
    expect(modes).toEqual(['leave']);
    hidden = false;
    page.show();
    await tick();
    expect(modes).toEqual(['leave', 'auto']);
  });

  it('"is the tab hidden" has one source: the injected answer steers the hide path as it steers the tick', () => {
    const page = fakePage();
    const { gate, modes } = open({ isHidden: () => true });
    gate.mark(PART, 'a', true);
    page.show();
    expect(modes).toEqual(['leave']);
    const other = open({ isHidden: () => false });
    other.gate.mark(PART, 'a', true);
    page.hide();
    expect(other.modes).toEqual([]);
  });

  it('AC-7: the tick itself still does nothing while the tab is hidden', async () => {
    const page = fakePage();
    const { gate, modes } = open({ isHidden: () => true });
    gate.mark(PART, 'a', true);
    page.hide();
    await tick();
    await tick();
    expect(modes).toEqual(['leave']);
  });
});
