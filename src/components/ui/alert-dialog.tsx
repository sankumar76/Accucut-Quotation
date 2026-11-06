'use client';

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { DIALOG_PANEL_CLASSES } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

/**
 * shadcn/ui AlertDialog on the Radix primitive: a dialog that asks for a decision (`role="alertdialog"`). Focus goes to
 * the Cancel button, the safe choice, when it opens; Escape closes it; the page behind it is inert. As with `Dialog`, a
 * caller that opens it without a trigger returns focus itself in `onCloseAutoFocus`.
 */
export const AlertDialog = AlertDialogPrimitive.Root;

export function AlertDialogContent({ className, children, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 z-(--z-overlay) bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
      />
      <AlertDialogPrimitive.Content data-slot="alert-dialog-content" className={cn(DIALOG_PANEL_CLASSES, className)} {...props}>
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-header" className={cn('flex flex-col gap-s-2', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-footer" className={cn('flex flex-col-reverse gap-s-3 sm:flex-row sm:justify-end', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title data-slot="alert-dialog-title" className={cn('text-sub font-semibold text-ink', className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description data-slot="alert-dialog-description" className={cn('text-ink-2', className)} {...props} />;
}

/** The confirming button, drawn as the danger button: the dialogs that use it ask before something is taken away. */
export function AlertDialogAction({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action data-slot="alert-dialog-action" className={cn(buttonVariants({ variant: 'danger' }), className)} {...props} />;
}

/** The safe choice: it takes the focus when the dialog opens. */
export function AlertDialogCancel({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel data-slot="alert-dialog-cancel" className={cn(buttonVariants({ variant: 'secondary' }), className)} {...props} />;
}
