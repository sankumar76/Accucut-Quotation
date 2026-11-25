import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Icon } from '@/components/shared/icon';
import { cn } from '@/lib/cn';
import { nodeKindLabel, type NodeKind } from '@/lib/estimate/node-kinds';
import { branchesOf, siblingPlacesOf, type Branch, type SiblingPlace } from '@/lib/estimates/tree-moves';

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

/**
 * What a caller draws in the toolbar slot of a row: the row's node, the name of its kind and **its place among the rows with the same parent** (AQP-406, PRF-C-01). The list works every place out once for the whole tree, so a
 * toolbar that needs to know where its row sits (Move up and Move down) reads it here and never scans the list itself.
 */
export type RenderPartsTreeToolbar<T extends PartsTreeItem> = (node: T, kindLabel: string, place: SiblingPlace) => ReactNode;

export interface PartsTreeListProps<T extends PartsTreeItem> {
  /** The nodes in reading order. */
  readonly nodes: ReadonlyArray<T>;
  /** The accessible name of the navigation landmark ("Parts tree"). */
  readonly label: string;
  readonly renderRow: RenderPartsTreeRow<T>;
  /**
   * What goes in the toolbar slot of each row (CR-01 item 3C: the "+" and "-"; 3D adds the move handle). The slot is a line of its own **under the row's name**, in the column of the link (AQP-418, DEF-075: a toolbar
   * that floated over the row took the press that was meant for the name). With no toolbar (the review tree, a person who may not edit) there is no slot, so no empty line. When the toolbar is in view is its own rule
   * (`RowActions`): the slot only gives it its place.
   */
  readonly renderToolbar?: RenderPartsTreeToolbar<T>;
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

/**
 * The width an arrow takes, kept by a leaf row too, so the icons of a level line up whether or not a row has a branch below it. At least 44 px wide and tall: it is a touch target (NFR-017). For a mouse at 1024 px and
 * wider (`fine-wide:`) it is 24 x 36 (WCAG 2.5.8 holds), so the row is 36 px, as its link already asks (DEF-081 ruling items 7b and 12); a finger, and anything narrower than 1024 px, keep 44 px.
 */
const ARROW_CELL = 'flex min-h-(--control-h) w-(--control-h) shrink-0 items-center justify-center fine-wide:min-h-(--compact-field-h) fine-wide:w-s-5';

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
  readonly renderToolbar: RenderPartsTreeToolbar<T> | undefined;
  /** The place of every row among its siblings, worked out once for the tree. Only there when there is a toolbar to give it to. */
  readonly places: ReadonlyMap<string, SiblingPlace> | undefined;
  readonly closed: ReadonlySet<string> | undefined;
  readonly onToggle: ((id: string) => void) | undefined;
}

/**
 * The toolbar slot of a row: the second line of the row's grid, in the link's column, so it is under the name and never over it. It is `relative`, so the clipped toolbar of a row that is not shown (`sr-only`, absolutely
 * placed) stays at the foot of its own row and adds no height.
 */
const TOOLBAR_SLOT = 'relative col-start-2 min-w-0';

/** The place of a row the list has no place for. Never reached (every row of the list has one); a row with neither Move up nor Move down is the safe answer if it ever were. */
const ONLY_CHILD: SiblingPlace = { index: 0, count: 1 };

function BranchItem<T extends PartsTreeItem>({ branch, siblings, level, renderRow, renderToolbar, places, closed, onToggle }: BranchItemProps<T>) {
  const { node, children } = branch;
  const kindLabel = nodeKindLabel(node, siblings);
  const interactive = closed !== undefined && onToggle !== undefined;
  const open = !(closed?.has(node.id) ?? false);
  const childrenId = `parts-tree-branch-${node.id}`;
  // The nodes of this level, made once for all its rows (a copy for each row made the list of a wide branch grow with the square of its rows).
  const childNodes = children.length > 0 && open ? children.map((child) => child.node) : [];
  return (
    <li data-part-row={node.id}>
      {/* The row: two columns, the arrow cell and then the link, with the toolbar slot on a line of its own under the link (AQP-418). */}
      <div className="group/row relative grid grid-cols-[auto_minmax(0,1fr)] items-start">
        <ArrowCell branch={branch} open={open} interactive={interactive} onToggle={interactive ? () => onToggle(node.id) : undefined} controls={childrenId} />
        <div className="min-w-0">{renderRow(node, kindLabel)}</div>
        {renderToolbar === undefined ? null : (
          <div data-row-toolbar="" className={TOOLBAR_SLOT}>
            {renderToolbar(node, kindLabel, places?.get(node.id) ?? ONLY_CHILD)}
          </div>
        )}
      </div>
      {children.length > 0 && open ? (
        <ul id={childrenId} className={cn('flex flex-col', level < LAST_INDENTED_LEVEL && 'ml-s-5 border-l border-border fine-wide:ml-s-3 fine-wide:pl-s-2')}>
          {children.map((child) => (
            <BranchItem key={child.node.id} branch={child} siblings={childNodes} level={level + 1} renderRow={renderRow} renderToolbar={renderToolbar} places={places} closed={closed} onToggle={onToggle} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The parts tree as a list of links (CR-01 item 3B, UX spec section 0.9 row 3; AQP-404): `nav` > nested `ul`, not `role="tree"`, because a tree item may not hold a second control and a row now does (its arrow, and
 * later its "+", "-" and move buttons). The level is told by the nesting and by thin guide lines, never by an `aria-level`, `aria-posinset` or `aria-setsize`. Each row is an arrow cell (a button when the tree
 * can open and close, a mark when it cannot, and the same empty space for a leaf row), what the caller draws, and, where the caller gives a toolbar, the toolbar on its own line under it (AQP-418).
 */
export function PartsTreeList<T extends PartsTreeItem>({ nodes, label, renderRow, renderToolbar, id, closed, onToggle }: PartsTreeListProps<T>) {
  const top = branchesOf(nodes);
  const topNodes = top.map((branch) => branch.node);
  const places = renderToolbar === undefined ? undefined : siblingPlacesOf(nodes);
  return (
    <nav aria-label={label} {...(id === undefined ? {} : { id })}>
      <ul className="flex flex-col">
        {top.map((branch) => (
          <BranchItem key={branch.node.id} branch={branch} siblings={topNodes} level={1} renderRow={renderRow} renderToolbar={renderToolbar} places={places} closed={closed} onToggle={onToggle} />
        ))}
      </ul>
    </nav>
  );
}
