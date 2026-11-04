'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';
import { ICON_SIZE } from '@/lib/design-tokens';

/** shadcn/ui Sheet: a Dialog that slides in from the left (the menu drawer below 1024 px). */
export const Sheet = SheetPrimitive.Root;

/** The button that opens the sheet. */
export const SheetTrigger = SheetPrimitive.Trigger;

/** A control that closes the sheet. */
export const SheetClose = SheetPrimitive.Close;

export interface SheetContentProps extends ComponentProps<typeof SheetPrimitive.Content> {
  /** The accessible name of the drawer; also read as its title. */
  readonly title: string;
  /** Visible label of the close button. */
  readonly closeLabel: string;
  /** Drawer is built from the dark menu, so the focus ring turns white (UX spec section 8). */
  readonly onDark?: boolean;
}

/**
 * The drawer panel with its dim overlay. Radix gives the focus trap, Escape to close and focus back on the
 * trigger; the slide and the fade are removed by `prefers-reduced-motion` (globals.css).
 */
export function SheetContent({ title, closeLabel, onDark = false, className, children, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-(--z-overlay) bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-on-dark={onDark ? '' : undefined}
        aria-describedby={undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-(--z-drawer) flex w-(--drawer-w) max-w-(--drawer-max) flex-col shadow-overlay data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
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
          <X size={ICON_SIZE.large} />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
