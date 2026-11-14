import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { cn } from '@/lib/cn';
import type { PartRow } from '@/lib/estimates/tree-moves';

import { TREE_ALL_INPUTS, TREE_NO_INPUTS, TREE_PART_NAME, TREE_SOME_INPUTS } from './estimate-texts';

/** The indent of each level; a part deeper than the last entry keeps the last indent, so a deep tree never grows wider than the panel (no sideways scroll at 360 px). */
const LEVEL_INDENT = ['pl-s-2', 'pl-s-4', 'pl-s-5', 'pl-s-6', 'pl-s-7'] as const;

const COMPLETENESS_TEXT = { EMPTY: TREE_NO_INPUTS, PARTIAL: TREE_SOME_INPUTS, COMPLETE: TREE_ALL_INPUTS } as const;

export interface TreeNodeProps {
  readonly row: PartRow;
  readonly selected: boolean;
  /** The part took focus (a click or an arrow key): it becomes the selected one. */
  readonly onFocusPart: (id: string) => void;
}

/**
 * One part in the tree (STORY-05.02 AC-9; UX spec SCR-05 "Accessibility"): a `treeitem` with its level, its place among its siblings and whether it is selected. It is
 * the one tab stop of the tree while it is selected (roving tabindex), and taking focus selects it. What it is (its Sl. No and name) and how filled it is are text, so a
 * screen reader reads both; no figure is ever shown here. The name is empty until the part form stores one (STORY-05.03), so "Part" stands in.
 */
export function TreeNode({ row, selected, onFocusPart }: TreeNodeProps) {
  const { part, level, position, size } = row;
  return (
    <li
      role="treeitem"
      data-part-id={part.id}
      aria-level={level}
      aria-posinset={position}
      aria-setsize={size}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onFocus={() => onFocusPart(part.id)}
      className={cn(
        'flex min-h-(--control-h) cursor-pointer items-center gap-s-2 rounded-md border border-transparent py-s-1 pr-s-2 text-body text-ink hover:bg-surface-2',
        'aria-selected:border-primary-line aria-selected:bg-primary-soft aria-selected:font-semibold',
        LEVEL_INDENT[Math.min(level, LEVEL_INDENT.length) - 1],
        BREAK_LONG_NAMES,
      )}
    >
      <span className="shrink-0 tabular-nums">{part.slNo}</span>
      <span className="min-w-0">{part.label === '' ? TREE_PART_NAME : part.label}</span>
      <span className="sr-only">{COMPLETENESS_TEXT[part.completeness]}</span>
    </li>
  );
}
