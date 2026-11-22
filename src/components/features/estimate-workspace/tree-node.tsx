import { Check, Circle, Contrast, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';

import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { Icon } from '@/components/shared/icon';
import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { cn } from '@/lib/cn';
import type { PartItem } from '@/lib/estimates/tree-client';

import { FORM_AREA_TITLE_ID, TREE_ALL_INPUTS, TREE_MISSING_INPUTS, TREE_NO_INPUTS, TREE_PART_NAME, TREE_SOME_INPUTS } from './estimate-texts';

const COMPLETENESS_TEXT = { EMPTY: TREE_NO_INPUTS, PARTIAL: TREE_SOME_INPUTS, COMPLETE: TREE_ALL_INPUTS } as const;

/**
 * The icon of each word (STORY-05.11 AC-4; UX spec SCR-05 "Content": check, half circle, empty circle): a different shape for each, so the state is never told by colour alone. The icons are decorative
 * (lucide hides one that has no name from assistive technology); the words stay beside them for a screen reader.
 */
const COMPLETENESS_ICON: Record<keyof typeof COMPLETENESS_TEXT, LucideIcon> = { EMPTY: Circle, PARTIAL: Contrast, COMPLETE: Check };

export interface TreeNodeProps {
  readonly part: PartItem;
  /** The name of the row's kind ("Part" or "Sub-part" by its siblings, `nodeKindLabel`): the tooltip and the spoken name of the kind icon. */
  readonly kindLabel: string;
  /** The row whose details are open in the form beside the tree. */
  readonly selected: boolean;
  /** Calculate found a missing input in this part (STORY-05.09; architecture A-16: client state from the blocked answer, never stored): a triangle and words follow the name. */
  readonly missing?: boolean;
  /** The row was chosen. `byKeyboard` is true for Enter on the link: the form then takes the focus (STORY-05.03, review SQR-11), as Enter on a part did before. */
  readonly onChoose: (id: string, byKeyboard: boolean) => void;
}

/**
 * The link of one row of the parts tree (CR-01 item 3B; UX spec SCR-05 "Accessibility"; STORY-05.02 AC-9 as changed): a link to the form area that opens this row's details, which is what a press or Enter
 * on it does (`onChoose`; the page does not move). It reads, in order, the kind icon (its name is a tooltip and the spoken name), the number and the name, and the status icon at the end; there is **no text
 * label for the kind**. The open row carries `aria-current="true"`. Tab moves from a row to its arrow and to its buttons; there is no roving tab stop and no arrow-key navigation (PM ruling). What it is
 * and how filled it is are text, so a screen reader reads both; no figure is ever shown here. The name is empty until the part form stores one (STORY-05.03), so "Part" stands in.
 */
export function TreeNode({ part, kindLabel, selected, missing = false, onChoose }: TreeNodeProps) {
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
      onClick={choose}
      className={cn(
        'flex min-h-(--control-h) fine-wide:min-h-(--compact-field-h) cursor-pointer items-center gap-s-2 rounded-md border border-transparent py-s-1 pr-s-2 pl-s-1 text-body text-ink no-underline hover:bg-surface-2',
        'aria-[current=true]:border-primary-line aria-[current=true]:bg-primary-soft aria-[current=true]:font-semibold',
        BREAK_LONG_NAMES,
      )}
    >
      <NodeKindIcon kind={part.nodeKind} label={kindLabel} />
      <span data-sl-no="" className="shrink-0 tabular-nums">
        {part.slNo}
      </span>
      <span className="min-w-0 flex-1">{part.label === '' ? TREE_PART_NAME : part.label}</span>
      <Icon icon={COMPLETENESS_ICON[part.completeness]} size="small" data-completeness={part.completeness} className={cn('shrink-0', part.completeness === 'COMPLETE' ? 'text-success' : 'text-ink-3')} />
      {missing ? (
        <>
          <Icon icon={TriangleAlert} size="small" className="shrink-0 text-danger" />
          <span className="sr-only">{TREE_MISSING_INPUTS}</span>
        </>
      ) : null}
      <span className="sr-only">{COMPLETENESS_TEXT[part.completeness]}</span>
    </a>
  );
}
