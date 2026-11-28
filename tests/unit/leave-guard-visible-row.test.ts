import { afterEach, describe, expect, it, vi } from 'vitest';

import { BOUNCE_GRACE_MS, captureRunsFirst, installLeaveGuard, type LeaveEnv } from '@/lib/estimates/leave-guard';
import type { LeaveRequest } from '@/lib/estimates/leave-registry';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * DEF-149 / QLT-845-08 (AQP-506; DL-482): **after Back asks and the person keeps editing, the page still shows the row they were typing in, with what they typed.** The guard's own entry is the one a row link replaces
 * while the guard is armed; the page's own entry below it keeps the address of the row the person opened first. Next's router also hears the Back (a `popstate`) and renders the address it lands on, which unmounts
 * the form of the row being typed in. This test models that second listener: the router renders the row of the address the history is at, and a form that is rendered for another row starts again from what is saved
 * (what was typed is gone). **What it shows and what it does not:** it shows what the guard does with the history and with the event (it stops the router from seeing the traversal to the page's own entry); that the
 * real router draws a stale row on such a traversal is shown by the end-to-end cases of `leave-guard-history.spec.ts`. The window of the model runs listeners added with `capture: true` first and honours
 * `stopImmediatePropagation`, as an engine that follows the DOM specification does; the order probe and the text-safe path of an engine that does not are tried below. Invented addresses only.
 *
 * This case was RED before the guard swallowed the traversal: `expected { row: '1.1', typed: null } to deeply equal { row: '1', typed: '…' }`.
 */

const QUEUE = 'http://portal.test/queue';
const FIRST_ROW = 'http://portal.test/estimates/Q-2026-0001?row=1.1';
const SECOND_ROW = 'http://portal.test/estimates/Q-2026-0001?row=1#row-inputs';
const SECOND_ROW_LINK = '/estimates/Q-2026-0001?row=1#row-inputs';
const PART = '00000000-0000-4000-8000-0000000000d1';
const FIRST = 'Invented description, first save';
const TYPED = 'Invented text typed in the second row';

const rowOf = (address: string): string => new URL(address).searchParams.get('row') ?? '';

type PopListener = (event: Event) => void;

function setUp({ captureFirst }: { readonly captureFirst: boolean | undefined }) {
  const entries = [QUEUE, FIRST_ROW];
  let index = 1;
  const timers: Array<() => void> = [];
  // The traversals made so far, and the one whose `popstate` never reaches the page (an event lost), counted from the next one.
  let traversals = 0;
  let lostTraversal: number | null = null;

  // A window that runs the listeners of the capture phase first and stops at `stopImmediatePropagation`.
  const popstate = { capture: [] as PopListener[], bubble: [] as PopListener[] };
  const registered: Array<{ readonly type: string; readonly capture: boolean }> = [];
  const dispatchPopstate = (): void => {
    const event = new Event('popstate');
    let stopped = false;
    Object.defineProperty(event, 'stopImmediatePropagation', { value: () => void (stopped = true) });
    for (const listener of [...popstate.capture, ...popstate.bubble]) if (!stopped) listener(event);
  };
  const win = {
    addEventListener: (type: string, listener: PopListener, capture?: boolean) => {
      registered.push({ type, capture: capture === true });
      if (type === 'popstate') (capture === true ? popstate.capture : popstate.bubble).push(listener);
    },
    removeEventListener: (type: string, listener: PopListener, capture?: boolean) => {
      if (type !== 'popstate') return;
      const list = capture === true ? popstate.capture : popstate.bubble;
      const at = list.indexOf(listener);
      if (at >= 0) list.splice(at, 1);
    },
    setTimeout: (handler: () => void) => void timers.push(handler),
  };
  const history = {
    state: { __NA: true },
    pushState: () => {
      entries.splice(index + 1);
      entries.push(entries[index] ?? FIRST_ROW);
      index += 1;
    },
    replaceState: (_state: unknown, _title: string, url: string) => void (entries[index] = new URL(url, entries[index]).href),
    back: () => void history.go(-1),
    go: (delta: number) => {
      index = Math.max(0, Math.min(entries.length - 1, index + delta));
      traversals += 1;
      if (lostTraversal === traversals) return;
      dispatchPopstate();
    },
  };
  const location = {
    get href() {
      return entries[index] ?? FIRST_ROW;
    },
    origin: 'http://portal.test',
  };
  const clickListeners: Array<(event: Event) => void> = [];
  const doc = {
    addEventListener: (type: string, listener: (event: Event) => void, useCapture?: boolean) => void (type === 'click' && useCapture === true ? clickListeners.push(listener) : undefined),
    removeEventListener: () => undefined,
    getElementById: () => null,
    activeElement: null,
  };
  const env = { win: Object.assign(win, { location, history }), doc } as unknown as LeaveEnv;

  /** What the person sees: the row the router rendered and the text typed in it and not saved. A form rendered for another row starts again, so the text typed in the row before is gone. */
  const form = { row: rowOf(FIRST_ROW), typed: null as string | null };
  const drawn: string[] = [];
  const render = (): void => {
    drawn.push(location.href);
    const row = rowOf(location.href);
    if (row !== form.row) {
      form.row = row;
      form.typed = null;
    }
  };
  // Next's router is registered first, and renders the address a traversal lands on.
  win.addEventListener('popstate', render);
  const router = {
    replace: (href: string) => {
      entries[index] = new URL(href, entries[index]).href;
      render();
    },
    push: (href: string) => {
      entries.splice(index + 1);
      entries.push(new URL(href, entries[index]).href);
      index += 1;
      render();
    },
  };

  const gate = createSaveGate();
  const asked: LeaveRequest[] = [];
  installLeaveGuard({ env, gate, ask: (request) => void asked.push(request), navigate: (href, replace) => (replace ? router.replace(href) : router.push(href)), ...(captureFirst === undefined ? {} : { captureFirst }) });
  const installed = registered.length;

  function clickRowLink(href: string): void {
    const anchor = { href: new URL(href, location.href).href, target: '', hasAttribute: () => false };
    let stopped = false;
    const event = new Event('click', { cancelable: true });
    Object.defineProperties(event, {
      target: { value: { closest: () => anchor } },
      button: { value: 0 },
      metaKey: { value: false },
      ctrlKey: { value: false },
      shiftKey: { value: false },
      altKey: { value: false },
      stopImmediatePropagation: { value: () => void (stopped = true) },
    });
    for (const listener of clickListeners) if (!stopped) listener(event);
    // A click the guard did not take is the page's own link: the tree's row links replace.
    if (!stopped) router.replace(href);
  }

  return {
    form,
    asked,
    entries,
    drawn,
    registered: () => registered.slice(0, installed),
    at: () => location.href,
    clickRowLink,
    type: (text: string) => {
      form.typed = text;
      gate.mark(PART, 'field-j', true);
    },
    save: () => {
      form.typed = null;
      gate.mark(PART, 'field-j', false);
    },
    back: () => history.go(-1),
    /** The nth traversal from now on is made, but its `popstate` never reaches the page. */
    losePopstateOfTraversal: (nth: number) => void (lostTraversal = traversals + nth),
    runTimers: () => timers.splice(0).forEach((timer) => timer()),
  };
}

/** Row 1.1 is edited and saved (the guard has armed itself and stays armed); another row's link is pressed and text is typed there that cannot be saved. */
function typedInTheSecondRow(s: ReturnType<typeof setUp>): void {
  s.type(FIRST);
  s.save();
  s.clickRowLink(SECOND_ROW_LINK);
  expect(s.form.row).toBe('1');
  s.type(TYPED);
}

afterEach(() => vi.unstubAllGlobals());

describe('QLT-845-08: "Keep editing" after a row link pressed while the guard is armed', () => {
  it('shows the row the person was typing in, with the text they typed; the address is that row\'s and no entry was added or removed', () => {
    const s = setUp({ captureFirst: true });
    typedInTheSecondRow(s);
    const entriesBefore = [...s.entries];
    s.back();
    expect(s.asked).toHaveLength(1);
    s.asked[0]?.cancel();
    expect({ row: s.form.row, typed: s.form.typed }).toEqual({ row: '1', typed: TYPED });
    expect(s.at()).toBe(SECOND_ROW);
    expect(s.entries).toEqual(entriesBefore);
    // Next's router never saw the traversal to the page's own entry (nor the guard's step forward): it drew the row link only.
    expect(s.drawn).toEqual([SECOND_ROW]);
  });

  it('a second Back with the dialog up asks again, and "Leave" lands on the page before (two steps back from the guard\'s entry)', () => {
    const s = setUp({ captureFirst: true });
    typedInTheSecondRow(s);
    s.back();
    s.back();
    expect(s.asked.length).toBeGreaterThanOrEqual(2);
    expect(s.form).toEqual({ row: '1', typed: TYPED });
    s.asked[s.asked.length - 1]?.proceed();
    expect(s.at()).toBe(QUEUE);
  });

  it('with nothing unsaved by then, the Back is passed on from the page\'s own entry and lands on the page before, with no question and without drawing the earlier row', () => {
    const s = setUp({ captureFirst: true });
    typedInTheSecondRow(s);
    s.save();
    s.back();
    expect(s.asked).toHaveLength(0);
    expect(s.at()).toBe(QUEUE);
    expect(s.drawn).toEqual([SECOND_ROW, QUEUE]);
  });

  it('the guard\'s own step forward is matched on the address it lands on: if its event never comes, the next real Back is asked about, not swallowed as the guard\'s own', () => {
    const s = setUp({ captureFirst: true });
    typedInTheSecondRow(s);
    // The Back is heard and swallowed; the guard steps forward (the second traversal) and that event is lost.
    s.losePopstateOfTraversal(2);
    s.back();
    expect(s.asked).toHaveLength(1);
    expect(s.at()).toBe(SECOND_ROW);
    // A real Back now lands on the page's own entry, which is not the address the guard's step was to land on.
    s.back();
    expect(s.asked).toHaveLength(2);
    s.asked[1]?.cancel();
    expect({ row: s.form.row, typed: s.form.typed }).toEqual({ row: '1', typed: TYPED });
  });

  it('where the guard\'s entry and the page\'s own have the same address, the wait for a lost step ends by itself, so a later real Back is asked about too', () => {
    const s = setUp({ captureFirst: true });
    s.type(TYPED);
    s.losePopstateOfTraversal(2);
    s.back();
    expect(s.asked).toHaveLength(1);
    // The same address cannot tell the guard's step from a real Back, so the wait runs out first (BOUNCE_GRACE_MS).
    s.runTimers();
    s.back();
    expect(s.asked).toHaveLength(2);
    expect(BOUNCE_GRACE_MS).toBeGreaterThan(0);
  });
});

describe('DL-482 (3): the order probe and the text-safe path', () => {
  it('where a capture listener does not run first, the guard takes master\'s path: the typed text survives Back and "Keep editing"', () => {
    const s = setUp({ captureFirst: false });
    typedInTheSecondRow(s);
    s.back();
    expect(s.asked).toHaveLength(1);
    s.asked[0]?.cancel();
    expect({ row: s.form.row, typed: s.form.typed }).toEqual({ row: '1', typed: TYPED });
    expect(s.registered().filter((listener) => listener.type === 'popstate' && listener.capture)).toHaveLength(0);
  });

  it('where a capture listener runs first, the guard listens to popstate in the capture phase', () => {
    const s = setUp({ captureFirst: true });
    expect(s.registered().filter((listener) => listener.type === 'popstate' && listener.capture)).toHaveLength(1);
  });

  it('the probe is made on a detached target and answers true only when the capture listener ran first', () => {
    const order = (captureFirst: boolean) =>
      class {
        private readonly listeners: Array<{ readonly fn: () => void; readonly capture: boolean }> = [];
        addEventListener(_type: string, fn: () => void, capture?: boolean) {
          this.listeners.push({ fn, capture: capture === true });
        }
        dispatchEvent() {
          const sorted = captureFirst ? [...this.listeners].sort((a, b) => Number(b.capture) - Number(a.capture)) : this.listeners;
          for (const { fn } of sorted) fn();
          return true;
        }
      };
    vi.stubGlobal('EventTarget', order(true));
    expect(captureRunsFirst()).toBe(true);
    vi.stubGlobal('EventTarget', order(false));
    expect(captureRunsFirst()).toBe(false);
    vi.stubGlobal(
      'EventTarget',
      class {
        constructor() {
          throw new Error('no EventTarget constructor');
        }
      },
    );
    expect(captureRunsFirst()).toBe(false);
  });

  it('left out, the choice is the probe\'s: a failing probe gives the text-safe path', () => {
    vi.stubGlobal(
      'EventTarget',
      class {
        private readonly seen: Array<() => void> = [];
        addEventListener(_type: string, fn: () => void) {
          this.seen.push(fn);
        }
        dispatchEvent() {
          for (const fn of this.seen) fn();
          return true;
        }
      },
    );
    const s = setUp({ captureFirst: undefined });
    expect(s.registered().filter((listener) => listener.type === 'popstate' && listener.capture)).toHaveLength(0);
    typedInTheSecondRow(s);
    s.back();
    s.asked[0]?.cancel();
    expect({ row: s.form.row, typed: s.form.typed }).toEqual({ row: '1', typed: TYPED });
  });
});
