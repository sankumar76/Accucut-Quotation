'use client';

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import { clampTreeWidth, TREE_WIDTH_DEFAULT, TREE_WIDTH_MIN } from '@/lib/ui/tree-width';
import { dragCancel, dragEnd, dragMove, dragStart, presetOfWidth, treeWidthForKey, type DragState } from '@/lib/ui/tree-width-gestures';

import { TREE_COLUMN_ID, TREE_RESIZE_HINT, TREE_RESIZE_HINT_ID, TREE_RESIZE_LABEL, treeWidthAnnouncement, treeWidthValueText } from './tree-width-texts';
import type { TreeWidth } from './use-tree-width';

export interface TreeResizeHandleProps {
  readonly resize: TreeWidth;
  /** Said politely after a reset (the tree's live region). */
  readonly announce: (text: string) => void;
}

/** Set on `<html>` for the length of a drag: the cursor is `col-resize` over the whole page and text cannot be selected (`globals.css`). */
const DRAGGING_ATTRIBUTE = 'data-tree-resizing';

/**
 * The handle on the tree card's right edge (AQP-426, STORY-CR01.3E, UX-AC-15.2 to 15.5, 15.9, 15.10, 15.12): a `div` with `role="separator"` that can take the focus (a `button` may not carry that role), full height of the
 * column, **24 px wide** with a mouse (from the card's right edge: the gap and 8 px of the form's side) and **44 px** with a finger (the gap and the 28 px of the card's own padding before it, so nothing of the form lies under it), `touch-action: none`, inside the column's `position: relative` wrapper and **not** inside the box that scrolls. The grip is a 4 x 40 px bar in `--border-strong`
 * (3:1 on the page and the card), `--primary` on hover, focus and drag; keyboard focus draws the 3 px `--focus` ring around a 12 x 48 px pill behind the grip, not around the strip. Nothing is animated.
 *
 * Mouse and finger: a drag follows the pointer between 240 px and the effective maximum, writes `--tree-w` in an animation frame (no React render per pixel), and is stored once, when the pointer goes up. Escape restores
 * the width the drag began with. A bare click only takes the focus. Keys: Left and Right 16 px, with Shift 64 px, Home 240, End the effective maximum, Enter and a double click 320 (and the stored width is removed). Up, Down
 * and other keys are not taken. The separator's own value is read by a screen reader as a key repeats; only a reset is announced.
 */
export function TreeResizeHandle({ resize, announce }: TreeResizeHandleProps) {
  const { width, ceiling, workspaceWidth, preview, commit } = resize;
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  /** The separator's numbers follow the drag directly, because React is not asked to render for each pixel. */
  const showValue = (pixels: number): void => {
    handle.current?.setAttribute('aria-valuenow', String(pixels));
    handle.current?.setAttribute('aria-valuetext', treeWidthValueText(pixels));
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

  // The tooltip is the hint itself: `display: none` at rest, so it is read from `aria-describedby` and shown on hover and keyboard focus.
  return (
    <div
      ref={handle}
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
      className="group absolute top-0 bottom-0 left-full z-(--z-handle) flex w-s-5 cursor-col-resize touch-none justify-center focus-visible:outline-none pointer-coarse:left-[calc(100%_-_28px)] pointer-coarse:w-[44px]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
    >
      {/* The pill behind the grip: it carries the focus ring, so the ring is a small shape around the grip and not the full-height strip. */}
      <span aria-hidden="true" className="absolute top-1/2 left-[2px] pointer-coarse:left-[30px] h-[48px] w-[12px] -translate-y-1/2 rounded-full group-focus-visible:bg-surface group-focus-visible:outline-[3px] group-focus-visible:outline-offset-2 group-focus-visible:outline-focus" />
      <span aria-hidden="true" data-tree-grip="" className="absolute top-1/2 left-[6px] pointer-coarse:left-[34px] h-[40px] w-[4px] -translate-y-1/2 rounded-full bg-border-strong group-hover:bg-primary group-focus-visible:bg-primary" />
      <span id={TREE_RESIZE_HINT_ID} role="tooltip" className="absolute top-s-2 left-full ml-s-2 hidden w-[240px] rounded-md border border-border bg-surface px-s-3 py-s-2 text-label text-ink shadow-overlay group-hover:block group-focus-visible:block">
        {TREE_RESIZE_HINT}
      </span>
    </div>
  );
}
