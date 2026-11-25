import { describe, expect, it, vi } from 'vitest';

import {
  createReorder,
  DRAG_START_PX,
  dropIndexOf,
  dropLineY,
  SCROLL_EDGE_PX,
  SCROLL_MAX_STEP_PX,
  scrollStepOf,
  type Box,
  type ReorderHost,
} from '@/components/features/estimate-workspace/tree-reorder';

/**
 * AQP-406 (CR-01 item 3D; ADR-020 R1; A-CR01-5 confirmed 2026-11-23): where a dragged row lands among the rows with the same parent, where the red line goes, how the panel scrolls at its edge, and the
 * order of a drag's events. Pure code: the boxes are the page's siblings in the order they are drawn, each with everything under it. The pointer and the page are the browser's and are judged by
 * `tests/e2e/estimate-tree.spec.ts` at three widths.
 */

/** Three siblings, the middle one tall because it has rows under it: 0 to 40, 40 to 160, 160 to 200. */
const THREE: ReadonlyArray<Box> = [
  { top: 0, bottom: 40 },
  { top: 40, bottom: 160 },
  { top: 160, bottom: 200 },
];

describe('AC-1: dropIndexOf, the place the row is let go at', () => {
  it('swaps two Main Assemblies: dragging the first below the middle of the second gives place 1, above it gives place 0', () => {
    const two: ReadonlyArray<Box> = [
      { top: 0, bottom: 100 },
      { top: 100, bottom: 200 },
    ];
    expect(dropIndexOf(two, 0, 160)).toBe(1);
    expect(dropIndexOf(two, 0, 120)).toBe(0);
    // And the second dragged above the middle of the first.
    expect(dropIndexOf(two, 1, 40)).toBe(0);
    expect(dropIndexOf(two, 1, 60)).toBe(1);
  });

  it('counts the other siblings whose middle is above the pointer, so a tall sibling with a subtree is passed once its middle is', () => {
    // Dragging the first row: the others are the tall one (middle 100) and the last (middle 180).
    expect(dropIndexOf(THREE, 0, 50)).toBe(0);
    expect(dropIndexOf(THREE, 0, 99)).toBe(0);
    expect(dropIndexOf(THREE, 0, 101)).toBe(1);
    expect(dropIndexOf(THREE, 0, 190)).toBe(2);
    // Dragging the last row up: the others are the first (middle 20) and the tall one (middle 100).
    expect(dropIndexOf(THREE, 2, 10)).toBe(0);
    expect(dropIndexOf(THREE, 2, 60)).toBe(1);
    expect(dropIndexOf(THREE, 2, 120)).toBe(2);
  });

  it('is the place the row has when the pointer is where the row is: nothing moves', () => {
    expect(dropIndexOf(THREE, 1, 100)).toBe(1);
    expect(dropIndexOf(THREE, 0, 20)).toBe(0);
    expect(dropIndexOf(THREE, 2, 180)).toBe(2);
  });

  it('is 0 for an only child, wherever the pointer is: there is no other place (AC-3)', () => {
    const only: ReadonlyArray<Box> = [{ top: 0, bottom: 40 }];
    for (const y of [-500, 0, 20, 900]) expect(dropIndexOf(only, 0, y)).toBe(0);
  });
});

describe('AC-1: dropLineY, the red line', () => {
  it('is at the top of the sibling the row lands before, and at the bottom of the last when the row goes last', () => {
    // The first row dragged: the line before the tall one (place 0 among the others), after it (place 1), after the last (place 2).
    expect(dropLineY(THREE, 0, 0)).toBe(40);
    expect(dropLineY(THREE, 0, 1)).toBe(160);
    expect(dropLineY(THREE, 0, 2)).toBe(200);
    // The last row dragged to the top.
    expect(dropLineY(THREE, 2, 0)).toBe(0);
  });

  it('is where the row is for an only child', () => {
    expect(dropLineY([{ top: 10, bottom: 50 }], 0, 0)).toBe(10);
  });
});

describe('AC-5: scrollStepOf, the panel scrolls at its edge', () => {
  const view: Box = { top: 100, bottom: 700 };

  it('does not scroll away from the edges', () => {
    expect(scrollStepOf(400, view)).toBe(0);
    expect(scrollStepOf(100 + SCROLL_EDGE_PX, view)).toBe(0);
    expect(scrollStepOf(700 - SCROLL_EDGE_PX, view)).toBe(0);
  });

  it('scrolls up near the top and down near the bottom, faster the nearer the edge, and at most one step', () => {
    expect(scrollStepOf(100, view)).toBe(-SCROLL_MAX_STEP_PX);
    expect(scrollStepOf(100 + SCROLL_EDGE_PX / 2, view)).toBe(-SCROLL_MAX_STEP_PX / 2);
    expect(scrollStepOf(700, view)).toBe(SCROLL_MAX_STEP_PX);
    expect(scrollStepOf(700 - SCROLL_EDGE_PX / 2, view)).toBe(SCROLL_MAX_STEP_PX / 2);
    expect(scrollStepOf(-300, view)).toBe(-SCROLL_MAX_STEP_PX);
    expect(scrollStepOf(2000, view)).toBe(SCROLL_MAX_STEP_PX);
  });
});

/** A page the test drives: the boxes scroll with `scrollBy`, and every line shown is kept. */
function page(boxes: ReadonlyArray<Box> = THREE, view: Box = { top: 0, bottom: 1000 }) {
  let offset = 0;
  const lines: Array<number | null> = [];
  const host: ReorderHost = {
    siblings: () => boxes.map((box) => ({ top: box.top - offset, bottom: box.bottom - offset })),
    view: () => view,
    scrollBy: (dy) => {
      offset += dy;
    },
    showLine: (y) => void lines.push(y),
  };
  return { host, lines, scrolled: () => offset };
}

describe('AC-1, AC-2: the order of a drag', () => {
  it('is a click, not a drag, until the pointer has gone DRAG_START_PX: no line, and ending it returns nothing', () => {
    const { host, lines } = page();
    const reorder = createReorder(host, 0, 20);
    reorder.move(20 + DRAG_START_PX - 1);
    expect(reorder.dragging).toBe(false);
    expect(reorder.end(20)).toBeNull();
    expect(lines).toEqual([null]);
  });

  it('shows the line at every move once it is a drag, and ends with the new place and the line hidden', () => {
    const { host, lines } = page();
    const reorder = createReorder(host, 0, 20);
    reorder.move(60);
    expect(reorder.dragging).toBe(true);
    reorder.move(120);
    expect(lines).toEqual([40, 160]);
    expect(reorder.end(120)).toBe(1);
    expect(lines.at(-1)).toBeNull();
    expect(reorder.dragging).toBe(false);
  });

  it('gives nothing when the row is let go at its own place, so no request is made', () => {
    const { host } = page();
    const reorder = createReorder(host, 1, 100);
    reorder.move(60);
    expect(reorder.end(100)).toBeNull();
  });

  it('gives nothing, and hides the line, when the drag is abandoned', () => {
    const { host, lines } = page();
    const reorder = createReorder(host, 0, 20);
    reorder.move(150);
    reorder.cancel();
    expect(reorder.dragging).toBe(false);
    expect(lines.at(-1)).toBeNull();
    expect(reorder.end(150)).toBeNull();
  });

  it('scrolls the panel at its edge in each frame of a drag, and moves the line with it, and does nothing in a click', () => {
    const { host, lines, scrolled } = page(THREE, { top: 0, bottom: 300 });
    const click = createReorder(host, 0, 300);
    click.frame();
    expect(scrolled()).toBe(0);
    const reorder = createReorder(host, 0, 100);
    reorder.move(300);
    reorder.frame();
    reorder.frame();
    expect(scrolled()).toBe(2 * SCROLL_MAX_STEP_PX);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    // The pointer back in the middle of the panel: no more scroll.
    reorder.move(150);
    reorder.frame();
    expect(scrolled()).toBe(2 * SCROLL_MAX_STEP_PX);
  });

  it('works out the drop from the boxes as they are after a scroll', () => {
    const scrolling = page(THREE, { top: 0, bottom: 300 });
    const reorder = createReorder(scrolling.host, 0, 100);
    reorder.move(300);
    for (let frame = 0; frame < 5; frame += 1) reorder.frame();
    // 5 frames of 16 px: the boxes moved up 80 px, so the pointer at 300 is now over what was at 380, past the last sibling.
    expect(scrolling.scrolled()).toBe(80);
    expect(reorder.end(300)).toBe(2);
  });

  it('calls showLine with null when it ends, so a stray line never stays on the page', () => {
    const showLine = vi.fn();
    const reorder = createReorder({ siblings: () => THREE, view: () => ({ top: 0, bottom: 100 }), scrollBy: vi.fn(), showLine }, 0, 0);
    reorder.end(0);
    expect(showLine).toHaveBeenCalledWith(null);
  });
});
