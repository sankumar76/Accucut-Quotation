'use client';

import { Progress as ProgressPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Progress. Radix draws `role="progressbar"` with its value and maximum; give it a name (`aria-label`) and, where the bar is only part of the message, the words beside it
 * (UX spec section 10 map: status is also in text). `getValueLabel` replaces the default percentage with the words that say what the bar counts.
 */
export function Progress({ className, value, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  const max = props.max ?? 100;
  const filled = value === null || value === undefined || max <= 0 ? 0 : Math.min(Math.max(value, 0), max) / max;
  return (
    <ProgressPrimitive.Root data-slot="progress" value={value} className={cn('relative h-s-2 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-border ring-inset', className)} {...props}>
      <ProgressPrimitive.Indicator data-slot="progress-indicator" className="h-full bg-primary transition-[width]" style={{ width: `${filled * 100}%` }} />
    </ProgressPrimitive.Root>
  );
}
