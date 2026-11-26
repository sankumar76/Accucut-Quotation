import { Plus } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** The size of a row's action button: the 44 px square, and 36 px from 1024 px with a fine pointer (UX row 3; NFR-017). */
export const ROW_ACTION_SIZE = 'fine-wide:h-(--control-h-row) fine-wide:w-(--control-h-row)';

/**
 * The look of a row's toolbar buttons (DEF-081 ruling item 9; the secondary look of UX spec 7.3.1): the icon is quiet `ink-2` at rest (8.43:1 on white) and not the brand red, grey on hover and when pressed. It goes after the
 * button's own variant, so it wins over the ghost's red (`cn` keeps the later class). The "-" adds its own red hover on top (`row-actions.tsx`).
 */
export const ROW_ACTION_LOOK =
  '[scroll-margin-block:40px] text-ink-2 hover:bg-surface-2 hover:text-ink active:bg-border active:text-ink active:shadow-pressed enabled:aria-busy:bg-border enabled:aria-busy:text-ink enabled:aria-busy:shadow-pressed';

/** The look of an action that cannot be taken at the moment (`aria-disabled`, not `disabled`: the button keeps the keyboard focus). */
export const UNAVAILABLE_LOOK = 'cursor-not-allowed opacity-60';

export interface AddNodeTriggerProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** The tooltip and the spoken name: "Add under 1 Hopper" for a menu, "Add fastener under 1.1.1 Plate" for the one kind added at once. */
  readonly label: string;
  /** A change to the tree is on its way (AQP-343): the button is `aria-disabled` and looks it, and keeps the focus. The caller sees to it that a press does nothing. Absent when not. */
  readonly unavailable?: boolean;
}

/**
 * The "+" of a row (CR-01 item 3C, UX spec section 0.9 row 3): one icon button, drawn the same by the plain button that is in the first load and by the Radix trigger that takes its place on the first open of its
 * menu (`add-node-menu.tsx`, `add-node-menu-panel.tsx`), so nothing changes when they swap (AQP-188). It passes every other prop on to the `<button>`, which is how Radix reaches it (`asChild`). Its name is its tooltip.
 */
export function AddNodeTrigger({ label, className, unavailable, ...props }: AddNodeTriggerProps) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} className={cn(ROW_ACTION_SIZE, ROW_ACTION_LOOK, unavailable && UNAVAILABLE_LOOK, className)} {...props} {...(unavailable === true ? { 'aria-disabled': true } : {})}>
      <Icon icon={Plus} size="large" />
    </Button>
  );
}
