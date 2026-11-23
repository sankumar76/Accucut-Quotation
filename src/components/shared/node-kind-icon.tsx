import { Box, Boxes, Layers, Nut, type LucideIcon } from 'lucide-react';

import { Icon, type IconProps } from '@/components/shared/icon';
import { cn } from '@/lib/cn';
import type { NodeKind } from '@/lib/estimate/node-kinds';

/**
 * The shape of each kind of parts-tree row (CR-01 item 3B, UX spec section 0.9 row 3; AQP-404): stacked blocks for a Main Assembly, grouped blocks for a Sub-Assembly, one block for a Part and a Sub-part (the
 * two differ only in their name, which is derived), and a hex nut for a Fastener. **The shape tells the kind first and the tint second, never the colour alone** (NFR-018): the four shapes differ with no colour
 * at all. The icons are lucide shapes from the installed package, so nothing is added to the bundle but four small paths.
 */
export const NODE_KIND_ICON: Readonly<Record<NodeKind, LucideIcon>> = {
  MAIN_ASSEMBLY: Layers,
  SUB_ASSEMBLY: Boxes,
  PART: Box,
  FASTENER: Nut,
};

/** The tint of each kind, from the existing colour tokens: a second cue after the shape, each with its contrast promised by the design system. */
const NODE_KIND_TINT: Readonly<Record<NodeKind, string>> = {
  MAIN_ASSEMBLY: 'text-primary-ink',
  SUB_ASSEMBLY: 'text-info-ink',
  PART: 'text-ink-2',
  FASTENER: 'text-accent-ink',
};

export interface NodeKindIconProps extends Omit<IconProps, 'icon' | 'aria-label'> {
  readonly kind: NodeKind;
  /**
   * The name of the kind as `nodeKindLabel` gives it ("Part" or "Sub-part" by the siblings). It is the tooltip on hover and the spoken name of the icon for a screen reader. Leave it out where the words stand
   * beside the icon (the legend): the icon is then decorative and hidden from assistive technology.
   */
  readonly label?: string | undefined;
}

/** The icon of a row's kind, with its name when it stands alone. Shape first, tint second. */
export function NodeKindIcon({ kind, label, className, ...props }: NodeKindIconProps) {
  const named = label === undefined ? {} : { role: 'img', 'aria-label': label };
  return (
    <Icon icon={NODE_KIND_ICON[kind]} size="large" data-node-kind={kind} className={cn('shrink-0', NODE_KIND_TINT[kind], className)} {...named} {...props}>
      {label === undefined ? null : <title>{label}</title>}
    </Icon>
  );
}
