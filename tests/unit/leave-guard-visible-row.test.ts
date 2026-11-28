import { describe, expect, it } from 'vitest';

import { installLeaveGuard, type LeaveEnv, type LeaveGuardHandle } from '@/lib/estimates/leave-guard';
import type { LeaveRequest } from '@/lib/estimates/leave-registry';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * DEF-149 / QLT-845-08 (AQP-506; DL-487): **after Back asks and the person keeps editing, the page still shows the row they were typing in, with what they typed.** A link to another row, pressed while the guard is
 * armed, used to replace only the guard's own entry; the page's own entry below it kept the address of the row the person opened first, and a Back that landed on it made Next's router draw that row, which unmounts the
 * form of the row being typed in. Now the guard steps off its entry, has the router write the row's address onto the page's own entry, and pushes a fresh entry only once the router has committed it.
 * **What this shows and what it does not:** its router is modelled (it draws the row of the address a traversal lands on, and tells the guard when it has committed one); the end-to-end cases of
 * `leave-guard-history.spec.ts` are the reading at a real router and a real browser. It runs under both orders of the `popstate` listeners, because nothing in the guard depends on which runs first.
 *
 * Before the fix this case was RED: `expected { row: '1.1', typed: null } to deeply equal { row: '1', typed: '…' }`. Invented addresses only.
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

function setUp(order: 'next-first' | 'guard-first') {
  const entries = [QUEUE, FIRST_ROW];
  let index = 1;
  const popstate: PopListener[] = [];
  const clickListeners: Array<(event: Event) => void> = [];
  const bubbleListeners: Array<(event: Event) => void> = [];
  const guardRef: { current: LeaveGuardHandle | undefined } = { current: undefined };

  const location = {
    get href() {
      return entries[index] ?? FIRST_ROW;
    },
    origin: 'http://portal.test',
  };

  /** What the person sees: the row the router drew and the text typed in it and not saved. A form drawn for another row starts again, so the text typed in the row before is gone. */
  const form = { row: rowOf(FIRST_ROW), typed: null as string | null };
  const gate = createSaveGate();
  const drawn: string[] = [];
  const draw = (): void => {
    drawn.push(location.href);
    const row = rowOf(location.href);
    if (row !== form.row) {
      form.row = row;
      form.typed = null;
      gate.mark(PART, 'field-j', false);
    }
  };

  const win = {
    addEventListener: (type: string, listener: PopListener) => void (type === 'popstate' ? popstate.push(listener) : undefined),
    removeEventListener: () => undefined,
    setTimeout: () => undefined,
    location,
    history: {
      state: { __NA: true },
      pushState: () => {
        entries.splice(index + 1);
        entries.push(entries[index] ?? FIRST_ROW);
        index += 1;
      },
      replaceState: (_state: unknown, _title: string, url: string) => void (entries[index] = new URL(url, entries[index]).href),
      back: () => void win.history.go(-1),
      go: (delta: number) => {
        const target = Math.max(0, Math.min(entries.length - 1, index + delta));
        if (target === index) return;
        index = target;
        const event = new Event('popstate');
        for (const listener of order === 'next-first' ? popstate : [...popstate].reverse()) listener(event);
        guardRef.current?.committed();
      },
    },
  };
  // Next's router listens first, and draws the address a traversal lands on.
  win.addEventListener('popstate', draw);
  const doc = {
    addEventListener: (type: string, listener: (event: Event) => void, useCapture?: boolean) => {
      if (type === 'click') (useCapture === true ? clickListeners : bubbleListeners).push(listener);
    },
    removeEventListener: () => undefined,
    getElementById: () => null,
    activeElement: null,
  };
  const env = { win, doc } as unknown as LeaveEnv;

  const router = {
    replace: (href: string) => {
      entries[index] = new URL(href, entries[index]).href;
      draw();
      guardRef.current?.committed();
    },
    push: (href: string) => {
      entries.splice(index + 1);
      entries.push(new URL(href, entries[index]).href);
      index += 1;
      draw();
      guardRef.current?.committed();
    },
  };
  const asked: LeaveRequest[] = [];
  guardRef.current = installLeaveGuard({ env, gate, ask: (request) => void asked.push(request), navigate: (href, replace) => (replace ? router.replace(href) : router.push(href)) });

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
    if (stopped) return;
    event.preventDefault();
    router.replace(href);
    for (const listener of bubbleListeners) listener(event);
  }

  return {
    form,
    asked,
    entries,
    drawn,
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
    back: () => win.history.go(-1),
    forward: () => win.history.go(1),
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

describe.each(['next-first', 'guard-first'] as const)('QLT-845-08: "Keep editing" after a row link pressed while the guard is armed (%s)', (order) => {
  it('shows the row the person was typing in, with the text they typed; the address is that row\'s and no entry was added or removed', () => {
    const s = setUp(order);
    typedInTheSecondRow(s);
    const entriesBefore = s.entries.length;
    const drawnBefore = s.drawn.length;
    s.back();
    expect(s.asked).toHaveLength(1);
    s.asked[0]?.cancel();
    expect({ row: s.form.row, typed: s.form.typed }).toEqual({ row: '1', typed: TYPED });
    expect(s.at()).toBe(SECOND_ROW);
    expect(s.entries).toHaveLength(entriesBefore);
    // The Back landed on the page\'s own entry, which has the row on screen\'s address: the router drew that row and no other.
    expect(s.drawn.slice(drawnBefore).every((address) => rowOf(address) === '1')).toBe(true);
  });

  it('a second Back with the dialog up asks again, and "Leave" lands on the page before (two steps back from the guard\'s entry)', () => {
    const s = setUp(order);
    typedInTheSecondRow(s);
    s.back();
    s.asked[0]?.cancel();
    s.back();
    expect(s.asked).toHaveLength(2);
    expect(s.form).toEqual({ row: '1', typed: TYPED });
    s.asked[1]?.proceed();
    expect(s.at()).toBe(QUEUE);
  });

  it('with nothing unsaved by then, the Back is passed on and lands on the page before, with no question and without drawing the earlier row', () => {
    const s = setUp(order);
    typedInTheSecondRow(s);
    s.save();
    const drawnBefore = s.drawn.length;
    s.back();
    expect(s.asked).toHaveLength(0);
    expect(s.at()).toBe(QUEUE);
    expect(s.drawn.slice(drawnBefore).some((address) => rowOf(address) === '1.1')).toBe(false);
  });

  it('a row link pressed while the guard is armed gives the page\'s own entry the row\'s address (the entry below the guard\'s is not the earlier row\'s)', () => {
    const s = setUp(order);
    s.type(FIRST);
    s.save();
    // QLT-845-12: nothing is unsaved at the link, so the history length read here is the guard's own (the page's entry and the guard's on top), and a guard that forgot its entry at the link and pushed another on the
    // next keystroke (the fault of DEF-149) would make it one longer.
    const lengthAtTheLink = s.entries.length;
    s.clickRowLink(SECOND_ROW_LINK);
    expect(rowOf(s.entries[1] ?? '')).toBe('1');
    s.type(TYPED);
    expect(s.entries).toHaveLength(lengthAtTheLink);
    expect(rowOf(s.entries[2] ?? '')).toBe('1');
  });

  it('Forward after the Back that left, with nothing typed, shows a row of this page and loses nothing', () => {
    const s = setUp(order);
    s.type(FIRST);
    s.save();
    s.clickRowLink(SECOND_ROW_LINK);
    s.back();
    expect(s.at()).toBe(QUEUE);
    s.forward();
    expect(s.at()).toContain('/estimates/Q-2026-0001');
    expect(s.form.typed).toBeNull();
  });
});
