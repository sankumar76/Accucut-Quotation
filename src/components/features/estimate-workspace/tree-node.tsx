import type { MouseEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Icon } from '@/components/shared/icon';
import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { RowName } from '@/components/shared/row-name';
import { TREE_ROW_NUMBER } from '@/components/shared/tree-row-number';
import { cn } from '@/lib/cn';
import type { PartItem } from '@/lib/estimates/tree-client';

import { COMPLETENESS_ICON, COMPLETENESS_INK, COMPLETENESS_TEXT, MISSING_ICON, MISSING_INK } from './completeness-look';
import { FORM_AREA_TITLE_ID, TREE_MISSING_INPUTS } from './estimate-texts';

export interface TreeNodeProps {
  readonly part: PartItem;
  /** The name of the row's kind ("Part" or "Sub-part" by its siblings, `nodeKindLabel`): the tooltip and the spoken name of the kind icon. */
  readonly kindLabel: string;
  /** The row whose details are open in the form beside the tree. */
  readonly selected: boolean;
  /** Calculate found a missing input in this part (STORY-05.09; architecture A-16: client state from the blocked answer, never stored): a triangle and words follow the name. */
  readonly missing?: boolean;
  /** True once for the row that was just added: its link takes the focus when it is mounted (CR-01 item 3C AC-3). A ref callback, so nothing is read while rendering and nothing is set. */
  readonly takesFocus?: (id: string) => boolean;
  /** The row was chosen. `byKeyboard` is true for Enter on the link: the form then takes the focus (STORY-05.03, review SQR-11), as Enter on a part did before. */
  readonly onChoose: (id: string, byKeyboard: boolean) => void;
}

/**
 * The link of one row of the parts tree (CR-01 item 3B; UX spec SCR-05 "Accessibility"; STORY-05.02 AC-9 as changed): a link to the form area that opens this row's details, which is what a press or Enter
 * on it does (`onChoose`; the page does not move). It reads, in order, the kind icon (its name is a tooltip and the spoken name), the number and the name, and the status icon at the end; there is **no text
 * label for the kind**. The open row carries `aria-current="true"`. Tab moves from a row to its arrow and to its buttons; there is no roving tab stop and no arrow-key navigation (PM ruling). What it is
 * and how filled it is are text, so a screen reader reads both; no figure is ever shown here. The name is the Description, else the Part No. (the row's `label`, from the server); with neither it is the
 * kind's own name in a muted style, with ", no description yet" for a screen reader (`RowName`; AQP-446, DEF-089).
 */
export function TreeNode({ part, kindLabel, selected, missing = false, onChoose, takesFocus }: TreeNodeProps) {
  const choose = (event: MouseEvent<HTMLAnchorElement>): void => {
    // The link is the way to the details, not a move of the page: the form beside the tree shows them. A press with a finger or a mouse has a detail of 1 or more, a key a detail of 0.
    event.preventDefault();
    onChoose(part.id, event.detail === 0);
  };
  return (
    <a
      href={`#${FORM_AREA_TITLE_ID}`}
      data-part-id={part.id}
      aria-current={selected ? 'true' : undefined}
      ref={(link) => {
        if (link !== null && takesFocus?.(part.id) === true) link.focus();
      }}
      onClick={choose}
      className={cn(
        'flex min-h-(--control-h) fine-wide:min-h-(--compact-field-h) cursor-pointer items-center gap-s-2 rounded-md py-s-1 pr-s-2 pl-s-1 text-body text-ink no-underline hover:bg-surface-2',
        'aria-[current=true]:bg-surface-2 aria-[current=true]:font-semibold aria-[current=true]:shadow-[inset_var(--s-1)_0_0_var(--primary)]',
        BREAK_LONG_NAMES,
      )}
    >
      <NodeKindIcon kind={part.nodeKind} label={kindLabel} />
      <span data-sl-no="" className={TREE_ROW_NUMBER}>
        {part.slNo}
      </span>
      <span className="min-w-0 flex-1">
        <RowName label={part.label} kindLabel={kindLabel} />
      </span>
      <Icon icon={COMPLETENESS_ICON[part.completeness]} size="default" data-completeness={part.completeness} className={cn('shrink-0', COMPLETENESS_INK[part.completeness])} />
      {missing ? (
        <>
          <Icon icon={MISSING_ICON} size="small" className={cn('shrink-0', MISSING_INK)} />
          <span className="sr-only">{TREE_MISSING_INPUTS}</span>
        </>
      ) : null}
      <span className="sr-only">{COMPLETENESS_TEXT[part.completeness]}</span>
    </a>
  );
}
