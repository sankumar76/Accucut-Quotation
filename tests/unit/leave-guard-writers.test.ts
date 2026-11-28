import { describe, expect, it } from 'vitest';

import { fragmentLinkOf, installLeaveGuard, type FragmentTarget, type LeaveEnv } from '@/lib/estimates/leave-guard';
import type { LeaveRequest } from '@/lib/estimates/leave-registry';
import { createSaveGate } from '@/lib/estimates/save-gate';

/**
 * DEF-149 (AQP-506), DL-476 note 8: the guard leaves with `history.go(-2)` and counts on one thing, that **the guard's own entry is the only one above the page's own**. This holds only if every writer of a history
 * entry on the page keeps it: the Lead's row links (the router's `replace`), the island's address rewrite (`replaceState`), the guard's own taking of a link, and a link to a place on the page (`#main`, `#review-calculate`,
 * a section of the form), which a browser answers with an entry of its own unless the guard does it (R1). Each writer is driven here against a model of the browser's history (entries, an index, `pushState` that
 * cuts what lies ahead, `go` that fires `popstate`), alone and in every order of up to three, with the first keystroke at every point of the sequence; then Back and "Leave" must land on the page BEFORE the page.
 * Invented addresses only.
 */

const BEFORE = 'http://portal.test/queue';
const PAGE = 'http://portal.test/estimates/Q-2026-0001';
const PART = '00000000-0000-4000-8000-0000000000d1';

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

function browser() {
  const entries = [BEFORE, PAGE];
  let index = 1;
  const win = new EventTarget();
  const capture: Array<(event: Event) => void> = [];
  const bubble: Array<(event: Event) => void> = [];
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
      // The same address again (the guard passes none), and what lay ahead is cut.
      entries.splice(index + 1);
      entries.push(entries[index] ?? PAGE);
      index += 1;
    },
    replaceState: (_state: unknown, _title: string, url: string) => void (entries[index] = new URL(url, entries[index]).href),
    back: () => void history.go(-1),
    go: (delta: number) => {
      const target = Math.max(0, Math.min(entries.length - 1, index + delta));
      // A step past either end of the history does nothing, and fires no event.
      if (target === index) return;
      index = target;
      win.dispatchEvent(new Event('popstate'));
    },
  };
  const location = {
    get href() {
      return entries[index] ?? PAGE;
    },
    origin: 'http://portal.test',
  };
  const env = { win: Object.assign(win, { location, history, setTimeout: () => undefined }), doc } as unknown as LeaveEnv;

  /** The router's own navigation, as the guard and the page's links reach it: `replace` keeps the entry count, `push` adds one. */
  const router = {
    replace: (href: string) => void (entries[index] = new URL(href, entries[index]).href),
    push: (href: string) => {
      entries.splice(index + 1);
      entries.push(new URL(href, entries[index]).href);
      index += 1;
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

  return { entries, history, env, router, click, at: () => entries[index] };
}

/** One page with the guard on it: the writers and the person's typing and Back. */
function setUp() {
  page.active = null;
  page.elements = new Map([
    ['main', element(false)],
    ['review-calculate', element(true)],
    ['section-one', element(false)],
  ]);
  const model = browser();
  const gate = createSaveGate();
  const asked: LeaveRequest[] = [];
  installLeaveGuard({ env: model.env, gate, ask: (request) => void asked.push(request), navigate: (href, replace) => (replace ? model.router.replace(href) : model.router.push(href)), captureFirst: true });
  const pageIndex = 1;
  return {
    ...model,
    asked,
    pageIndex,
    type: () => gate.mark(PART, 'field-j', true),
    save: () => gate.mark(PART, 'field-j', false),
    /** Entries above the page's own entry. */
    above: () => model.entries.length - 1 - pageIndex,
  };
}

type Setup = ReturnType<typeof setUp>;

/** Every writer of a history entry on the page, as the page does it. */
const WRITERS: ReadonlyArray<readonly [string, (s: Setup) => void]> = [
  // The Lead's row link: a Next link with `replace`; the guard takes it when it is armed (it replaces the guard's entry), and otherwise the page's handler replaces.
  ['a row link', (s) => s.click('/estimates/Q-2026-0001?row=1.2', (event) => (event.preventDefault(), s.router.replace('/estimates/Q-2026-0001?row=1.2')))],
  // The island's rewrite of `?row=` after an add.
  ['the island rewrite', (s) => s.history.replaceState(s.history.state, '', '?row=1.3')],
  // The skip link and the rates-changed link: plain anchors, no handler.
  ['a link to a place on the page with no handler of its own', (s) => s.click('#main')],
  // The section strip, the form's link in the tree and the calculate summary prevent the default and do their own scrolling.
  ['a link to a place on the page that its own handler takes', (s) => s.click('#section-one', (event) => event.preventDefault())],
];

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
    const page2 = browser();
    const handle = installLeaveGuard({ env: page2.env, gate: createSaveGate(), ask: () => undefined, navigate: () => undefined });
    handle.remove();
    page2.click('#main');
    // No guard: the browser pushes its own entry.
    expect(page2.entries).toEqual([BEFORE, PAGE, `${PAGE}#main`]);
  });
});

describe('DEF-149 (R1): whatever the page writes, at most the guard\'s own entry is above the page\'s, and the way out lands on the page before', () => {
  it.each(WRITERS)('%s, alone, then the first keystroke: one entry above the page\'s, and Back with Leave lands on the page before', (_name, write) => {
    const s = setUp();
    write(s);
    s.type();
    expect(s.above()).toBe(1);
    s.history.back();
    expect(s.asked).toHaveLength(1);
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

  it(`${String(sequences.length)} sequences of up to three writers, the keystroke at every point: never more than the guard's entry above the page's, and the way out lands on the page before`, () => {
    let checked = 0;
    for (const sequence of sequences) {
      for (let typedAfter = 0; typedAfter <= sequence.length; typedAfter += 1) {
        const s = setUp();
        const names: string[] = [];
        // The first keystroke, saved at once (the field was left): the guard's entry stays on top, and what is written next meets it.
        if (typedAfter === 0) {
          s.type();
          s.save();
        }
        sequence.forEach((writer, step) => {
          const [name, write] = WRITERS[writer] ?? WRITERS[0] ?? ['', () => undefined];
          names.push(name);
          write(s);
          expect(s.above(), `after ${names.join(', then ')}`).toBeLessThanOrEqual(1);
          if (typedAfter === step + 1) {
            s.type();
            s.save();
          }
        });
        s.type();
        expect(s.above(), `after ${names.join(', then ')} and typing`).toBe(1);
        s.history.back();
        // One question. A handler of the page that rewrites the guard's entry unseen (the island's address rewrite) can leave the guard unsure whether its own step forward has landed, and then it asks once more:
        // the dialog takes a second request in its stride, and the step past the end of the history does nothing, so it is never more than two.
        expect(s.asked.length, `Back asks after ${names.join(', then ')}`).toBeGreaterThanOrEqual(1);
        expect(s.asked.length, `Back asks at most twice after ${names.join(', then ')}`).toBeLessThanOrEqual(2);
        s.asked[s.asked.length - 1]?.proceed();
        expect(s.at(), `the way out after ${names.join(', then ')}, typing after step ${String(typedAfter)}`).toBe(BEFORE);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});
