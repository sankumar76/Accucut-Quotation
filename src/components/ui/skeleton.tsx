import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** shadcn/ui Skeleton: a grey block with the shimmer, which `prefers-reduced-motion` turns off (globals.css). */
export function Skeleton({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('skeleton-shimmer block animate-shimmer rounded-sm', className)}
      {...props}
    />
  );
}
