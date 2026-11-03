import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Input: 44 px high, strong border (3:1 on white), error state through `aria-invalid` (thick red
 * border and tint; the message and icon are the caller's, so colour is never the only signal), and a dashed
 * grey look for read-only and auto-filled values.
 */
export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        'h-(--control-h) w-full min-w-0 rounded-md border border-border-strong bg-surface px-s-3 text-body text-ink placeholder:text-ink-3 hover:border-ink-2',
        'read-only:border-dashed read-only:bg-surface-2 read-only:text-ink-2',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-ink-3',
        'aria-invalid:border-2 aria-invalid:border-danger aria-invalid:bg-danger-soft',
        className,
      )}
      {...props}
    />
  );
}
