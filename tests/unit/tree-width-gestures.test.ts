import { describe, expect, it } from 'vitest';

import { FORM_MIN_WIDTH, TREE_FORM_GAP } from '@/lib/ui/tree-width';
import {
  dragCancel,
  dragEnd,
  dragMove,
  dragStart,
  presetFits,
  presetOfWidth,
  TREE_WIDTH_PRESETS,
  treeWidthForKey,
  type KeyPress,
} from '@/lib/ui/tree-width-gestures';

/**
 * AQP-426 (STORY-CR01.3E, FR-112): the keys, the drag and the three choices of the resizable parts tree as pure functions, so no browser and no pointer event is needed to prove them (AC-3, AC-4, AC-7). Every ID is invented.
 */

const ROOMY = 1200;
const ROOM_FOR_360 = 360 + TREE_FORM_GAP + FORM_MIN_WIDTH;
const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({ key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...extra });

describe('treeWidthForKey (AC-4)', () => {
  it('Left narrows and Right widens by 16 px', () => {
    expect(treeWidthForKey(320, press('ArrowLeft'), ROOMY)).toEqual({ width: 304, reset: false });
    expect(treeWidthForKey(320, press('ArrowRight'), ROOMY)).toEqual({ width: 336, reset: false });
  });

  it('Shift+Left and Shift+Right move by 64 px', () => {
    expect(treeWidthForKey(320, press('ArrowLeft', { shiftKey: true }), ROOMY)).toEqual({ width: 256, reset: false });
    expect(treeWidthForKey(320, press('ArrowRight', { shiftKey: true }), ROOMY)).toEqual({ width: 384, reset: false });
  });

  it('Home is 240 and End is the effective maximum', () => {
    expect(treeWidthForKey(320, press('Home'), ROOMY)).toEqual({ width: 240, reset: false });
    expect(treeWidthForKey(320, press('End'), ROOMY)).toEqual({ width: 400, reset: false });
    expect(treeWidthForKey(320, press('End'), ROOM_FOR_360)).toEqual({ width: 360, reset: false });
  });

  it('Enter is the standard width, and says it is a reset', () => {
    expect(treeWidthForKey(400, press('Enter'), ROOMY)).toEqual({ width: 320, reset: true });
    expect(treeWidthForKey(240, press('Enter'), ROOMY)).toEqual({ width: 320, reset: true });
  });

  it('clamps at both ends', () => {
    expect(treeWidthForKey(240, press('ArrowLeft'), ROOMY)?.width).toBe(240);
    expect(treeWidthForKey(250, press('ArrowLeft', { shiftKey: true }), ROOMY)?.width).toBe(240);
    expect(treeWidthForKey(400, press('ArrowRight'), ROOMY)?.width).toBe(400);
    expect(treeWidthForKey(390, press('ArrowRight', { shiftKey: true }), ROOMY)?.width).toBe(400);
    expect(treeWidthForKey(360, press('ArrowRight'), ROOM_FOR_360)?.width).toBe(360);
  });

  it('steps from the width that is shown, whole pixels from there', () => {
    expect(treeWidthForKey(360, press('ArrowLeft'), ROOM_FOR_360)?.width).toBe(344);
  });

  it('does nothing, and does not take the key, for Up, Down and every other key', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Tab', 'a', ' ', 'PageUp', 'PageDown', 'Escape', 'Backspace']) {
      expect(treeWidthForKey(320, press(key), ROOMY), key).toBeNull();
    }
  });

  it('leaves the browser its own shortcuts (Alt+Left is Back)', () => {
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      expect(treeWidthForKey(320, press('ArrowLeft', { [modifier]: true }), ROOMY), modifier).toBeNull();
      expect(treeWidthForKey(320, press('Home', { [modifier]: true }), ROOMY), modifier).toBeNull();
    }
  });
});

describe('the drag (AC-3)', () => {
  it('begins at the width shown and the pointer where it went down, and has changed nothing yet', () => {
    const drag = dragStart(320, 500);
    expect(drag).toEqual({ startX: 500, startWidth: 320, width: 320 });
    expect(dragEnd(drag)).toEqual({ width: 320, store: false });
  });

  it('follows the pointer: right widens and left narrows, by the distance moved', () => {
    const drag = dragStart(320, 500);
    expect(dragMove(drag, 540, ROOMY).width).toBe(360);
    expect(dragMove(drag, 460, ROOMY).width).toBe(280);
  });

  it('measures from where the drag began, not from the last move', () => {
    let drag = dragStart(320, 500);
    drag = dragMove(drag, 600, ROOMY);
    drag = dragMove(drag, 520, ROOMY);
    expect(drag.width).toBe(340);
  });

  it('never goes under 240 or over the effective maximum, however far the pointer goes', () => {
    const drag = dragStart(320, 500);
    expect(dragMove(drag, -4000, ROOMY).width).toBe(240);
    expect(dragMove(drag, 4000, ROOMY).width).toBe(400);
    expect(dragMove(drag, 4000, ROOM_FOR_360).width).toBe(360);
  });

  it('comes back from the end of the range as soon as the pointer does (no stuck width)', () => {
    let drag = dragStart(320, 500);
    drag = dragMove(drag, 4000, ROOMY);
    drag = dragMove(drag, 560, ROOMY);
    expect(drag.width).toBe(380);
  });

  it('is stored once, at the end, and only if the width changed (a bare click only takes focus)', () => {
    let drag = dragStart(320, 500);
    drag = dragMove(drag, 540, ROOMY);
    expect(dragEnd(drag)).toEqual({ width: 360, store: true });
    drag = dragMove(drag, 500, ROOMY);
    expect(dragEnd(drag)).toEqual({ width: 320, store: false });
  });

  it('is undone by Escape: the width the drag began with, and nothing to store', () => {
    let drag = dragStart(320, 500);
    drag = dragMove(drag, 560, ROOMY);
    const cancelled = dragCancel(drag);
    expect(cancelled.width).toBe(320);
    expect(dragEnd(cancelled)).toEqual({ width: 320, store: false });
  });

  it('does not change the state it was given (the move is a function of the start)', () => {
    const drag = dragStart(320, 500);
    dragMove(drag, 560, ROOMY);
    expect(drag).toEqual({ startX: 500, startWidth: 320, width: 320 });
  });
});

describe('the three choices of the Tree width button (AC-7)', () => {
  it('are Narrow 256, Standard 320 and Wide 400, in that order', () => {
    expect(TREE_WIDTH_PRESETS.map((preset) => [preset.id, preset.width])).toEqual([
      ['narrow', 256],
      ['standard', 320],
      ['wide', 400],
    ]);
  });

  it('are all offered where there is room', () => {
    for (const preset of TREE_WIDTH_PRESETS) expect(presetFits(preset, ROOMY), preset.id).toBe(true);
    for (const preset of TREE_WIDTH_PRESETS) expect(presetFits(preset, null), preset.id).toBe(true);
  });

  it('turn off the ones larger than the effective maximum, and no others', () => {
    const fits = TREE_WIDTH_PRESETS.map((preset) => presetFits(preset, ROOM_FOR_360));
    expect(fits).toEqual([true, true, false]);
    const tight = 300 + TREE_FORM_GAP + FORM_MIN_WIDTH;
    expect(TREE_WIDTH_PRESETS.map((preset) => presetFits(preset, tight))).toEqual([true, false, false]);
  });

  it('are found again from a width: the choice that is shown as chosen', () => {
    expect(presetOfWidth(256)?.id).toBe('narrow');
    expect(presetOfWidth(320)?.id).toBe('standard');
    expect(presetOfWidth(400)?.id).toBe('wide');
    expect(presetOfWidth(300)).toBeNull();
  });
});
