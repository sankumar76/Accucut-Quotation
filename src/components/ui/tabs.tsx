'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Tabs on the Radix primitive (UX spec SCR-13 "Tabs", SCR-03; the mock-up's `.tabs` and `.tab`). Radix gives `role=tablist`,
 * `tab` and `tabpanel`, the arrow keys between tabs and the panel naming. A tab is 44 px high for touch; the selected one has a 3 px
 * line in the brand colour under it, and the text says which is selected as well as the line (not colour alone).
 */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn('flex gap-s-1 overflow-x-auto border-b border-border', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex h-(--control-h) items-center justify-center gap-s-2 border-0 border-b-[3px] border-transparent bg-transparent px-s-4 text-body leading-none font-semibold whitespace-nowrap text-ink-2 cursor-pointer hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink max-sm:flex-1 max-sm:px-s-2',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('min-w-0', className)} {...props} />;
}
