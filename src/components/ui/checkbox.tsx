'use client';

import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Checkbox. The button is the 44 px touch target; the 24 px box is drawn inside it, so the
 * hit area meets the project's control height without a large box (UX spec section 7.2).
 */
export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn('group inline-flex h-(--control-h) w-(--control-h) shrink-0 cursor-pointer items-center justify-center disabled:cursor-not-allowed', className)}
      {...props}
    >
      <span className="flex h-s-5 w-s-5 items-center justify-center rounded-sm border border-border-strong bg-surface text-on-fill group-data-[state=checked]:border-primary-ink group-data-[state=checked]:bg-primary-ink group-disabled:border-border group-disabled:bg-surface-2">
        <CheckboxPrimitive.Indicator>
          <Check aria-hidden="true" focusable="false" size={16} strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}
