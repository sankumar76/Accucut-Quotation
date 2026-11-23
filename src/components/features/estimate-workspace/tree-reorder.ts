/**
 * The drag that reorders a row of the parts tree (CR-01 item 3D, AQP-406; ADR-020 R1; UX spec section 0.9 row 3; WCAG 2.2 SC 2.5.7 has its alternative in `move-menu.tsx`). Own pointer events, one axis, among the
 * siblings of one parent (A-CR01-5, confirmed 2026-11-23: a row never changes parent). **This file is loaded when the first pointer goes down on a move handle** (`move-handle.tsx`); it is not in the first load of the
 * page (NFR-009). No dependency.
 *
 * The first half is pure: where a drop lands, where the red line goes, and how fast the panel scrolls near its edge. The second half is the thin layer that listens to the pointer and draws the line.
 */

import { DRAG_START_PX } from './move-handle-trigger';

/** The top and the bottom of a sibling, with everything under it, in the same coordinates as the pointer (the viewport's). */
export interface Box {
  readonly top: number;
  readonly bottom: number;
}

/** How far the pointer must go before a press on the handle is a drag and not a click (it opens the menu). Defined with the handle, which needs it before this code has arrived. */
export { DRAG_START_PX };
/** How close to the edge of the panel the pointer must be for the panel to scroll, and the most it scrolls in one frame. */
export const SCROLL_EDGE_PX = 48;
export const SCROLL_MAX_STEP_PX = 16;

const middleOf = (box: Box): number => (box.top + box.bottom) / 2;

/**
 * The place the dragged row ends up in among its siblings when it is let go with the pointer at `pointerY`: 0 is first. It is the number of the *other* siblings whose middle is above the pointer, which is the
 * `index` the move route takes ("the place among its new siblings", after the row has left its old place). `from` is the row's place now.
 */
export function dropIndexOf(siblings: ReadonlyArray<Box>, from: number, pointerY: number): number {
  return siblings.filter((box, place) => place !== from && middleOf(box) < pointerY).length;
}

/** The height of the red line for a drop at `index`: the top of the sibling that lands after the row, or the bottom of the last one when the row goes last. */
export function dropLineY(siblings: ReadonlyArray<Box>, from: number, index: number): number {
  const others = siblings.filter((_box, place) => place !== from);
  const after = others[index];
  if (after !== undefined) return after.top;
  // An only child has no other place: the line is at the row itself.
  return others.length === 0 ? (siblings[from]?.top ?? 0) : (others[others.length - 1]?.bottom ?? 0);
}

/** How far to scroll the panel in this frame (negative: up) for a pointer at `pointerY` over the visible part `view`: 0 away from the edges, faster the nearer the edge. */
export function scrollStepOf(pointerY: number, view: Box, edge = SCROLL_EDGE_PX, most = SCROLL_MAX_STEP_PX): number {
  if (pointerY < view.top + edge) return -Math.round(most * Math.min(1, (view.top + edge - pointerY) / edge));
  if (pointerY > view.bottom - edge) return Math.round(most * Math.min(1, (pointerY - (view.bottom - edge)) / edge));
  return 0;
}

/** What the drag needs of the page. The siblings are read again at every move, so a scroll is taken into account. */
export interface ReorderHost {
  siblings(): ReadonlyArray<Box>;
  /** The visible part of the scrolling panel. */
  view(): Box;
  scrollBy(dy: number): void;
  /** Shows the red line at this height, or hides it. */
  showLine(y: number | null): void;
}

export interface Reorder {
  /** The pointer moved to `y`. */
  move(y: number): void;
  /** One animation frame: scrolls the panel while the pointer is at its edge. */
  frame(): void;
  /** The pointer was let go at `y`: the place to move the row to, or null when it was not a drag or the row stays where it is. */
  end(y: number): number | null;
  /** The drag was abandoned (Escape, a cancelled pointer): nothing moves. */
  cancel(): void;
  readonly dragging: boolean;
}

/** One drag of the row that is now at place `from` among its siblings, started with the pointer at `startY`. */
export function createReorder(host: ReorderHost, from: number, startY: number): Reorder {
  let dragging = false;
  let lastY = startY;
  const show = (y: number): void => host.showLine(dropLineY(host.siblings(), from, dropIndexOf(host.siblings(), from, y)));
  return {
    move(y) {
      lastY = y;
      if (!dragging && Math.abs(y - startY) < DRAG_START_PX) return;
      dragging = true;
      show(y);
    },
    frame() {
      if (!dragging) return;
      const step = scrollStepOf(lastY, host.view());
      if (step === 0) return;
      host.scrollBy(step);
      show(lastY);
    },
    end(y) {
      host.showLine(null);
      if (!dragging) return null;
      dragging = false;
      const index = dropIndexOf(host.siblings(), from, y);
      return index === from ? null : index;
    },
    cancel() {
      dragging = false;
      host.showLine(null);
    },
    get dragging() {
      return dragging;
    },
  };
}

/** What the pointer did on the handle before this code arrived: kept by the handle (`startDrag`) and replayed here, so a quick drag on a page that has not fetched this code yet is not lost. */
export interface GestureEvent {
  readonly kind: 'move' | 'up' | 'cancel';
  readonly y: number;
}

/**
 * Plays what the pointer did before this code arrived into a new drag, in order. If the pointer was already let go (`up`) or abandoned (`cancel`), the drag is over: `index` is the place to drop at, or null when the
 * row stays (or the gesture was cancelled). Otherwise the drag goes on, with its line where the pointer is now.
 */
export function replayGesture(reorder: Reorder, seen: ReadonlyArray<GestureEvent>): { readonly ended: boolean; readonly index: number | null } {
  for (const event of seen) {
    if (event.kind === 'move') {
      reorder.move(event.y);
    } else if (event.kind === 'up') {
      return { ended: true, index: reorder.end(event.y) };
    } else {
      reorder.cancel();
      return { ended: true, index: null };
    }
  }
  return { ended: false, index: null };
}

export interface AttachOptions {
  /** The move handle that was pressed; it holds the pointer until the drag ends. */
  readonly handle: HTMLElement;
  readonly pointerId: number;
  readonly startY: number;
  /** The place the row was dropped at; not called when it did not move. */
  readonly onDrop: (index: number) => void;
  /** What the pointer did between the press and the arrival of this code (see `GestureEvent`). */
  readonly seen?: ReadonlyArray<GestureEvent>;
}

const boxOf = (element: Element): Box => {
  const { top, bottom } = element.getBoundingClientRect();
  return { top, bottom };
};

/** The red drop line, drawn over the page at the width of the siblings. `fixed`, so it needs nothing of the layout around the tree. */
function createLine(): { readonly show: (y: number | null, left: number, width: number) => void; readonly remove: () => void } {
  const line = document.createElement('div');
  line.setAttribute('data-drop-line', '');
  line.setAttribute('aria-hidden', 'true');
  line.className = 'pointer-events-none fixed z-(--z-popover) bg-primary';
  line.style.height = '2px';
  line.hidden = true;
  document.body.append(line);
  return {
    show(y, left, width) {
      line.hidden = y === null;
      if (y === null) return;
      line.style.top = `${String(Math.round(y) - 1)}px`;
      line.style.left = `${String(left)}px`;
      line.style.width = `${String(width)}px`;
    },
    remove: () => line.remove(),
  };
}

/** The nearest ancestor that scrolls up and down (the panel), or null when the page itself does. */
function scrollParentOf(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

/**
 * Starts the drag of a row from its handle: the pointer is held by the handle, the red line follows it, the panel scrolls at its edge, and on release `onDrop` gets the new place. A drag marks the handle
 * (`data-dragged`), so the click that follows it opens no menu; the handle clears the mark.
 */
export function attachReorder({ handle, pointerId, startY, onDrop, seen = [] }: AttachOptions): void {
  // The row is the `li` that holds the handle; its siblings are the `li` of its own `ul`, and no others (a row never changes parent).
  const row = handle.closest<HTMLElement>('li[data-part-row]');
  const list = row?.parentElement;
  if (row === null || list === null || list === undefined) return;
  const scroller = scrollParentOf(row);
  const rows = [...list.children].filter((child) => child.matches('li[data-part-row]'));
  const from = rows.indexOf(row);
  const line = createLine();
  const reorder = createReorder(
    {
      siblings: () => rows.map(boxOf),
      view: () => (scroller === null ? { top: 0, bottom: window.innerHeight } : boxOf(scroller)),
      scrollBy: (dy) => (scroller === null ? window.scrollBy(0, dy) : void (scroller.scrollTop += dy)),
      showLine: (y) => {
        const { left, width } = list.getBoundingClientRect();
        line.show(y, left, width);
      },
    },
    from,
    startY,
  );
  // The pointer may have moved, or been let go, while this code was on its way: play that first. A drag that is over needs no listeners. (The handle has marked it already if it was a drag, so the click that followed it opened nothing.)
  const replayed = replayGesture(reorder, seen);
  if (replayed.ended) {
    line.remove();
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    if (replayed.index !== null) onDrop(replayed.index);
    return;
  }
  let frame = 0;
  const tick = (): void => {
    reorder.frame();
    frame = window.requestAnimationFrame(tick);
  };
  const finish = (): void => {
    window.cancelAnimationFrame(frame);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    line.remove();
  };
  const onMove = (event: PointerEvent): void => reorder.move(event.clientY);
  const onUp = (event: PointerEvent): void => {
    if (reorder.dragging) handle.dataset['dragged'] = '';
    const index = reorder.end(event.clientY);
    finish();
    if (index !== null) onDrop(index);
  };
  const onCancel = (): void => {
    if (reorder.dragging) handle.dataset['dragged'] = '';
    reorder.cancel();
    finish();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') onCancel();
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey);
  frame = window.requestAnimationFrame(tick);
}
