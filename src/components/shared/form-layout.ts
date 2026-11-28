/**
 * The class strings that decide the part form's size, in one place (DEF-145, PF-4 of `rulings/partform-placeholder-shape-2026-11-28.md`). **The form and its loading ghost both import them**: the cards, the
 * section strip, the fields, the head lines and the grid are laid out by these strings, so the ghost (`part-form-ghost.tsx`) has the form's number of cards, their widths and their rows at any width without a
 * pixel typed anywhere, and cannot drift from the form when someone changes its spacing (`tests/unit/part-form-ghost.test.ts` holds both to the module). Strings only: no component and no hook, so the server and
 * the lazy chunk may both import it, and the shell does not.
 */

/** A card's share of its row follows its weight (`--n`), and a card never overflows the row (`min-w-0`, in `Card`); below 768 px it takes the whole row. */
export const CARD_SHARE = 'flex-[var(--n)_1_calc(var(--n)_*_var(--compact-weight-unit))] max-md:flex-[1_1_100%]';

/**
 * The fields of a card: 12 px padding and gaps, an auto-fill grid with a least column, a multi-line box, the treatments and the picture across the row (the picture two columns, the whole row on a phone). The
 * form's own markers (`data-slot=textarea`, `data-treatments`, `data-picture-zone`) and the ghost's (`data-ghost-wide`, `data-ghost-picture`) are matched by the same rules.
 */
export const FIELDS =
  'grid grid-cols-[repeat(auto-fill,minmax(var(--compact-column-min),1fr))] gap-s-3 p-s-3 md:p-s-3 [&>:has([data-slot=textarea])]:col-span-full [&>[data-ghost-wide]]:col-span-full [&>[data-treatments]]:col-span-full [&>:has([data-picture-zone])]:col-span-full [&>[data-ghost-picture]]:col-span-full min-[480px]:[&>:has([data-picture-zone])]:col-span-2 min-[480px]:[&>[data-ghost-picture]]:col-span-2';

/** The number tile of a card (DEF-098; SCR-05 mock-up `.section-no`): 32 px; the ghost draws a grey block of the same size. */
export const NUMBER_TILE = 'inline-flex size-s-6 shrink-0 items-center justify-center rounded-md font-mono text-label font-medium text-on-fill';

/** A card's header, its title (the tile and the name) and the chips beside it. */
export const CARD_HEADER = 'px-s-3 py-s-2 md:px-s-3';
export const CARD_TITLE = 'flex min-w-0 flex-1 items-center gap-s-2';
export const RANGE_CHIP = 'rounded-sm bg-surface-2 px-s-1 font-mono text-label text-ink-2';
export const COUNT_TEXT = 'text-label text-ink-2 tabular-nums';

/** The section strip: the box, its list, an item and a link (the ghost draws the same box, not sticky, with spans for links). */
export const STRIP_BOX = 'min-w-0 rounded-md border border-border bg-surface px-s-2 shadow-card';
export const STRIP_STICKY = 'sticky top-(--topbar-h) z-(--z-bar)';
export const STRIP_LIST = 'relative flex min-w-0 gap-s-1 overflow-x-auto py-s-1';
export const STRIP_ITEM = 'shrink-0';
export const STRIP_LINK = 'inline-flex min-h-(--control-h) items-center gap-s-1 rounded-md px-s-2 text-body whitespace-nowrap text-ink no-underline';

/** One field: the box (label, control, hint, 8 px apart) and the hint's text. */
export const FIELD_BOX = 'flex min-w-0 flex-col gap-s-2';
export const HINT_TEXT = 'text-label text-ink-3';

/** The form: its root, the head (progress and status line), the completion row and the row of cards. */
export const FORM_ROOT = 'is-compact flex min-w-0 flex-1 flex-col gap-s-4';
export const HEAD_LINES = 'flex flex-col gap-s-1';
export const STATUS_LINE = 'text-label text-ink-3';
export const PROGRESS_ROW = 'flex min-w-0 flex-wrap items-center gap-x-s-3 gap-y-s-1';
export const PROGRESS_BAR_WIDTH = 'w-[10rem] shrink-0';
export const CARD_GRID = 'flex flex-wrap gap-s-3';

/** The picture's block while it loads (AQP-395; held within 2 px of the control by `estimate-picture.spec.ts`): the height at below 768, at 768 and from 1024 px. */
export const PICTURE_ZONE_HEIGHT = 'h-[146px] md:h-[130px] lg:h-[114px]';

/**
 * The same block for a picture field with no hint: the Lead's read-only view drops every hint (`reviewField`), and its control has no hint line below the box and a box 16 px lower from 768 px (read from the control at
 * 360, 768 and 1366 px on the Lead's review: 146, 114, 114; DEF-145, QLT-833-13). The placeholder of the picture and the ghost's picture block take it from here, so neither moves the page when the control arrives.
 */
export const PICTURE_ZONE_HEIGHT_UNHINTED = 'h-[146px] md:h-[114px]';

/**
 * The same unhinted box when the part **holds a picture** (PF-19): the editable control then has no prompt line, only the file's name, its size, Replace and Remove, so its box is 132 px high below 768 px and 116 px from
 * 768 px (read from the control at 360, 768, 1024 and 1366 px on the Lead's review with a one-line file name; a long name wraps and is taller). The ghost and the placeholder of the picture take it from here.
 */
export const PICTURE_ZONE_HEIGHT_HELD = 'h-[132px] md:h-[116px]';

/**
 * The least height the read-only form's picture box takes while the page is one a Lead or an Admin can correct (PF-19, DL-465): the read-only box is the thumbnail alone (74 px), the island's editable box is
 * `PICTURE_ZONE_HEIGHT_UNHINTED` (`_HELD` when a picture is held), and the swap must not move the page. Set on the block that holds the form (`#row-inputs`), so no prop reaches the form's code and nothing is added to the first load.
 * Written out here because Tailwind reads class names as written; `picture-zone-reserve.test.ts` derives each from the height above, so they cannot drift.
 */
export const PICTURE_ZONE_RESERVE = '[&_[data-picture-zone]]:min-h-[146px] md:[&_[data-picture-zone]]:min-h-[114px]';
export const PICTURE_ZONE_RESERVE_HELD = '[&_[data-picture-zone]]:min-h-[132px] md:[&_[data-picture-zone]]:min-h-[116px]';

/**
 * The picture's box when the page cannot change it (Approved, Quoted, Ignored; PF-17): the control then draws only the thumbnail, 48 px, in a box with 12 px of padding and a 1 px border on each side, at every width. Written from
 * the tokens that build it, not as a number (`--s-7` is the thumbnail, `--s-3` the padding).
 */
export const PICTURE_ZONE_HEIGHT_READONLY = 'h-[calc(var(--s-7)+2*var(--s-3)+2px)]';

/** A control's height: 44 px, 36 px from 1024 px with a fine pointer (`Input`, `NativeSelect`), and a multi-line box's least height (`Textarea`). `part-form-ghost.test.ts` reads those three components for the same strings. */
export const CONTROL_HEIGHT = 'h-(--control-h) compact-fine:h-(--compact-field-h)';
export const TEXTAREA_HEIGHT = 'min-h-(--textarea-min-h) compact:min-h-(--compact-textarea-min-h)';
