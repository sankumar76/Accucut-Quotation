import { describe, expect, it } from 'vitest';

import {
  clampTreeWidth,
  clearStoredTreeWidth,
  FORM_MIN_WIDTH,
  parseStoredTreeWidth,
  readStoredTreeWidth,
  TREE_FORM_GAP,
  TREE_WIDTH_DEFAULT,
  TREE_WIDTH_MAX,
  TREE_WIDTH_MIN,
  treeWidthCeiling,
  treeWidthStorageKey,
  writeStoredTreeWidth,
  type WidthStorage,
} from '@/lib/ui/tree-width';

/**
 * AQP-426 (STORY-CR01.3E, FR-112; UX ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, "Item 15 specification"): the pure rules of the resizable parts tree. Every width on the page comes from
 * `clampTreeWidth`; the stored value is read by `parseStoredTreeWidth` and never rewritten by a clamp. No browser is needed. Every ID is invented.
 */

/** A workspace wide enough that the room never limits the tree (about 728 px at 1024 px, the ruling's measure, and more). */
const ROOMY = 1200;
/** A workspace with room for 360 px of tree: 360 + gap + the form's 232 px. */
const ROOM_FOR_360 = 360 + TREE_FORM_GAP + FORM_MIN_WIDTH;

const memory = (initial: Record<string, string> = {}): WidthStorage & { readonly data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
};

const throwing: WidthStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('the numbers (AC-1, AC-6)', () => {
  it('are 320 by default, 240 at the least and 400 at the most, with 232 px kept for the form', () => {
    expect([TREE_WIDTH_DEFAULT, TREE_WIDTH_MIN, TREE_WIDTH_MAX, FORM_MIN_WIDTH, TREE_FORM_GAP]).toEqual([320, 240, 400, 232, 16]);
  });
});

describe('treeWidthCeiling: the effective maximum (AC-6)', () => {
  it('is 400 where there is room, and the room less the gap and the form where there is not', () => {
    expect(treeWidthCeiling(ROOMY)).toBe(400);
    expect(treeWidthCeiling(728)).toBe(400); // 1024 px: side menu 248, padding 2 x 24
    expect(treeWidthCeiling(ROOM_FOR_360)).toBe(360);
  });

  it('is 400 while the workspace has not been measured', () => {
    expect(treeWidthCeiling(null)).toBe(400);
    expect(treeWidthCeiling(Number.NaN)).toBe(400);
  });

  it('never falls below the minimum, so aria-valuemax is never under aria-valuemin', () => {
    expect(treeWidthCeiling(300)).toBe(TREE_WIDTH_MIN);
    expect(treeWidthCeiling(0)).toBe(TREE_WIDTH_MIN);
  });
});

describe('clampTreeWidth (AC-3, AC-6, AC-8)', () => {
  it('keeps a width inside the range', () => {
    expect(clampTreeWidth(300, ROOMY)).toBe(300);
    expect(clampTreeWidth(240, ROOMY)).toBe(240);
    expect(clampTreeWidth(400, ROOMY)).toBe(400);
  });

  it('raises a width below 240 to 240 and lowers one above 400 to 400', () => {
    expect(clampTreeWidth(100, ROOMY)).toBe(240);
    expect(clampTreeWidth(-5, ROOMY)).toBe(240);
    expect(clampTreeWidth(1000, ROOMY)).toBe(400);
  });

  it('lowers a width above the room to the room', () => {
    expect(clampTreeWidth(400, ROOM_FOR_360)).toBe(360);
    expect(clampTreeWidth(360, ROOM_FOR_360)).toBe(360);
  });

  it('gives 320 for a value that is not a number, then clamps that', () => {
    expect(clampTreeWidth(Number.NaN, ROOMY)).toBe(320);
    expect(clampTreeWidth(Number.POSITIVE_INFINITY, ROOMY)).toBe(400);
    expect(clampTreeWidth(Number.NEGATIVE_INFINITY, ROOMY)).toBe(240);
    expect(clampTreeWidth(Number.NaN, 500)).toBe(252);
  });

  it('rounds a width that is not a whole number of pixels', () => {
    expect(clampTreeWidth(300.4, ROOMY)).toBe(300);
    expect(clampTreeWidth(300.5, ROOMY)).toBe(301);
  });

  it('measures nothing against an unmeasured workspace', () => {
    expect(clampTreeWidth(400, null)).toBe(400);
  });
});

describe('parseStoredTreeWidth (AC-8)', () => {
  it('reads an integer from 240 to 400 written as text', () => {
    expect(parseStoredTreeWidth('240')).toBe(240);
    expect(parseStoredTreeWidth('320')).toBe(320);
    expect(parseStoredTreeWidth('400')).toBe(400);
  });

  it.each([null, undefined, '', 'abc', '300.5', '1000', '239', '401', '-300', ' 300', '300 ', '3e2', '0x140', 'NaN', '１２３'])('ignores %j', (raw) => {
    expect(parseStoredTreeWidth(raw)).toBeNull();
  });
});

describe('the stored width (AC-8)', () => {
  it('is kept under aqp.ui.treeWidth.<userId>, as the integer in text', () => {
    expect(treeWidthStorageKey('u-1')).toBe('aqp.ui.treeWidth.u-1');
    const storage = memory();
    writeStoredTreeWidth('u-1', 360, storage);
    expect(storage.data.get('aqp.ui.treeWidth.u-1')).toBe('360');
    expect(readStoredTreeWidth('u-1', storage)).toBe(360);
  });

  it('is one number per user', () => {
    const storage = memory();
    writeStoredTreeWidth('u-1', 360, storage);
    writeStoredTreeWidth('u-2', 280, storage);
    expect(readStoredTreeWidth('u-1', storage)).toBe(360);
    expect(readStoredTreeWidth('u-2', storage)).toBe(280);
    expect(readStoredTreeWidth('u-3', storage)).toBeNull();
  });

  it('is removed by a reset', () => {
    const storage = memory({ 'aqp.ui.treeWidth.u-1': '360' });
    clearStoredTreeWidth('u-1', storage);
    expect(storage.data.has('aqp.ui.treeWidth.u-1')).toBe(false);
    expect(readStoredTreeWidth('u-1', storage)).toBeNull();
  });

  it('reads a value that is not valid as nothing, and leaves it where it is', () => {
    const storage = memory({ 'aqp.ui.treeWidth.u-1': '1000' });
    expect(readStoredTreeWidth('u-1', storage)).toBeNull();
    expect(storage.data.get('aqp.ui.treeWidth.u-1')).toBe('1000');
  });

  it('is not rewritten by a clamp: a stored 400 on a window with room for 360 shows 360 and is still 400 after (AC-6, AC-8)', () => {
    const storage = memory({ 'aqp.ui.treeWidth.u-1': '400' });
    const stored = readStoredTreeWidth('u-1', storage);
    expect(stored).toBe(400);
    expect(clampTreeWidth(stored ?? TREE_WIDTH_DEFAULT, ROOM_FOR_360)).toBe(360);
    expect(treeWidthCeiling(ROOM_FOR_360)).toBe(360);
    expect(storage.data.get('aqp.ui.treeWidth.u-1')).toBe('400');
    expect(clampTreeWidth(stored ?? TREE_WIDTH_DEFAULT, ROOMY)).toBe(400);
  });

  it('reads as nothing, and writes and removes with no error, where the storage throws (private window, blocked site data)', () => {
    expect(readStoredTreeWidth('u-1', throwing)).toBeNull();
    expect(() => writeStoredTreeWidth('u-1', 360, throwing)).not.toThrow();
    expect(() => clearStoredTreeWidth('u-1', throwing)).not.toThrow();
  });

  it('reads as nothing, and writes with no error, where there is no storage at all', () => {
    expect(readStoredTreeWidth('u-1', null)).toBeNull();
    expect(() => writeStoredTreeWidth('u-1', 360, null)).not.toThrow();
    expect(() => clearStoredTreeWidth('u-1', null)).not.toThrow();
  });
});
