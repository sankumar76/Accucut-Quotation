'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';
import { ICON_SIZE } from '@/lib/design-tokens';

/** Gap between the select button and its list, in pixels. */
const LIST_OFFSET = 4;

/** shadcn/ui Select on the Radix primitive: keyboard type-ahead, arrow keys, Escape; 44 px trigger and rows. */
export const Select = SelectPrimitive.Root;

/** The chosen option (or the placeholder) inside the trigger. */
export const SelectValue = SelectPrimitive.Value;

/** The 44 px button that opens the list. `aria-invalid` gives it the error border. */
export function SelectTrigger({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-(--control-h) w-full min-w-0 items-center justify-between gap-s-2 rounded-md border border-border-strong bg-surface px-s-3 text-left text-body text-ink hover:border-ink-2',
        'data-[placeholder]:text-ink-3 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-ink-3',
        'aria-invalid:border-2 aria-invalid:border-danger aria-invalid:bg-danger-soft',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={ICON_SIZE.small} className="shrink-0 text-ink-2" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/** The list of options, in a portal above the page. */
export function SelectContent({ className, children, position = 'popper', ...props }: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={LIST_OFFSET}
        className={cn(
          'z-(--z-popover) max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg border border-border bg-surface p-s-2 shadow-overlay',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/** One option: a 44 px row with a check mark when chosen. */
export function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'flex min-h-(--control-h) cursor-pointer items-center gap-s-3 rounded-md px-s-3 text-body text-ink outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:font-semibold',
        className,
      )}
      {...props}
    >
      <span className="flex w-s-4 shrink-0 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check size={ICON_SIZE.small} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
