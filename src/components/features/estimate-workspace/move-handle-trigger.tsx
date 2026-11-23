import { GripVertical } from 'lucide-react';
import type { ComponentProps, PointerEvent } from 'react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { ROW_ACTION_SIZE } from './add-node-trigger';

/** The drag's code, fetched at the first pointer-down on a handle (AC-5). A request that fails leaves no drag, and the menu is still there. */
const loadReorder = (): Promise<typeof import('./tree-reorder')> => import('./tree-reorder');

/**
 * A press on the handle starts a drag: the primary button, or a finger or pen. The handle holds the pointer from now on, so the drag goes on over the rest of the page; `onMoveTo` gets the place the row
 * was dropped at. The drag's code loads now, and this runs the same before and after the menu has loaded, so the handle drags whichever of the two it is.
 */
export function startDrag(event: PointerEvent<HTMLButtonElement>, onMoveTo: (index: number) => void): void {
  if (event.button !== 0) return;
  const handle = event.currentTarget;
  const { pointerId, clientY } = event;
  handle.setPointerCapture(pointerId);
  void loadReorder()
    .then((module) => module.attachReorder({ handle, pointerId, startY: clientY, onDrop: onMoveTo }))
    .catch(() => undefined);
}

/** True once for the click that ends a drag, which opens nothing: `tree-reorder.ts` marks the handle and this clears the mark. */
export function endsDrag(handle: HTMLElement): boolean {
  if (!('dragged' in handle.dataset)) return false;
  delete handle.dataset['dragged'];
  return true;
}

export interface MoveHandleTriggerProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** The tooltip and the spoken name: "Move 1.1 Frame". */
  readonly label: string;
}

/**
 * The move handle of a row (CR-01 item 3D, UX spec section 0.9 row 3): one icon button, drawn the same by the plain button that is in the first load (`move-handle.tsx`) and by the Radix trigger that takes its place on
 * the first open of its menu (`move-menu.tsx`), so nothing changes when they swap (AQP-188). `touch-none`: a finger that goes down on the handle drags the row, and a finger anywhere else still scrolls the page. It
 * passes every other prop on to the `<button>`, which is how Radix reaches it (`asChild`).
 */
export function MoveHandleTrigger({ label, className, ...props }: MoveHandleTriggerProps) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} className={cn(ROW_ACTION_SIZE, 'cursor-grab touch-none', className)} {...props}>
      <Icon icon={GripVertical} size="large" />
    </Button>
  );
}
