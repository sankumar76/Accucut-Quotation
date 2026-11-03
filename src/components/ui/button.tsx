import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';
import { ICON_SIZE } from '@/lib/design-tokens';

/**
 * Looks of the one button (UX spec section 7.2): 44 px high, 16 px side padding, 14 / 600, four variants. The base
 * sets `border-transparent`; a variant that has a border sets its own colour after it and `cn` keeps the later one
 * (QLT-01). `size="icon"` is the 44 px square, `size="icon-row"` the 36 px square for dense table rows.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-s-2 rounded-md border border-transparent text-body font-semibold leading-none whitespace-nowrap no-underline transition-colors cursor-pointer disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-ink-3 disabled:hover:bg-surface-2 disabled:hover:text-ink-3',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-fill hover:bg-primary-hover hover:text-on-fill',
        secondary: 'border-border-strong bg-surface text-ink hover:bg-surface-2 hover:text-ink',
        ghost: 'bg-transparent text-primary-ink hover:bg-primary-soft hover:text-primary-ink',
        danger: 'bg-danger text-on-fill hover:bg-danger-ink hover:text-on-fill',
      },
      size: {
        default: 'h-(--control-h) px-s-4',
        icon: 'h-(--control-h) w-(--control-h) px-0',
        'icon-row': 'h-(--control-h-row) w-(--control-h-row) px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

type NativeButton = ComponentProps<'button'>;

/**
 * `loading` and `disabled` need a real `<button>`: `asChild` renders the child (a link) with the button's look and
 * can not carry them, so the type refuses the combination instead of dropping the props (QLT-09).
 */
export type ButtonProps = VariantProps<typeof buttonVariants> &
  (
    | (NativeButton & {
        /** Render a `<button>`. */
        readonly asChild?: false;
        /** Shows a spinner, sets `aria-busy` and disables the button; the label is the verb in the present tense. */
        readonly loading?: boolean;
      })
    | (Omit<NativeButton, 'disabled'> & {
        /** Render the child element (a link, say) with the button's look. */
        readonly asChild: true;
        readonly loading?: never;
        readonly disabled?: never;
      })
  );

/**
 * shadcn/ui Button: one size and four variants (primary, secondary, ghost, danger) plus the icon squares.
 * An icon-only button needs an accessible name (`aria-label`).
 */
export function Button({ variant, size, asChild = false, loading = false, className, children, disabled, type, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  // The size is on the element so a test can tell the 36 px row button from a full-size one by what it is.
  const dataSize = size ?? 'default';

  if (asChild) {
    return (
      <Slot.Root data-slot="button" data-size={dataSize} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      data-size={dataSize}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle size={ICON_SIZE.default} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
