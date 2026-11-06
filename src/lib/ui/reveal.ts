/**
 * Brings a notice into view when it appears off-screen (UX spec v0.14, SCR-25 and SCR-14): `block: 'nearest'` moves the page
 * only as far as needed and not at all when the notice is already visible, and `behavior: 'auto'` never animates (no smooth
 * scroll, which would move content under a person who asked for less motion). Written apart from the component so a test can
 * hold the exact options (QLT-78).
 */

export interface Revealable {
  scrollIntoView(options: ScrollIntoViewOptions): void;
}

export const REVEAL_OPTIONS: ScrollIntoViewOptions = { block: 'nearest', behavior: 'auto' };

export function revealNearest(element: Revealable | null | undefined): void {
  element?.scrollIntoView(REVEAL_OPTIONS);
}
