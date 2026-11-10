import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * The width of the Actions column of a masters table by the number of 36 px buttons in it: the buttons, an 8 px gap between them and 16 px
 * of padding on each side (68, 112 and 156 px; UX spec 6.0 "Masters tables", Width). The class sets `--actions-w` on the region, which the
 * sticky column and `scroll-padding-inline-end` read. Written out in full so Tailwind finds the class names.
 */
const ACTIONS_WIDTH = {
  1: '[--actions-w:68px]',
  2: '[--actions-w:112px]',
  3: '[--actions-w:156px]',
} as const;

export interface TableProps extends ComponentProps<'table'> {
  /** Names the scrollable region for assistive technology; required because the wrapper takes focus. */
  readonly regionLabel: string;
  /** Visually hidden caption (UX spec section 6.0 "Tables and cards"). */
  readonly caption: string;
  /**
   * Makes this a masters table (UX spec section 6.0 "Masters tables", DEF-021): how many row-action buttons its last, Actions column
   * holds. That column is sticky at the right edge of the region (see `TableActionsHead` and `TableActionsCell`). Headings wrap, the
   * region keeps clear of the sticky column when focus scrolls it (`scroll-padding-inline-end`), and it is an isolated stacking
   * context so the sticky column stays below the top bar, the drawer and dialogs. Omit it for a table with no row actions.
   */
  readonly actionButtons?: keyof typeof ACTIONS_WIDTH;
}

/**
 * shadcn/ui Table. The table scrolls sideways inside its own container only, never the page; that
 * container is a focusable, named region so a keyboard user can scroll it (axe `scrollable-region-focusable`).
 */
export function Table({ regionLabel, caption, actionButtons, className, children, ...props }: TableProps) {
  const masters = actionButtons !== undefined;
  return (
    <div
      data-slot="table-container"
      role="region"
      aria-label={regionLabel}
      tabIndex={0}
      className={cn('relative w-full overflow-x-auto', masters && ['isolate scroll-pe-(--actions-w)', ACTIONS_WIDTH[actionButtons]])}
    >
      <table data-slot="table" className={cn('w-full border-collapse text-body', masters && '[&_th]:whitespace-normal', className)} {...props}>
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

/** The classes of the Actions heading and its cells: the last column, sticky at the right edge of the region with a hairline on its left. */
const STICKY_ACTIONS = 'sticky right-0 z-(--z-sticky-cell) w-(--actions-w) min-w-(--actions-w) shadow-[inset_1px_0_0_var(--border)]';

/** The heading of the Actions column of a masters table; its `Table` needs `actionButtons`. The word "Actions" is for assistive technology only. */
export function TableActionsHead({ className, ...props }: Omit<ComponentProps<'th'>, 'children'>) {
  return (
    <TableHead className={cn(STICKY_ACTIONS, 'text-right', className)} {...props}>
      <span className="sr-only">Actions</span>
    </TableHead>
  );
}

/** A cell of the Actions column of a masters table. Opaque, so nothing that scrolls under it shows through. */
export function TableActionsCell({ className, ...props }: ComponentProps<'td'>) {
  return <TableCell className={cn(STICKY_ACTIONS, 'bg-surface', className)} {...props} />;
}
