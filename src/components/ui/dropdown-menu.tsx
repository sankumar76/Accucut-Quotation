'use client';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/** shadcn/ui DropdownMenu: the account menu. Arrow keys move, Escape closes and returns focus to the trigger. */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, align = 'end', ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-(--menu-w) max-w-[calc(100vw-var(--s-4)*2)] rounded-lg border border-border bg-surface p-s-2 shadow-overlay',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn('mb-s-2 flex flex-col gap-s-1 border-b border-border p-s-3 pt-s-2', className)}
      {...props}
    />
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex min-h-(--control-h) cursor-pointer items-center gap-s-3 rounded-md px-s-3 text-body font-semibold text-ink no-underline outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-3',
        className,
      )}
      {...props}
    />
  );
}
