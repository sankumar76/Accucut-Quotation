import { Blocks, Bolt, Box, Boxes, type LucideIcon } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';
import type { NodeKind } from '@/lib/estimate/node-kinds';

/**
 * The shape of each kind of parts-tree row (CR-01 item 3B, UX spec section 0.9 row 3; AQP-404; DEF-081 ruling 2): stacked blocks for a Main Assembly, grouped blocks for a Sub-Assembly, one block for a Part and
 * a Sub-part (the two differ only in their name, which is derived), and a hex nut for a Fastener (lucide has no hex nut, and its `Nut` is a food nut, so `Bolt`, a hexagon with a round bore, stands for it). **The
 * shape tells the kind first and the tint second, never the colour alone** (NFR-018): the four shapes differ with no colour at all. The icons are lucide shapes from the installed package, so nothing is added
 * to the bundle but four small paths.
 */
export const NODE_KIND_ICON: Readonly<Record<NodeKind, LucideIcon>> = {
  MAIN_ASSEMBLY: Boxes,
  SUB_ASSEMBLY: Blocks,
  PART: Box,
  FASTENER: Bolt,
};

/**
 * The 24 px tile the glyph sits on (the SCR-05 mock-up's `.kind-ic`, DEF-081 ruling 1): a fixed footprint, so the rows line up whatever the glyph. The tile is decoration; the glyph carries the kind, and the
 * glyph's ink on the tile's fill keeps 3:1 (non-text contrast) for every kind.
 */
const TILE = 'inline-flex size-s-5 shrink-0 items-center justify-center rounded-sm';

/**
 * The fill and ink of each kind's tile, from the existing colour tokens (DEF-081 ruling 3): a second cue after the shape, each pair with its contrast promised by the design system. The Part and the Fastener
 * tints are close (the palette has no blue), so the shape, the tooltip and the legend are what tell those two apart.
 */
const NODE_KIND_TINT: Readonly<Record<NodeKind, string>> = {
  MAIN_ASSEMBLY: 'bg-primary-soft text-primary-ink',
  SUB_ASSEMBLY: 'bg-accent-soft text-accent-ink',
  PART: 'bg-surface-2 text-ink-2',
  FASTENER: 'bg-info-soft text-info-ink',
};

export interface NodeKindIconProps {
  readonly kind: NodeKind;
  /**
   * The name of the kind as `nodeKindLabel` gives it ("Part" or "Sub-part" by the siblings). It is the tooltip on hover and the spoken name of the icon for a screen reader. Leave it out where the words stand
   * beside the icon (the legend, the "+" menu): the icon is then decorative and hidden from assistive technology.
   */
  readonly label?: string | undefined;
  /** Extra classes for the tile. */
  readonly className?: string | undefined;
}

/** The icon of a row's kind on its tile, with its name when it stands alone. Shape first, tint second. */
export function NodeKindIcon({ kind, label, className }: NodeKindIconProps) {
  const named = label === undefined ? {} : { role: 'img', 'aria-label': label };
  return (
    <span className={cn(TILE, NODE_KIND_TINT[kind], className)}>
      <Icon icon={NODE_KIND_ICON[kind]} size="default" strokeWidth={1.75} data-node-kind={kind} {...named}>
        {label === undefined ? null : <title>{label}</title>}
      </Icon>
    </span>
  );
}
