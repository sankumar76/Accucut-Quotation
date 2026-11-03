'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Sheet (a Dialog that slides in from the left): the menu drawer below 1024 px. Radix gives the
 * focus trap, Escape to close and focus back on the trigger; the slide and the fade are removed by
 * `prefers-reduced-motion` (globals.css).
 */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export interface SheetContentProps extends ComponentProps<typeof SheetPrimitive.Content> {
  /** The accessible name of the drawer; also read as its title. */
  readonly title: string;
  /** Visible label of the close button. */
  readonly closeLabel: string;
  /** Drawer is built from the dark menu, so the focus ring turns white (UX spec section 8). */
  readonly onDark?: boolean;
}

export function SheetContent({ title, closeLabel, onDark = false, className, children, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-40 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-on-dark={onDark ? '' : undefined}
        aria-describedby={undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-(--drawer-w) max-w-[88vw] flex-col shadow-overlay data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
          className,
        )}
        {...props}
      >
        <SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>
        {children}
        <SheetPrimitive.Close
          className="absolute top-s-2 right-s-2 inline-flex h-(--control-h) w-(--control-h) cursor-pointer items-center justify-center rounded-md text-nav-ink hover:bg-nav-2 hover:text-on-fill"
          aria-label={closeLabel}
        >
          <X aria-hidden="true" focusable="false" size={20} />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
