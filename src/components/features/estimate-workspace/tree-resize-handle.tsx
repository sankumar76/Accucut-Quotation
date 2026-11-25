'use client';

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { clampTreeWidth, TREE_WIDTH_DEFAULT, TREE_WIDTH_MIN } from '@/lib/ui/tree-width';
import { dragCancel, dragEnd, dragMove, dragStart, presetOfWidth, treeWidthForKey, type DragState } from '@/lib/ui/tree-width-gestures';

import { TREE_RESIZE_HINT, TREE_RESIZE_HINT_ID, TREE_RESIZE_LABEL, treeWidthAnnouncement, treeWidthValueText } from './tree-width-texts';
import { TREE_COLUMN_ID, type TreeWidth } from './use-tree-width';

export interface TreeResizeHandleProps {
  readonly resize: TreeWidth;
  /** Said politely after a reset (the tree's live region). */
  readonly announce: (text: string) => void;
}

/** Set on `<html>` for the length of a drag: the cursor is `col-resize` over the whole page and text cannot be selected (`globals.css`). */
const DRAGGING_ATTRIBUTE = 'data-tree-resizing';

/**
 * The handle on the tree card's right edge (AQP-426, STORY-CR01.3E, UX-AC-15.2 to 15.5, 15.9, 15.10, 15.12), in two parts (re-land, DL-389 (4)(a); ux-expert note 90e23166): the **hit area**, a full-height wrapper with no role
 * and no tab stop that holds the pointer handlers, and in it the **separator**, the one focusable element, a `div` with `role="separator"` (a `button` may not carry that role) that holds the ARIA, the key handler, the 3 px
 * `--focus` ring (the global `:focus-visible` rule: it is drawn on the focused element itself, which the Nightly sweep asks for, DEF-086) and the grip.
 *
 * The hit area is **24 px wide** with a mouse (from the card's right edge: the gap and 8 px of the form's side) and **44 px** with a finger (the gap and the 28 px of the card's own padding before it, so nothing of the form lies
 * under it), `touch-action: none`, inside the column's `position: relative` wrapper and **not** inside the box that scrolls. The separator is 24 x 48 px (44 x 48 with a finger) and the grip a 4 x 40 px bar in `--border-strong`
 * (3:1 on the page and the card), `--primary` on hover of the hit area, on keyboard focus and while dragging. Nothing is animated.
 *
 * Mouse and finger: a press on the hit area focuses the separator (so a drag, then arrow keys, works) and starts a drag, which follows the pointer between 240 px and the effective maximum, writes `--tree-w` in an animation
 * frame (no React render per pixel), and is stored once, when the pointer goes up. Escape restores the width the drag began with. A bare click only takes the focus. Keys, on the separator: Left and Right 16 px, with Shift 64 px,
 * Home 240, End the effective maximum, Enter and a double click 320 (and the stored width is removed). Up, Down and other keys are not taken. The separator's own value is read by a screen reader as a key repeats; only a reset
 * is announced.
 */
export function TreeResizeHandle({ resize, announce }: TreeResizeHandleProps) {
  const { width, ceiling, workspaceWidth, preview, commit } = resize;
  const separator = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  /** The separator's numbers follow the drag directly, because React is not asked to render for each pixel. */
  const showValue = (pixels: number): void => {
    separator.current?.setAttribute('aria-valuenow', String(pixels));
    separator.current?.setAttribute('aria-valuetext', treeWidthValueText(pixels));
  };

  const endDragLook = (): void => document.documentElement.removeAttribute(DRAGGING_ATTRIBUTE);
  // A handle that goes away mid-drag (the window grows past a breakpoint, the page is left) must not leave the page in "dragging".
  useEffect(() => endDragLook, []);

  const reset = (): void => {
    const standard = clampTreeWidth(TREE_WIDTH_DEFAULT, workspaceWidth);
    commit(standard, true);
    announce(treeWidthAnnouncement('standard', standard));
  };

  const cancelDrag = (): void => {
    if (drag.current === null) return;
    const back = dragCancel(drag.current);
    drag.current = null;
    endDragLook();
    preview(back.width);
    showValue(back.width);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.isPrimary || event.button !== 0) return;
    // The wrapper is not focusable, so the browser's own focus move on a press would drop the focus to the page: the press is taken here, and the separator gets the focus (no ring for a mouse, as for any press).
    event.preventDefault();
    separator.current?.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = dragStart(width, event.clientX);
    document.documentElement.setAttribute(DRAGGING_ATTRIBUTE, '');
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current === null) return;
    drag.current = dragMove(drag.current, event.clientX, workspaceWidth);
    preview(drag.current.width);
    showValue(drag.current.width);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.current === null) return;
    const ended = dragEnd(drag.current);
    drag.current = null;
    endDragLook();
    if (ended.store) commit(ended.width, false);
    else {
      // Moved and brought back, or only pressed: nothing is stored, and the page shows the width it had.
      preview(ended.width);
      showValue(ended.width);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && drag.current !== null) {
      event.preventDefault();
      event.stopPropagation();
      cancelDrag();
      return;
    }
    if (drag.current !== null) return;
    const outcome = treeWidthForKey(width, event, workspaceWidth);
    if (outcome === null) return;
    event.preventDefault();
    if (outcome.reset) reset();
    else commit(outcome.width, false);
  };

  // The tooltip is the hint itself: `display: none` at rest, so it is read from `aria-describedby` and shown on hover of the hit area and on keyboard focus of the separator.
  return (
    <div
      data-tree-hit=""
      className="group/hit absolute top-0 bottom-0 left-full z-(--z-handle) w-s-5 cursor-col-resize touch-none pointer-coarse:left-[calc(100%_-_28px)] pointer-coarse:w-[44px]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
      onDoubleClick={reset}
    >
      <div
        ref={separator}
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={TREE_RESIZE_LABEL}
        aria-controls={TREE_COLUMN_ID}
        aria-valuenow={width}
        aria-valuemin={TREE_WIDTH_MIN}
        aria-valuemax={ceiling}
        aria-valuetext={treeWidthValueText(width)}
        aria-describedby={TREE_RESIZE_HINT_ID}
        data-tree-handle=""
        data-preset={presetOfWidth(width)?.id}
        className="group/sep absolute top-1/2 left-0 flex h-[48px] w-s-5 -translate-y-1/2 items-center justify-center rounded-md pointer-coarse:w-[44px]"
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true" data-tree-grip="" className="h-[40px] w-[4px] rounded-full bg-border-strong group-hover/hit:bg-primary group-focus-visible/sep:bg-primary" />
      </div>
      <span id={TREE_RESIZE_HINT_ID} role="tooltip" className="absolute top-s-2 left-full ml-s-2 hidden w-[240px] rounded-md border border-border bg-surface px-s-3 py-s-2 text-label text-ink shadow-overlay group-hover/hit:block group-has-[:focus-visible]/hit:block">
        {TREE_RESIZE_HINT}
      </span>
    </div>
  );
}
