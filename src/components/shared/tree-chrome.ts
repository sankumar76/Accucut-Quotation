/**
 * The chrome of the editing parts tree that is not a control (DL-465, PRF-811-03): the review's first paint draws the read-only tree and the editing island takes its place, so the read-only tree reserves what the island
 * adds (a toolbar line under each row and the foot with "Add main assembly") with these strings, **server-side only**. The editing tree (`TreePanel`, `PartsTreeList`) keeps its own copies of the same strings so that no
 * module of the first load grows by a module boundary (the first load of the route is held to its ceiling to the byte); `review-tree-reserve.test.ts` reads both and fails if they differ. A module with no import.
 */

/** The foot of a parts tree: a hairline, "Add main assembly" under it, and then the legends (DEF-081 items 13 and 14). The same string as `TreePanel`'s `data-tree-foot`. */
export const TREE_FOOT = 'flex flex-col gap-s-3 border-t border-border pt-s-3';

/**
 * The line the toolbar of the selected row takes for a finger, held by the read-only tree of the first paint (inert, no content): the same height as the toolbar, `--tree-slot-h`. For a mouse the slot `PartsTreeList` draws
 * under every row (`relative col-start-2 min-w-0 mouse:min-h-(--tree-slot-h)`) is the reserve: it has that least height whether the toolbar is in view or not, and the read-only tree draws it when it is given a toolbar.
 */
export const TOOLBAR_RESERVE = 'hidden h-(--tree-slot-h) touch:group-has-[[aria-current=true]]/row:block';
