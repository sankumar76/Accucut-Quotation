import type { TreeWidthPresetId } from '@/lib/ui/tree-width-gestures';

/**
 * The words of the resizable parts tree (AQP-426, STORY-CR01.3E; UX ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, "Item 15 specification", UX-AC-15.2, 15.7, 15.13), written once. They are in their own
 * file because only the resize controls, which are fetched after the page is up, use them (NFR-009). No word names a rate, a price or a formula (UX-24).
 */

/** The name of the handle (a `separator`) on the tree's right edge. */
export const TREE_RESIZE_LABEL = 'Resize parts tree';
/** The hidden hint the handle is described by; the same words show as a tooltip on hover and keyboard focus. */
export const TREE_RESIZE_HINT = 'Drag, or use the left and right arrow keys. Enter resets to the standard width.';
export const TREE_RESIZE_HINT_ID = 'parts-tree-resize-hint';
export const treeWidthValueText = (pixels: number): string => `Parts tree ${pixels} pixels wide`;

/** The button in the tree card's head, the group of choices it opens, and the reason a choice is turned off. */
export const TREE_WIDTH_BUTTON = 'Tree width';
export const TREE_WIDTH_NO_ROOM = 'Not enough room at this window size';
export const TREE_WIDTH_DEFAULT_NOTE = 'default';

const CHOICE_NAME: Readonly<Record<TreeWidthPresetId, string>> = { narrow: 'Narrow', standard: 'Standard', wide: 'Wide' };
const CHOICE_WORD: Readonly<Record<TreeWidthPresetId, string>> = { narrow: 'narrow', standard: 'standard', wide: 'wide' };
export const treeWidthChoiceLabel = (id: TreeWidthPresetId, pixels: number): string => `${CHOICE_NAME[id]} (${pixels} px)`;

/** Said politely, with no focus move, after a choice or a reset ("Parts tree width: standard, 320 pixels."). The keys of the handle are read from its own value. */
export const treeWidthAnnouncement = (id: TreeWidthPresetId, pixels: number): string => `Parts tree width: ${CHOICE_WORD[id]}, ${pixels} pixels.`;
