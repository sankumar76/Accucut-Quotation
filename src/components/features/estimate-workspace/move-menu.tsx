'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';

import { Icon } from '@/components/shared/icon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { TREE_MOVE_DOWN, TREE_MOVE_UP } from './estimate-texts';
import type { MoveHandleMenuProps } from './move-handle';
import { endsDrag, MoveHandleTrigger, startDrag } from './move-handle-trigger';

/** Where Radix puts focus when the menu opens: a keyboard open focuses the first item that can be chosen (the same rule as the "+" menu, `add-node-menu-panel.tsx`). A pointer open keeps Radix's own behaviour. */
function focusFirstItem(event: Event): void {
  const menu = event.currentTarget;
  if (!(menu instanceof HTMLElement)) return;
  const first = menu.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])');
  if (first === null) return;
  event.preventDefault();
  first.focus();
}

/**
 * Move up and Move down of a row (CR-01 item 3D, AC-2; WCAG 2.2 SC 2.5.7: a way to reorder with no dragging, by pointer and by keyboard). Loaded when the move handle is first pressed (`move-handle.tsx`), not with the
 * page. It is the shadcn/ui `DropdownMenu` with its own trigger, which has the face of the plain handle it replaces, in the same place; it opens at once, Radix handles arrow keys and Escape, and Escape returns focus to
 * the handle. **A place the row cannot go to is a disabled item**: Move up on the first sibling, Move down on the last, both for an only child. The place each item moves the row to comes from `stepOf`, so the
 * result is the same as a drag that ends there.
 *
 * **The handle still drags once the menu has loaded.** The menu is controlled: the trigger starts a drag on a pointer-down and keeps Radix from toggling on it (`preventDefault`, which Radix's own handler respects), and a
 * pointer click (one with a position, not the click an Enter or a Space makes) toggles it; Enter, Space and the arrow keys are Radix's own.
 */
export function MoveMenu({ label, upTo, downTo, onMoveTo, keyboard, unavailable, describedBy }: MoveHandleMenuProps) {
  // The override is for the open that mounted the menu only; from then on Radix sees every key itself.
  const openedByKeyboard = useRef(keyboard);
  const [open, setOpen] = useState(true);
  const focusOnOpen = (event: Event): void => {
    if (!openedByKeyboard.current) return;
    openedByKeyboard.current = false;
    focusFirstItem(event);
  };
  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        // While a change is on its way (AQP-343) Enter, Space or an arrow cannot open it again; it can still be closed.
        if (!next || unavailable !== true) setOpen(next);
      }}
    >
      <DropdownMenuTrigger asChild>
        <MoveHandleTrigger
          label={label}
          {...(unavailable === true ? { unavailable, ...(describedBy === undefined ? {} : { 'aria-describedby': describedBy }) } : {})}
          onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            if (unavailable !== true) startDrag(event, onMoveTo);
          }}
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            if (endsDrag(event.currentTarget) || unavailable === true) return;
            if (event.detail !== 0) setOpen((current) => !current);
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" {...{ onOpenAutoFocus: focusOnOpen }}>
        <DropdownMenuItem disabled={upTo === null || unavailable === true} onSelect={() => upTo !== null && onMoveTo(upTo)}>
          <Icon icon={ArrowUp} size="large" />
          {TREE_MOVE_UP}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={downTo === null || unavailable === true} onSelect={() => downTo !== null && onMoveTo(downTo)}>
          <Icon icon={ArrowDown} size="large" />
          {TREE_MOVE_DOWN}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
