import { describe, expect, it, vi } from 'vitest';

import { createReorder, replayGesture, type Box, type GestureEvent, type ReorderHost } from '@/components/features/estimate-workspace/tree-reorder';

/**
 * AQP-406 (CR-01 item 3D; AC-5): the drag's code is fetched at the first pointer-down, so on a page that has not fetched it yet (a slow connection, or the development server compiling it on demand) the pointer can
 * move, and even be let go, before it arrives. What the handle kept is played into the new drag, so a quick first drag is the same drag. Three siblings, the middle one tall: 0 to 40, 40 to 160, 160 to 200.
 */

const THREE: ReadonlyArray<Box> = [
  { top: 0, bottom: 40 },
  { top: 40, bottom: 160 },
  { top: 160, bottom: 200 },
];

function page() {
  const lines: Array<number | null> = [];
  const host: ReorderHost = { siblings: () => THREE, view: () => ({ top: 0, bottom: 1000 }), scrollBy: vi.fn(), showLine: (y) => void lines.push(y) };
  return { host, lines };
}

/** The same gesture played live, move by move, as the reference. */
function live(events: ReadonlyArray<GestureEvent>, from: number, startY: number): number | null {
  const { host } = page();
  const reorder = createReorder(host, from, startY);
  let index: number | null = null;
  for (const event of events) {
    if (event.kind === 'move') reorder.move(event.y);
    else if (event.kind === 'up') index = reorder.end(event.y);
    else reorder.cancel();
  }
  return index;
}

describe('replayGesture: a drag that was over before the drag\'s code arrived', () => {
  const GESTURE: ReadonlyArray<GestureEvent> = [
    { kind: 'move', y: 30 },
    { kind: 'move', y: 90 },
    { kind: 'move', y: 190 },
    { kind: 'up', y: 190 },
  ];

  it('drops at the place the same gesture gives when it is played live', () => {
    const { host } = page();
    const replayed = replayGesture(createReorder(host, 0, 20), GESTURE);
    expect(replayed).toEqual({ ended: true, index: 2 });
    expect(replayed.index).toBe(live(GESTURE, 0, 20));
  });

  it('shows the line for the moves it plays, and hides it at the end', () => {
    const { host, lines } = page();
    replayGesture(createReorder(host, 0, 20), GESTURE);
    expect(lines.slice(0, 3)).toEqual([40, 40, 200]);
    expect(lines.at(-1)).toBeNull();
  });

  it('drops nothing when the pointer went and came back to the row\'s own place, and nothing for a press that never moved', () => {
    const { host } = page();
    expect(replayGesture(createReorder(host, 1, 100), [{ kind: 'move', y: 10 }, { kind: 'move', y: 100 }, { kind: 'up', y: 100 }])).toEqual({ ended: true, index: null });
    expect(replayGesture(createReorder(page().host, 1, 100), [{ kind: 'up', y: 101 }])).toEqual({ ended: true, index: null });
  });

  it('drops nothing, and hides the line, when the pointer was cancelled', () => {
    const { host, lines } = page();
    const replayed = replayGesture(createReorder(host, 0, 20), [{ kind: 'move', y: 150 }, { kind: 'cancel', y: 150 }]);
    expect(replayed).toEqual({ ended: true, index: null });
    expect(lines.at(-1)).toBeNull();
  });

  it('stops at the end of the gesture: what comes after an up or a cancel is not played', () => {
    const { host } = page();
    const replayed = replayGesture(createReorder(host, 0, 20), [{ kind: 'up', y: 20 }, { kind: 'move', y: 190 }, { kind: 'up', y: 190 }]);
    expect(replayed).toEqual({ ended: true, index: null });
  });
});

describe('replayGesture: a drag that was still going when the drag\'s code arrived', () => {
  it('goes on, with the line where the pointer is, and drops where the pointer is let go next', () => {
    const { host, lines } = page();
    const reorder = createReorder(host, 0, 20);
    expect(replayGesture(reorder, [{ kind: 'move', y: 30 }, { kind: 'move', y: 120 }])).toEqual({ ended: false, index: null });
    expect(reorder.dragging).toBe(true);
    expect(lines.at(-1)).toBe(160);
    expect(reorder.end(190)).toBe(2);
  });

  it('is nothing at all when the pointer did nothing yet: the drag starts as if the code had been here', () => {
    const { host, lines } = page();
    const reorder = createReorder(host, 0, 20);
    expect(replayGesture(reorder, [])).toEqual({ ended: false, index: null });
    expect(reorder.dragging).toBe(false);
    expect(lines).toEqual([]);
  });

  it('treats moves under the threshold as a click, as live', () => {
    const { host } = page();
    const reorder = createReorder(host, 0, 20);
    replayGesture(reorder, [{ kind: 'move', y: 22 }, { kind: 'move', y: 19 }]);
    expect(reorder.dragging).toBe(false);
  });
});
