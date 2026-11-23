'use client';

import { useRef } from 'react';

import { Icon } from '@/components/shared/icon';
import { NODE_KIND_ICON } from '@/components/shared/node-kind-icon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NODE_KIND_NAMES } from '@/lib/estimate/node-kinds';

import type { AddNodeMenuPanelProps } from './add-node-menu';
import { AddNodeTrigger } from './add-node-trigger';

/**
 * Where Radix puts focus when the menu opens. A keyboard open focuses the first item: Radix decides that from the last key it saw, but the menu is first mounted after the key was pressed, so it cannot know and
 * the caller says it. A pointer open keeps Radix's own behaviour (the same as the account menu, AQP-188 AC-4).
 */
function focusFirstItem(event: Event): void {
  const menu = event.currentTarget;
  if (!(menu instanceof HTMLElement)) return;
  const first = menu.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])');
  if (first === null) return;
  event.preventDefault();
  first.focus();
}

/**
 * The "+" menu of a row once its code has loaded (CR-01 item 3C, UX spec section 0.9 row 3): the shadcn/ui `DropdownMenu` with its own trigger, which has the same face as the plain button it replaces, in the same
 * place. It opens at once (`defaultOpen`), offers exactly the kinds it is given (the ones `ALLOWED_CHILDREN` allows under the row) and then behaves as Radix menus do: arrow keys move, Escape closes and returns focus
 * to the trigger. Not modal on purpose: a modal menu hides the rest of the page from assistive technology while its controls stay focusable (axe `aria-hidden-focus`). It is placed under its row.
 */
export function AddNodeMenuPanel({ label, nodeKinds, onChoose, keyboard }: AddNodeMenuPanelProps) {
  // The override is for the open that mounted the menu only; from then on Radix sees every key itself.
  const openedByKeyboard = useRef(keyboard);
  const focusOnOpen = (event: Event): void => {
    if (!openedByKeyboard.current) return;
    openedByKeyboard.current = false;
    focusFirstItem(event);
  };
  return (
    <DropdownMenu modal={false} defaultOpen>
      <DropdownMenuTrigger asChild>
        <AddNodeTrigger label={label} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" {...{ onOpenAutoFocus: focusOnOpen }}>
        {nodeKinds.map((nodeKind) => (
          <DropdownMenuItem key={nodeKind} onSelect={() => onChoose(nodeKind)}>
            <Icon icon={NODE_KIND_ICON[nodeKind]} size="large" />
            {NODE_KIND_NAMES[nodeKind]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
