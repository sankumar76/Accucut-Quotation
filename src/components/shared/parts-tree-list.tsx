import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';
import { nodeKindLabel, type NodeKind } from '@/lib/estimate/node-kinds';
import { branchesOf, type Branch } from '@/lib/estimates/tree-moves';

/**
 * What a row of the parts tree needs of a node (CR-01 item 3B): where it sits, its number and its stored kind. Both the workspace tree (SCR-05) and the review tree (SCR-06) draw their rows through this one
 * component, so a row reads the same on both: an arrow, the kind icon, the number and the name, and, on the review, the figures on a second line.
 */
export interface PartsTreeItem {
  readonly id: string;
  readonly parentId: string | null;
  readonly slNo: string;
  readonly nodeKind: NodeKind;
}

/** What a caller draws inside a row: the node, and the name of its kind (`nodeKindLabel`: "Part" or "Sub-part" by its siblings). */
export type RenderPartsTreeRow<T extends PartsTreeItem> = (node: T, kindLabel: string) => ReactNode;

export interface PartsTreeListProps<T extends PartsTreeItem> {
  /** The nodes in reading order. */
  readonly nodes: ReadonlyArray<T>;
  /** The accessible name of the navigation landmark ("Parts tree"). */
  readonly label: string;
  readonly renderRow: RenderPartsTreeRow<T>;
  /** The ID of the `nav`, for a caller that moves focus into it. */
  readonly id?: string;
  /**
   * The branches that are closed, and what a press on an arrow does. Leave both out for the read-only tree (SCR-06, SCR-07): every branch is shown open, and the arrow only tells that a branch is there (no
   * button, no action).
   */
  readonly closed?: ReadonlySet<string>;
  readonly onToggle?: (id: string) => void;
}

/** The words of an arrow: "Close branch 1.1" while it is open, "Open branch 1.1" while it is closed. */
export const branchToggleLabel = (open: boolean, slNo: string): string => `${open ? 'Close' : 'Open'} branch ${slNo}`;

/**
 * The branches of a row at this level or deeper are not indented any more, so a deep legacy tree (one that has more levels than the kinds allow) never grows wider than its panel (no sideways scroll at 360 px). Four
 * levels are what the kinds allow, and the guide lines of the levels below them are drawn.
 */
const LAST_INDENTED_LEVEL = 5;

/** The width an arrow takes, kept by a leaf row too, so the icons of a level line up whether or not a row has a branch below it. At least 44 px wide and tall: it is a touch target (NFR-017). */
const ARROW_CELL = 'flex min-h-(--control-h) w-(--control-h) shrink-0 items-center justify-center';

function ArrowCell({ branch, open, interactive, onToggle, controls }: { readonly branch: Branch<PartsTreeItem>; readonly open: boolean; readonly interactive: boolean; readonly onToggle: (() => void) | undefined; readonly controls: string }) {
  if (branch.children.length === 0) return <span aria-hidden="true" className={ARROW_CELL} data-branch-arrow="none" />;
  const arrow = <Icon icon={open ? ChevronDown : ChevronRight} size="small" />;
  if (!interactive) {
    return (
      <span aria-hidden="true" className={cn(ARROW_CELL, 'text-ink-3')} data-branch-arrow={open ? 'open' : 'closed'}>
        {arrow}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={branchToggleLabel(open, branch.node.slNo)}
      data-branch-arrow={open ? 'open' : 'closed'}
      onClick={onToggle}
      className={cn(ARROW_CELL, 'rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink')}
    >
      {arrow}
    </button>
  );
}

interface BranchItemProps<T extends PartsTreeItem> {
  readonly branch: Branch<T>;
  readonly siblings: ReadonlyArray<T>;
  readonly level: number;
  readonly renderRow: RenderPartsTreeRow<T>;
  readonly closed: ReadonlySet<string> | undefined;
  readonly onToggle: ((id: string) => void) | undefined;
}

function BranchItem<T extends PartsTreeItem>({ branch, siblings, level, renderRow, closed, onToggle }: BranchItemProps<T>) {
  const { node, children } = branch;
  const interactive = closed !== undefined && onToggle !== undefined;
  const open = !(closed?.has(node.id) ?? false);
  const childrenId = `parts-tree-branch-${node.id}`;
  return (
    <li data-part-row={node.id}>
      {/* The row. `relative` and the empty slot at its end are where the toolbar of 3C (add, delete) and 3D (move) goes, so neither has to lay the row out again. */}
      <div className="relative flex items-start">
        <ArrowCell branch={branch} open={open} interactive={interactive} onToggle={interactive ? () => onToggle(node.id) : undefined} controls={childrenId} />
        <div className="min-w-0 flex-1">{renderRow(node, nodeKindLabel(node, siblings))}</div>
        <div data-row-toolbar="" className="absolute inset-y-0 right-0 flex items-center" />
      </div>
      {children.length > 0 && open ? (
        <ul id={childrenId} className={cn('flex flex-col', level < LAST_INDENTED_LEVEL && 'ml-s-5 border-l border-border')}>
          {children.map((child) => (
            <BranchItem key={child.node.id} branch={child} siblings={children.map((sibling) => sibling.node)} level={level + 1} renderRow={renderRow} closed={closed} onToggle={onToggle} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The parts tree as a list of links (CR-01 item 3B, UX spec section 0.9 row 3; AQP-404): `nav` > nested `ul`, not `role="tree"`, because a tree item may not hold a second control and a row now does (its arrow, and
 * later its "+", "-" and move buttons). The level is told by the nesting and by thin guide lines, never by an `aria-level`, `aria-posinset` or `aria-setsize`. Each row is an arrow cell (a button when the tree
 * can open and close, a mark when it cannot, and the same empty space for a leaf row), what the caller draws, and the empty toolbar slot at the row's end.
 */
export function PartsTreeList<T extends PartsTreeItem>({ nodes, label, renderRow, id, closed, onToggle }: PartsTreeListProps<T>) {
  const top = branchesOf(nodes);
  return (
    <nav aria-label={label} {...(id === undefined ? {} : { id })}>
      <ul className="flex flex-col">
        {top.map((branch) => (
          <BranchItem key={branch.node.id} branch={branch} siblings={top.map((sibling) => sibling.node)} level={1} renderRow={renderRow} closed={closed} onToggle={onToggle} />
        ))}
      </ul>
    </nav>
  );
}
