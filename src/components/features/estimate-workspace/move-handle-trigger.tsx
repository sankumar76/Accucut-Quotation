import { GripVertical } from 'lucide-react';
import type { ComponentProps, FocusEvent, PointerEvent } from 'react';

import { Icon } from '@/components/shared/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { ROW_ACTION_SIZE, UNAVAILABLE_LOOK } from './add-node-trigger';
import type { GestureEvent } from './tree-reorder';

/** How far the pointer must go before a press on the handle is a drag and not a click (it opens the menu). Here, and not in `tree-reorder.ts`, because the handle needs it before that code has arrived. */
export const DRAG_START_PX = 4;

/** The drag's code, fetched at the first pointer-down on a handle (AC-5). A request that fails leaves no drag, and the menu is still there. */
const loadReorder = (): Promise<typeof import('./tree-reorder')> => import('./tree-reorder');

/** Starts fetching the drag's code when the pointer comes to a handle or the handle takes the focus, so that it is usually here before the press. A request that fails is tried again at the press. */
export const preloadReorder = (): void => void loadReorder().catch(() => undefined);

/**
 * A press on the handle starts a drag: the primary button, or a finger or pen. The handle holds the pointer from now on, so the drag goes on over the rest of the page; `onMoveTo` gets the place the row
 * was dropped at. The drag's code loads now (or has been fetched already, `preloadReorder`), and this runs the same before and after the menu has loaded, so the handle drags whichever of the two it is.
 *
 * **What the pointer does before that code arrives is not lost.** The code takes a moment the first time (over the network, or compiled on demand in development), and a quick drag can be over by then. The handle keeps what
 * the pointer does from the press on (`GestureEvent`) and hands it over when the code arrives, which plays it into the drag. A gesture that moved `DRAG_START_PX` or more and ended before the code arrived marks the
 * handle at once (`endsDrag`), because the click that follows it must open no menu, and that cannot wait for code that is not here.
 */
export function startDrag(event: PointerEvent<HTMLButtonElement>, onMoveTo: (index: number) => void): void {
  if (event.button !== 0) return;
  const handle = event.currentTarget;
  const { pointerId, clientY } = event;
  handle.setPointerCapture(pointerId);
  const seen: GestureEvent[] = [];
  let moved = false;
  const keep =
    (kind: GestureEvent['kind']) =>
    (pointer: { readonly clientY: number }): void => {
      seen.push({ kind, y: pointer.clientY });
      if (Math.abs(pointer.clientY - clientY) >= DRAG_START_PX) moved = true;
      if (kind !== 'move' && moved) handle.dataset['dragged'] = '';
    };
  const onMove = keep('move');
  const onUp = keep('up');
  const onCancel = keep('cancel');
  const stop = (): void => {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onCancel);
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onCancel);
  void loadReorder()
    .then((module) => {
      stop();
      module.attachReorder({ handle, pointerId, startY: clientY, onDrop: onMoveTo, seen });
    })
    .catch(stop);
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
  /** A change to the tree is on its way (AQP-343): the handle is `aria-disabled` and looks it, and keeps the focus. The caller sees to it that a press does nothing. Absent when not. */
  readonly unavailable?: boolean;
}

/**
 * The move handle of a row (CR-01 item 3D, UX spec section 0.9 row 3): one icon button, drawn the same by the plain button that is in the first load (`move-handle.tsx`) and by the Radix trigger that takes its place on
 * the first open of its menu (`move-menu.tsx`), so nothing changes when they swap (AQP-188). `touch-none`: a finger that goes down on the handle drags the row, and a finger anywhere else still scrolls the page. It
 * passes every other prop on to the `<button>`, which is how Radix reaches it (`asChild`).
 */
export function MoveHandleTrigger({ label, className, unavailable, onPointerEnter, onFocus, ...props }: MoveHandleTriggerProps) {
  const comes = (event: PointerEvent<HTMLButtonElement>): void => {
    preloadReorder();
    onPointerEnter?.(event);
  };
  const focused = (event: FocusEvent<HTMLButtonElement>): void => {
    preloadReorder();
    onFocus?.(event);
  };
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label} data-move-handle="" onPointerEnter={comes} onFocus={focused} className={cn(ROW_ACTION_SIZE, 'touch-none', unavailable === true ? UNAVAILABLE_LOOK : 'cursor-grab', className)} {...props} {...(unavailable === true ? { 'aria-disabled': true } : {})}>
      <Icon icon={GripVertical} size="large" />
    </Button>
  );
}
