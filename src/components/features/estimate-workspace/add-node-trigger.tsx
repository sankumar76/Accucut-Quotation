import { Plus } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** The size of a row's action button: the 44 px square, and 36 px from 1024 px with a fine pointer (UX row 3; NFR-017). */
export const ROW_ACTION_SIZE = 'fine-wide:h-(--control-h-row) fine-wide:w-(--control-h-row)';

export interface AddNodeTriggerProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** The tooltip and the spoken name: "Add under 1 Hopper" for a menu, "Add fastener under 1.1.1 Plate" for the one kind added at once. */
  readonly label: string;
}

/**
 * The "+" of a row (CR-01 item 3C, UX spec section 0.9 row 3): one icon button, drawn the same by the plain button that is in the first load and by the Radix trigger that takes its place on the first open of its
 * menu (`add-node-menu.tsx`, `add-node-menu-panel.tsx`), so nothing changes when they swap (AQP-188). It passes every other prop on to the `<button>`, which is how Radix reaches it (`asChild`). Its name is its tooltip.
 */
export function AddNodeTrigger({ label, className, ...props }: AddNodeTriggerProps) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} className={cn(ROW_ACTION_SIZE, className)} {...props}>
      <Icon icon={Plus} size="large" />
    </Button>
  );
}
