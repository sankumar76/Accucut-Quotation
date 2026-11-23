'use client';

import type { ComponentType, KeyboardEvent, MouseEvent, PointerEvent } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';

import { endsDrag, MoveHandleTrigger, startDrag } from './move-handle-trigger';

/** What the loaded menu is given. It opens itself, with focus as the way it was opened asks for. */
export interface MoveHandleMenuProps {
  /** The tooltip and the spoken name: "Move 1.1 Frame". */
  readonly label: string;
  /** The place Move up takes the row to among its siblings, or null on the first sibling (`stepOf`). */
  readonly upTo: number | null;
  /** The place Move down takes the row to, or null on the last sibling. */
  readonly downTo: number | null;
  /** Moves the row to this place among its siblings: from the menu, and from the end of a drag. */
  readonly onMoveTo: (index: number) => void;
  /** Opened with Enter, Space or ArrowDown: focus goes to the first item that can be chosen. A pointer open leaves it on the menu. */
  readonly keyboard: boolean;
}

export interface MoveHandleProps extends Omit<MoveHandleMenuProps, 'keyboard'> {
  /** Names the control for the first-open loader: one per row. */
  readonly id: string;
}

/** The menu's code: a bare `import()` behind a type-only import, so a failed request can be tried again and none of it is in the first load (AQP-188, NFR-009, ADR-016). */
const loadMenu = (): Promise<ComponentType<MoveHandleMenuProps>> => import('./move-menu').then((module) => module.MoveMenu);

const FAILURE_MESSAGE = 'The menu did not open. Check your connection and try again.';

/**
 * The move handle of a row (CR-01 item 3D, AQP-406; UX spec section 0.9 row 3): the one control that is in the first load. **A press and a drag** with the pointer drag the row to a new place among the rows with the
 * same parent (`tree-reorder.ts`, loaded at the first pointer-down); **a click, Enter, Space or an arrow-down** opens Move up / Move down (`move-menu.tsx`, loaded at the first open: the pressed look and
 * `aria-busy` while it comes, a line if it does not). Until then it is a plain button with the face, name and `aria-haspopup="menu"` of the Radix trigger that replaces it. Same pattern as the "+" menu (`add-node-menu.tsx`).
 */
export function MoveHandle({ id, label, upTo, downTo, onMoveTo }: MoveHandleProps) {
  const first = useFirstOpen<MoveHandleMenuProps>({ id, load: loadMenu });
  const failureId = `${id}-failure`;

  if (first.shown && first.Overlay !== null) {
    const Menu = first.Overlay;
    return <Menu label={label} upTo={upTo} downTo={downTo} onMoveTo={onMoveTo} keyboard={first.keyboard} />;
  }

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => startDrag(event, onMoveTo);
  const onClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (!endsDrag(event.currentTarget)) first.activate(event.detail === 0);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    first.activate(true);
  };

  return (
    <span className="relative inline-flex">
      <MoveHandleTrigger label={label} aria-haspopup="menu" aria-expanded={false} aria-busy={first.pending || undefined} aria-describedby={first.failed ? failureId : undefined} onPointerDown={onPointerDown} onClick={onClick} onKeyDown={onKeyDown} />
      {first.failed ? <FirstOpenFailure id={failureId} message={FAILURE_MESSAGE} align="right" /> : null}
    </span>
  );
}
