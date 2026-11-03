import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** Seven tones from the mock-up: neutral, info, warn (amber), success, danger, brand (red tint) and dark. */
export const badgeVariants = cva(
  'inline-flex h-s-5 items-center gap-s-1 rounded-full border px-s-2 text-label font-semibold leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-2 text-ink-2',
        info: 'border-info-line bg-info-soft text-info-ink',
        warn: 'border-accent-line bg-accent-soft text-accent-ink',
        success: 'border-success-line bg-success-soft text-success-ink',
        danger: 'border-danger-line bg-danger-soft text-danger-ink',
        brand: 'border-primary-line bg-primary-soft text-primary-ink',
        dark: 'border-transparent bg-ink text-on-fill',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

/** shadcn/ui Badge: icon plus text, never colour alone (UX spec section 8). The caller puts the icon first. */
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
