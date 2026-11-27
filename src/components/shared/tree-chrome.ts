/**
 * The chrome of the editing parts tree that is not a control, written once (DL-465, PRF-811-03): the review's first paint draws the read-only tree and the editing island takes its place, so the read-only tree reserves
 * what the island adds (a toolbar line under each row and the foot with "Add main assembly") with these strings, and the island's tree draws its own with the same ones. A server-safe module with no import: the pages
 * that draw the first paint and the client code that draws the island both read it, and Tailwind finds the classes here.
 */

/**
 * The toolbar slot of a row: the second line of the row's grid, in the link's column, so it is under the name and never over it. It is `relative`, so the clipped toolbar of a row that is not shown (`sr-only`, absolutely
 * placed) stays at the foot of its own row. **For a mouse the slot has a fixed least height, `--tree-slot-h` (40 px; 48 px below 1024 px), whether the toolbar is in view or not** (DEF-129, DEF-132; UX ruling
 * tree-toolbar-no-shift-2026-11-27): the toolbar fills it when it shows, so showing or hiding it moves no row and the pointer can go down from one row onto the next one's link without anything sliding. A finger
 * has no reserved slot: its toolbar is on the selected row alone (`TOOLBAR_RESERVE` holds that line for it before the toolbar is there).
 */
export const TOOLBAR_SLOT = 'relative col-start-2 min-w-0 mouse:min-h-(--tree-slot-h)';

/** The line the toolbar of the selected row will take for a finger, held by the read-only tree of the first paint (inert, no content): the same height as the toolbar, `--tree-slot-h`. A mouse has `TOOLBAR_SLOT`'s own. */
export const TOOLBAR_RESERVE = 'hidden h-(--tree-slot-h) touch:group-has-[[aria-current=true]]/row:block';

/** The foot of a parts tree: a hairline, "Add main assembly" under it, and then the legends (DEF-081 items 13 and 14). */
export const TREE_FOOT = 'flex flex-col gap-s-3 border-t border-border pt-s-3';
