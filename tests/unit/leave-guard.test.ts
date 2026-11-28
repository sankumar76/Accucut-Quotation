import { describe, expect, it } from 'vitest';

import { installLeaveGuard, leavingLinkOf, type LeaveEnv } from '@/lib/estimates/leave-guard';
import { askToLeave, mayLeave, registerLeaveGuard, type LeaveRequest } from '@/lib/estimates/leave-registry';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * STORY-05.08 AC-4: nothing prompts when there are no unsaved changes, and with some, a closed tab, a link inside the portal, the back button and Sign out all ask first. The listeners are tried
 * against plain event targets (the node has no browser): the real page, with Next.js's router and a real history, is `tests/e2e/estimate-save.spec.ts` in CI at three widths. Invented ids only.
 */

const PART = '00000000-0000-4000-8000-0000000000d1';
const HERE = 'http://portal.test/estimates/Q-2026-0001';
const ORIGIN = 'http://portal.test';

interface Anchor {
  readonly href: string;
  readonly target: string;
  readonly hasAttribute: (name: string) => boolean;
}

const anchor = (href: string, extra: { readonly target?: string; readonly download?: boolean } = {}): Anchor => ({
  href: new URL(href, HERE).href,
  target: extra.target ?? '',
  hasAttribute: (name) => name === 'download' && extra.download === true,
});

const linkClick = (to: Anchor | null, overrides: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({
  target: { closest: () => to },
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

describe('AC-4: which clicks leave the page', () => {
  const location = { href: HERE, origin: ORIGIN };

  it('a plain click on a link to another page of the portal leaves, and gives the address to go to', () => {
    expect(leavingLinkOf(linkClick(anchor('/audit?page=2#top')), location)).toBe('/audit?page=2#top');
  });

  it.each([
    ['another mouse button', linkClick(anchor('/audit'), { button: 1 })],
    ['a held Ctrl, which opens a new tab', linkClick(anchor('/audit'), { ctrlKey: true })],
    ['a held Cmd', linkClick(anchor('/audit'), { metaKey: true })],
    ['a held Shift', linkClick(anchor('/audit'), { shiftKey: true })],
    ['a held Alt', linkClick(anchor('/audit'), { altKey: true })],
    ['a link that opens in another tab', linkClick(anchor('/audit', { target: '_blank' }))],
    ['a download', linkClick(anchor('/api/v1/file', { download: true }))],
    ['another site (the browser asks on its own)', linkClick(anchor('https://elsewhere.test/page'))],
    ['the address the person is on', linkClick(anchor('/estimates/Q-2026-0001'))],
    ['a different # on the same page', linkClick(anchor('/estimates/Q-2026-0001#part-form-title'))],
    ['something that is not inside a link', linkClick(null)],
  ])('does not leave for %s', (_name, click) => {
    expect(leavingLinkOf(click, location)).toBeNull();
  });

  it('reads a link that opens in the same frame as a link inside the page', () => {
    expect(leavingLinkOf(linkClick(anchor('/audit', { target: '_self' })), location)).toBe('/audit');
  });

  it('is not fooled by a target that has no closest(), such as the document itself', () => {
    expect(leavingLinkOf({ target: {}, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }, location)).toBeNull();
    expect(leavingLinkOf({ target: null, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }, location)).toBeNull();
  });
});

/** A window and a document that are only event targets, with a history that remembers what was asked of it. */
function fakePage() {
  const win = new EventTarget();
  const doc = new EventTarget();
  const history = { state: { __NA: true }, pushed: 0, backs: 0, gone: [] as number[], pushState: () => void (history.pushed += 1), back: () => void (history.backs += 1), go: (delta: number) => void history.gone.push(delta) };
  const timers: Array<() => void> = [];
  const env = {
    win: Object.assign(win, { location: { href: HERE, origin: ORIGIN }, history, setTimeout: (handler: () => void) => timers.push(handler) }),
    doc,
  } as unknown as LeaveEnv;
  return { env, win, doc, history, timers };
}

function setUp() {
  const page = fakePage();
  const gate = createSaveGate();
  const asked: LeaveRequest[] = [];
  const navigated: string[] = [];
  const handle = installLeaveGuard({ env: page.env, gate, ask: (request) => void asked.push(request), navigate: (href, replace) => void navigated.push(replace ? `replace ${href}` : `push ${href}`) });
  const typeSomething = (): void => gate.mark(PART, 'field-j', true);
  const saveIt = (): void => gate.mark(PART, 'field-j', false);
  const click = (to: Anchor): Event => {
    // `target` is a getter on a real event, so the facts of a click are put on it as own properties.
    const event = new Event('click', { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries(linkClick(to)).map(([name, value]) => [name, { value }])));
    page.doc.dispatchEvent(event);
    return event;
  };
  const unload = (): Event => {
    const event = new Event('beforeunload', { cancelable: true });
    page.win.dispatchEvent(event);
    return event;
  };
  const pressBack = (): void => void page.win.dispatchEvent(new Event('popstate'));
  return { ...page, gate, asked, navigated, handle, typeSomething, saveIt, click, unload, pressBack };
}

describe('AC-4: a closed tab or a reload', () => {
  it('shows the browser prompt only while something is unsaved', () => {
    const { unload, typeSomething, saveIt } = setUp();
    expect(unload().defaultPrevented).toBe(false);
    typeSomething();
    expect(unload().defaultPrevented).toBe(true);
    saveIt();
    expect(unload().defaultPrevented).toBe(false);
  });

  it('shows it while a save is still in flight too, since closing the tab can cancel the request', () => {
    const { gate, unload } = setUp();
    gate.track(new Promise<void>(() => undefined));
    expect(unload().defaultPrevented).toBe(true);
  });

  it('lets one full load through after the person chose to sign out, and guards the page again after the grace period', () => {
    const { handle, unload, typeSomething, timers } = setUp();
    typeSomething();
    handle.allowFullLoad();
    expect(unload().defaultPrevented).toBe(false);
    for (const lapse of timers) lapse();
    expect(unload().defaultPrevented).toBe(true);
  });

  it('is off once the guard is removed', () => {
    const { handle, unload, typeSomething } = setUp();
    typeSomething();
    handle.remove();
    expect(unload().defaultPrevented).toBe(false);
  });
});

describe('AC-4: a link inside the portal', () => {
  it('does nothing when nothing is unsaved: the click goes on to the router', () => {
    const { click, asked } = setUp();
    expect(click(anchor('/audit')).defaultPrevented).toBe(false);
    expect(asked).toEqual([]);
  });

  it('stops the click and asks when something is unsaved; going takes the person there, staying does not', () => {
    const { click, asked, navigated, typeSomething } = setUp();
    typeSomething();
    expect(click(anchor('/audit')).defaultPrevented).toBe(true);
    expect(asked).toHaveLength(1);
    asked[0]?.cancel();
    expect(navigated).toEqual([]);
    asked[0]?.proceed();
    // The extra history entry is on top by now (typing put it there), so the link replaces it.
    expect(navigated).toEqual(['replace /audit']);
  });

  it('with the extra history entry on top, a link on a clean page replaces it instead of stacking on it, with no question (review SQR-03: no dead Back press)', () => {
    const { click, asked, navigated, typeSomething, saveIt } = setUp();
    typeSomething();
    saveIt();
    expect(click(anchor('/audit')).defaultPrevented).toBe(true);
    expect(asked).toEqual([]);
    expect(navigated).toEqual(['replace /audit']);
  });

  it('without the extra entry (nothing was ever typed) the click is left to the router, which pushes', () => {
    const { click, navigated } = setUp();
    expect(click(anchor('/audit')).defaultPrevented).toBe(false);
    expect(navigated).toEqual([]);
  });

  it('after Back asked and the extra entry was put back, a link still replaces it', () => {
    const { click, navigated, typeSomething, pressBack, asked } = setUp();
    typeSomething();
    pressBack();
    asked[0]?.cancel();
    click(anchor('/audit'));
    asked[1]?.proceed();
    expect(navigated).toEqual(['replace /audit']);
  });

  it('leaves alone a click that was never going to leave, even with something unsaved', () => {
    const { click, asked, typeSomething } = setUp();
    typeSomething();
    expect(click(anchor('https://elsewhere.test/x')).defaultPrevented).toBe(false);
    expect(click(anchor('/estimates/Q-2026-0001')).defaultPrevented).toBe(false);
    expect(asked).toEqual([]);
  });
});

describe('DEF-149: a link to another row of the same page leaves the extra entry on top and the guard armed', () => {
  const ROW = anchor('/estimates/Q-2026-0001?row=1.2');

  it('replaces the extra entry and does not push a second one when something is typed again', () => {
    const { click, navigated, history, typeSomething, saveIt } = setUp();
    typeSomething();
    saveIt();
    expect(history.pushed).toBe(1);
    click(ROW);
    expect(navigated).toEqual(['replace /estimates/Q-2026-0001?row=1.2']);
    // The router replaced the extra entry; the page is the same and so is its one extra entry: typing again must not stack another.
    typeSomething();
    expect(history.pushed).toBe(1);
  });

  it('after an add (a row opened with the extra entry on top) and typing, Back asks and the way out is two steps back, once', () => {
    const { click, history, typeSomething, saveIt, pressBack, asked } = setUp();
    typeSomething();
    saveIt();
    click(ROW);
    typeSomething();
    pressBack();
    expect(asked).toHaveLength(1);
    asked[0]?.proceed();
    expect(history.gone).toEqual([-2]);
    expect(history.pushed).toBe(2);
  });

  it('a link to another page takes the guard away with it: nothing stays armed for the page that follows', () => {
    const { click, history, typeSomething, saveIt } = setUp();
    typeSomething();
    saveIt();
    click(anchor('/audit'));
    typeSomething();
    expect(history.pushed).toBe(2);
  });

  it('two row links in a row and then Back: still one extra entry, and the way out is two steps back', () => {
    const { click, history, typeSomething, saveIt, pressBack, asked } = setUp();
    typeSomething();
    saveIt();
    click(anchor('/estimates/Q-2026-0001?row=1.2'));
    click(anchor('/estimates/Q-2026-0001?row=1.3'));
    typeSomething();
    expect(history.pushed).toBe(1);
    pressBack();
    asked[0]?.proceed();
    expect(history.gone).toEqual([-2]);
  });

  it('"Keep editing" keeps the guard armed: a later Back asks again', () => {
    const { typeSomething, pressBack, asked } = setUp();
    typeSomething();
    pressBack();
    asked[0]?.cancel();
    pressBack();
    expect(asked).toHaveLength(2);
  });
});

describe('AC-4: the back button', () => {
  it('puts one extra entry on the history when something first becomes unsaved, and not another while it stays so', () => {
    const { history, typeSomething, saveIt } = setUp();
    expect(history.pushed).toBe(0);
    typeSomething();
    saveIt();
    typeSomething();
    expect(history.pushed).toBe(1);
  });

  it('asks on Back while something is unsaved, puts the entry back so Back asks again, and goes two steps back if the person leaves', () => {
    const { history, asked, typeSomething, pressBack } = setUp();
    typeSomething();
    pressBack();
    expect(asked).toHaveLength(1);
    expect(history.pushed).toBe(2);
    expect(history.gone).toEqual([]);
    asked[0]?.proceed();
    expect(history.gone).toEqual([-2]);
  });

  it('stays on the page when the person chooses to keep editing: nothing is traversed', () => {
    const { history, asked, typeSomething, pressBack } = setUp();
    typeSomething();
    pressBack();
    asked[0]?.cancel();
    expect(history.gone).toEqual([]);
    expect(history.backs).toBe(0);
  });

  it('passes Back on at once, without asking, when everything was saved after the entry was made', () => {
    const { history, asked, typeSomething, saveIt, pressBack } = setUp();
    typeSomething();
    saveIt();
    pressBack();
    expect(asked).toEqual([]);
    expect(history.backs).toBe(1);
  });

  it('does not touch a Back that was never from its own entry (nothing was unsaved while it was pressed), and leaves a different address alone', () => {
    const { history, asked, win, pressBack, typeSomething } = setUp();
    pressBack();
    expect(history.backs).toBe(0);
    typeSomething();
    (win as unknown as { location: { href: string } }).location.href = 'http://portal.test/audit';
    pressBack();
    expect(asked).toEqual([]);
    expect(history.backs).toBe(0);
  });
});

describe('AC-4: the registry that Sign out and a change of part ask through', () => {
  it('lets the person go at once when no guard is registered', async () => {
    await expect(mayLeave()).resolves.toBe(true);
  });

  it('hands the request to the registered guard, which decides; the answer is what the person chose', async () => {
    const seen: LeaveRequest[] = [];
    const withdraw = registerLeaveGuard((request) => void seen.push(request));
    const answer = mayLeave();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.fullLoad).toBe(true);
    seen[0]?.cancel();
    await expect(answer).resolves.toBe(false);
    withdraw();
  });

  it('a withdrawn guard no longer asks, and an older guard cannot withdraw a newer one', () => {
    const calls: string[] = [];
    const first = registerLeaveGuard(() => void calls.push('first'));
    const second = registerLeaveGuard(() => void calls.push('second'));
    first();
    askToLeave({ proceed: () => undefined, cancel: () => undefined });
    expect(calls).toEqual(['second']);
    second();
    let went = false;
    askToLeave({ proceed: () => void (went = true), cancel: () => undefined });
    expect(went).toBe(true);
  });
});
