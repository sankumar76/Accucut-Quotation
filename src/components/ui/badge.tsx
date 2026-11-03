import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Badge: icon plus text, never colour alone (UX spec section 8). The caller puts the icon first.
 * Seven tones from the mock-up: neutral, info, warn (amber), success, danger, brand (red tint) and dark.
 */
const TONE_CLASSES = {
  neutral: 'border-border bg-surface-2 text-ink-2',
  info: 'border-info-line bg-info-soft text-info-ink',
  warn: 'border-accent-line bg-accent-soft text-accent-ink',
  success: 'border-success-line bg-success-soft text-success-ink',
  danger: 'border-danger-line bg-danger-soft text-danger-ink',
  brand: 'border-primary-line bg-primary-soft text-primary-ink',
  dark: 'border-transparent bg-ink text-on-fill',
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

export interface BadgeProps extends ComponentProps<'span'> {
  readonly tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex h-s-5 items-center gap-s-1 rounded-full border px-s-2 text-label font-semibold leading-none whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
