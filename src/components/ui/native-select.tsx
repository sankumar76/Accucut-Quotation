import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';

/**
 * shadcn/ui Native Select: the browser's own `<select>` drawn like the portal's inputs (44 px high, strong border, the error
 * state through `aria-invalid`), with a chevron. For a short, fixed list of choices (the filters of the audit log) it is the
 * lighter and more familiar control: the phone shows its own picker, the keyboard types ahead, and nothing is loaded for it (NFR-009).
 * The Radix `Select` stays for lists that need a custom look.
 */
export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative w-full min-w-0">
      <select
        data-slot="native-select"
        className={cn(
          'h-(--control-h) w-full min-w-0 appearance-none truncate rounded-md border border-border-strong bg-surface pr-s-7 pl-s-3 text-body text-ink hover:border-ink-2',
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-ink-3',
          'aria-invalid:border-2 aria-invalid:border-danger aria-invalid:bg-danger-soft',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <Icon icon={ChevronDown} size="small" className="pointer-events-none absolute top-1/2 right-s-3 -translate-y-1/2 text-ink-2" />
    </div>
  );
}
