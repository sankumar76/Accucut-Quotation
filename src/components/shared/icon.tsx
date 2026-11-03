import type { LucideIcon, LucideProps } from 'lucide-react';

import { ICON_SIZE, type IconSize } from '@/lib/design-tokens';

export interface IconProps extends Omit<LucideProps, 'size' | 'ref'> {
  /** The lucide icon to draw. */
  readonly icon: LucideIcon;
  /** The role-based size (`ICON_SIZE` in design-tokens.ts). Default 18 px, the size of an icon beside body text. */
  readonly size?: IconSize;
}

/**
 * One way to draw an icon (STD-08). An icon with no accessible name of its own is hidden from assistive
 * technology: lucide-react sets `aria-hidden="true"` itself when it has no `aria-label` or `title`, so a screen
 * reader reads the words beside the icon, never the icon. Pass `aria-label` for an icon that stands alone.
 */
export function Icon({ icon: Glyph, size = 'default', ...props }: IconProps) {
  return <Glyph size={ICON_SIZE[size]} {...props} />;
}
