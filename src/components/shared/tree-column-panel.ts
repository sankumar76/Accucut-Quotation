/**
 * The panel of a parts tree that is a column beside the page (AQP-465, DEF-108; AQP-452, DEF-113). Below 1024 px it is a foldable `details`. From 1024 px it is the left column: sticky below the top bar, as high as the
 * window leaves it (the sticky offsets are measured by `use-sticky-offsets`, with the top bar's height as the fallback) with a scroll of its own, and no longer foldable: the content is shown even if the element were
 * closed (`::details-content`, which a browser that does not know it simply ignores). SCR-06 and SCR-07 write it once, here; Tailwind finds the classes in this file.
 */
export const TREE_COLUMN_PANEL =
  'rounded-md border border-border bg-surface-2 min-[1024px]:sticky min-[1024px]:top-[var(--sticky-top,var(--topbar-h))] min-[1024px]:max-h-[calc(100dvh-var(--sticky-top,var(--topbar-h))-var(--sticky-bottom,0px)-var(--s-4))] min-[1024px]:overflow-y-auto min-[1024px]:[&::details-content]:[content-visibility:visible]';

/** The summary of that panel: the whole line is the control below 1024 px and takes no press from there. */
export const TREE_COLUMN_SUMMARY = 'flex min-h-(--control-h) cursor-pointer items-center px-s-4 text-body font-semibold text-ink min-[1024px]:pointer-events-none min-[1024px]:cursor-default';

/** The page that has the column: a stack below 1024 px, the tree's column and the rest from there. */
export const TREE_COLUMN_LAYOUT = 'flex flex-col gap-s-4 md:gap-s-5 min-[1024px]:grid min-[1024px]:grid-cols-[var(--tree-w)_minmax(0,1fr)] min-[1024px]:items-start';
