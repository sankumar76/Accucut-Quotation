/**
 * The width of the parts tree beside the form (AQP-426, STORY-CR01.3E, FR-112; UX ruling `docs/03-ux/rulings/parts-tree-vs-scr05-2026-11-24.md`, "Item 15 specification"), as pure functions: the numbers, the one
 * function that decides every width (`clampTreeWidth`), and the person's choice kept in the browser (`localStorage`, one number per signed-in user, no server call). Nothing here reads the page, so every rule
 * is proved without a browser. The keys, the drag and the three choices are in `tree-width-gestures.ts`, which only the resize controls load.
 */

/** The width when nobody has chosen one, and what a reset gives. */
export const TREE_WIDTH_DEFAULT = 320;
/** The least width: below it the indent, the arrow cell and a name leave no room. */
export const TREE_WIDTH_MIN = 240;
/** The most width, however much room there is. */
export const TREE_WIDTH_MAX = 400;
/** The form never gets less than one section card (14.5 rem), the minimum of the card grid and of the drawing region. */
export const FORM_MIN_WIDTH = 232;
/** The gap between the tree's card and the form's (`gap-s-4`). */
export const TREE_FORM_GAP = 16;

/**
 * The effective maximum: 400, or where less, the workspace width less the gap and the form's 232 px (UX-AC-15.6). Never under the minimum, so `aria-valuemax` is never under `aria-valuemin`. A workspace that has
 * not been measured yet (`null`) limits nothing.
 */
export function treeWidthCeiling(workspaceWidth: number | null): number {
  if (workspaceWidth === null || Number.isNaN(workspaceWidth)) return TREE_WIDTH_MAX;
  return Math.max(TREE_WIDTH_MIN, Math.min(TREE_WIDTH_MAX, workspaceWidth - TREE_FORM_GAP - FORM_MIN_WIDTH));
}

/**
 * The one function that decides every width on the page (UX-AC-15.3, 15.4, 15.6): a number that is not one gives 320, a fraction is rounded to a whole pixel, and the result is held between 240 and the effective
 * maximum. It clamps what is shown and never what is stored: a stored 400 on a window with room for 360 shows 360 and comes back as 400 on a bigger window.
 */
export function clampTreeWidth(value: number, workspaceWidth: number | null): number {
  const wanted = Number.isNaN(value) ? TREE_WIDTH_DEFAULT : value;
  const whole = Number.isFinite(wanted) ? Math.round(wanted) : wanted;
  return Math.max(TREE_WIDTH_MIN, Math.min(treeWidthCeiling(workspaceWidth), whole));
}

/** A stored width is the integer in plain digits, from 240 to 400; anything else (missing, "abc", "300.5", "1000", spaces, an exponent) is ignored and the default is used. */
export function parseStoredTreeWidth(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || !/^\d{1,4}$/.test(raw)) return null;
  const width = Number(raw);
  return width >= TREE_WIDTH_MIN && width <= TREE_WIDTH_MAX ? width : null;
}

/** Per browser and per signed-in user, so two engineers who share a PC each keep their own (UX-AC-15.8). One number for every estimate. */
export const treeWidthStorageKey = (userId: string): string => `aqp.ui.treeWidth.${userId}`;

/** The part of `Storage` this file uses, so a test can hand in a plain object. */
export type WidthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The browser's `localStorage`, or `null` where reaching it throws (a private window, blocked site data) or there is no browser. */
export function browserStorage(): WidthStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The stored width, or `null` for none, a bad value, or storage that cannot be read. No error is ever shown for it. */
export function readStoredTreeWidth(userId: string, storage: WidthStorage | null = browserStorage()): number | null {
  try {
    return parseStoredTreeWidth(storage?.getItem(treeWidthStorageKey(userId)));
  } catch {
    return null;
  }
}

/** Stores the width as text. A write that fails is swallowed: the width still applies for as long as the page is open. */
export function writeStoredTreeWidth(userId: string, width: number, storage: WidthStorage | null = browserStorage()): void {
  try {
    storage?.setItem(treeWidthStorageKey(userId), String(width));
  } catch {
    // Storage is full, blocked or off: the choice holds for this page only.
  }
}

/** A reset removes the key, so a later change of the default reaches this person. */
export function clearStoredTreeWidth(userId: string, storage: WidthStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(treeWidthStorageKey(userId));
  } catch {
    // Nothing to remove, or storage is blocked.
  }
}
