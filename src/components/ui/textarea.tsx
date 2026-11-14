import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Textarea: the same look as `Input` (strong border, 3:1 on white, the error state through `aria-invalid`: a thick red border and a tint, with the
 * message and icon the caller's), and as tall as three lines to start. It grows by the person's drag, never past the width of its card.
 */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-(--textarea-min-h) w-full min-w-0 resize-y rounded-md border border-border-strong bg-surface px-s-3 py-s-2 text-body text-ink placeholder:text-ink-3 hover:border-ink-2',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-ink-3',
        'aria-invalid:border-2 aria-invalid:border-danger aria-invalid:bg-danger-soft',
        className,
      )}
      {...props}
    />
  );
}
