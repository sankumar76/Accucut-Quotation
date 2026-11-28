import { describe, expect, it } from 'vitest';

import { fragmentLinkOf, installLeaveGuard, type FragmentTarget, type LeaveEnv, type LeaveGuardHandle } from '@/lib/estimates/leave-guard';
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
  let index = 1;
  const popstate: Array<(event: Event) => void> = [];
  const capture: Array<(event: Event) => void> = [];
  const bubble: Array<(event: Event) => void> = [];
  const timers: Array<() => void> = [];
  const traversals: number[] = [];
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

  /** The router has committed an address: the component of the guard tells it (`useEffect` on the router's path and query). */
  const signal = (): void => (guard as { committed?: () => void } | undefined)?.committed?.();

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
    setTimeout: (handler: () => void) => void timers.push(handler),
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
    state: { __NA: true },
    pushState: () => {
      // The guard pushes an entry only on top of an entry whose address is the row on screen (DL-487 (2) (i)).
      if (pathSearch(entries[index] ?? PAGE) !== screen.path) violations.push(`pushed on ${entries[index] ?? ''} while ${screen.path} is on screen`);
      // The same address again (the guard passes none), and what lay ahead is cut.
      entries.splice(index + 1);
      entries.push(entries[index] ?? PAGE);
      index += 1;
    },
    replaceState: (_state: unknown, _title: string, url: string) => {
      entries[index] = new URL(url, entries[index]).href;
      // Next's patched `replaceState` hands the address to the router, which commits it when it changes the path or the query.
      if (pathSearch(entries[index] ?? PAGE) !== screen.path) {
        draw(false);
        signal();
      }
    },
    back: () => void history.go(-1),
    go: (delta: number) => {
      if (variant.queued === true) traversals.push(delta);
      else traverse(delta);
    },
  };
  win.history = history;
  const env = { win, doc } as unknown as LeaveEnv;

  /** The router's commit of an address: its `replaceState` lands on whatever entry is current then. */
  const commit = (href: string): void => {
    entries[index] = new URL(href, entries[index]).href;
    draw(false);
    signal();
  };
  /** The router's own navigation, as the guard and the page's links reach it: `replace` keeps the entry count (its commit lands now or after the next keystroke), `push` adds one. */
  const router = {
    replace: (href: string) => {
      if (variant.timing === 'at-once') commit(href);
      else deferred.push(() => commit(href));
    },
    push: (href: string) => {
      entries.splice(index + 1);
      entries.push(new URL(href, entries[index]).href);
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
      history.pushState();
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
      for (const land of deferred.splice(0)) land();
    },
    pendingCommits: () => deferred.length,
    /** The traversals that were queued are made, in order. */
    settle: () => {
      for (let next = traversals.shift(); next !== undefined; next = traversals.shift()) traverse(next);
    },
    pendingTraversals: () => traversals.length,
    runTimers: () => timers.splice(0).forEach((timer) => timer()),
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
  const handle = installLeaveGuard({
    env: model.env,
    gate,
    ask: (request) => void asked.push(request),
    navigate: (href, replace) => (replace ? model.router.replace(href) : model.router.push(href)),
  });
  model.install(handle);
  model.hooks.unmounted = () => gate.mark(PART, 'field-j', false);
  const pageIndex = 1;
  return {
    ...model,
    handle,
    asked,
    pageIndex,
    type: () => {
      model.form.typed = true;
      gate.mark(PART, 'field-j', true);
    },
    save: () => {
      model.form.typed = false;
      gate.mark(PART, 'field-j', false);
    },
    /** Entries above the page's own entry. */
    above: () => model.entries.length - 1 - pageIndex,
  };
}

type Setup = ReturnType<typeof setUp>;

/** Every writer of a history entry on the page, as the page does it. */
const WRITERS: ReadonlyArray<readonly [string, (s: Setup) => void]> = [
  // The Lead's row link: a Next link with `replace`; the guard takes it when it is armed (it steps off its entry and then replaces the page's own), and otherwise the page's handler replaces.
  ['a row link', (s) => s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)))],
  // The island's rewrite of `?row=` after an add.
  ['the island rewrite', (s) => s.history.replaceState(s.history.state, '', '?row=1.3')],
  // The skip link and the rates-changed link: plain anchors, no handler.
  ['a link to a place on the page with no handler of its own', (s) => s.click('#main')],
  // The section strip, the form's link in the tree and the calculate summary prevent the default and do their own scrolling.
  ['a link to a place on the page that its own handler takes', (s) => s.click('#section-one', (event) => event.preventDefault())],
];

/** What must hold after every step, whatever the order of the listeners and the timing of the router. */
function check(s: Setup, label: string): void {
  expect(s.violations, `${label}: no entry is pushed while the address differs from the row on screen`).toEqual([]);
  expect(s.form.lost, `${label}: nothing typed was dropped by a draw`).toBe(false);
  expect(s.above(), `${label}: at most one entry is above the page's`).toBeLessThanOrEqual(1);
  // While a deferred write or a traversal is still on its way the entries are in step with what has been committed, not with what is asked for.
  if (s.pendingCommits() === 0 && s.pendingTraversals() === 0) expect(pathSearch(s.entries[s.pageIndex] ?? ''), `${label}: the page's own entry carries the row on screen`).toBe(s.screen.path);
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

describe.each(VARIANTS)('DEF-149 (R1), QLT-845-08: whatever the page writes, the guard keeps its two invariants and the way out lands on the page before ($order, router writes $timing)', (variant) => {
  it.each(WRITERS)('%s, alone, then the first keystroke: one entry above the page\'s, and Back with Leave lands on the page before', (_name, write) => {
    const s = setUp(variant);
    write(s);
    s.flush();
    s.settle();
    s.type();
    s.flush();
    s.settle();
    check(s, 'after the writer and the keystroke');
    expect(s.above()).toBe(1);
    s.history.back();
    expect(s.asked).toHaveLength(1);
    expect(s.form.typed).toBe(true);
    s.asked[0]?.proceed();
    expect(s.at()).toBe(BEFORE);
  });

  // Every order of up to three writers, with the first keystroke before the sequence, after each writer, and at the end.
  const sequences: Array<ReadonlyArray<number>> = [];
  for (let length = 1; length <= 3; length += 1) {
    const walk = (so: ReadonlyArray<number>): void => {
      if (so.length === length) {
        sequences.push(so);
        return;
      }
      for (let writer = 0; writer < WRITERS.length; writer += 1) walk([...so, writer]);
    };
    walk([]);
  }

  it(`${String(sequences.length)} sequences of up to three writers, the keystroke at every point: after every step no push on a stale address, the page's entry carries the row on screen, at most one entry above it, nothing typed dropped; and Back asks once and Leave lands on the page before`, () => {
    let checked = 0;
    for (const sequence of sequences) {
      for (let typedAfter = 0; typedAfter <= sequence.length; typedAfter += 1) {
        const s = setUp(variant);
        const names: string[] = [];
        // A keystroke, saved at once (the field was left): the guard's entry stays on top, and what is written next meets it. A router write that was deferred lands after it.
        const keystroke = (): void => {
          s.type();
          s.flush();
          s.save();
        };
        if (typedAfter === 0) keystroke();
        sequence.forEach((writer, step) => {
          const [name, write] = WRITERS[writer] ?? WRITERS[0] ?? ['', () => undefined];
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
        // A keystroke before a router write that is still waiting (the old row's box), and another after it has landed (the row now on screen's).
        s.type();
        s.flush();
        s.settle();
        s.type();
        // The router's write lands in milliseconds: it is not a thing a press of Back can come before.
        s.flush();
        s.settle();
        check(s, `after ${names.join(', then ')} and typing`);
        s.history.back();
        s.settle();
        const label = `${names.join(', then ')}, typing after step ${String(typedAfter)}`;
        // QLT-845-13: exactly one question, and what was typed is still there (QLT-845-08).
        expect(s.asked, `Back asks once after ${label}`).toHaveLength(1);
        expect(s.form.lost, `nothing typed was dropped after ${label}`).toBe(false);
        expect(s.form.typed, `what was typed is still there after ${label}`).toBe(true);
        s.asked[0]?.proceed();
        s.settle();
        expect(s.at(), `the way out after ${label}`).toBe(BEFORE);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe('QLT-845-08 (DL-487): the cases the end-to-end set reads at the browser', () => {
  const armedAndSaved = (variant: Variant) => {
    const s = setUp(variant);
    s.type();
    s.flush();
    s.save();
    return s;
  };

  it('c1: typing straight after a row link, before the router has committed it, pushes nothing until it has; typing in the row that is then on screen is guarded: Back asks, the text is there and the address is the row at that time', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'after-keystroke' });
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    s.type();
    // The router's write has not landed: the address is still the old row's, the guard waits, and the guard's old entry still lies ahead.
    expect(s.pendingCommits()).toBe(1);
    expect(s.index()).toBe(1);
    s.flush();
    expect(s.violations).toEqual([]);
    expect(pathSearch(s.at() ?? '')).toBe(pathSearch(new URL(ROW_LINK, PAGE).href));
    // The row now on screen is typed in (the old row's form went with its marks).
    s.type();
    expect(s.index()).toBe(2);
    expect(s.above()).toBe(1);
    s.history.back();
    expect(s.asked).toHaveLength(1);
    expect(s.form).toEqual({ typed: true, lost: false });
    s.asked[0]?.cancel();
    // "Keep editing": the same row, the same address, the same entries.
    expect(s.screen.path).toBe(pathSearch(new URL(ROW_LINK, PAGE).href));
    expect(pathSearch(s.at() ?? '')).toBe(s.screen.path);
    expect(s.entries).toHaveLength(3);
    s.asked[0]?.proceed();
    expect(s.at()).toBe(BEFORE);
  });

  it('c2: two row links in quick succession (the first step off has not landed) resolve to the last one', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'at-once', queued: true });
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    s.click('/estimates/Q-2026-0001?row=1.3', (event) => (event.preventDefault(), s.router.replace('/estimates/Q-2026-0001?row=1.3')));
    expect(s.pendingTraversals()).toBe(1);
    s.settle();
    s.flush();
    expect(s.screen.path).toBe('/estimates/Q-2026-0001?row=1.3');
    expect(pathSearch(s.entries[s.pageIndex] ?? '')).toBe(s.screen.path);
    s.type();
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    s.history.back();
    s.settle();
    expect(s.asked).toHaveLength(1);
    s.asked[0]?.proceed();
    s.settle();
    expect(s.at()).toBe(BEFORE);
  });

  it('a keystroke while the guard\'s own step off is still on its way pushes nothing; it is pushed when the router has committed the new row', () => {
    const s = armedAndSaved({ order: 'next-first', timing: 'at-once', queued: true });
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    s.type();
    expect(s.pendingTraversals()).toBe(1);
    expect(s.violations).toEqual([]);
    s.settle();
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    expect(s.form.lost).toBe(false);
  });

  it('c3a: a row link, then Back with nothing typed: the page before, with no question', () => {
    const s = armedAndSaved(DEFAULT);
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    s.history.back();
    expect(s.asked).toHaveLength(0);
    expect(s.at()).toBe(BEFORE);
  });

  it('c3b: a row link, then Back and Forward with nothing typed: the row of the link is shown and nothing is lost; the old entry that lay ahead is gone', () => {
    const s = armedAndSaved(DEFAULT);
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    s.history.back();
    s.history.go(1);
    expect(s.asked).toHaveLength(0);
    expect(s.form.lost).toBe(false);
    expect(s.screen.path).toBe(pathSearch(new URL(ROW_LINK, PAGE).href));
    expect(s.violations).toEqual([]);
  });

  it('the stale forward entry of the guard is harmless: a Forward before any typing shows a row of this page, nothing typed, and the first keystroke after it pushes on a matching address', () => {
    const s = armedAndSaved(DEFAULT);
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    // The page\'s own entry is the current one; the guard\'s old entry lies ahead with the old row\'s address.
    expect(s.above()).toBe(1);
    s.history.go(1);
    expect(s.form.typed).toBe(false);
    s.history.go(-1);
    s.type();
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
  });

  it('a router that commits the stale entry address after the guard step off (Next own restore) does not open the arm on it: the guard pushes only after the commit of the row asked for', () => {
    const s = armedAndSaved({ order: 'guard-first', timing: 'after-keystroke' });
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    // The restore commit of the page's own entry has been signalled already (a traversal ends with it); the new row is still to be written.
    s.type();
    expect(s.violations).toEqual([]);
    expect(s.index()).toBe(1);
    s.flush();
    s.type();
    expect(s.violations).toEqual([]);
    expect(s.index()).toBe(2);
  });

  it('a row link of the page own (nothing typed yet, so the guard is not armed) whose write has not landed when the first keystroke comes: the push is on a matching address, and when the write lands on the guard entry the page own entry is given the row address once the old row text has gone with its form', () => {
    const s = setUp({ order: 'next-first', timing: 'after-keystroke' });
    s.click(ROW_LINK, (event) => (event.preventDefault(), s.router.replace(ROW_LINK)));
    s.type();
    expect(s.violations).toEqual([]);
    s.flush();
    // The old row's form went with its marks; the guard stepped off and asked the router to write the row onto the page's own entry.
    s.flush();
    expect(s.violations).toEqual([]);
    expect(pathSearch(s.entries[s.pageIndex] ?? '')).toBe(s.screen.path);
    s.type();
    expect(s.violations).toEqual([]);
    expect(s.above()).toBe(1);
    s.history.back();
    expect(s.asked).toHaveLength(1);
    expect(s.form).toEqual({ typed: true, lost: false });
    s.asked[0]?.proceed();
    expect(s.at()).toBe(BEFORE);
  });
});
