/**
 * The compact padding of the output screens (CR-01 item 1, UX spec section 0.9 row 1; AQP-388), as the classes a `CardContent` takes over its default (16 px, 24 px from 768 px). Written out whole, for the style scanner,
 * and twice (with and without `md:`), because the default has a rule from 768 px that a bare class would not beat. A figure tile (SCR-06) is 12 px by 16 px; a figure box (SCR-07) is 8 px by 12 px.
 */
export const COMPACT_TILE_PADDING = 'py-s-3 px-s-4 md:py-s-3 md:px-s-4';
export const COMPACT_BOX_PADDING = 'py-s-2 px-s-3 md:py-s-2 md:px-s-3';
