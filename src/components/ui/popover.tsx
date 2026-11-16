'use client';

import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** Gap between the trigger and the panel, in pixels. The same as the menu's. */
const POPOVER_OFFSET = 8;

/** shadcn/ui Popover: a panel that opens beside its trigger and holds interactive content (the eight surface treatments, STORY-05.06). Escape closes it and returns focus to the trigger. */
export const Popover = PopoverPrimitive.Root;

/** The button that opens the panel. */
export const PopoverTrigger = PopoverPrimitive.Trigger;

/** The panel, in a portal above the page, as wide as its trigger and never wider than the screen. */
export function PopoverContent({ className, sideOffset = POPOVER_OFFSET, align = 'start', ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-(--z-popover) w-(--radix-popover-trigger-width) min-w-(--menu-w) max-w-[calc(100vw-var(--s-4)*2)] rounded-lg border border-border bg-surface p-s-2 shadow-overlay',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
