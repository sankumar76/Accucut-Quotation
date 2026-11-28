import type { LeaveRequest } from './leave-registry';
import type { SaveGate } from './save-gate';

/**
 * The listeners that stop typing being lost when the person leaves the estimate page (STORY-05.08 AC-4), apart from React so each can be tried with a plain event target. What leaves the page, and
 * what the guard does about each:
 *
 * - **A closed tab, a reload, a link to another site:** the browser's own prompt (`beforeunload`). The text of that prompt is the browser's; nothing can change it.
 * - **A link inside the portal:** the click is stopped in the capture phase, before Next.js's link sees it, and the person is asked; if they go, `navigate` takes them there. While the extra history entry
 *   below is on top, the link **replaces** it (also on a clean page), so the history is not left with two entries of the same address.
 * - **A link to another place on this page (`#main`, `#review-calculate`, a section of the form):** the browser pushes a history entry of its own for it, and an entry stacked on the page's own one is one more than the
 *   guard's `go(-2)` counts (DEF-149). While the guard is installed, whatever the state of the page, it takes such a click when no handler of the page has: it replaces the `#` of the address (no entry) and moves scroll and
 *   focus to the target as the browser would. A link whose own handler already took the click (it prevented the default, as the form's section strip and the calculate summary do) is left alone: it pushes nothing.
 * - **The back button:** a browser does not let a page cancel it, so while something is unsaved the guard puts one extra entry of the same address on top of the history. Back then lands on the page's
 *   own entry and the guard asks; the entry is put back at once, so Back asks again. When nothing is unsaved by then, the same press is passed on, so a person who saved is not made to press Back twice. This needs
 *   `history.state` to be Next.js's own entry, which it is on every page the router drew. **The page's own entry must have the address of the row on screen**, or Next's router would draw another row on that Back and
 *   unmount the one being typed in (QLT-845-08): a link to another row of the page, pressed while the guard's entry is on top, steps off that entry (`go(-1)`), has the router `replace` the page's own entry, and the next
 *   keystroke pushes a fresh guard entry, and only when the current address is the row on screen's (DL-487). Nothing in this depends on which `popstate` listener runs first.
 * - **A row write the router owes (DL-488):** a link to another row that the page itself took (the guard was not armed) leaves a write in flight that says nothing when it ends where it started, is overtaken or is
 *   redirected. The guard therefore never waits for it: it arms at the first key accepted, and repairs the page's own entry if the write lands on its entry. While a write is owed it takes every link to another row
 *   itself and writes the last one, one write at a time; it makes no step off its entry and no `#` write meanwhile; and it tells the form (`onInputHeld`) to hold its fields, so a key is refused and never accepted and
 *   then dropped with the row that is replaced.
 *
 * What it cannot catch, and says so: a jump over several history entries from the browser's history menu, which no page can intercept. The prompt on tab close still covers a close.
 */

type Listener = (event: Event) => void;

interface Target {
  readonly addEventListener: (type: string, listener: Listener, options?: boolean) => void;
  readonly removeEventListener: (type: string, listener: Listener, options?: boolean) => void;
}

export interface LeaveEnv {
  readonly win: Target & {
    readonly location: { readonly href: string; readonly origin: string; readonly replace?: (url: string) => void };
    readonly history: {
      readonly state: unknown;
      readonly pushState: (state: unknown, title: string) => void;
      readonly replaceState: (state: unknown, title: string, url: string) => void;
      readonly back: () => void;
      readonly go: (delta: number) => void;
    };
    readonly setTimeout: (handler: () => void, ms: number) => unknown;
  };
  readonly doc: Target & {
    /** The element a `#` names, or null. */
    readonly getElementById: (id: string) => FragmentTarget | null;
    /** The element with the focus now. */
    readonly activeElement: unknown;
  };
}

/** What a jump to a `#` does with its target: scroll to it and give it the focus, as the browser does for a link to a place on the page. */
export interface FragmentTarget {
  readonly scrollIntoView: () => void;
  readonly focus: (options: { readonly preventScroll: boolean }) => void;
  readonly setAttribute: (name: string, value: string) => void;
  readonly removeAttribute: (name: string) => void;
  readonly addEventListener: (type: string, listener: () => void, options: { readonly once: boolean }) => void;
}

export interface LeaveGuardOptions {
  readonly env: LeaveEnv;
  readonly gate: SaveGate;
  /** Asks the person, or lets them go at once when nothing turns out to be unsaved. */
  readonly ask: (request: LeaveRequest) => void;
  /** Takes the person to a link inside the portal: the router's `push`, or its `replace` when the guard's extra history entry is on top, so that entry is not left behind. */
  readonly navigate: (href: string, replace: boolean) => void;
  /**
   * Whether anything is unsaved IN THE ROW ON SCREEN (DL-488 (iii)): the repair of the page's own entry waits for this and for nothing else, so a save of another part that is in flight, or failed, does not keep it from
   * running. Left out, it is `gate.isDirty()`.
   */
  readonly rowDirty?: () => boolean;
  /**
   * Told when the form's fields must not accept input (from a link to another row being taken until its write has committed, and while a repair step is in flight) and when they may again (DL-488 (iv)). The page
   * shows it with the form's own read-only state; it is not the `inert` attribute and not `disabled`.
   */
  readonly onInputHeld?: (held: boolean) => void;
  /**
   * Told when a write of the router has been owed for `INPUT_HELD_MAX_MS` and the fields are still held, and again when the hold ends (DL-489). There is no time-out that lets a key into the row meanwhile: the page says
   * the row is taking a while to open and offers "Reload the page" (`stayOnThisRow` on the handle).
   */
  readonly onHeldTooLong?: (tooLong: boolean) => void;
}

/** How long the page lets a full load through after the person chose to sign out: long enough for the request, short enough that a failed one leaves the page guarded again. */
export const FULL_LOAD_GRACE_MS = 5_000;

/**
 * How long the guard waits for its own step off its entry to land (DL-487 (2) (ii)). The step is matched on the address it lands on; this only ends the wait if its event never comes, so a later press of the person's is
 * never taken for the guard's own. It does not move the page: the link that asked for the step is dropped and the page stays as it is. Nothing the guard does to the history waits on a timer.
 */
export const STEP_GRACE_MS = 1_000;

/**
 * How long a write of the router may be owed before the page says so (DL-489, QLT-845-25). **Nothing is released, armed or repaired by the time passing**: a key let in after any time would be typed into a row that the late
 * write then replaces. The hold ends only on an event (the write lands, the router writes another address, a traversal, the guard's next link, the page is left). A write that never comes (dropped, redirected to where the page
 * is, never asked for) says nothing to the guard, so the way out is the person's, "Reload the page" (`stayOnThisRow`). 5 s is longer than a row's read on a slow phone.
 */
export const INPUT_HELD_MAX_MS = 5_000;

/**
 * The mark the guard puts in the `history.state` of its own entry, with the address of the page's own entry below it. A traversal that lands on an entry with it (Forward onto the guard's old entry, which lies ahead
 * after a step off) tells the guard it is above the page's own entry again, which no address can: the two share one until the router has written the row's. A write of the router replaces the state and takes the mark
 * with it; the guard then goes by the addresses alone, as before.
 */
const GUARD_MARK = 'leaveGuardEntryAbove';

function markOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const mark: unknown = Reflect.get(state, GUARD_MARK);
  return typeof mark === 'string' ? mark : null;
}

interface ClickFacts {
  readonly target: unknown;
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

interface AnchorFacts {
  readonly href: string;
  readonly target: string;
  readonly hasAttribute: (name: string) => boolean;
  /** The attribute as written in the page (`href` is the address it resolves to). An element has it; a plain object of a test may not. */
  readonly getAttribute?: (name: string) => string | null;
}

function isAnchor(value: unknown): value is AnchorFacts {
  return (
    typeof value === 'object' &&
    value !== null &&
    'href' in value &&
    typeof value.href === 'string' &&
    'target' in value &&
    typeof value.target === 'string' &&
    'hasAttribute' in value &&
    typeof value.hasAttribute === 'function'
  );
}

/** The link a click happened in, or null: the target is read as what it is (an element has `closest`), never assumed. */
function anchorOf(target: unknown): AnchorFacts | null {
  if (typeof target !== 'object' || target === null || !('closest' in target) || typeof target.closest !== 'function') return null;
  const found: unknown = target.closest('a[href]');
  return isAnchor(found) ? found : null;
}

/**
 * Whether the link is written as a jump to a place on this page: its `href` as written starts with a `#` (the skip link, the rates-changed notice, the section strip, the Calculate summary). The tree's row links are
 * written with the whole address, `?row=<Sl. No>#row-inputs`, so a link back to the row on screen has the same path and query as the page and a `#`, and is still a link to a row (QLT-845-24). Null when the link cannot say.
 */
function writtenAsPlaceOnPage(target: unknown): boolean | null {
  const anchor = anchorOf(target);
  if (anchor === null || typeof anchor.getAttribute !== 'function') return null;
  const written = anchor.getAttribute('href');
  return written === null ? null : written.startsWith('#');
}

/** What a click event says, read without assuming it is a mouse event: anything that is not a left click reads as button -1 and so never leaves. */
function clickFactsOf(event: Event): ClickFacts {
  const flag = (name: string): boolean => name in event && Reflect.get(event, name) === true;
  const button: unknown = 'button' in event ? event.button : -1;
  return { target: event.target, button: typeof button === 'number' ? button : -1, metaKey: flag('metaKey'), ctrlKey: flag('ctrlKey'), shiftKey: flag('shiftKey'), altKey: flag('altKey') };
}

/**
 * The address inside the portal that a click would take the person to, or null for a click that does not leave this page: another mouse button or a held key (a new tab), a link that opens elsewhere
 * or downloads, another site, the same address, or only a different `#`.
 */
export function leavingLinkOf(click: ClickFacts, location: { readonly href: string; readonly origin: string }): string | null {
  const link = plainLinkOf(click, location);
  if (link === null) return null;
  const { to, here } = link;
  if (to.origin !== location.origin || (to.pathname === here.pathname && to.search === here.search)) return null;
  return `${to.pathname}${to.search}${to.hash}`;
}

/** The address (path, query and `#`) of a plain click on a link to another place on THIS page: the same path and query, with a `#`. Null for anything else, including a link to the same address with no `#`. */
export function fragmentLinkOf(click: ClickFacts, location: { readonly href: string; readonly origin: string }): string | null {
  const link = plainLinkOf(click, location);
  if (link === null) return null;
  const { to, here } = link;
  if (to.origin !== location.origin || to.pathname !== here.pathname || to.search !== here.search || to.hash === '') return null;
  return `${to.pathname}${to.search}${to.hash}`;
}

/** A left click, with no key held, on a link that opens in this frame and does not download: the link's address and the page's, or null. */
function plainLinkOf(click: ClickFacts, location: { readonly href: string; readonly origin: string }): { readonly to: URL; readonly here: URL } | null {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  const anchor = anchorOf(click.target);
  if (anchor === null || anchor.hasAttribute('download') || (anchor.target !== '' && anchor.target !== '_self')) return null;
  try {
    return { to: new URL(anchor.href, location.href), here: new URL(location.href) };
  } catch {
    return null;
  }
}

export interface LeaveGuardHandle {
  /** Takes the guard off the page. */
  readonly remove: () => void;
  /**
   * "Reload the page" (DL-492): a full load of the row that is being opened, the address of the write in flight with its `#` (`location.replace`, never `reload` or `assign`). Any unload cancels the held read, and Next
   * then falls back to a hard navigation to that same address, so whichever navigation wins the person ends on that row after one load; no framework behaviour is relied on. That address differs from the current one in path
   * or query, so it is always a real load (`replace` of the current address with a `#` is a fragment navigation, QLT-845-29). It goes through the leave check like any other way out; the hold on the fields is not released first.
   */
  readonly stayOnThisRow: () => void;
  /** Lets one full page load through, for a person who has just chosen to sign out: the browser's own prompt would be a second question. It lapses after `FULL_LOAD_GRACE_MS`, so a sign-out that fails leaves the page guarded again. */
  readonly allowFullLoad: () => void;
  /** The router has committed an address: called from an effect on its path and query (`leave-guard.tsx`). The guard learns which row is on screen, and pushes its entry only when the current address is that row's. */
  readonly committed: () => void;
}

/** Puts the guard on the page. */
export function installLeaveGuard({ env, gate, ask, navigate, rowDirty = () => gate.isDirty(), onInputHeld = () => undefined, onHeldTooLong = () => undefined }: LeaveGuardOptions): LeaveGuardHandle {
  const { win, doc } = env;
  // The path of this page: the guard acts only on addresses of it.
  const pagePath = new URL(win.location.href).pathname;
  const pathSearchOf = (href: string): string => {
    const url = new URL(href, win.location.href);
    return url.pathname + url.search;
  };
  const onThisPage = (): boolean => new URL(win.location.href).pathname === pagePath;
  // The row on screen, as the path and query of its address: what the router committed last (`committed()`), or the address a traversal landed on. A `#` is not part of it.
  let shown = pathSearchOf(win.location.href);
  // The address of the page's OWN entry while the guard's entry is on top of it; null while there is none.
  let armedFor: string | null = null;
  // The address of the page's own entry as the guard last saw it while it was the current one: what a landing on a guard entry (marked) says is below it.
  let knownPage = win.location.href;
  // The guard's step off its entry onto the page's own, made when a link to another row is pressed while the guard is armed (DL-487), or to repair a page entry that has another row's address: where it must land, and the
  // address to give the page's own entry from there.
  let step: { target: string; readonly landing: string } | null = null;
  // A step whose landing did not come in `STEP_GRACE_MS`: where it would land, kept until the next `popstate`, so that a landing that is only late is not taken for the person's Back (QLT-845-20).
  let late: { readonly landing: string } | null = null;
  // The path and query the guard's own step off has just landed on, until the page's effect has told the guard about it (`committed`): that is not the router answering the write that was asked for after it.
  let justLanded: string | null = null;
  // A traversal was made while a write was owed (DL-490 (3)): a commit of another address that follows it is the traversal's draw, not the write's answer, so it is not read as a redirect.
  let traversedDuringHold = false;
  // The path and query of the row the router has been asked for, a write it has not committed yet: ONE at a time (DL-488 follow-up: two router writes in flight overlap, and a traversal made while one is in flight is
  // what Next answers with a fall back to a full load in WebKit). A link pressed meanwhile only changes `queued`, and is written when the first has settled. Neither blocks the guard from arming (DL-488 (i)); they hold the
  // form's fields for as long as they are set, so nothing can be typed into a row that is about to be replaced.
  let inFlight: string | null = null;
  let queued: string | null = null;
  // The address, as the link carried it (with its `#`), of the write in flight: what "Reload the page" loads (DL-492).
  let inFlightHref: string | null = null;
  let inFlightMarker: object | null = null;
  // A link to a place on the page, pressed while a write is owed: the guard makes no history write then, and does it when the write has settled.
  let fragmentWaiting: string | null = null;
  let letFullLoadThrough = false;
  let held = false;
  // A write has been owed for `INPUT_HELD_MAX_MS` and the fields are still held: the page says so and offers "Reload the page".
  let tooLong = false;

  /** The form's fields do not accept input from a row link being taken until its write has committed, and while a repair step is in flight (DL-488 (iv)). */
  const syncHeld = (): void => {
    const now = step !== null || inFlight !== null || queued !== null;
    if (now === held) return;
    held = now;
    onInputHeld(now);
    if (!now && tooLong) {
      tooLong = false;
      onHeldTooLong(false);
    }
  };

  /** The write the marker belongs to is still owed after `INPUT_HELD_MAX_MS`: the page says so. Nothing is settled, armed or repaired by the time passing (DL-489). */
  const owedTooLong = (marker: object): void => {
    win.setTimeout(() => {
      if (inFlightMarker !== marker || tooLong) return;
      tooLong = true;
      onHeldTooLong(true);
    }, INPUT_HELD_MAX_MS);
  };

  /** The write that was in flight has ended (it landed, it was overtaken, or the person went elsewhere): the next one, if a link was pressed meanwhile, is written, and so is a jump to a place on the page. */
  const settled = (): void => {
    traversedDuringHold = false;
    inFlightMarker = null;
    inFlight = null;
    inFlightHref = null;
    if (queued !== null && step === null) {
      const next = queued;
      queued = null;
      readdress(next);
    }
    if (inFlight === null && queued === null && step === null && fragmentWaiting !== null) {
      const address = fragmentWaiting;
      fragmentWaiting = null;
      writeFragment(address);
    }
    syncHeld();
  };

  /** The row asked for is what the page's own entry has now (the write landed, whether or not the router's effect said so, or there was nothing to write): the write is over. */
  const settleInFlight = (): void => {
    if (inFlight === null || step !== null) return;
    if (pathSearchOf(win.location.href) !== inFlight) return;
    // The write landed on the page's own entry (no guard entry is on top, and the entry is not one the guard marked): that entry's address is what the guard's entry will sit on, and what a Forward onto the old guard entry
    // must find below it.
    if (armedFor === null && markOf(win.history.state) === null) knownPage = win.location.href;
    settled();
  };

  /**
   * Puts the guard's entry on the history, when something is unsaved and there is none. **It pushes only when the current address has the path and query of the row the router committed last** (DL-487 (2) (i)), and **an owed
   * write never stops it** (DL-488 (i)): what is typed before the write lands is in the row that is replaced and goes with it, and if the write lands on the guard's entry the page's own entry is repaired
   * (`ensureAddressed`). The entry carries a mark (`GUARD_MARK`). It runs when something becomes unsaved, when the router commits, when a step ends, and on every traversal.
   */
  const tryArm = (): void => {
    settleInFlight();
    if (armedFor !== null || step !== null || !gate.isDirty() || !onThisPage()) return;
    // Something typed in the row on screen is armed at once, whatever is owed. What is only a save of another part in flight waits for the owed write to land: arming before it would put the guard's entry where that write
    // lands, which is repaired and armed again, and so on (the write is on its way and nothing is typed that it could take away).
    if (inFlight !== null && !rowDirty()) return;
    if (pathSearchOf(win.location.href) !== shown) return;
    knownPage = win.location.href;
    const state: unknown = win.history.state;
    win.history.pushState(typeof state === 'object' && state !== null ? { ...state, [GUARD_MARK]: knownPage } : state, '');
    armedFor = knownPage;
  };

  const onBeforeUnload: Listener = (event) => {
    if (letFullLoadThrough || !gate.isDirty()) return;
    event.preventDefault();
    // Some browsers still read `returnValue` to decide whether to show the prompt.
    Reflect.set(event, 'returnValue', '');
  };

  /**
   * Asks the router to write `target` onto the entry that is current now, which is the page's own: the one write in flight. A write that changes neither the path nor the query has nothing to wait for. The one timer here
   * (`INPUT_HELD_MAX_MS`) only lets the page say that the write is taking a while; it ends no hold, arms nothing and repairs nothing (DL-489).
   */
  const retarget = (target: string): void => {
    if (inFlight !== null) {
      queued = target;
      syncHeld();
      return;
    }
    const marker = {};
    inFlightMarker = marker;
    inFlight = pathSearchOf(target);
    inFlightHref = target;
    owedTooLong(marker);
    syncHeld();
    navigate(target, true);
    settleInFlight();
  };

  /**
   * Gives the page's own entry the address `target`, which is the row that is on screen or about to be (QLT-845-08, DL-487). While the guard's entry is on top, the router would write only that top entry, and the page's own
   * entry below it would keep the address of an earlier row: a Back would land on it and Next's router would draw that row and unmount the one being typed in. So the guard steps off its entry first (`go(-1)`, which lands
   * on the page's own entry; the row Next draws there is the row on screen, and the form's fields are held while this goes on), and only when that step has landed (matched on the address, an event) does it ask the router to
   * `replace` the page's own entry. The guard's old entry stays ahead of it until the next push, which cuts it. **It makes no step while a write of the router is in flight:** a link pressed then is written when that has
   * settled. A second link pressed before a step has landed just changes where it ends up.
   */
  const readdress = (target: string): void => {
    if (step !== null) {
      step.target = target;
      return;
    }
    if (inFlight !== null) {
      queued = target;
      syncHeld();
      return;
    }
    if (armedFor === null) {
      retarget(target);
      return;
    }
    const marker = { target, landing: armedFor };
    step = marker;
    // Only ends the wait if the landing never comes, so a later press of the person's is never taken for the guard's own step; it moves nothing (the link is dropped, the page stays as it is). It then arms again if it can.
    win.setTimeout(() => {
      if (step !== marker) return;
      step = null;
      // The guard still thinks it is on its entry (the landing may only be late): it asks for no second step now, which would land one entry too far if both arrived.
      late = { landing: marker.landing };
      settled();
      tryArm();
    }, STEP_GRACE_MS);
    syncHeld();
    // A write of the router replaces the whole state of the entry it lands on, and takes the mark with it. The entry is about to lie ahead of the page's own, where a Forward can land on it, so it is marked again
    // first (the same address, and the state it has plus the mark: a call that carries Next's own state goes straight to the browser).
    const state: unknown = win.history.state;
    if (markOf(state) === null && typeof state === 'object' && state !== null) win.history.replaceState({ ...state, [GUARD_MARK]: marker.landing }, '', win.location.href);
    win.history.go(-1);
  };

  /** The page's own entry has an address other than the row on screen (a write landed on the guard's entry, or the island rewrote it): it is given the row's, as for a link, once nothing is unsaved in the row on screen. */
  const ensureAddressed = (): void => {
    settleInFlight();
    if (armedFor === null || step !== null || inFlight !== null) return;
    if (pathSearchOf(armedFor) === shown) return;
    // The step off would draw the page's own entry over what is typed in the row on screen. A save of another part, in flight or failed, is not that (DL-488 (iii)).
    if (rowDirty()) return;
    const here = new URL(win.location.href);
    readdress(here.pathname + here.search + here.hash);
  };

  const onClick: Listener = (event) => {
    stillHere();
    const dirty = gate.isDirty();
    // With the extra history entry on top, even a clean page takes the click: the link then replaces that entry instead of stacking on it, so a later Back has no dead press (review SQR-03). While a write is owed the guard drives
    // every link to another row itself (DL-488 (ii)), so the last link pressed is the one that is written; it compares the link with the row the page is heading for, not with the address the entry still has.
    if (!dirty && armedFor === null && inFlight === null && queued === null && step === null) return;
    // The row the page is heading for: the link queued behind the write, the write in flight, or the target of a step off that has not landed. A link back to the row on screen has the page's own path and query, so it must be
    // compared with this and not with the address the entry still has, or the router would take it while the step is on its way and the press would be lost.
    const heading = queued ?? inFlight ?? step?.target ?? null;
    // A link to a place on this page is not a link to another row, whatever row is being written: `onFragmentClick` does it, when the write has settled. It is told by how it is written (`#main`), not by its address: a row
    // link written `?row=1.1#row-inputs` resolves to the page's own path and query and a `#` too, and when the row it names is the one on screen it is the link back to it (QLT-845-24).
    if (heading !== null) {
      const placeOnPage = writtenAsPlaceOnPage(event.target);
      if (placeOnPage === true || (placeOnPage === null && fragmentLinkOf(clickFactsOf(event), win.location) !== null)) return;
    }
    const reference = heading === null ? win.location : { href: new URL(heading, win.location.href).href, origin: win.location.origin };
    const href = leavingLinkOf(clickFactsOf(event), reference);
    if (href === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const go = (): void => {
      if (new URL(href, win.location.href).pathname !== pagePath) {
        // A link to another page takes the guard away with it: the guard's entry, if it is on top, is the one that is replaced.
        const replace = armedFor !== null;
        armedFor = null;
        navigate(href, replace);
        return;
      }
      // A link to another row of this same page: the page's own entry is given the new row's address (see `readdress`), so what is typed next meets one guard entry above an entry with the row on screen (DEF-149, QLT-845-08).
      readdress(href);
    };
    if (dirty) ask({ proceed: go, cancel: () => undefined, samePage: new URL(href, win.location.href).pathname === pagePath });
    else go();
  };

  /**
   * A link to another row of this page that the page took itself (the tree's row links when the guard is not armed: Next's `Link` prevents the default and asks the router to `replace`): the router now has a write in flight,
   * and the form's fields are held until it has landed (DL-488 (iv)). This blocks nothing else: the guard still arms at the first key that is accepted, and a link pressed meanwhile is taken by `onClick`.
   */
  const onPageOwnLink: Listener = (event) => {
    if (armedFor !== null || step !== null || inFlight !== null || !event.defaultPrevented) return;
    const href = leavingLinkOf(clickFactsOf(event), win.location);
    if (href === null || new URL(href, win.location.href).pathname !== pagePath) return;
    const marker = {};
    inFlightMarker = marker;
    inFlight = pathSearchOf(href);
    inFlightHref = href;
    owedTooLong(marker);
    syncHeld();
    // A write for the address the entry already has holds nothing (DL-489 (3) (i)).
    settleInFlight();
  };

  /** "Reload the page": see `LeaveGuardHandle.stayOnThisRow`. */
  const stayOnThisRow = (): void => {
    // The row that is being opened (DL-492): the address of the write in flight, which is also where Next's own fallback goes when the load cancels the slow read, so both end on the same row after one load. It always
    // differs from the current address in path or query (a write to the current address holds nothing), so it is a load and never a fragment navigation. A link queued behind it is not the one loaded.
    // With no write in flight (a step off that has not landed, which lasts at most STEP_GRACE_MS): the step's target, and failing that the current path and query without the `#`, which is a load and never a fragment
    // navigation (QLT-845-29).
    const here = new URL(win.location.href);
    const fallback = `${here.pathname}${here.search}`;
    const target = new URL(inFlightHref ?? step?.target ?? fallback, win.location.href).href;
    ask({
      // A full load of that row (no new entry). Nothing typed can be lost, because nothing could be typed while the fields were held.
      proceed: () => win.location.replace?.(target),
      cancel: () => undefined,
      fullLoad: true,
    });
  };

  /** The `#` of a link to a place on this page is written to the address, with no entry, and the target gets the scroll and the focus. */
  const writeFragment = (address: string): void => {
    // `null`, not the entry's own state: Next's patched `replaceState` hands a call that carries its own state (`__NA`) straight to the browser and does not record the address, so a page read again later (a
    // `router.refresh()` after a save) wrote the router's last known address over this one and the `#` was lost. A call with no state of its own is recorded as the router's address, with its state added.
    win.history.replaceState(null, '', address);
    jumpToFragment(address.slice(address.indexOf('#') + 1));
  };

  // A link to another place on this page, which no handler of the page took (it did not prevent the default): the browser would push an entry for it, so it is done here without one (DEF-149, R1). This runs after
  // the page's own handlers (a listener on the document, in the bubbling phase), so a link whose handler prevents the default, and does its own scrolling, is not touched. It runs whatever the state of the page: an
  // entry pushed while the page was clean would sit under the guard's entry when the person starts to type, and the way out would then land on the page itself. While a write of the router is owed it makes no history
  // write: it keeps the address and does the jump when the write has settled.
  const onFragmentClick: Listener = (event) => {
    if (event.defaultPrevented) return;
    const address = fragmentLinkOf(clickFactsOf(event), win.location);
    if (address === null) return;
    event.preventDefault();
    if (inFlight !== null || queued !== null || step !== null) {
      fragmentWaiting = address;
      return;
    }
    writeFragment(address);
  };

  /** Scroll to the target of a `#` and give it the focus, as the browser does: a target that cannot take the focus by itself is given `tabindex="-1"` for as long as it has it, and so is where the next Tab starts. */
  const jumpToFragment = (fragment: string): void => {
    let id = fragment;
    try {
      id = decodeURIComponent(fragment);
    } catch {
      // A `#` that is not valid percent-encoding names the element by its text as it is.
    }
    const target = doc.getElementById(id);
    if (target === null) return;
    target.scrollIntoView();
    target.focus({ preventScroll: true });
    if (doc.activeElement !== target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
  };

  // A way out that takes the person away has been sent and the page is still here: it did not go anywhere (QLT-845-34), so what was held back for it ends. A landing on another page is the way out itself.
  const stillHere = (): void => {
    if (gate.isLeaveAway() && onThisPage()) gate.setLeaving(false);
  };

  const onPopState: Listener = () => {
    const here = win.location.href;
    stillHere();
    // A `popstate` of an entry that has no state of its own is not one Next answers (`app-router.js` ignores it: nothing is drawn): a fragment navigation of the document, or a replace of the same address with a `#`
    // (QLT-845-29). While a write is owed it ends nothing: it does not settle the write, drop what was queued, or arm.
    if ((inFlight !== null || queued !== null) && step === null && (typeof win.history.state !== 'object' || win.history.state === null)) return;
    const lateStep = late;
    late = null;
    if (step === null && lateStep !== null && here === lateStep.landing && !gate.isDirty()) {
      // The guard's own step off, landing after `STEP_GRACE_MS`, on a page with nothing unsaved: not a Back, which a clean page passes on and so would leave it (QLT-845-20). The page stays as it is (the link that asked for it was
      // dropped); the guard is on the page's own entry now, and arms again at the next key. With something unsaved the press is read as a Back, which asks: a question too many is safe, a Back that is not asked about is not.
      armedFor = null;
      knownPage = here;
      if (new URL(here).pathname === pagePath) shown = pathSearchOf(here);
      tryArm();
      return;
    }
    if (step !== null) {
      const { target, landing } = step;
      step = null;
      if (here === landing) {
        // The guard's own step off has landed on the page's own entry. The guard's entry lies ahead of it now, and the router is asked to write the row's address onto this entry; the next push cuts the old one.
        armedFor = null;
        knownPage = here;
        justLanded = pathSearchOf(here);
        retarget(target);
        syncHeld();
        tryArm();
        return;
      }
      // It landed anywhere else, so the person pressed Back or Forward as well: the step is over, and this press is handled as any other.
    }
    // Every other traversal: the router answers it, and the row on screen is the one it landed on. **While a row write is owed it ends nothing** (DL-490 (3)): no traversal proves what the write will do (Next ignores
    // some, and whether a restore discards a pending navigation is its own choice), so the write is neither settled nor dropped, the link queued behind it stays, and the fields stay held. If the traversal did cancel
    // the write, the notice and its button recover it; if it did not, the write lands and ends the hold by its address.
    if (inFlight !== null || queued !== null) traversedDuringHold = true;
    if (new URL(here).pathname === pagePath) shown = pathSearchOf(here);
    // A landing on an entry that carries the guard's mark, while the guard thinks it is on the page's own entry: it is on its own entry (the old one that lay ahead after a step off), above the page's own entry as last seen.
    if (armedFor === null && markOf(win.history.state) !== null) {
      armedFor = knownPage;
      return;
    }
    if (armedFor === null) knownPage = here;
    // Only the press of Back from our own entry lands on the same address; any other traversal is somebody else's.
    if (armedFor !== null && here === armedFor) {
      armedFor = null;
      // Nothing is unsaved any more (it was saved while the entry was up): the press is passed on, so the person is not made to press Back twice.
      if (!gate.isDirty()) {
        win.history.back();
        return;
      }
      tryArm();
      ask({
        // From the entry put back, two steps are the page's own entry and the one before it. The guard no longer waits for a Back, so the traversal that follows is not asked about again.
        proceed: () => {
          armedFor = null;
          // Two steps, as a held invariant and not a guess: the guard's own entry is the only one above the page's entry, and the page's own entry has the address of the row on screen. A Back lands on the page's own entry and the
          // push above truncates what was forward of it, so the history is the page's entry and this one whatever was done on the page. No writer stacks an entry on the page's own: a link to another row of this page gives
          // the page's own entry its address (`readdress`), a write that lands on the guard's entry or the island's address rewrite is repaired through `committed()`, and a link to a place on this page is done by `onFragmentClick` without an entry.
          win.history.go(-2);
        },
        cancel: () => undefined,
      });
      return;
    }
    tryArm();
    ensureAddressed();
  };

  /**
   * The router has committed an address (the page tells the guard from an effect on the router's path and query): the row on screen is the one the current address has. The effect speaks only when the path or the query changes,
   * so nothing here may wait for it: a write that is overtaken, or that ends where the page started, says nothing, and `settleInFlight` reads the entry instead.
   */
  const committed = (): void => {
    if (!onThisPage() || step !== null) return;
    stillHere();
    shown = pathSearchOf(win.location.href);
    if (armedFor === null && markOf(win.history.state) === null) knownPage = win.location.href;
    // The router has written an address of this page. The write that was owed is over when it is the address asked for (`settleInFlight`), and also when it is another one (a redirect is an event too, DL-489 (3) (i)),
    // **unless it is the address the guard's own step off has just landed on**: the page's effect tells the guard about that landing too, and the write the guard asked for after it is still owed.
    const at = pathSearchOf(win.location.href);
    const ownLanding = justLanded;
    justLanded = null;
    settleInFlight();
    if (inFlight !== null && at !== ownLanding && !traversedDuringHold) settled();
    ensureAddressed();
    tryArm();
  };

  const unsubscribe = gate.subscribe(() => {
    tryArm();
    ensureAddressed();
  });
  win.addEventListener('beforeunload', onBeforeUnload);
  win.addEventListener('popstate', onPopState);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('click', onFragmentClick);
  doc.addEventListener('click', onPageOwnLink);

  return {
    remove: () => {
      unsubscribe();
      win.removeEventListener('beforeunload', onBeforeUnload);
      win.removeEventListener('popstate', onPopState);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('click', onFragmentClick);
      doc.removeEventListener('click', onPageOwnLink);
      step = null;
      late = null;
      inFlight = null;
      inFlightMarker = null;
      queued = null;
      fragmentWaiting = null;
      syncHeld();
    },
    allowFullLoad: () => {
      letFullLoadThrough = true;
      win.setTimeout(() => {
        letFullLoadThrough = false;
      }, FULL_LOAD_GRACE_MS);
    },
    committed,
    stayOnThisRow,
  };
}
