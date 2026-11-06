'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Dialog on the Radix primitive: a centred panel over a dimmed page. Radix gives the focus trap, Escape to close,
 * `aria-modal` and the hidden page behind it. It does not return focus to a control it was not opened from, so the caller
 * that opens it without a `DialogTrigger` sets focus in `onCloseAutoFocus` (SCR-14 does).
 */
export const Dialog = DialogPrimitive.Root;

/** A control that closes the dialog (Cancel). */
export const DialogClose = DialogPrimitive.Close;

/** The dimmed page behind a dialog. Fades out under `prefers-reduced-motion` like every overlay (globals.css). */
export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 z-(--z-overlay) bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in', className)}
      {...props}
    />
  );
}

export const DIALOG_PANEL_CLASSES =
  'fixed top-1/2 left-1/2 z-(--z-drawer) flex max-h-[calc(100dvh-2*var(--s-4))] w-[calc(100%-2*var(--s-4))] max-w-120 -translate-x-1/2 -translate-y-1/2 flex-col gap-s-4 overflow-y-auto rounded-lg border border-border bg-surface p-s-5 shadow-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in';

/** The panel. Always give it a `DialogTitle`; give it a `DialogDescription`, or `aria-describedby={undefined}` when it has none. */
export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn(DIALOG_PANEL_CLASSES, className)} {...props}>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-s-2', className)} {...props} />;
}

/** Actions at the foot: stacked on a phone with the main action first, side by side from 640 px with it last. */
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('flex flex-col-reverse gap-s-3 sm:flex-row sm:justify-end', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('text-sub font-semibold text-ink', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('text-ink-2', className)} {...props} />;
}
