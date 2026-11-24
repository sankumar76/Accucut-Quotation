/**
 * Rule P of the parts tree (AQP-419, DEF-076; UX design of AQP-419 comment 13032): **a layout never changes between a pointer going down in the tree and the end of that press.** A toolbar line that is in view when
 * the pointer goes down (the open row's, one that shows because the keyboard focus is in its row, one whose menu is open) is held at the same height until the `click` has run, and only then do the rows settle. Without
 * it a press that moves the focus (a mouse-down on a link does) took the focus ring off another row, that row's toolbar went back to the `sr-only` clip, the pressed row moved up by a toolbar line under the pointer, the
 * mouse-up landed on something else, and no `click` was sent: the press was lost.
 *
 * The hold is a mark on the toolbar group (`data-hold`, which `RowActions` reads as one more reason to be in view), set at the pointer-down and taken off when the press is over. No state, no render. It ends at the first of:
 * the `click` has run (the next task, after the handlers of the click), the pointer is up and no click has come, the pointer is cancelled, the window loses the focus, or `HOLD_CEILING_MS`. **The keyboard never holds
 * anything:** nothing here listens to a key or to the focus, so Tab away from a row collapses its toolbar at once.
 *
 * Rule P2 (the same design, decided by QA's check 4: a double click on a row below the open row reached "Add fastener", "Delete" and "Move" of the row it had just opened) is in the same listeners: a press on a button of
 * a toolbar within `ROW_OPEN_SETTLE_MS` and `ROW_OPEN_SETTLE_PX` of the click that opened its row is ignored.
 */

/** The mark a held toolbar carries. `RowActions` has `data-hold:not-sr-only`, so the two change together. */
export const HOLD_ATTRIBUTE = 'data-hold';

/** The longest a press holds the layout, whatever else happens (a pointer that is never released, a click that never comes). */
export const HOLD_CEILING_MS = 5_000;

/** How long after the pointer is up the hold waits for the click before it lets go. A finger's click is a task of its own, after the pointer-up, so the wait is not nothing. */
export const CLICK_WAIT_MS = 250;

/** What a toolbar must let the hold do to it: carry a mark. An element does. */
export interface HeldToolbar {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface PressHold {
  /** A primary pointer went down in the tree: the toolbars in view now are held. */
  down(): void;
  /** The pointer came up: the click, if there is one, is next. */
  up(): void;
  /** The click has been delivered: the rows settle once its handlers have run. */
  click(): void;
  /** The press ended without a click (cancelled, or the window lost the focus): the rows settle now. */
  cancel(): void;
}

/**
 * The state of one press. `shown` returns the toolbars that are in view at the moment it is called (the DOM glue measures them); a call with none held and none in view starts nothing.
 */
export function createPressHold(shown: () => ReadonlyArray<HeldToolbar>): PressHold {
  const held = new Set<HeldToolbar>();
  let ceiling: ReturnType<typeof setTimeout> | undefined;
  let release: ReturnType<typeof setTimeout> | undefined;

  const stop = (timer: ReturnType<typeof setTimeout> | undefined): void => {
    if (timer !== undefined) clearTimeout(timer);
  };
  const end = (): void => {
    stop(ceiling);
    stop(release);
    ceiling = undefined;
    release = undefined;
    for (const toolbar of held) toolbar.removeAttribute(HOLD_ATTRIBUTE);
    held.clear();
  };
  // A press that begins while the one before it is still held (the second press of a double click, when the click of the first has not come) adds to the hold and keeps the first's: nothing settles between them.
  const down = (): void => {
    stop(release);
    release = undefined;
    for (const toolbar of shown()) {
      toolbar.setAttribute(HOLD_ATTRIBUTE, '');
      held.add(toolbar);
    }
    if (held.size === 0) return;
    stop(ceiling);
    ceiling = setTimeout(end, HOLD_CEILING_MS);
  };
  const letGoIn = (ms: number): void => {
    if (held.size === 0) return;
    stop(release);
    release = setTimeout(end, ms);
  };
  return { down, up: () => letGoIn(CLICK_WAIT_MS), click: () => letGoIn(0), cancel: end };
}

/** How long after the click that opened a row a press on a button of a toolbar is taken for the second press of a double click (rule P2, AQP-419 comment 13032). */
export const ROW_OPEN_SETTLE_MS = 500;

/** How far from that click a press can be and still be that second press. A press on a button of a toolbar is a different place: the toolbar is a line under the name, further than that from where the click on the name was. */
export const ROW_OPEN_SETTLE_PX = 8;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SettleGuard {
  /** A click on a row's name has run: it is the click that opened the row (or the one that found it open). */
  opened(at: Point, time: number): void;
  /** Is a press on a button of a toolbar, at this place and time, the second press of a double click on the name? */
  blocks(at: Point, time: number): boolean;
}

/**
 * Rule P2: selecting a row below the open row takes the old row's toolbar line away once the click has run, so the new row sits one toolbar line higher under a pointer that has not moved, and its own toolbar line is
 * what the pointer is over. The second press of a double click would land on its "Move", "+" or "-" (the "+" of a Part adds a Fastener at once). A press on a button of a toolbar that starts within
 * `ROW_OPEN_SETTLE_MS` and `ROW_OPEN_SETTLE_PX` of the click that opened the row is ignored. A press on a button at another place (a person who means it moves the pointer there) is not slowed.
 */
export function createSettleGuard(): SettleGuard {
  let last: { at: Point; time: number } | undefined;
  return {
    opened: (at, time) => {
      last = { at, time };
    },
    blocks: (at, time) => {
      if (last === undefined) return false;
      const since = time - last.time;
      return since >= 0 && since <= ROW_OPEN_SETTLE_MS && Math.hypot(at.x - last.at.x, at.y - last.at.y) <= ROW_OPEN_SETTLE_PX;
    },
  };
}

/** A toolbar is in view when it is taller than the 1 px of the `sr-only` clip. */
const CLIPPED_HEIGHT_PX = 1;

/** The toolbar group of a row (`RowActions`). */
const TOOLBAR = '[data-row-actions]';

/**
 * Connects the hold to the page: the primary pointer-down in the tree (the capture phase, so it also covers a press on the move handle and on a button of a toolbar, which stop their own events) holds every toolbar
 * that is in view; the pointer-up, the click and the pointer-cancel anywhere on the page, and the window's blur, end the press. The same listeners keep rule P2: a press on a button of a toolbar that is the second press of
 * a double click on a name is stopped before the button sees it (its pointer-down, which opens a menu or starts a drag, and the click that ends the press). Returns the function that takes all of it away.
 */
export function attachPressHold(doc: Document, win: Window, treeId: string): () => void {
  const within = ({ target }: Event, selector: string): boolean => {
    if (typeof target !== 'object' || target === null || !('closest' in target) || typeof target.closest !== 'function') return false;
    return Reflect.apply(target.closest, target, [selector]) !== null;
  };
  const toolbars = (): HTMLElement[] =>
    [...(doc.getElementById(treeId)?.querySelectorAll<HTMLElement>(TOOLBAR) ?? [])].filter((toolbar) => toolbar.getBoundingClientRect().height > CLIPPED_HEIGHT_PX);
  const hold = createPressHold(toolbars);
  const settle = createSettleGuard();
  // The press that rule P2 stopped: the click that ends it is stopped too. A click from the keyboard (`detail` 0) is never part of a press.
  let ignored = false;
  const at = (event: MouseEvent): Point => ({ x: event.clientX, y: event.clientY });
  const onDown = (event: PointerEvent): void => {
    ignored = false;
    if (!event.isPrimary || event.button !== 0 || !within(event, `#${treeId}`)) return;
    if (within(event, TOOLBAR) && settle.blocks(at(event), event.timeStamp)) {
      ignored = true;
      event.stopPropagation();
      return;
    }
    hold.down();
  };
  const onUp = (): void => hold.up();
  const onClick = (event: MouseEvent): void => {
    if (ignored && event.detail !== 0) {
      event.stopPropagation();
      event.preventDefault();
    } else if (within(event, `#${treeId} a`)) {
      settle.opened(at(event), event.timeStamp);
    }
    ignored = false;
    hold.click();
  };
  const onCancel = (): void => {
    ignored = false;
    hold.cancel();
  };
  doc.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('pointerup', onUp, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('pointercancel', onCancel, true);
  win.addEventListener('blur', onCancel);
  return () => {
    doc.removeEventListener('pointerdown', onDown, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('pointercancel', onCancel, true);
    win.removeEventListener('blur', onCancel);
    hold.cancel();
  };
}
