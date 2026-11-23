'use client';

import type { ComponentType, KeyboardEvent, MouseEvent } from 'react';

import { FirstOpenFailure } from '@/components/shared/first-open-failure';
import { useFirstOpen } from '@/components/shared/use-first-open';
import type { NodeKind } from '@/lib/estimate/node-kinds';

import { AddNodeTrigger } from './add-node-trigger';

/** What the loaded menu is given. It opens itself, with focus as the way it was opened asks for. */
export interface AddNodeMenuPanelProps {
  readonly label: string;
  /** The kinds the row allows, from `ALLOWED_CHILDREN` (`addActionOf`): the menu offers these and no other. */
  readonly nodeKinds: ReadonlyArray<NodeKind>;
  readonly onChoose: (nodeKind: NodeKind) => void;
  /** Opened with Enter, Space or ArrowDown: focus goes to the first item. A pointer open leaves it on the menu. */
  readonly keyboard: boolean;
}

export interface AddNodeMenuProps extends Omit<AddNodeMenuPanelProps, 'keyboard'> {
  /** Names the control for the first-open loader: one per row. */
  readonly id: string;
}

/** The menu's code: a bare `import()` behind a type-only import above, so a failed request can be tried again and none of it (Radix `DropdownMenu` and its positioning) is in the first load (AQP-188, NFR-009, ADR-016). */
const loadPanel = (): Promise<ComponentType<AddNodeMenuPanelProps>> => import('./add-node-menu-panel').then((module) => module.AddNodeMenuPanel);

const FAILURE_MESSAGE = 'The menu did not open. Check your connection and try again.';

/**
 * The "+" of a row that offers a choice of kinds (Main Assembly and Sub-Assembly rows; CR-01 item 3C, AC-1). Until its first open it is a plain button with the face, name and `aria-haspopup="menu"` of the Radix
 * trigger that replaces it: the menu's code is not in the first load of the page. The first press fetches the code (the pressed look and `aria-busy` while it comes) and the menu then opens in the same place; a
 * failed request shows a line and the next press asks again. Same pattern as the account menu (`account-menu.tsx`).
 */
export function AddNodeMenu({ id, label, nodeKinds, onChoose }: AddNodeMenuProps) {
  const first = useFirstOpen<AddNodeMenuPanelProps>({ id, load: loadPanel });
  const failureId = `${id}-failure`;

  if (first.shown && first.Overlay !== null) {
    const Panel = first.Overlay;
    return <Panel label={label} nodeKinds={nodeKinds} onChoose={onChoose} keyboard={first.keyboard} />;
  }

  const onClick = (event: MouseEvent<HTMLButtonElement>): void => first.activate(event.detail === 0);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    first.activate(true);
  };

  return (
    <span className="relative inline-flex">
      <AddNodeTrigger label={label} aria-haspopup="menu" aria-expanded={false} aria-busy={first.pending || undefined} aria-describedby={first.failed ? failureId : undefined} onClick={onClick} onKeyDown={onKeyDown} />
      {first.failed ? <FirstOpenFailure id={failureId} message={FAILURE_MESSAGE} align="right" /> : null}
    </span>
  );
}
