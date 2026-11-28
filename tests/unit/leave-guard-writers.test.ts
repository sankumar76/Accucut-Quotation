import { describe, expect, it, vi } from 'vitest';

import { fragmentLinkOf, INPUT_HELD_MAX_MS, installLeaveGuard, STEP_GRACE_MS, type FragmentTarget, type LeaveEnv, type LeaveGuardHandle } from '@/lib/estimates/leave-guard';
import type { LeaveRequest } from '@/lib/estimates/leave-registry';
import { proceedAfterRefresh } from '@/lib/estimates/leave-after-refresh';
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
/**
 * The addresses the links of the tree carry. **The real ones end in `#row-inputs`** (`review-tree.tsx`: `?row=<Sl. No>#row-inputs`), so a link back to the row on screen has the same path and query as the page and
 * differs only by that `#` (QLT-845-24); the cases run with that shape and without a `#`. `setUp` sets them for the variant.
 */
const links = { row: '', other: '', page: '' };
const setLinks = (hash: boolean): void => {
  const suffix = hash ? '#row-inputs' : '';
  links.row = `/estimates/Q-2026-0001?row=1.2${suffix}`;
  links.other = `/estimates/Q-2026-0001?row=1.4${suffix}`;
  links.page = `/estimates/Q-2026-0001${suffix}`;
};
setLinks(true);

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
  /** Whether the links of the tree end in `#row-inputs`, as the real ones do (the default), or carry no `#`. */
  readonly hash?: boolean;
  /** Traversals (`go`) are queued and made when the test settles them, so something can happen while one is on its way. */
  readonly queued?: boolean;
}

const VARIANTS: ReadonlyArray<Variant> = [true, false].flatMap((hash) => [
  { order: 'next-first', timing: 'at-once', hash } as const,
  { order: 'guard-first', timing: 'at-once', hash } as const,
  { order: 'next-first', timing: 'after-keystroke', hash } as const,
  { order: 'guard-first', timing: 'after-keystroke', hash } as const,
]);
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

  // The addresses the page was loaded again at (`location.reload`, "Stay on this row"): the model draws nothing of it, the page that loads is a new one.
  const reloads: string[] = [];
  // Every call of the document's location, by name: the guard's button is a `reload()` and nothing else (DL-490 (4) (c)).
  const locationCalls: string[] = [];
  // Every traversal the guard or the test asked for: a repair or a step off is a `go(-1)`.
  const stepsMade: number[] = [];
  // What a `location.replace` of the address that is current does when the address ends in a `#`: a fragment navigation, not a load. Set below, where the history and the listeners are.
  let fragmentNavigation: () => void = () => undefined;
  // The guard says the fields are held, which is a write owed or a step: set by `setUp`, so the model can say a push was made meanwhile.
  const holding = { now: () => false };
  const location = {
    get href() {
      return entries[index] ?? PAGE;
    },
    origin: 'http://portal.test',
    /** A load of the current entry: the end of the document. The model draws nothing more of it. */
    reload: (): void => {
      locationCalls.push('reload');
      reloads.push(entries[index] ?? PAGE);
    },
    /**
     * A replace with an address equal to the current one that has a `#` is a fragment navigation (the document stays, a `popstate` fires with no state); anything else is a load. **The model does not assume that
     * `replace` loads** (DL-490 (4) (a)): that assumption hid QLT-845-29.
     */
    replace: (url: string): void => {
      locationCalls.push('replace');
      const target = new URL(url, entries[index]).href;
      if (target === entries[index] && target.includes('#')) fragmentNavigation();
      else reloads.push(target);
    },
    assign: (): void => void locationCalls.push('assign'),
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
      // No push while a write is owed or a step is on its way (DL-490 (4) (c)): nothing is typed that it could guard, and it would sit where the late write lands.
      if (holding.now()) violations.push('an entry was pushed while the fields were held');
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
      stepsMade.push(delta);
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
  // A write that was asked for and will never land the way it was asked (discarded, redirected, a traversal that never comes, a handler that never navigates): the hold on the fields may then end only by its fail-open end.
  const lost = { any: false };
  const router = {
    replace: (asked: string) => {
      const href = redirect.next ?? asked;
      if (href !== asked) lost.any = true;
      redirect.next = null;
      if (variant.timing === 'at-once') commit(href);
      else {
        // Next discards a navigation that another one overtakes (`app-router-instance.js`): only the last write that is waiting lands, and a link the guard did not take is how one overtakes another.
        deferred.splice(0);
        deferred.push(() => commit(href));
      }
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
    // `getAttribute('href')` is the href as written in the page (`#main` for a link to a place on the page), as in the browser.
    const anchorFacts = { href: absolute, target: '', hasAttribute: () => false, getAttribute: (name: string) => (name === 'href' ? href : null) };
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

  fragmentNavigation = (): void => {
    states[index] = null;
    for (const listener of variant.order === 'next-first' ? popstate : [...popstate].reverse()) listener(new Event('popstate'));
  };

  return {
    entries,
    reloads,
    /**
     * What `location.replace` of the address that is current does when the address ends in a `#` (the old "Stay on this row", QLT-845-29): a fragment navigation, not a load. The entry is replaced by one with no
     * state, and a `popstate` fires for it, with no state; Next ignores it (nothing is drawn). The document stays.
     */
    fragmentReplace: () => fragmentNavigation(),
    /** A script's own `location.replace(location.href)`. */
    scriptReplace: () => location.replace(entries[index] ?? PAGE),
    /** A `popstate` at the same address with Next's own state: the document is where it was. */
    samePopstate: () => {
      for (const listener of variant.order === 'next-first' ? popstate : [...popstate].reverse()) listener(new Event('popstate'));
      signal();
    },
    /** A traversal to an entry of another row of this page (a Forward onto one that lay ahead), and back: made while a write is owed. */
    otherRowAndBack: () => {
      entries.splice(index + 1);
      states.splice(index + 1);
      entries.push(new URL(links.other, entries[index]).href);
      states.push({ __NA: true });
      history.go(1);
      history.go(-1);
    },
    locationCalls: () => [...locationCalls],
    holding,
    /** The traversals asked for so far (`history.go`). */
    stepsMade: () => [...stepsMade],
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
    discardFirstWrite: () => {
      lost.any = true;
      deferred.shift();
    },
    /** A write that was owed and will never come: a handler that prevented the default and never navigated. */
    markLost: () => void (lost.any = true),
    lostWrites: () => lost.any,
    redirect,
    /** The traversals that were queued are made, in order. */
    settle: () => {
      for (let next = traversals.shift(); next !== undefined; next = traversals.shift()) traverse(next);
    },
    pendingTraversals: () => traversals.length,
    /** From now on traversals wait to be settled (or not). */
    setQueued: (queued: boolean) => void (queuedNow = queued),
    /** A traversal whose landing never comes. */
    dropQueuedTraversals: () => {
      lost.any = true;
      traversals.splice(0);
    },
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
  setLinks(variant.hash ?? true);
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
  const state = { inert: false, refused: 0, stuck: false };
  const handle = installLeaveGuard({
    env: model.env,
    gate,
    ask: (request) => void asked.push(request),
    navigate: (href, replace) => (replace ? model.router.replace(href) : model.router.push(href)),
    rowDirty: () => model.form.typed,
    onInputHeld: (held) => void (state.inert = held),
    // DL-489: no fail-open end of the hold; after the time the form says the row is taking long and offers "Stay on this row".
    onHeldTooLong: (tooLong) => void (state.stuck = tooLong),
  });
  model.install(handle);
  model.holding.now = () => state.inert;
  model.hooks.unmounted = () => gate.mark(PART, 'field-j', false);
  const pageIndex = 1;
  return {
    ...model,
    handle,
    gate,
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
    /** The form says the row is taking a while to open and offers "Stay on this row". */
    stuck: () => state.stuck,
    /**
     * The person presses "Stay on this row": the guard asks through the leave check, and with nothing unsaved the request goes through (the page's own `ask` lets it). Answers the addresses the page was loaded
     * again at, the full load that is the answer to the slow read.
     */
    pressStay: (): string[] => {
      const before = asked.length;
      const callsBefore = model.locationCalls().length;
      handle.stayOnThisRow();
      asked[before]?.proceed();
      // The button is `location.reload()` and nothing else: not `replace` (a fragment navigation on a `#row-inputs` address), not `assign` (it adds an entry).
      expect(model.locationCalls().slice(callsBefore), 'the button calls location.reload() and nothing else').toEqual(['reload']);
      return model.reloads;
    },
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
  ['a row link', (s) => s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)))],
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
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
      s.click(links.page, (event) => (event.preventDefault(), s.router.replace(links.page)));
      s.discardFirstWrite();
    },
  ],
  // A link whose own handler prevents the default and never navigates.
  [
    'a row link whose handler prevents the default and never navigates',
    (s) => {
      s.markLost();
      s.click(links.row, (event) => event.preventDefault());
    },
  ],
  // A navigation the router redirects to the address the page had.
  [
    'a row link whose navigation is redirected to the address the page had',
    (s) => {
      // A redirect belongs to a navigation: a link to the address the router is on is no navigation (its `replace` commits nothing), so there is nothing to redirect.
      if (pathSearch(new URL(links.row, PAGE).href) !== s.screen.path) s.redirect.next = PAGE;
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
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
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
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
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
      s.runTimers(STEP_GRACE_MS);
      s.setQueued(false);
      s.settle();
    },
  ],
  // A link to the address the page is on (QLT-845-19, "a link to the current address"): the router's `replace` of an address it is on commits nothing and says nothing.
  ['a link to the address the page is on', (s) => s.click(s.at() ?? PAGE, (event) => (event.preventDefault(), s.router.replace(s.at() ?? PAGE)))],
  // DL-490 (4) (b): while a write is owed, no popstate ends it, settles it, drops what was queued or releases the fields (a null-state one, a same-address one, one with Next's own state, a traversal to another row), and
  // the button on a `#row-inputs` address is a real load. Each runs only where the fields are held: that is where it must end nothing.
  [
    'a null-state popstate at the same address while a write is owed (a script\'s location.replace of the current address with a #)',
    (s) => {
      if (!s.inert()) return;
      const index = s.index();
      s.fragmentReplace();
      expect(s.inert(), 'the hold is not ended by a popstate with no state').toBe(true);
      expect(s.index()).toBe(index);
    },
  ],
  [
    'a same-address popstate with Next\'s own state while a write is owed',
    (s) => {
      if (!s.inert()) return;
      const index = s.index();
      s.samePopstate();
      expect(s.inert(), 'the hold is not ended by a popstate at the same address').toBe(true);
      expect(s.index()).toBe(index);
    },
  ],
  [
    'a traversal to another row of this page and back while a write is owed',
    (s) => {
      if (!s.inert() || s.above() !== 0) return;
      s.otherRowAndBack();
      s.settle();
      expect(s.inert(), 'the hold is not ended by a traversal').toBe(true);
    },
  ],
  [
    'the button pressed on the address a row link wrote (a #row-inputs address) while a write is owed',
    (s) => {
      if (!s.inert()) return;
      s.runTimers();
      expect(s.stuck()).toBe(true);
      s.pressStay();
      expect(s.inert(), 'the hold is not released before the page loads').toBe(true);
    },
  ],
  // DL-489 (3) (vi): a row write that lands after INPUT_HELD_MAX_MS (at 5.001 s, and at 30 s). The time passing releases nothing, arms nothing and repairs nothing: the notice shows while the fields are held, a key
  // is refused, and when the write lands the hold and the notice end. (The reviewer's probe 5 had a key accepted at 5.001 s, the guard arming on the row about to be replaced, and the write landing on its entry.)
  [
    'a row write that lands after INPUT_HELD_MAX_MS (5.001 s)',
    (s) => {
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
      s.runTimers(INPUT_HELD_MAX_MS + 1);
      if (s.inert()) expect(s.type()).toBe(false);
      s.flush();
    },
  ],
  [
    'a row write that lands after 30 s',
    (s) => {
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
      s.runTimers(30_000);
      if (s.inert()) expect(s.type()).toBe(false);
      s.flush();
    },
  ],
  // A write of the router that lands on whatever entry is current, which is the guard's when it is on top. It lands within the step: a write that nobody announced (no link was pressed) and that lands after a keystroke
  // redraws the row for any guard, and the guard cannot hold input for a write it was not told about (see the Dev Record, known limitations).
  [
    'a late write of the router onto the current entry',
    (s) => {
      s.router.replace(links.row);
      s.flush();
    },
  ],
  // The save of the part that was open before is in flight and never answers: the gate stays dirty, the row on screen does not (the reviewer's trap).
  ['a save of the part that was open, in flight', (s) => s.holdSave()],
  // Two and three quick links, each to a row of its own.
  [
    'two quick row links to rows of their own',
    (s) => {
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
      s.click(links.other, (event) => (event.preventDefault(), s.router.replace(links.other)));
    },
  ],
  [
    'three quick row links',
    (s) => {
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
      s.click(links.other, (event) => (event.preventDefault(), s.router.replace(links.other)));
      s.click(links.page, (event) => (event.preventDefault(), s.router.replace(links.page)));
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
  // The hold on the fields ends when the writes have landed, not by its fail-open end: the fail-open end is for a write that never comes (QLT-845-24: a link the guard did not take left the hold for 5 s).
  // The notice with "Stay on this row" is shown only while the fields are held.
  if (s.stuck()) expect(s.inert(), `${label}: the notice shows only while the fields are held`).toBe(true);
  if (idle && !s.lostWrites()) expect(s.inert(), `${label}: the hold ended with the writes`).toBe(false);
  if (s.form.typed && idle) expect(s.index(), `${label}: something is typed, so the guard is armed`).toBeGreaterThanOrEqual(2);
}

/**
 * A key the person presses in the row on screen: refused while the form is busy (nothing is accepted and then dropped), and accepted once the router's write has landed. If the form is still busy when everything has
 * landed, the write never came: there is no fail-open end of the hold (QLT-845-25), the form says the row is taking a while to open, and the person presses "Stay on this row".
 */
function typeWhenAllowed(s: Setup, label: string): boolean {
  if (s.type()) return true;
  s.flush();
  s.settle();
  if (s.type()) return true;
  // Nothing is on its way and the fields are still held: a write that never came. No timer ends the hold, arms or repairs (DL-489). After the time the form says so, nothing is accepted meanwhile, and nothing was armed
  // by the time passing; "Stay on this row" is a full load of the current address, and the hold is not released first. That load replaces the page, so the case ends there.
  const indexBefore = s.index();
  s.runTimers();
  expect(s.stuck(), `${label}: the form says the row is taking a while to open`).toBe(true);
  expect(s.type(), `${label}: still no key is accepted`).toBe(false);
  expect(s.index(), `${label}: the time passing armed nothing and moved nothing`).toBe(indexBefore);
  expect(s.form.typed, `${label}: nothing was typed, so a load loses nothing`).toBe(false);
  const loads = s.pressStay();
  expect(loads.at(-1), `${label}: "Stay on this row" loads the address that is current`).toBe(s.at());
  expect(s.inert(), `${label}: the hold is not released before the page loads`).toBe(true);
  return false;
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
      // The page was loaded again by "Stay on this row": the case ends there, with nothing lost (checked where the button is pressed).
      let loaded = false;
      const keystroke = (): void => {
        if (!typeWhenAllowed(s, label())) {
          loaded = true;
          return;
        }
        s.save();
      };
      try {
        if (typedAfter === 0) keystroke();
        sequence.forEach((writer, step) => {
          if (loaded) return;
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
        if (loaded || !typeWhenAllowed(s, label())) {
          checked += 1;
          continue;
        }
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

/**
 * The 399-sequence walk (1533 runs of a few ms each) takes 1.4 to 2.2 s on its own, in each of the 8 variants, and took 5.2 to 5.4 s when the whole suite ran in parallel on a loaded machine, past the default 5 s
 * (QLT-845-28). 30 s is about 5 times the loaded figure and 14 times the quiet one: it bounds the walk and changes nothing it checks.
 */
const WALK_TIMEOUT_MS = 30_000;

describe.each(VARIANTS)('DEF-149 (R1), QLT-845-08, QLT-845-19: whatever the page writes, the guard keeps its invariants, nothing is accepted and then dropped, and the way out lands on the page before ($order, router writes $timing, links with # $hash)', (variant) => {
  it.each(WRITERS)('%s, alone, then the first keystroke: the oracle holds', (_name, write) => {
    const s = setUp(variant);
    write(s);
    s.flush();
    s.settle();
    if (!typeWhenAllowed(s, 'the writer alone')) return;
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
    if (!typeWhenAllowed(s, 'the writer alone')) return;
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
  const rowLink = (s: Setup, href = links.row) => s.click(href, (event) => (event.preventDefault(), s.router.replace(href)));

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
    expect(pathSearch(s.at() ?? '')).toBe(pathSearch(new URL(links.row, PAGE).href));
    expect(s.type()).toBe(true);
    expect(s.index()).toBe(2);
    expect(s.above()).toBe(1);
    backOracle(s, 'c1');
  });

  it('c2: two row links in quick succession (the first step off has not landed) resolve to the last one, and nothing is accepted meanwhile', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'at-once', queued: true });
    rowLink(s);
    rowLink(s, links.other);
    expect(s.pendingTraversals()).toBe(1);
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    s.settle();
    s.flush();
    expect(s.screen.path).toBe(pathSearch(new URL(links.other, PAGE).href));
    expect(pathSearch(s.entries[s.pageIndex] ?? '')).toBe(s.screen.path);
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    backOracle(s, 'c2');
  });

  it('c2 as Firefox ran it: two row links, the second back to the row the page was opened on: the guard takes the second (DL-488 (ii)), writes it when the first has landed, the router ends where it started, and the guard arms on the first key accepted', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, links.page);
    expect(s.inert()).toBe(true);
    s.flush();
    expect(s.pendingCommits()).toBe(0);
    expect(s.screen.path).toBe(pathSearch(PAGE));
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    backOracle(s, 'c2 in Firefox');
  });

  it('c2 as Firefox ran it, the first write overtaken and never landing: the router ends where it started and says nothing; the fields stay held for as long as it takes, the form says the row is taking a while after 5 s, and "Stay on this row" loads the page again (DL-489)', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, links.page);
    s.discardFirstWrite();
    s.flush();
    expect(s.pendingCommits()).toBe(0);
    expect(s.type()).toBe(false);
    expect(s.stuck()).toBe(false);
    s.runTimers();
    expect(s.stuck()).toBe(true);
    expect(s.type()).toBe(false);
    expect(s.pressStay()).toEqual([s.at()]);
    // The hold is not released first: the page that loads is the answer.
    expect(s.inert()).toBe(true);
    expect(s.form.typed).toBe(false);
  });

  it('u2 (the reviewer\'s case): a clean page, never armed; row 1\'s link, then at once the current row\'s: the guard takes the second link (DL-488 (ii)) and writes it once the first has landed, so Next never discards the first; typing is guarded', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, links.page);
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    s.flush();
    expect(s.screen.path).toBe(pathSearch(PAGE));
    expect(s.type()).toBe(true);
    expect(s.violations).toEqual([]);
    expect(s.index()).toBe(2);
    backOracle(s, 'u2');
  });

  it('u2 with the router discarding the first navigation (QLT-845-19 as the reviewer\'s probe had it): the router ends where it started and says nothing; no timer releases the fields or arms the guard, and "Stay on this row" loads the page again', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    rowLink(s);
    rowLink(s, links.page);
    s.discardFirstWrite();
    s.flush();
    expect(s.type()).toBe(false);
    s.runTimers();
    expect(s.stuck()).toBe(true);
    expect(s.type()).toBe(false);
    // Nothing was armed by the time passing.
    expect(s.index()).toBe(1);
    expect(s.pressStay()).toEqual([s.at()]);
    expect(s.inert()).toBe(true);
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
    s.router.replace(links.row);
    expect(pathSearch(s.entries[s.pageIndex] ?? '')).toBe(s.screen.path);
    expect(s.type()).toBe(true);
    backOracle(s, 'late write with a save in flight');
  });

  it('an owed write never blocks arming, and a write that never comes holds the fields until the person presses "Stay on this row", which loads the page again (a link that goes nowhere)', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    s.markLost();
    s.click(links.row, (event) => event.preventDefault());
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    // No timer ends the hold (DL-489): the form says so after the time, the fields stay held, and nothing is armed.
    expect(s.stuck()).toBe(false);
    s.runTimers();
    expect(s.stuck()).toBe(true);
    expect(s.inert()).toBe(true);
    expect(s.type()).toBe(false);
    expect(s.index()).toBe(1);
    expect(s.pressStay()).toEqual([s.at()]);
    expect(s.inert()).toBe(true);
  });

  it('QLT-845-25 (the reviewer\'s slow-write probe, result turned around): a row write that lands after INPUT_HELD_MAX_MS: the form says so and accepts nothing; when the write lands the hold and the notice end, the guard has pushed nothing on the row about to be replaced, and what is typed next is guarded and never dropped', () => {
    for (const late of [INPUT_HELD_MAX_MS + 1, 30_000]) {
      const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
      s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
      s.runTimers(late);
      expect(s.stuck(), `${String(late)} ms: the notice is shown`).toBe(true);
      for (let key = 0; key < 5; key += 1) expect(s.type(), `${String(late)} ms: no key is accepted`).toBe(false);
      expect(s.form.typed).toBe(false);
      // Nothing was armed on the row that is about to be replaced (the reviewer's probe: a key accepted at 5.001 s armed the guard, and the late write then landed on its entry), and no repair step was made.
      expect(s.index()).toBe(1);
      expect(s.stepsMade(), `${String(late)} ms: no step off, no repair`).toEqual([]);
      expect(s.violations).toEqual([]);
      s.flush();
      expect(s.stuck()).toBe(false);
      expect(s.inert()).toBe(false);
      expect(s.screen.path).toBe(pathSearch(new URL(links.row, PAGE).href));
      expect(s.type()).toBe(true);
      expect(s.index()).toBe(2);
      expect(s.form.lost).toBe(false);
      backOracle(s, `a slow write, landing after ${String(late)} ms`);
    }
  });

  it('QLT-845-25: "Stay on this row" is a full load of the address that is current, through the leave check: it never releases the hold first, adds no entry, and with something typed it is asked about like any other way out', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
    s.runTimers();
    expect(s.stuck()).toBe(true);
    const entriesBefore = s.entries.length;
    expect(s.pressStay()).toEqual([s.at()]);
    expect(s.inert()).toBe(true);
    expect(s.entries).toHaveLength(entriesBefore);
    expect(s.asked.at(-1)?.fullLoad).toBe(true);
  });

  it('QLT-845-29 (the reviewer\'s probe 6, result turned around): a replace of the current address that is only a fragment navigation (a popstate with no state) while a row write is owed ends nothing: the hold and the notice stay, no key is accepted, nothing is armed, and the write that lands later finds an unarmed guard', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    // The address a tree row link wrote earlier ends in `#row-inputs`, which is what makes a replace of it a fragment navigation and not a load.
    s.history.replaceState(s.history.state, '', '#row-inputs');
    s.click(links.row, (event) => (event.preventDefault(), s.router.replace(links.row)));
    s.runTimers();
    expect(s.stuck()).toBe(true);
    // The reviewer's probe 6 at f8c090b6: the old button, `location.replace(location.href)` on a `#row-inputs` address. The model treats it as the fragment navigation it is.
    s.scriptReplace();
    expect(s.reloads).toEqual([]);
    expect(s.stuck()).toBe(true);
    expect(s.inert()).toBe(true);
    for (let key = 0; key < 5; key += 1) expect(s.type()).toBe(false);
    expect(s.index()).toBe(1);
    expect(s.stepsMade()).toEqual([]);
    s.flush();
    expect(s.inert()).toBe(false);
    expect(s.stuck()).toBe(false);
    expect(s.type()).toBe(true);
    expect(s.form.lost).toBe(false);
    backOracle(s, 'a fragment-only replace while a write is owed');
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
    expect(s.screen.path).toBe(pathSearch(new URL(links.row, PAGE).href));
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

describe('QLT-845-23 (DL-491): a refresh of the page in flight when "Leave" is chosen', () => {
  it('the way out waits for the refresh to end, and then lands exactly on the page before', async () => {
    const s = setUp({ order: 'next-first', timing: 'at-once' });
    expect(s.type()).toBe(true);
    // The review's refresh (`router.refresh()`) is in flight: its fetch is what a traversal would cut in the middle.
    s.gate.setRefreshing(true);
    s.history.back();
    s.settle();
    expect(s.asked).toHaveLength(1);
    const leaving = proceedAfterRefresh(s.gate, () => s.asked[0]?.proceed(), STEP_GRACE_MS);
    await Promise.resolve();
    expect(s.stepsMade(), 'no traversal is made while the refresh is in flight').not.toContain(-2);
    s.gate.setRefreshing(false);
    await leaving;
    s.settle();
    expect(s.stepsMade()).toContain(-2);
    expect(s.at(), '"Leave" lands on the page before').toBe(BEFORE);
  });

  it('a refresh that does not end holds the way out only for STEP_GRACE_MS (no new budget), and the way out then goes ahead', async () => {
    vi.useFakeTimers();
    try {
      const s = setUp({ order: 'next-first', timing: 'at-once' });
      expect(s.type()).toBe(true);
      s.gate.setRefreshing(true);
      s.history.back();
      s.settle();
      const waiting: boolean[] = [];
      const leaving = proceedAfterRefresh(s.gate, () => s.asked[0]?.proceed(), STEP_GRACE_MS, (now) => void waiting.push(now));
      await vi.advanceTimersByTimeAsync(STEP_GRACE_MS - 1);
      expect(s.stepsMade()).not.toContain(-2);
      expect(waiting).toEqual([true]);
      await vi.advanceTimersByTimeAsync(1);
      await leaving;
      s.settle();
      expect(waiting).toEqual([true, false]);
      expect(s.at()).toBe(BEFORE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('with no refresh in flight the way out goes ahead at once, with no wait and no busy state', async () => {
    const s = setUp({ order: 'next-first', timing: 'at-once' });
    expect(s.type()).toBe(true);
    s.history.back();
    s.settle();
    const waiting: boolean[] = [];
    await proceedAfterRefresh(s.gate, () => s.asked[0]?.proceed(), STEP_GRACE_MS, (now) => void waiting.push(now));
    s.settle();
    expect(waiting).toEqual([]);
    expect(s.at()).toBe(BEFORE);
  });
});
