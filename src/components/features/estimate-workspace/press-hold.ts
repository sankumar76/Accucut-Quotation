/**
 * Rule P of the parts tree (AQP-419, DEF-076; UX design of AQP-419 comment 13032): **a layout never changes between a pointer going down in the tree and the end of that press.** A toolbar line that is in view when
 * the pointer goes down (the open row's, one that shows because the keyboard focus is in its row, one whose menu is open) is held at the same height until the `click` has run, and only then do the rows settle. Without
 * it a press that moves the focus (a mouse-down on a link does) took the focus ring off another row, that row's toolbar went back to the `sr-only` clip, the pressed row moved up by a toolbar line under the pointer, the
 * mouse-up landed on something else, and no `click` was sent: the press was lost.
 *
 * The hold is a mark on the toolbar group (`data-hold`, which `RowActions` reads as one more reason to be in view), set at the pointer-down and taken off when the press is over. No state, no render. It ends at the first of:
 * the `click` has run (the next task, after the handlers of the click), the pointer is up and no click has come, the pointer is cancelled, the window loses the focus, or `HOLD_CEILING_MS`. **The keyboard never holds
 * anything:** nothing here listens to a key or to the focus, so Tab away from a row collapses its toolbar at once.
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

/** A toolbar is in view when it is taller than the 1 px of the `sr-only` clip. */
const CLIPPED_HEIGHT_PX = 1;

/**
 * Connects the hold to the page: the primary pointer-down in the tree (the capture phase, so it also covers a press on the move handle and on a button of a toolbar, which stop their own events) holds every toolbar
 * that is in view; the pointer-up, the click and the pointer-cancel anywhere on the page, and the window's blur, end the press. Returns the function that takes all of it away.
 */
export function attachPressHold(doc: Document, win: Window, treeId: string): () => void {
  const inTree = ({ target }: Event): boolean => {
    if (target === null || !('closest' in target) || typeof target.closest !== 'function') return false;
    return Reflect.apply(target.closest, target, [`#${treeId}`]) !== null;
  };
  const toolbars = (): HTMLElement[] =>
    [...(doc.getElementById(treeId)?.querySelectorAll<HTMLElement>('[data-row-actions]') ?? [])].filter((toolbar) => toolbar.getBoundingClientRect().height > CLIPPED_HEIGHT_PX);
  const hold = createPressHold(toolbars);
  const onDown = (event: PointerEvent): void => {
    if (event.isPrimary && event.button === 0 && inTree(event)) hold.down();
  };
  const onUp = (): void => hold.up();
  const onClick = (): void => hold.click();
  const onCancel = (): void => hold.cancel();
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
