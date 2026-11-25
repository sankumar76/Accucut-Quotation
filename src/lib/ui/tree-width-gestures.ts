import { clampTreeWidth, TREE_WIDTH_DEFAULT, TREE_WIDTH_MIN, treeWidthCeiling } from './tree-width';

/**
 * What the keys, the pointer and the "Tree width" button do to the width of the parts tree (AQP-426, UX-AC-15.3, 15.4, 15.7), as pure functions of the width before. The page applies the answer; none of it touches the
 * page, so the rules are proved without a browser or a pointer event. Loaded with the resize controls, not in the first load (NFR-009).
 */

/** An arrow key moves the edge by 16 px; with Shift by 64 px (four steps). */
export const TREE_WIDTH_STEP = 16;
export const TREE_WIDTH_STEP_LARGE = 64;

/** The part of a key event the rules read. */
export interface KeyPress {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/** What a key does: the new width, and whether it is the reset (which removes the stored width and is announced). `null` for a key that is not the handle's. */
export type KeyOutcome = { readonly width: number; readonly reset: boolean } | null;

/**
 * The handle's keys (UX-AC-15.4): Left narrows and Right widens by 16 (64 with Shift), Home is 240, End is the effective maximum and Enter is the standard width. Up, Down and every other key return `null`, so
 * the page does not take them and scrolls as usual; so does a key held with Alt, Ctrl or Meta, which are the browser's (Alt+Left is Back).
 */
export function treeWidthForKey(current: number, press: KeyPress, workspaceWidth: number | null): KeyOutcome {
  if (press.altKey || press.ctrlKey || press.metaKey) return null;
  const step = press.shiftKey ? TREE_WIDTH_STEP_LARGE : TREE_WIDTH_STEP;
  switch (press.key) {
    case 'ArrowLeft':
      return { width: clampTreeWidth(current - step, workspaceWidth), reset: false };
    case 'ArrowRight':
      return { width: clampTreeWidth(current + step, workspaceWidth), reset: false };
    case 'Home':
      return { width: TREE_WIDTH_MIN, reset: false };
    case 'End':
      return { width: treeWidthCeiling(workspaceWidth), reset: false };
    case 'Enter':
      return { width: clampTreeWidth(TREE_WIDTH_DEFAULT, workspaceWidth), reset: true };
    default:
      return null;
  }
}

/** A drag in progress: where the pointer went down, the width then, and the width now. */
export interface DragState {
  readonly startX: number;
  readonly startWidth: number;
  readonly width: number;
}

export const dragStart = (width: number, x: number): DragState => ({ startX: x, startWidth: width, width });

/** The width follows the pointer by the distance from where it went down, held between 240 and the effective maximum (UX-AC-15.3). */
export const dragMove = (state: DragState, x: number, workspaceWidth: number | null): DragState => ({ ...state, width: clampTreeWidth(state.startWidth + (x - state.startX), workspaceWidth) });

/** Escape: back to the width the drag began with. */
export const dragCancel = (state: DragState): DragState => ({ ...state, width: state.startWidth });

/** The end of the gesture: the width to keep, and whether it is to be stored (only if it changed, so a bare click only takes focus). Nothing is stored while the pointer moves. */
export const dragEnd = (state: DragState): { readonly width: number; readonly store: boolean } => ({ width: state.width, store: state.width !== state.startWidth });

export type TreeWidthPresetId = 'narrow' | 'standard' | 'wide';

export interface TreeWidthPreset {
  readonly id: TreeWidthPresetId;
  readonly width: number;
}

/** The three choices of the "Tree width" button, the way to resize without dragging (WCAG 2.2 SC 2.5.7): Narrow 256, Standard 320 (also the reset) and Wide 400. */
export const TREE_WIDTH_PRESETS: ReadonlyArray<TreeWidthPreset> = [
  { id: 'narrow', width: 256 },
  { id: 'standard', width: TREE_WIDTH_DEFAULT },
  { id: 'wide', width: 400 },
];

/** A choice larger than the effective maximum is turned off, with the reason stated. */
export const presetFits = (preset: TreeWidthPreset, workspaceWidth: number | null): boolean => preset.width <= treeWidthCeiling(workspaceWidth);

/** The choice that has this width, to show it as chosen; `null` for a width set by the handle or the keys. */
export const presetOfWidth = (width: number): TreeWidthPreset | null => TREE_WIDTH_PRESETS.find((preset) => preset.width === width) ?? null;
