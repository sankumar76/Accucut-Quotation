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
 *
 * Pending first open (UX spec 7.3.1 rule 11, AQP-188): an enabled button with `aria-busy` keeps its pressed look held, keyed to the
 * attribute so it shows before React has run (the early tap, DEF-013). `enabled:` leaves a `loading` button (disabled) alone.
 *
 * Pressed (UX spec section 7.3.1, DEF-008, DEF-010): `active:` sets a fill, the text colour and the inset
 * `shadow-pressed` for mouse, finger and pen. Primary and danger use the darker `-pressed` colours, because the step
 * from rest to the hover colour was too small to see on a phone. Pressed shows on the first frame
 * (`active:transition-none`) and fades out over 200 ms on release (`duration-200 ease-out`). Button text is not
 * selectable (`select-none`). It is never inside the "can hover" media query that Tailwind puts around `hover:`, because a
 * phone has no hover and the pressed look is then the only sign that a tap registered. Tailwind emits `active:` after
 * `hover:`, so a button that is hovered and pressed shows pressed. `disabled:active:` puts the disabled look back, so a
 * disabled or loading button shows nothing under a pointer.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-s-2 rounded-md border border-transparent text-body font-semibold leading-none whitespace-nowrap no-underline select-none transition-colors duration-200 ease-out active:transition-none cursor-pointer disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-2 disabled:text-ink-3 disabled:hover:bg-surface-2 disabled:hover:text-ink-3 disabled:active:bg-surface-2 disabled:active:text-ink-3 disabled:active:shadow-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-fill hover:bg-primary-hover hover:text-on-fill active:bg-primary-pressed active:text-on-fill active:shadow-pressed enabled:aria-busy:bg-primary-pressed enabled:aria-busy:text-on-fill enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none',
        secondary: 'border-border-strong bg-surface text-ink hover:bg-surface-2 hover:text-ink active:bg-border active:text-ink active:shadow-pressed enabled:aria-busy:bg-border enabled:aria-busy:text-ink enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none',
        ghost: 'bg-transparent text-primary-ink hover:bg-primary-soft hover:text-primary-ink active:bg-primary-line active:text-ink active:shadow-pressed enabled:aria-busy:bg-primary-line enabled:aria-busy:text-ink enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none',
        danger: 'bg-danger text-on-fill hover:bg-danger-ink hover:text-on-fill active:bg-danger-pressed active:text-on-fill active:shadow-pressed enabled:aria-busy:bg-danger-pressed enabled:aria-busy:text-on-fill enabled:aria-busy:shadow-pressed enabled:aria-busy:transition-none',
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
 * On a real `<button>` only (UX spec 7.3.1 rule 9, DEF-010): no iOS copy bubble or magnifier on a long press. It is not
 * in `buttonVariants` because a link drawn as a button (`asChild`) keeps the link menu (open in a new tab, copy the
 * link). Chromium does not implement `-webkit-touch-callout`; only a check on an iPhone shows its effect.
 */
const NO_TOUCH_CALLOUT ='[-webkit-touch-callout:none]';

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
      className={cn(classes, NO_TOUCH_CALLOUT)}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle size={ICON_SIZE.default} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
