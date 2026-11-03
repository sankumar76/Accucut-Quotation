import { LoaderCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * shadcn/ui Button, one size and four variants (UX spec section 7.2, STORY-10.02 AC-5): 44 px high,
 * 16 px side padding, 14 / 600. `size="icon"` is the 44 px square; `size="icon-row"` is the 36 px square
 * for dense table rows. An icon-only button needs an accessible name (`aria-label`).
 */
const VARIANT_CLASSES = {
  primary: 'bg-primary text-on-fill hover:bg-primary-hover hover:text-on-fill',
  secondary: 'bg-surface text-ink border-border-strong hover:bg-surface-2 hover:text-ink',
  ghost: 'bg-transparent text-primary-ink hover:bg-primary-soft hover:text-primary-ink',
  danger: 'bg-danger text-on-fill hover:bg-danger-ink hover:text-on-fill',
} as const;

const SIZE_CLASSES = {
  default: 'h-(--control-h) px-s-4',
  icon: 'h-(--control-h) w-(--control-h) px-0',
  'icon-row': 'h-(--control-h-row) w-(--control-h-row) px-0',
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASSES;
export type ButtonSize = keyof typeof SIZE_CLASSES;

export interface ButtonProps extends ComponentProps<'button'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** Render the child element (a link, say) with the button's look instead of a `<button>`. */
  readonly asChild?: boolean;
  /** Shows a spinner, sets `aria-busy` and disables the button; the label should be the verb in the present tense. */
  readonly loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'default',
  asChild = false,
  loading = false,
  className,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-s-2 rounded-md border border-transparent text-body font-semibold leading-none whitespace-nowrap no-underline transition-colors cursor-pointer',
    'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-ink-3 disabled:hover:bg-surface-2 disabled:hover:text-ink-3',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type ?? 'button'}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" focusable="false" size={18} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
