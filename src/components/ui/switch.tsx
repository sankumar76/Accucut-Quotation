'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Switch. The button is 44 px high for touch; the 52 x 32 track is drawn inside it. The state is
 * always also written in words next to it (UX spec section 10 map: "Label states ON or OFF in words").
 */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn('group inline-flex h-(--control-h) w-(--switch-w) shrink-0 cursor-pointer items-center disabled:cursor-not-allowed', className)}
      {...props}
    >
      <span className="relative block h-s-6 w-full rounded-full bg-border-strong group-data-[state=checked]:bg-success group-disabled:opacity-60">
        <SwitchPrimitive.Thumb className="absolute top-s-1 left-s-1 block h-s-5 w-s-5 rounded-full bg-surface transition-transform data-[state=checked]:translate-x-(--switch-travel)" />
      </span>
    </SwitchPrimitive.Root>
  );
}
