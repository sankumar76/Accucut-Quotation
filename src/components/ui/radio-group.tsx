'use client';

import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** shadcn/ui Radio Group: the arrow keys move the choice inside the group and Tab leaves it, as a native radio group does. */
export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('flex flex-col gap-s-3', className)} {...props} />;
}

/**
 * shadcn/ui Radio Group item. The button is the 44 px touch target; the 24 px ring is drawn inside it, so the hit area meets the project's control height (UX spec section 7.2), like `Checkbox`.
 * The chosen item is filled, so the choice is never shown by colour alone: the dot is a shape.
 */
export function RadioGroupItem({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn('group inline-flex h-(--control-h) w-(--control-h) shrink-0 cursor-pointer items-center justify-center disabled:cursor-not-allowed', className)}
      {...props}
    >
      <span className="flex h-s-5 w-s-5 items-center justify-center rounded-full border border-border-strong bg-surface group-data-[state=checked]:border-primary-ink group-disabled:border-border group-disabled:bg-surface-2">
        <RadioGroupPrimitive.Indicator className="block h-s-3 w-s-3 rounded-full bg-primary-ink" />
      </span>
    </RadioGroupPrimitive.Item>
  );
}
