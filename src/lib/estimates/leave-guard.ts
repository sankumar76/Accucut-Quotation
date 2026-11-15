import type { LeaveRequest } from './leave-registry';
import type { SaveGate } from './save-gate';

/**
 * The listeners that stop typing being lost when the person leaves the estimate page (STORY-05.08 AC-4), apart from React so each can be tried with a plain event target. What leaves the page, and
 * what the guard does about each:
 *
 * - **A closed tab, a reload, a link to another site:** the browser's own prompt (`beforeunload`). The text of that prompt is the browser's; nothing can change it.
 * - **A link inside the portal:** the click is stopped in the capture phase, before Next.js's link sees it, and the person is asked; if they go, `navigate` takes them there. While the extra history entry
 *   below is on top, the link **replaces** it (also on a clean page), so the history is not left with two entries of the same address.
 * - **The back button:** a browser does not let a page cancel it, so while something is unsaved the guard puts one extra entry of the same address on top of the history. Back then lands on the page's
 *   own entry (the same address, so Next.js keeps the page and what is typed in it) and the guard asks; the entry is put back at once, so Back asks again. When nothing is unsaved by then, the same
 *   press is passed on, so a person who saved is not made to press Back twice. This needs `history.state` to be Next.js's own entry, which it is on every page the router drew.
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
    readonly history: { readonly state: unknown; readonly pushState: (state: unknown, title: string) => void; readonly back: () => void; readonly go: (delta: number) => void };
    readonly setTimeout: (handler: () => void, ms: number) => unknown;
  };
  readonly doc: Target;
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
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  const anchor = anchorOf(click.target);
  if (anchor === null || anchor.hasAttribute('download') || (anchor.target !== '' && anchor.target !== '_self')) return null;
  let to: URL;
  let here: URL;
  try {
    to = new URL(anchor.href, location.href);
    here = new URL(location.href);
  } catch {
    return null;
  }
  if (to.origin !== location.origin || (to.pathname === here.pathname && to.search === here.search)) return null;
  return `${to.pathname}${to.search}${to.hash}`;
}

export interface LeaveGuardHandle {
  /** Takes the guard off the page. */
  readonly remove: () => void;
  /** Lets one full page load through, for a person who has just chosen to sign out: the browser's own prompt would be a second question. It lapses after `FULL_LOAD_GRACE_MS`, so a sign-out that fails leaves the page guarded again. */
  readonly allowFullLoad: () => void;
}

/** Puts the guard on the page. */
export function installLeaveGuard({ env, gate, ask, navigate }: LeaveGuardOptions): LeaveGuardHandle {
  const { win, doc } = env;
  // The address the extra history entry was made for, while there is one on top; null while the person is on the page's own entry.
  let armedFor: string | null = null;
  let letFullLoadThrough = false;

  const arm = (): void => {
    if (armedFor !== null) return;
    win.history.pushState(win.history.state, '');
    armedFor = win.location.href;
  };

  const onBeforeUnload: Listener = (event) => {
    if (letFullLoadThrough || !gate.isDirty()) return;
    event.preventDefault();
    // Some browsers still read `returnValue` to decide whether to show the prompt.
    Reflect.set(event, 'returnValue', '');
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
      const replace = armedFor !== null;
      armedFor = null;
      navigate(href, replace);
    };
    if (dirty) ask({ proceed: go, cancel: () => undefined });
    else go();
  };

  const onPopState: Listener = () => {
    // Only the press of Back from our own entry lands on the same address; any other traversal is somebody else's.
    if (armedFor === null || win.location.href !== armedFor) return;
    armedFor = null;
    // Nothing is unsaved any more (it was saved while the entry was up): the press is passed on, so the person is not made to press Back twice.
    if (!gate.isDirty()) {
      win.history.back();
      return;
    }
    arm();
    ask({
      // From the entry put back, two steps are the page's own entry and the one before it. The guard no longer waits for a Back, so the traversal that follows is not asked about again.
      proceed: () => {
        armedFor = null;
        win.history.go(-2);
      },
      cancel: () => undefined,
    });
  };

  const unsubscribe = gate.subscribe(() => {
    if (gate.isDirty()) arm();
  });
  win.addEventListener('beforeunload', onBeforeUnload);
  win.addEventListener('popstate', onPopState);
  doc.addEventListener('click', onClick, true);

  return {
    remove: () => {
      unsubscribe();
      win.removeEventListener('beforeunload', onBeforeUnload);
      win.removeEventListener('popstate', onPopState);
      doc.removeEventListener('click', onClick, true);
    },
    allowFullLoad: () => {
      letFullLoadThrough = true;
      win.setTimeout(() => {
        letFullLoadThrough = false;
      }, FULL_LOAD_GRACE_MS);
    },
  };
}
