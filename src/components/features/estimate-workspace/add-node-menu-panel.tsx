'use client';

import { useCallback, useRef, useState } from 'react';

import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { NODE_KIND_NAMES, type NodeKind } from '@/lib/estimate/node-kinds';

import type { AddNodeMenuPanelProps } from './add-node-menu';
import { AddNodeTrigger } from './add-node-trigger';

/**
 * What each item says (AQP-449, DEF-092 option A; ux-expert ruling 2026-11-26, MENU-1 and MENU-3). The words live here, in the menu's own lazy code, and not in `node-kinds.ts` or `tree-actions.ts`, so the first load of the page
 * does not carry them (NFR-009). The Part item is one item that always adds a PART: it reads "Sub-part" when the row already holds a Part, because the Part it adds will then be called that (SPEC 6.1, FR-043, ADR-020 K1).
 */
const SUB_PART = 'Sub-part';
/** The hint of the kinds that have one besides the Part: no row allows a Main Assembly under it, so that one is never offered. */
const HINTS: Readonly<Partial<Record<NodeKind, string>>> = {
  SUB_ASSEMBLY: 'A group of parts and fasteners',
  FASTENER: 'A bought-out item, same inputs as a part',
};
const FIRST_PART_HINT = 'The first part under this row. A second one is called "Sub-part"';
const NEXT_PART_HINT = 'A part is already here, so both are called "Sub-part"';

/** The name and the hint of one item: the stored kind it adds, as the person will see the new row named. */
function itemText(nodeKind: NodeKind, holdsPart: boolean): { readonly name: string; readonly hint: string } {
  if (nodeKind !== 'PART') return { name: NODE_KIND_NAMES[nodeKind], hint: HINTS[nodeKind] ?? '' };
  return holdsPart ? { name: SUB_PART, hint: NEXT_PART_HINT } : { name: NODE_KIND_NAMES.PART, hint: FIRST_PART_HINT };
}

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
export function AddNodeMenuPanel({ label, nodeKinds, onChoose, keyboard, holdsPart = false, unavailable, describedBy }: AddNodeMenuPanelProps) {
  // The group of the row the menu is under (`RowActions`), found from the trigger once it is on the page: the menu is put inside it, so it opens in line under the row and not on the page body (AQP-451, DEF-094).
  // Absent until then (nothing is drawn); null when the trigger is in no such group (the menu then opens in the default place).
  const [group, setGroup] = useState<HTMLElement | null | undefined>(undefined);
  const anchor = useCallback((button: HTMLElement | null): void => {
    if (button !== null) setGroup(button.closest<HTMLElement>('[data-row-actions]'));
  }, []);
  // The override is for the open that mounted the menu only; from then on Radix sees every key itself.
  const openedByKeyboard = useRef(keyboard);
  const [open, setOpen] = useState(true);
  const focusOnOpen = (event: Event): void => {
    if (!openedByKeyboard.current) return;
    openedByKeyboard.current = false;
    focusFirstItem(event);
  };
  return (
    // Open at first, as it was asked for; controlled, so that while a change is on its way (AQP-343) a press, Enter, Space or an arrow on the trigger cannot open it again. Radix reads only `disabled`, which would also take the focus away.
    <DropdownMenu modal={false} open={open} onOpenChange={(next) => {
        if (!next || unavailable !== true) setOpen(next);
      }}>
      <DropdownMenuTrigger asChild>
        <AddNodeTrigger ref={anchor} label={label} {...(unavailable === true ? { unavailable, ...(describedBy === undefined ? {} : { 'aria-describedby': describedBy }) } : {})} />
      </DropdownMenuTrigger>
      {group === undefined ? null : (
      <DropdownMenuContent align="start" container={group} data-inline-menu="" className="mb-s-2 ml-s-1 mt-s-1 min-w-0 max-w-(--menu-w)" {...{ onOpenAutoFocus: focusOnOpen }}>
        {/* The header says which row the menu adds under. Text only and hidden from assistive technology: the menu is named by its trigger, which has the same words (`label`). */}
        <div data-menu-header="" aria-hidden={true} className="px-s-3 pb-s-2 text-label font-semibold text-ink-2">
          {label}
        </div>
        {nodeKinds.map((nodeKind) => {
          const { name, hint } = itemText(nodeKind, holdsPart);
          const hintId = `add-node-hint-${nodeKind}`;
          // The name stays the plain word (it is what a screen reader says and what a test finds); the hint is its description.
          return (
            <DropdownMenuItem key={nodeKind} aria-label={name} aria-describedby={hintId} disabled={unavailable === true} onSelect={() => onChoose(nodeKind)} className="py-s-2">
              <NodeKindIcon kind={nodeKind} />
              <span className="flex flex-col">
                <span>{name}</span>
                <span id={hintId} className="text-label font-normal text-ink-2">
                  {hint}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
