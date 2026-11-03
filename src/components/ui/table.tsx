import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

export interface TableProps extends ComponentProps<'table'> {
  /** Names the scrollable region for assistive technology; required because the wrapper takes focus. */
  readonly regionLabel: string;
  /** Visually hidden caption (UX spec section 6.0 "Tables and cards"). */
  readonly caption: string;
}

/**
 * shadcn/ui Table. The table scrolls sideways inside its own container only, never the page; that
 * container is a focusable, named region so a keyboard user can scroll it (axe `scrollable-region-focusable`).
 */
export function Table({ regionLabel, caption, className, children, ...props }: TableProps) {
  return (
    <div data-slot="table-container" role="region" aria-label={regionLabel} tabIndex={0} className="relative w-full overflow-x-auto">
      <table data-slot="table" className={cn('w-full border-collapse text-body', className)} {...props}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHeader(props: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" {...props} />;
}

export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn('border-b border-border last:border-b-0', className)} {...props} />;
}

export function TableHead({ className, scope = 'col', ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        'border-b border-border bg-surface-2 px-s-4 py-s-3 text-left text-label font-semibold tracking-wider whitespace-nowrap text-ink-2 uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('px-s-4 py-s-3 align-middle', className)} {...props} />;
}
