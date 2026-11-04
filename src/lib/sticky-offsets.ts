/**
 * Space that a focused element must stay clear of when sticky bars cover the page edges
 * (WCAG 2.4.11 Focus Not Obscured; architecture section 11 "Sticky bars"; UX spec section 8 "Focus").
 * The bars are measured, never fixed: on a phone the action bar wraps and is taller than on a desktop.
 */

export type StickyEdge = 'top' | 'bottom';

export interface StickyBar {
  readonly edge: StickyEdge;
  /** Rendered height in CSS pixels. */
  readonly height: number;
}

export interface StickyOffsets {
  readonly top: number;
  readonly bottom: number;
}

/** Gap kept between a bar and the focused element so the focus ring (3 px plus 2 px offset) is clear too. */
export const STICKY_CLEARANCE = 8;

/** Sums the bars on each edge and adds the clearance. An edge with no bar still gets the clearance. */
export function computeStickyOffsets(bars: ReadonlyArray<StickyBar>, clearance: number = STICKY_CLEARANCE): StickyOffsets {
  const total = (edge: StickyEdge): number =>
    bars.filter((bar) => bar.edge === edge).reduce((sum, bar) => sum + Math.max(0, bar.height), 0);
  return { top: Math.ceil(total('top') + clearance), bottom: Math.ceil(total('bottom') + clearance) };
}

export interface Reconciliation<T> {
  /** In the page now, not watched yet. */
  readonly add: ReadonlyArray<T>;
  /** Watched, but no longer in the page: stop watching so the removed element can be freed (QLT-08). */
  readonly remove: ReadonlyArray<T>;
}

/** Compares the bars being watched with the bars in the page. */
export function reconcileObserved<T>(observed: ReadonlySet<T>, current: ReadonlyArray<T>): Reconciliation<T> {
  const present = new Set(current);
  return { add: current.filter((bar) => !observed.has(bar)), remove: [...observed].filter((bar) => !present.has(bar)) };
}
