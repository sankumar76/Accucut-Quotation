'use client';

import { Nav, type NavGroup } from '@/components/shared/nav';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export interface MenuDrawerProps {
  readonly groups: ReadonlyArray<NavGroup>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onNavigate: (href: string) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/**
 * The side menu as a drawer: focus trapped, Escape closes. The Radix `Sheet` (dialog, overlay, focus trap) lives in this
 * module only, which the page frame fetches the first time the menu button is pressed and then keeps mounted
 * (AQP-188, NFR-009, architecture section 10). There is no `SheetTrigger`: the menu button is a plain button in the first
 * load and owns `open`, so the frame returns focus to it in `onCloseAutoFocus`, unless a page was chosen.
 */
export function MenuDrawer({ groups, open, onOpenChange, onNavigate, onCloseAutoFocus }: MenuDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Menu" closeLabel="Close menu" onDark className="bg-nav text-nav-ink" onCloseAutoFocus={onCloseAutoFocus}>
        <div className="pt-s-7">
          <Nav groups={groups} onNavigate={onNavigate} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
