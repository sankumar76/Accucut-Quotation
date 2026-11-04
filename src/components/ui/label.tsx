import { Label as LabelPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** shadcn/ui Label: one label above each field, label size, 600 (UX spec section 6.0 "Forms"). */
export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn('flex items-center gap-s-2 text-label font-semibold text-ink-2', className)}
      {...props}
    />
  );
}
