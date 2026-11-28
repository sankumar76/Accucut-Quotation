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
    readonly location: { readonly href: string; readonly origin: string };
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
}

/** How long the page lets a full load through after the person chose to sign out: long enough for the request, short enough that a failed one leaves the page guarded again. */
export const FULL_LOAD_GRACE_MS = 5_000;

/**
 * How long the guard waits for its own step off its entry to land (DL-487 (2) (ii)). The step is matched on the address it lands on; this only ends the wait if its event never comes, so a later press of the person's is
 * never taken for the guard's own. It does not move the page: the link that asked for the step is dropped and the page stays as it is. Nothing the guard does to the history waits on a timer.
 */
export const STEP_GRACE_MS = 1_000;

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
  /** Lets one full page load through, for a person who has just chosen to sign out: the browser's own prompt would be a second question. It lapses after `FULL_LOAD_GRACE_MS`, so a sign-out that fails leaves the page guarded again. */
  readonly allowFullLoad: () => void;
  /** The router has committed an address: called from an effect on its path and query (`leave-guard.tsx`). The guard learns which row is on screen, and pushes its entry only when the current address is that row's. */
  readonly committed: () => void;
}

/** Puts the guard on the page. */
export function installLeaveGuard({ env, gate, ask, navigate }: LeaveGuardOptions): LeaveGuardHandle {
  const { win, doc } = env;
  // The path of this page: the guard acts only on addresses of it.
  const pagePath = new URL(win.location.href).pathname;
  const pathSearchOf = (href: string): string => {
    const url = new URL(href, win.location.href);
    return url.pathname + url.search;
  };
  const onThisPage = (): boolean => new URL(win.location.href).pathname === pagePath;
  // The row on screen, as the path and query of its address: what the router committed last (`committed()`), or the address the guard has just asked it for. A `#` is not part of it.
  let shown = pathSearchOf(win.location.href);
  // The address of the page's OWN entry while the guard's entry is on top of it; null while there is none.
  let armedFor: string | null = null;
  // The guard's step off its entry onto the page's own, made when a link to another row is pressed while the guard is armed (DL-487): where the step must land, and the address to give the page's own entry from there.
  let step: { target: string; readonly landing: string } | null = null;
  // The router has been asked to write `target` (path and query) onto the page's own entry and has not committed it yet; `stale` is the address that entry still has until it does.
  let pending: { readonly target: string; readonly stale: string } | null = null;
  let letFullLoadThrough = false;

  /**
   * Puts the guard's entry on the history, when something is unsaved and there is none. **It pushes only when the current address has the path and query of the row on screen** (DL-487 (2) (i)): a push made while the
   * router still has a write to land on the page's own entry would put the guard's entry on an address that is not the row's, and Next's deferred write would then land on it. A keystroke that finds the addresses apart marks
   * the form dirty all the same; the push waits for the router's commit (`committed()`), an event of the router and not a timer.
   */
  const tryArm = (): void => {
    if (armedFor !== null || step !== null || pending !== null || !gate.isDirty() || !onThisPage()) return;
    if (pathSearchOf(win.location.href) !== shown) return;
    win.history.pushState(win.history.state, '');
    armedFor = win.location.href;
  };

  const onBeforeUnload: Listener = (event) => {
    if (letFullLoadThrough || !gate.isDirty()) return;
    event.preventDefault();
    // Some browsers still read `returnValue` to decide whether to show the prompt.
    Reflect.set(event, 'returnValue', '');
  };

  /** Asks the router to write `target` onto the entry that is current now, which is the page's own: from then until it commits, the guard pushes nothing. */
  const retarget = (target: string): void => {
    pending = { target: pathSearchOf(target), stale: pending?.stale ?? pathSearchOf(win.location.href) };
    shown = pending.target;
    navigate(target, true);
  };

  /**
   * Gives the page's own entry the address `target`, which is the row that is on screen or about to be (QLT-845-08, DL-487). While the guard's entry is on top, the router would write only that top entry, and the page's own
   * entry below it would keep the address of an earlier row: a Back would land on it and Next's router would draw that row and unmount the one being typed in. So the guard steps off its entry first (`go(-1)`, which lands
   * on the page's own entry; the row Next draws there is the row on screen, and nothing is unsaved at that moment), and only when that step has landed (matched on the address, an event, not a timer) does it ask the router to
   * `replace` the page's own entry. The guard's old entry stays ahead of it until the next push, which cuts it. A second link pressed before the step has landed just changes where it ends up.
   */
  const readdress = (target: string): void => {
    if (step !== null) {
      step.target = target;
      return;
    }
    if (armedFor === null) {
      retarget(target);
      return;
    }
    const marker = { target, landing: armedFor };
    step = marker;
    // Only ends the wait if the landing never comes, so a later press of the person's is never taken for the guard's own step; it moves nothing (the link is dropped, the page stays as it is).
    win.setTimeout(() => {
      if (step === marker) step = null;
    }, STEP_GRACE_MS);
    win.history.go(-1);
  };

  /** The page's own entry has an address other than the row on screen (the island rewrote the guard's entry, say): it is given the row's, as for a link, once nothing is unsaved. */
  const ensureAddressed = (): void => {
    if (armedFor === null || step !== null || pending !== null) return;
    if (pathSearchOf(armedFor) === shown) return;
    // The step off would draw the page's own entry over what is typed.
    if (gate.isDirty()) return;
    const here = new URL(win.location.href);
    readdress(here.pathname + here.search + here.hash);
  };

  const onClick: Listener = (event) => {
    const dirty = gate.isDirty();
    // With the extra history entry on top, even a clean page takes the click: the link then replaces that entry instead of stacking on it, so a later Back has no dead press (review SQR-03).
    if (!dirty && armedFor === null) return;
    const href = leavingLinkOf(clickFactsOf(event), win.location);
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
      // A link to another row of this same page: the page's own entry is given the new row's address (see \`readdress\`), so what is typed next meets one guard entry above an entry with the row on screen (DEF-149, QLT-845-08).
      readdress(href);
    };
    if (dirty) ask({ proceed: go, cancel: () => undefined });
    else go();
  };

  /**
   * A link to another row of this page that the page took itself (the tree's row links when the guard is not armed: Next's `Link` prevents the default and asks the router to `replace`): the router now owes a write onto the
   * page's own entry, and Next makes it when the new row is committed, on whatever entry is current then. A keystroke before that must not push the guard's entry, or the write would land on it and leave the page's own entry
   * with the old row (QLT-845-08). So the guard records the write as owed, as for a link it took, and pushes nothing until the router commits (`committed()`, or any traversal, which ends the wait).
   */
  const onPageOwnLink: Listener = (event) => {
    if (armedFor !== null || step !== null || !event.defaultPrevented) return;
    const href = leavingLinkOf(clickFactsOf(event), win.location);
    if (href === null || new URL(href, win.location.href).pathname !== pagePath) return;
    pending = { target: pathSearchOf(href), stale: pending?.stale ?? pathSearchOf(win.location.href) };
  };

  // A link to another place on this page, which no handler of the page took (it did not prevent the default): the browser would push an entry for it, so it is done here without one (DEF-149, R1). This runs after
  // the page's own handlers (a listener on the document, in the bubbling phase), so a link whose handler prevents the default, and does its own scrolling, is not touched. It runs whatever the state of the page: an
  // entry pushed while the page was clean would sit under the guard's entry when the person starts to type, and the way out would then land on the page itself.
  const onFragmentClick: Listener = (event) => {
    if (event.defaultPrevented) return;
    const address = fragmentLinkOf(clickFactsOf(event), win.location);
    if (address === null) return;
    event.preventDefault();
    // \`null\`, not the entry's own state: Next's patched \`replaceState\` hands a call that carries its own state (\`__NA\`) straight to the browser and does not record the address, so a page read again later (a
    // \`router.refresh()\` after a save) wrote the router's last known address over this one and the \`#\` was lost. A call with no state of its own is recorded as the router's address, with its state added.
    win.history.replaceState(null, '', address);
    jumpToFragment(address.slice(address.indexOf('#') + 1));
  };

  /** Scroll to the target of a \`#\` and give it the focus, as the browser does: a target that cannot take the focus by itself is given \`tabindex="-1"\` for as long as it has it, and so is where the next Tab starts. */
  const jumpToFragment = (fragment: string): void => {
    let id = fragment;
    try {
      id = decodeURIComponent(fragment);
    } catch {
      // A \`#\` that is not valid percent-encoding names the element by its text as it is.
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

  const onPopState: Listener = () => {
    const here = win.location.href;
    // A traversal ends the wait for a write the page's own link asked of the router: the router answers the traversal, not the link.
    if (step === null) pending = null;
    if (step !== null) {
      const { target, landing } = step;
      step = null;
      if (here === landing) {
        // The guard's own step off has landed on the page's own entry. The guard's entry lies ahead of it now, and the router is asked to write the row's address onto this entry; the next push cuts the old one.
        armedFor = null;
        retarget(target);
        return;
      }
      // It landed anywhere else, so the person pressed Back or Forward as well: the step is over, and this press is handled as any other.
    }
    // Only the press of Back from our own entry lands on the same address; any other traversal is somebody else's.
    if (armedFor === null || here !== armedFor) return;
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
        // the page's own entry its address (\`readdress\`), the island's address rewrite does the same through \`committed()\`, and a link to a place on this page is done by \`onFragmentClick\` without an entry.
        win.history.go(-2);
      },
      cancel: () => undefined,
    });
  };

  /**
   * The router has committed an address (the page tells the guard from an effect on the router's path and query): the row on screen is the one the current address has. A commit of the address the page's own entry still has
   * while the guard has a write on its way to that entry is the router's restore of the entry the guard stepped onto, and is not the row asked for.
   */
  const committed = (): void => {
    if (!onThisPage() || step !== null) return;
    const here = pathSearchOf(win.location.href);
    if (pending !== null) {
      if (here === pending.stale && here !== pending.target) return;
      pending = null;
    }
    shown = here;
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
    },
    allowFullLoad: () => {
      letFullLoadThrough = true;
      win.setTimeout(() => {
        letFullLoadThrough = false;
      }, FULL_LOAD_GRACE_MS);
    },
    committed,
  };
}
