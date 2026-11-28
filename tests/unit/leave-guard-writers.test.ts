import { describe, expect, it } from 'vitest';

import { fragmentLinkOf, installLeaveGuard, STEP_GRACE_MS, type FragmentTarget, type LeaveEnv, type LeaveGuardHandle } from '@/lib/estimates/leave-guard';
import type { LeaveRequest } from '@/lib/estimates/leave-registry';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * DEF-149 (AQP-506, DL-476 note 8) and QLT-845-08 (DL-487): the guard leaves with `history.go(-2)` and counts on two things. **(1) The guard's own entry is the only one above the page's own.** **(2) The page's own entry
 * carries the address of the row on screen**, so a Back that lands on it makes Next's router draw the row that is there and unmounts nothing. This holds only if every writer of a history entry on the page keeps both: the Lead's
 * row links (the router's `replace`, whose `replaceState` is made later, after the router has committed), the island's address rewrite (`replaceState`), the guard's own taking of a link, and a link to a place on the page
 * (`#main`, `#review-calculate`, a section of the form), which a browser answers with an entry of its own unless the guard does it (R1).
 *
 * **The model is engine-neutral** (DL-487 (4) (a)): it must not assume the property it is meant to test. Each writer is driven against a model of the browser's history (entries, an index, `pushState` that cuts what
 * lies ahead, `go` that fires `popstate`) and of Next's router, which draws the row of the address a traversal lands on, and tells the guard when it has committed an address (`committed()`), **under both orders of the
 * `popstate` listeners (Next's first, the guard's first) and both timings of the router's `replaceState` (at once; or only after the first keystroke, as Next's deferred write can land)**. After every step: the guard has
 * pushed no entry while the address differs from the row on screen; the page's own entry carries the row on screen; at most one entry is above the page's; and nothing typed was dropped by a draw. Then Back and "Leave"
 * must land on the page BEFORE the page. Invented addresses only.
 */

const BEFORE = 'http://portal.test/queue';
const PAGE = 'http://portal.test/estimates/Q-2026-0001';
const PART = '00000000-0000-4000-8000-0000000000d1';
const ROW_LINK = '/estimates/Q-2026-0001?row=1.2';
const OTHER_LINK = '/estimates/Q-2026-0001?row=1.4';

/** The path and query of an address: what makes it "the row on screen". A `#` does not. */
const pathSearch = (href: string): string => {
  const url = new URL(href);
  return url.pathname + url.search;
};

/** An element that a `#` can name: it records what was done to it, and takes the focus only if it can (a `tabindex`, or built to). */
function element(naturallyFocusable: boolean) {
  const attributes = new Map<string, string>();
  const blur: Array<() => void> = [];
  const state = { scrolled: 0, focusCalls: 0, attributes, blur };
  const target: FragmentTarget & { readonly state: typeof state } = {
    state,
    scrollIntoView: () => void (state.scrolled += 1),
    focus: () => {
      state.focusCalls += 1;
      if (naturallyFocusable || attributes.has('tabindex')) page.active = target;
    },
    setAttribute: (name, value) => void attributes.set(name, value),
    removeAttribute: (name) => void attributes.delete(name),
    addEventListener: (_type, listener) => void blur.push(listener),
  };
  return target;
}

/** The model of a window and a document with a real history, shared by one test at a time. */
const page = {
  active: null as unknown,
  elements: new Map<string, ReturnType<typeof element>>(),
};

type Order = 'next-first' | 'guard-first';
type Timing = 'at-once' | 'after-keystroke';

interface Variant {
  /** Which `popstate` listener runs first: Next's router (registered first, as it is) or the guard's. */
  readonly order: Order;
  /** When the router's deferred `replaceState` lands: at once, or only after the next keystroke. */
  readonly timing: Timing;
  /** Traversals (`go`) are queued and made when the test settles them, so something can happen while one is on its way. */
  readonly queued?: boolean;
}

const VARIANTS: ReadonlyArray<Variant> = [
  { order: 'next-first', timing: 'at-once' },
  { order: 'guard-first', timing: 'at-once' },
  { order: 'next-first', timing: 'after-keystroke' },
  { order: 'guard-first', timing: 'after-keystroke' },
];
const DEFAULT: Variant = VARIANTS[0] as Variant;

function browser(variant: Variant) {
  const entries = [BEFORE, PAGE];
  // The state of each entry, as `history.state` reads it: Next's own (`__NA`) on every entry the router drew, plus whatever a `pushState` or a `replaceState` of the guard or the island put there. A write of the router
  // replaces the state of the entry it lands on, and so drops a mark the guard put in it.
  const states: unknown[] = [{ __NA: true }, { __NA: true }];
  let index = 1;
  const popstate: Array<(event: Event) => void> = [];
  const capture: Array<(event: Event) => void> = [];
  const bubble: Array<(event: Event) => void> = [];
  const timers: Array<{ readonly ms: number; readonly run: () => void }> = [];
  const traversals: number[] = [];
  let queuedNow = variant.queued === true;
  const deferred: Array<() => void> = [];
  let guard: LeaveGuardHandle | undefined;

  /** The row on screen: the address the router committed last. `lost` is set when a draw made by a Back (or Forward) replaced a row while something was typed in it: the Sev-1 of QLT-845-08. */
  const screen = { path: pathSearch(PAGE) };
  const form = { typed: false, lost: false };
  const violations: string[] = [];
  // What the page does when the row on screen changes: the form of the row that was there unmounts and its unsaved marks go (`part-form.tsx` key, `save-gate.ts`).
  const hooks = { unmounted: () => undefined as void };

  const location = {
    get href() {
      return entries[index] ?? PAGE;
    },
    origin: 'http://portal.test',
  };

  /**
   * The router has committed an address: the component of the guard tells it from an effect on the router's path and query, so **only when one of them has changed** from what the effect last saw. A commit that leaves
   * the path and query as they were (the router ends where it started, or a write that only changes the `#`) says nothing to the guard.
   */
  let lastSeenByTheEffect = pathSearch(PAGE);
  const signal = (): void => {
    const now = pathSearch(location.href);
    if (now === lastSeenByTheEffect) return;
    lastSeenByTheEffect = now;
    (guard as { committed?: () => void } | undefined)?.committed?.();
  };

  const draw = (fromTraversal: boolean): void => {
    const here = pathSearch(location.href);
    if (here === screen.path) return;
    if (fromTraversal && form.typed) form.lost = true;
    screen.path = here;
    form.typed = false;
    hooks.unmounted();
  };

  const win = {
    addEventListener: (type: string, listener: (event: Event) => void) => void (type === 'popstate' ? popstate.push(listener) : undefined),
    removeEventListener: (type: string, listener: (event: Event) => void) => {
      const at = popstate.indexOf(listener);
      if (type === 'popstate' && at >= 0) popstate.splice(at, 1);
    },
    setTimeout: (handler: () => void, ms: number) => void timers.push({ ms, run: handler }),
    location,
    history: undefined as unknown,
  };
  // Next's router listens first: it draws the row of the address a traversal lands on.
  win.addEventListener('popstate', () => draw(true));

  const dispatchPopstate = (): void => {
    const event = new Event('popstate');
    for (const listener of variant.order === 'next-first' ? popstate : [...popstate].reverse()) listener(event);
    // Next's router commits what it drew, and its effect tells the guard.
    signal();
  };
  const traverse = (delta: number): void => {
    const target = Math.max(0, Math.min(entries.length - 1, index + delta));
    // A step past either end of the history does nothing, and fires no event.
    if (target === index) return;
    index = target;
    dispatchPopstate();
  };

  const doc = {
    addEventListener: (type: string, listener: (event: Event) => void, useCapture?: boolean) => void (type === 'click' ? (useCapture === true ? capture : bubble).push(listener) : undefined),
    removeEventListener: (type: string, listener: (event: Event) => void, useCapture?: boolean) => {
      const list = useCapture === true ? capture : bubble;
      const at = list.indexOf(listener);
      if (type === 'click' && at >= 0) list.splice(at, 1);
    },
    getElementById: (id: string) => page.elements.get(id) ?? null,
    get activeElement() {
      return page.active;
    },
  };
  const history = {
    get state(): unknown {
      return states[index];
    },
    pushState: (state: unknown) => {
      // The guard pushes an entry only on top of an entry whose address is the row on screen (DL-487 (2) (i)).
      if (pathSearch(entries[index] ?? PAGE) !== screen.path) violations.push(`pushed on ${entries[index] ?? ''} while ${screen.path} is on screen`);
      // The same address again (the guard passes none), and what lay ahead is cut.
      entries.splice(index + 1);
      states.splice(index + 1);
      entries.push(entries[index] ?? PAGE);
      states.push(state);
      index += 1;
    },
    replaceState: (state: unknown, _title: string, url: string) => {
      entries[index] = new URL(url, entries[index]).href;
      states[index] = state;
      // Next's patched `replaceState` hands the address to the router, which commits it when it changes the path or the query.
      if (pathSearch(entries[index] ?? PAGE) !== screen.path) {
        draw(false);
        signal();
      }
    },
    back: () => void history.go(-1),
    go: (delta: number) => {
      if (queuedNow) traversals.push(delta);
      else traverse(delta);
    },
  };
  win.history = history;
  const env = { win, doc } as unknown as LeaveEnv;

  /** The router's commit of an address: its `replaceState` lands on whatever entry is current then. */
  const commit = (href: string): void => {
    entries[index] = new URL(href, entries[index]).href;
    states[index] = { __NA: true };
    draw(false);
    signal();
  };
  /** The router's own navigation, as the guard and the page's links reach it: `replace` keeps the entry count (its commit lands now or after the next keystroke), `push` adds one. */
  // The address the next write of the router ends at when a navigation is redirected (a redirect to the address the page had).
  const redirect: { next: string | null } = { next: null };
  const router = {
    replace: (asked: string) => {
      const href = redirect.next ?? asked;
      redirect.next = null;
      if (variant.timing === 'at-once') commit(href);
      else deferred.push(() => commit(href));
    },
    push: (href: string) => {
      entries.splice(index + 1);
      states.splice(index + 1);
      entries.push(new URL(href, entries[index]).href);
      states.push({ __NA: true });
      index += 1;
      draw(false);
      signal();
    },
  };

  /**
   * A left click on a link. The guard's capture listener comes first; if it does not stop the click, the page's own handler runs (`own`, which may prevent the default), then the guard's bubbling listener; a
   * click nobody prevented is then done by the browser: a link to a place on the page pushes an entry of its own.
   */
  function click(href: string, own?: (event: { preventDefault: () => void }) => void): void {
    const absolute = new URL(href, entries[index]).href;
    const anchorFacts = { href: absolute, target: '', hasAttribute: () => false };
    let stopped = false;
    const event = new Event('click', { cancelable: true });
    Object.defineProperties(event, {
      target: { value: { closest: () => anchorFacts } },
      button: { value: 0 },
      metaKey: { value: false },
      ctrlKey: { value: false },
      shiftKey: { value: false },
      altKey: { value: false },
      stopImmediatePropagation: { value: () => void (stopped = true) },
    });
    for (const listener of capture) if (!stopped) listener(event);
    if (stopped) return;
    own?.(event);
    for (const listener of bubble) listener(event);
    if (!event.defaultPrevented && new URL(absolute).pathname === new URL(entries[index] ?? PAGE).pathname) {
      // The browser's own answer to a link to a place on the page: a new entry with that address.
      history.pushState({ __NA: true });
      entries[index] = absolute;
    }
  }

  return {
    entries,
    history,
    env,
    router,
    click,
    screen,
    form,
    violations,
    at: () => entries[index],
    hooks,
    install: (handle: LeaveGuardHandle) => void (guard = handle),
    index: () => index,
    /** The router's deferred `replaceState` lands now. */
    flush: () => {
      // A write that lands can make the guard ask for the next one (a link it queued), so this goes on until none is left.
      for (let landing = deferred.splice(0), rounds = 0; landing.length > 0; landing = deferred.splice(0), rounds += 1) {
        // A guard that keeps asking for one more write when each has landed would never settle: that is a failure, not a hang.
        if (rounds > 20) throw new Error('the guard keeps asking the router for another write');
        for (const land of landing) land();
      }
    },
    pendingCommits: () => deferred.length,
    /** The router drops a navigation that was asked for and never writes it (React drops a transition that another one overtakes, a redirect, a navigation that is abandoned): the first write that was waiting never lands. */
    discardFirstWrite: () => void deferred.shift(),
    redirect,
    /** The traversals that were queued are made, in order. */
    settle: () => {
      for (let next = traversals.shift(); next !== undefined; next = traversals.shift()) traverse(next);
    },
    pendingTraversals: () => traversals.length,
    /** From now on traversals wait to be settled (or not). */
    setQueued: (queued: boolean) => void (queuedNow = queued),
    /** A traversal whose landing never comes. */
    dropQueuedTraversals: () => void traversals.splice(0),
    /** The timers that are due after `upTo` ms (all of them when it is left out) run. The one that ends the hold on the fields is a fail-open for a write that never comes, so a case that has a write still on its way must not run it. */
    runTimers: (upTo = Infinity) => {
      const due = timers.filter((timer) => timer.ms <= upTo);
      for (const timer of due) timers.splice(timers.indexOf(timer), 1);
      due.forEach((timer) => timer.run());
    },
  };
}

/** One page with the guard on it: the writers and the person's typing and Back. */
function setUp(variant: Variant = DEFAULT) {
  page.active = null;
  page.elements = new Map([
    ['main', element(false)],
    ['review-calculate', element(true)],
    ['section-one', element(false)],
  ]);
  const model = browser(variant);
  const gate = createSaveGate();
  const asked: LeaveRequest[] = [];
  // DL-488 (iv): while the guard says the form is busy, no field accepts input. DL-488 (iii): the row on screen is dirty only when something is typed in it, not when another part's save is in flight or failed.
  const state = { inert: false, refused: 0 };
  const handle = installLeaveGuard({
    env: model.env,
    gate,
    ask: (request) => void asked.push(request),
    navigate: (href, replace) => (replace ? model.router.replace(href) : model.router.push(href)),
    rowDirty: () => model.form.typed,
    onInputHeld: (held) => void (state.inert = held),
  });
  model.install(handle);
  model.hooks.unmounted = () => gate.mark(PART, 'field-j', false);
  const pageIndex = 1;
  return {
    ...model,
    handle,
    asked,
    pageIndex,
    /** A key pressed in the row on screen: refused, and not accepted and dropped, while the form is busy (the field is read-only then). Answers whether it was accepted. */
    type: (): boolean => {
      if (state.inert) {
        state.refused += 1;
        return false;
      }
      model.form.typed = true;
      gate.mark(PART, 'field-j', true);
      return true;
    },
    inert: () => state.inert,
    refused: () => state.refused,
    /** A save of the part that was open before is in flight and never answers (the trap of QLT-845-19): the gate stays dirty, the row on screen is not. */
    holdSave: () => gate.track(new Promise(() => undefined)),
    save: () => {
      model.form.typed = false;
      gate.mark(PART, 'field-j', false);
    },
    /** Entries above the page's own entry. */
    above: () => model.entries.length - 1 - pageIndex,
  };
}

type Setup = ReturnType<typeof setUp>;

/** The core writers of a history entry on the page, as the page does it; every sequence of up to three of them is walked. */
const WRITERS: ReadonlyArray<readonly [string, (s: Setup) => void]> = [
  // The Lead's row link: a Next link with `replace`; the guard takes it when it is armed (it steps off its entry and then replaces the page's own), and otherwise the page's handler replaces.
  ['a row link', (s) => s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)))],
  // The island's rewrite of `?row=` after an add.
  ['the island rewrite', (s) => s.history.replaceState(s.history.state, '', '?row=1.3')],
  // The skip link and the rates-changed link: plain anchors, no handler.
  ['a link to a place on the page with no handler of its own', (s) => s.click('#main')],
  // The section strip, the form's link in the tree and the calculate summary prevent the default and do their own scrolling.
  ['a link to a place on the page that its own handler takes', (s) => s.click('#section-one', (event) => event.preventDefault())],
  // Two quick links: the second goes back to the address the page has, Next drops the navigation the first asked for, and the router ends where it started and says nothing (the reviewer's case, and c2 in Firefox).
  [
    'two quick row links, the first overtaken by the second',
    (s) => {
      s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
      s.click(PAGE, (event) => (event.preventDefault(), s.router.replace(PAGE)));
      s.discardFirstWrite();
    },
  ],
  // A link whose own handler prevents the default and never navigates.
  ['a row link whose handler prevents the default and never navigates', (s) => s.click(ROW_LINK, (event) => event.preventDefault())],
  // A navigation the router redirects to the address the page had.
  [
    'a row link whose navigation is redirected to the address the page had',
    (s) => {
      // A redirect belongs to a navigation: a link to the address the router is on is no navigation (its `replace` commits nothing), so there is nothing to redirect.
      if (pathSearch(new URL(ROW_LINK, PAGE).href) !== s.screen.path) s.redirect.next = PAGE;
      s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    },
  ],
];

/** The further writers of DL-488 (3) (a): every sequence of up to two of all of them, the core ones included, is walked as well. */
const MORE_WRITERS: ReadonlyArray<readonly [string, (s: Setup) => void]> = [
  // The person presses Forward onto the guard's old entry before the router's write has landed.
  ['a Forward before the router\'s write lands', (s) => s.history.go(1)],
  // The guard's step off whose landing never comes: it ends by itself (STEP_GRACE_MS) and the guard arms and repairs again.
  [
    'a step off whose landing never comes and ends by STEP_GRACE_MS',
    (s) => {
      s.setQueued(true);
      s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
      s.dropQueuedTraversals();
      s.runTimers(STEP_GRACE_MS);
      s.setQueued(false);
    },
  ],
  // The guard's step off whose landing is only late (QLT-845-20): the grace ends first, the landing comes after it, and it must not be read as the person's Back.
  [
    'a step off whose landing comes after STEP_GRACE_MS',
    (s) => {
      s.setQueued(true);
      s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
      s.runTimers(STEP_GRACE_MS);
      s.setQueued(false);
      s.settle();
    },
  ],
  // A link to the address the page is on (QLT-845-19, "a link to the current address"): the router's `replace` of an address it is on commits nothing and says nothing.
  ['a link to the address the page is on', (s) => s.click(s.at() ?? PAGE, (event) => (event.preventDefault(), s.router.replace(s.at() ?? PAGE)))],
  // A write of the router that lands on whatever entry is current, which is the guard's when it is on top. It lands within the step: a write that nobody announced (no link was pressed) and that lands after a keystroke
  // redraws the row for any guard, and the guard cannot hold input for a write it was not told about (see the Dev Record, known limitations).
  [
    'a late write of the router onto the current entry',
    (s) => {
      s.router.replace(ROW_LINK);
      s.flush();
    },
  ],
  // The save of the part that was open before is in flight and never answers: the gate stays dirty, the row on screen does not (the reviewer's trap).
  ['a save of the part that was open, in flight', (s) => s.holdSave()],
  // Two and three quick links, each to a row of its own.
  [
    'two quick row links to rows of their own',
    (s) => {
      s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
      s.click(OTHER_LINK, (event) => (event.preventDefault(), s.router.replace(OTHER_LINK)));
    },
  ],
  [
    'three quick row links',
    (s) => {
      s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
      s.click(OTHER_LINK, (event) => (event.preventDefault(), s.router.replace(OTHER_LINK)));
      s.click(PAGE, (event) => (event.preventDefault(), s.router.replace(PAGE)));
    },
  ],
];

/** What must hold after every step, whatever the order of the listeners and the timing of the router. */
function check(s: Setup, label: string): void {
  expect(s.violations, `${label}: no entry is pushed while the address differs from the row on screen`).toEqual([]);
  expect(s.form.lost, `${label}: nothing typed was dropped by a draw`).toBe(false);
  expect(s.above(), `${label}: at most one entry is above the page's`).toBeLessThanOrEqual(1);
  const idle = s.pendingCommits() === 0 && s.pendingTraversals() === 0;
  // While a deferred write or a traversal is still on its way the entries are in step with what has been committed, not with what is asked for.
  if (idle) expect(pathSearch(s.entries[s.pageIndex] ?? ''), `${label}: the page's own entry carries the row on screen`).toBe(s.screen.path);
  // At idle, something typed means the guard is armed: its entry is on top of the page's own and the person is on it (the class of QLT-845-19).
  if (s.form.typed && idle) expect(s.index(), `${label}: something is typed, so the guard is armed`).toBeGreaterThanOrEqual(2);
}

/**
 * A key the person presses in the row on screen: refused while the form is busy (nothing is accepted and then dropped), and accepted once the router's write has landed. If the form is still busy when everything has
 * landed, the guard's fail-open end of the lock is what the person waits for.
 */
function typeWhenAllowed(s: Setup, label: string): void {
  if (s.type()) return;
  s.flush();
  s.settle();
  if (s.type()) return;
  // Nothing is on its way and the fields are still held: a write that never came. The guard's fail-open end of the hold runs (a link it queued meanwhile is then written, and can itself be redirected or dropped, so
  // this may take a few rounds).
  for (let round = 0; round < 4; round += 1) {
    s.runTimers();
    s.flush();
    s.settle();
    if (s.type()) return;
  }
  expect(s.type(), `${label}: the form accepts input again`).toBe(true);
}

/**
 * The oracle of DL-488 (3) (a), at the state the person reached by typing: Back shows the dialog; "Keep editing" keeps the row on screen, what was typed, and an address that is that row's; a second Back asks again;
 * and "Leave" lands exactly on the page before.
 */
function backOracle(s: Setup, label: string): void {
  const rowBefore = s.screen.path;
  // A row link pressed while the gate is dirty because of another part's save in flight is itself asked about (the dialog of a link, unanswered here): only the asks this Back makes are counted.
  const before = s.asked.length;
  s.history.back();
  s.settle();
  expect(s.asked, `${label}: Back asks once`).toHaveLength(before + 1);
  expect(s.form.lost, `${label}: nothing typed was dropped`).toBe(false);
  expect(s.form.typed, `${label}: what was typed is still there`).toBe(true);
  s.asked[before]?.cancel();
  expect(s.screen.path, `${label}: "Keep editing" keeps the row on screen`).toBe(rowBefore);
  expect(pathSearch(s.at() ?? ''), `${label}: "Keep editing" keeps an address that is the row's`).toBe(rowBefore);
  expect(s.form.typed, `${label}: "Keep editing" keeps the text`).toBe(true);
  s.history.back();
  s.settle();
  expect(s.asked, `${label}: a second Back asks again`).toHaveLength(before + 2);
  s.asked[before + 1]?.proceed();
  s.settle();
  expect(s.at(), `${label}: "Leave" lands on the page before`).toBe(BEFORE);
}

describe('DEF-149 (R1): which links to a place on the page the guard takes', () => {
  const location = { href: PAGE, origin: 'http://portal.test' };
  const click = (href: string) => ({ target: { closest: () => ({ href: new URL(href, PAGE).href, target: '', hasAttribute: () => false }) }, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false });

  it('reads a link with a # on the same path and query, and nothing else', () => {
    expect(fragmentLinkOf(click('#main'), location)).toBe('/estimates/Q-2026-0001#main');
    expect(fragmentLinkOf(click('/estimates/Q-2026-0001#review-calculate'), location)).toBe('/estimates/Q-2026-0001#review-calculate');
    // Another page, another query (a row), the same address with no #, another site: not a place on this page.
    expect(fragmentLinkOf(click('/audit#main'), location)).toBeNull();
    expect(fragmentLinkOf(click('?row=1.2#main'), location)).toBeNull();
    expect(fragmentLinkOf(click('/estimates/Q-2026-0001'), location)).toBeNull();
    expect(fragmentLinkOf(click('https://elsewhere.test/estimates/Q-2026-0001#main'), location)).toBeNull();
  });

  it('leaves a click with a held key or another button to the browser (a new tab)', () => {
    const held = { ...click('#main'), ctrlKey: true };
    expect(fragmentLinkOf(held, location)).toBeNull();
    expect(fragmentLinkOf({ ...click('#main'), button: 1 }, location)).toBeNull();
  });
});

describe('DEF-149 (R1): a link to a place on the page is done with no entry, scroll and focus as the browser does them', () => {
  it('replaces the # of the address, adds no entry, scrolls to the target and gives it the focus; the skip link\'s target (main, which takes no focus by itself) gets a tabindex for as long as it has it', () => {
    const s = setUp();
    s.click('#main');
    expect(s.entries).toEqual([BEFORE, `${PAGE}#main`]);
    const main = page.elements.get('main');
    expect(main?.state.scrolled).toBe(1);
    expect(page.active).toBe(main);
    expect(main?.state.attributes.get('tabindex')).toBe('-1');
    // The tabindex goes when the focus does.
    for (const listener of main?.state.blur ?? []) listener();
    expect(main?.state.attributes.has('tabindex')).toBe(false);
  });

  it('a target that is focusable already (the Recalculate button of the rates-changed link) takes the focus with no tabindex', () => {
    const s = setUp();
    s.click('#review-calculate');
    const button = page.elements.get('review-calculate');
    expect(button?.state.scrolled).toBe(1);
    expect(page.active).toBe(button);
    expect(button?.state.attributes.has('tabindex')).toBe(false);
    expect(s.at()).toBe(`${PAGE}#review-calculate`);
  });

  it('a # that names nothing changes the address and scrolls nothing', () => {
    const s = setUp();
    s.click('#nowhere');
    expect(s.at()).toBe(`${PAGE}#nowhere`);
    expect(s.entries).toHaveLength(2);
    expect(page.active).toBeNull();
  });

  it('it does so on a clean page, with nothing typed and the guard not armed: an entry made then would sit under the guard\'s entry when the person starts to type', () => {
    const s = setUp();
    s.click('#main');
    expect(s.above()).toBe(0);
  });

  it('a link whose own handler took the click (the default prevented) is left to that handler: nothing is scrolled or focused here, and no entry is made', () => {
    const s = setUp();
    s.click('#section-one', (event) => event.preventDefault());
    expect(page.elements.get('section-one')?.state.scrolled).toBe(0);
    expect(s.entries).toEqual([BEFORE, PAGE]);
  });

  it('is off once the guard is removed: the click is the browser\'s', () => {
    const page2 = browser(DEFAULT);
    const handle = installLeaveGuard({ env: page2.env, gate: createSaveGate(), ask: () => undefined, navigate: () => undefined });
    handle.remove();
    page2.click('#main');
    // No guard: the browser pushes its own entry.
    expect(page2.entries).toEqual([BEFORE, PAGE, `${PAGE}#main`]);
  });
});

/** Every order of up to `longest` writers drawn from `list`. */
function sequencesOf(list: ReadonlyArray<unknown>, longest: number): Array<ReadonlyArray<number>> {
  const out: Array<ReadonlyArray<number>> = [];
  for (let length = 1; length <= longest; length += 1) {
    const walk = (so: ReadonlyArray<number>): void => {
      if (so.length === length) {
        out.push(so);
        return;
      }
      for (let writer = 0; writer < list.length; writer += 1) walk([...so, writer]);
    };
    walk([]);
  }
  return out;
}

/**
 * Walks every sequence with the person's first keystroke before it, after each writer, and at the end. After every step the invariants of `check` hold; the keystroke that is refused is tried again once the router's write
 * has landed; and at the end the oracle of DL-488 (3) (a) holds (`backOracle`).
 */
function walk(variant: Variant, list: ReadonlyArray<readonly [string, (s: Setup) => void]>, sequences: ReadonlyArray<ReadonlyArray<number>>): number {
  let checked = 0;
  for (const sequence of sequences) {
    for (let typedAfter = 0; typedAfter <= sequence.length; typedAfter += 1) {
      const s = setUp(variant);
      const names: string[] = [];
      // The order, the timing and the sequence are in the name of a failure, so it can be found again.
      const label = (): string => `[${variant.order}/${variant.timing} ${sequence.join(',')} @${String(typedAfter)}] ${names.join(', then ')}, typing after step ${String(typedAfter)}`;
      // A keystroke, saved at once (the field was left): the guard's entry stays on top, and what is written next meets it. If the form is busy the key is refused and tried again when the write has landed.
      const keystroke = (): void => {
        typeWhenAllowed(s, label());
        s.save();
      };
      try {
        if (typedAfter === 0) keystroke();
        sequence.forEach((writer, step) => {
          const [name, write] = list[writer] ?? list[0] ?? ['', () => undefined];
          names.push(name);
          // A write of the router that was waiting lands before the next writer acts (a keystroke may have come between).
          s.flush();
          s.settle();
          write(s);
          s.settle();
          check(s, `after ${names.join(', then ')}`);
          if (typedAfter === step + 1) {
            keystroke();
            s.settle();
            check(s, `after ${names.join(', then ')} and a keystroke`);
          }
        });
        // The row on screen is typed in: a key is refused while the router's write is owed, and accepted when it has landed.
        typeWhenAllowed(s, label());
        s.flush();
        s.settle();
        check(s, `after ${names.join(', then ')} and typing`);
        backOracle(s, label());
        checked += 1;
      } catch (error) {
        // Which sequence it was is what is needed to find it.
        throw new Error(`${label()}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
  }
  return checked;
}

/** A walk takes 0.5 to 2 s on its own; the default 5 s is too close when the whole suite runs in parallel on a busy machine. It bounds the walk, not what it checks. */
const WALK_TIMEOUT_MS = 30_000;

describe.each(VARIANTS)('DEF-149 (R1), QLT-845-08, QLT-845-19: whatever the page writes, the guard keeps its invariants, nothing is accepted and then dropped, and the way out lands on the page before ($order, router writes $timing)', (variant) => {
  it.each(WRITERS)('%s, alone, then the first keystroke: the oracle holds', (_name, write) => {
    const s = setUp(variant);
    write(s);
    s.flush();
    s.settle();
    typeWhenAllowed(s, 'the writer alone');
    s.flush();
    s.settle();
    check(s, 'after the writer and the keystroke');
    backOracle(s, 'the writer alone');
  });

  const core = sequencesOf(WRITERS, 3);
  it(`${String(core.length)} sequences of up to three writers, the keystroke at every point: the invariants hold after every step, and the oracle at the end`, () => {
    expect(walk(variant, WRITERS, core)).toBeGreaterThan(1000);
  }, WALK_TIMEOUT_MS);

  const all = [...WRITERS, ...MORE_WRITERS];
  const more = sequencesOf(all, 2);
  it.each(MORE_WRITERS)('%s, alone, then the first keystroke: the oracle holds', (_name, write) => {
    const s = setUp(variant);
    write(s);
    s.flush();
    s.settle();
    typeWhenAllowed(s, 'the writer alone');
    s.flush();
    s.settle();
    check(s, 'after the writer and the keystroke');
    backOracle(s, 'the writer alone');
  });
  it(`${String(more.length)} sequences of up to two of all ${String(all.length)} writers, the keystroke at every point: the invariants hold after every step, and the oracle at the end`, () => {
    expect(walk(variant, all, more)).toBeGreaterThan(400);
  }, WALK_TIMEOUT_MS);
});

describe('QLT-845-08, QLT-845-19 (DL-487, DL-488): the cases the end-to-end set reads at the browser', () => {
  const armedAndSaved = (variant: Variant) => {
    const s = setUp(variant);
    s.type();
    s.flush();
    s.save();
    return s;
  };
  const rowLink = (s: Setup, href = ROW_LINK) => s.click(href, (event) => (event.preventDefault(), s.router.replace(href)));

  it('c1: a key pressed straight after a row link, before the router has written it, is refused; once it has, typing is guarded: Back asks, the text is there and the address is the row\'s', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    // The router\'s write has not landed: the fields are inert, so the key is refused, not accepted and then dropped.
    expect(s.pendingCommits()).toBe(1);
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    expect(s.form.typed).toBe(false);
    s.flush();
    expect(s.inert()).toBe(false);
    expect(s.violations).toEqual([]);
    expect(pathSearch(s.at() ?? '')).toBe(pathSearch(new URL(ROW_LINK, PAGE).href));
    expect(s.type()).toBe(true);
    expect(s.index()).toBe(2);
    expect(s.above()).toBe(1);
    backOracle(s, 'c1');
  });

  it('c2: two row links in quick succession (the first step off has not landed) resolve to the last one, and nothing is accepted meanwhile', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'at-once', queued: true });
    rowLink(s);
    rowLink(s, OTHER_LINK);
    expect(s.pendingTraversals()).toBe(1);
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    s.settle();
    s.flush();
    expect(s.screen.path).toBe(pathSearch(new URL(OTHER_LINK, PAGE).href));
    expect(pathSearch(s.entries[s.pageIndex] ?? '')).toBe(s.screen.path);
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    backOracle(s, 'c2');
  });

  it('c2 as Firefox ran it: two row links, the second back to the row the page was opened on: the guard takes the second (DL-488 (ii)), writes it when the first has landed, the router ends where it started, and the guard arms on the first key accepted', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, PAGE);
    expect(s.inert()).toBe(true);
    s.flush();
    expect(s.pendingCommits()).toBe(0);
    expect(s.screen.path).toBe(pathSearch(PAGE));
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    backOracle(s, 'c2 in Firefox');
  });

  it('c2 as Firefox ran it, the first write overtaken and never landing: the router ends where it started and says nothing; the fields are held until the guard\'s fail-open end, and the guard then arms on the first key accepted', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, PAGE);
    s.discardFirstWrite();
    s.flush();
    expect(s.pendingCommits()).toBe(0);
    expect(s.type()).toBe(false);
    s.runTimers();
    s.flush();
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    backOracle(s, 'c2 in Firefox, write dropped');
  });

  it('u2 (the reviewer\'s case): a clean page, never armed; row 1\'s link, then at once the current row\'s: the guard takes the second link (DL-488 (ii)) and writes it once the first has landed, so Next never discards the first; typing is guarded', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, PAGE);
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    s.flush();
    expect(s.screen.path).toBe(pathSearch(PAGE));
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.index()).toBe(2);
    backOracle(s, 'u2');
  });

  it('u2 with the router discarding the first navigation (QLT-845-19 as the reviewer\'s probe had it): the router ends where it started and says nothing, the fields are held until the guard\'s fail-open end, and typing is then guarded', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, PAGE);
    s.discardFirstWrite();
    s.flush();
    expect(s.type()).toBe(false);
    s.runTimers();
    s.flush();
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.index()).toBe(2);
    backOracle(s, 'u2, first navigation discarded');
  });

  it('u3: with the row\'s write held, no key is accepted into the form, and after the write lands typing in the new row is guarded', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    for (let key = 0; key < 20; key += 1) expect(s.type()).toBe(false);
    expect(s.refused()).toBe(20);
    expect(s.form.typed).toBe(false);
    s.flush();
    expect(s.type()).toBe(true);
    backOracle(s, 'u3');
  });

  it('u4 (the trap): the save of the part that was open is in flight and never answers, the row changes (the island rewrite after an add: a row link would first ask about the unsaved save), the new row is typed in: Back asks, the text stays, and Leave lands on the page before', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'after-keystroke' });
    s.holdSave();
    s.history.replaceState(s.history.state, '', '?row=1.3');
    s.flush();
    s.settle();
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(pathSearch(s.entries[s.pageIndex] ?? '')).toBe(s.screen.path);
    backOracle(s, 'u4');
  });

  it('a write that lands on the guard\'s entry is repaired as soon as nothing is unsaved in the row on screen, even while another part\'s save is in flight; nothing can be typed meanwhile', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'at-once' });
    s.holdSave();
    s.router.replace(ROW_LINK);
    expect(pathSearch(s.entries[s.pageIndex] ?? '')).toBe(s.screen.path);
    expect(s.type()).toBe(true);
    backOracle(s, 'late write with a save in flight');
  });

  it('an owed write never blocks arming, and the lock on the fields ends by itself if the write never comes (a link that goes nowhere)', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    s.click(ROW_LINK, (event) => event.preventDefault());
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    // The fail-open end of the lock: the fields accept input again, and the first key arms the guard.
    s.runTimers();
    expect(s.inert()).toBe(false);
    expect(s.type()).toBe(true);
    expect(s.index()).toBe(2);
    backOracle(s, 'a link that goes nowhere');
  });

  it('a Forward before the router\'s write lands: the row on screen is the one the traversal landed on, the guard arms there, and Back asks', () => {
    const s = armedAndSaved({ order: 'guard-first', timing: 'after-keystroke' });
    rowLink(s);
    s.history.go(1);
    s.flush();
    typeWhenAllowed(s, 'forward');
    expect(s.violations).toEqual([]);
    backOracle(s, 'forward before the write');
  });

  it('c3a: a row link, then Back with nothing typed: the page before, with no question', () => {
    const s = armedAndSaved(DEFAULT);
    rowLink(s);
    s.history.back();
    expect(s.asked).toHaveLength(0);
    expect(s.at()).toBe(BEFORE);
  });

  it('QLT-845-20: the step off the guard makes, landing after STEP_GRACE_MS, is not read as a Back: on a clean page nothing leaves, and the guard arms again at the next key', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'at-once' });
    s.setQueued(true);
    rowLink(s);
    // The grace ends with no landing: the link is dropped and nothing is held for ever.
    s.runTimers(STEP_GRACE_MS);
    expect(s.inert()).toBe(false);
    s.setQueued(false);
    // The landing comes now. It is the guard's own step, so the page is not left (the old reading made it a Back and passed it on).
    s.settle();
    expect(s.at()).toBe(PAGE);
    expect(s.asked).toHaveLength(0);
    expect(s.violations).toEqual([]);
    expect(s.type()).toBe(true);
    expect(s.above()).toBe(1);
    backOracle(s, 'a late landing');
  });

  it('c3b: a row link, then Back and Forward with nothing typed: the row of the link is shown and nothing is lost; the old entry that lay ahead is gone', () => {
    const s = armedAndSaved(DEFAULT);
    rowLink(s);
    s.history.back();
    s.history.go(1);
    expect(s.asked).toHaveLength(0);
    expect(s.form.lost).toBe(false);
    expect(s.screen.path).toBe(pathSearch(new URL(ROW_LINK, PAGE).href));
    expect(s.violations).toEqual([]);
  });

  it('the stale forward entry of the guard is harmless: a Forward before any typing shows a row of this page, nothing typed, and the first key after it is guarded', () => {
    const s = armedAndSaved(DEFAULT);
    rowLink(s);
    // The page\'s own entry is the current one; the guard\'s old entry lies ahead with the old row\'s address.
    expect(s.above()).toBe(1);
    s.history.go(1);
    expect(s.form.typed).toBe(false);
    s.history.go(-1);
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
  });

  it('with no guard entry above the page\'s (nothing typed yet), a row link of the page\'s own makes the fields inert until it lands, and the first key after it pushes on the row now shown', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    s.flush();
    expect(s.inert()).toBe(false);
    expect(s.type()).toBe(true);
    expect(s.above()).toBe(1);
    expect(s.violations).toEqual([]);
  });
});
