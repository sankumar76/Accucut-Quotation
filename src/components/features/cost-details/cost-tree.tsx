import { BREAK_LONG_NAMES } from '@/components/shared/break-long-names';
import { NodeKindIcon } from '@/components/shared/node-kind-icon';
import { PartsTreeList } from '@/components/shared/parts-tree-list';
import { RowName } from '@/components/shared/row-name';
import { TOUCH_LINK } from '@/components/shared/touch-link';
import { TREE_COLUMN_PANEL, TREE_COLUMN_SUMMARY } from '@/components/shared/tree-column-panel';
import { TREE_ROW_NUMBER } from '@/components/shared/tree-row-number';
import { cn } from '@/lib/cn';
import type { NodeKind } from '@/lib/estimate/node-kinds';

import { COST_TREE_TITLE } from './cost-details-texts';

/**
 * The parts tree column of SCR-07 (AQP-452, DEF-113; UX spec SCR-07 "Layout" and "Responsive"): the estimate's rows in the width of the SCR-05 tree, sticky with a scroll of its own from 1024 px and a foldable panel
 * below it, as SCR-06's (`TREE_COLUMN_PANEL`). It holds names and kinds and **no figure**: each row is the way to that row's own cost details, and the row that is open is `aria-current`. A server component with no
 * hook, so it ships no script. Lead and Admin only, like the screen it is in.
 */

/**
 * What a row of this tree needs, and no more: the tree read of the estimate (`getTree`) has it, and carries no figure (QLT-789-01). Anything else a node holds is not drawn.
 */
export interface CostTreeNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly slNo: string;
  readonly nodeKind: NodeKind;
  /** The name as typed (Description, else Part No.), or an empty text. */
  readonly label: string;
}

/** The address of SCR-07 for a row: the task code and the row's Sl. No. */
const costDetailsHref = (code: string, slNo: string): string => `/estimates/${encodeURIComponent(code)}/costs/${encodeURIComponent(slNo)}`;

function TreeRow({ node, kindLabel, code, openSlNo }: { readonly node: CostTreeNode; readonly kindLabel: string; readonly code: string; readonly openSlNo: string }) {
  const open = node.slNo === openSlNo;
  return (
    <a
      href={costDetailsHref(code, node.slNo)}
      {...(open ? { 'aria-current': 'page' as const } : {})}
      className={cn(TOUCH_LINK, 'w-full gap-s-2 rounded-md py-s-1 pr-s-2 pl-s-1 text-body text-ink no-underline hover:bg-surface-2 aria-[current=page]:bg-primary-soft aria-[current=page]:font-semibold')}
    >
      <NodeKindIcon kind={node.nodeKind} label={kindLabel} />
      <span data-sl-no="" className={TREE_ROW_NUMBER}>
        {node.slNo}
      </span>
      <span className={cn('min-w-0 flex-1', BREAK_LONG_NAMES)}>
        <RowName label={node.label} kindLabel={kindLabel} />
      </span>
    </a>
  );
}

export interface CostTreeProps {
  readonly code: string;
  /** Every row of the estimate, in reading order. */
  readonly nodes: ReadonlyArray<CostTreeNode>;
  /** The Sl. No of the row whose cost details are open. */
  readonly openSlNo: string;
}

export function CostTree({ code, nodes, openSlNo }: CostTreeProps) {
  return (
    // Below 1024 px the stages come first and the tree follows them: the design is silent on the phone's order, and a Lead there should not scroll past every row to reach the stages (QLT-789-04).
    <details open data-cost-tree="" className={cn(TREE_COLUMN_PANEL, 'max-[1023px]:order-last')}>
      <summary className={TREE_COLUMN_SUMMARY}>{COST_TREE_TITLE}</summary>
      <div className="px-s-4 pb-s-4">
        <PartsTreeList label={COST_TREE_TITLE} nodes={nodes} renderRow={(node, kindLabel) => <TreeRow node={node} kindLabel={kindLabel} code={code} openSlNo={openSlNo} />} />
      </div>
    </details>
  );
}
