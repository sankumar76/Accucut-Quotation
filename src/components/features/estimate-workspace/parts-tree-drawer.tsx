'use client';

import type { ReactNode } from 'react';

import { Sheet, SheetContent } from '@/components/ui/sheet';

import { TREE_CLOSE, TREE_TITLE } from './estimate-texts';

export interface PartsTreeDrawerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Radix has no trigger to return focus to: the "Parts tree" button takes it back, or the part form does after Enter on a part (`PartsTreeArea`). */
  readonly onCloseAutoFocus: (event: Event) => void;
  /** The tree panel: it is made by `PartsTreeArea`, which keeps what the tree holds, so closing the drawer loses nothing. */
  readonly children: ReactNode;
}

/**
 * The parts tree as the left drawer of a phone (STORY-05.02 AC-9): a scrim, a focus trap, Escape closes. The Radix `Sheet` (dialog, focus scope, dismissable layer, portal, scroll lock) lives in this
 * module only, which `PartsTreeArea` fetches the first time the "Parts tree" button is pressed and then keeps mounted (AQP-188, NFR-009, ADR-016 E1, architecture section 10). There is no
 * `SheetTrigger`: the button is a plain button in the first load and owns `open`, like the menu button of the page frame (`menu-drawer.tsx`).
 */
export function PartsTreeDrawer({ open, onOpenChange, onCloseAutoFocus, children }: PartsTreeDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={TREE_TITLE} closeLabel={TREE_CLOSE} className="overflow-y-auto bg-surface p-s-4 pt-s-7 text-ink" onCloseAutoFocus={onCloseAutoFocus}>
        {children}
      </SheetContent>
    </Sheet>
  );
}
