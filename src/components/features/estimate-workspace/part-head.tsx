import type { Ref } from 'react';

import { RowName } from '@/components/shared/row-name';
import { nodeKindLabel } from '@/lib/estimate/node-kinds';
import { rowNameOf } from '@/lib/estimates/row-name';
import type { PartItem } from '@/lib/estimates/tree-client';

/**
 * The head of the part form (AQP-454, DEF-097; SCR-05 mock-up and UX spec): a small eyebrow that says what the row is and where it sits, "Sub-Assembly · level 2, under 1 Control cabinet assembly", and under it the
 * title, the row's number and its name, "1.1 · Base frame" (the same name as the tree row: its Description, else its Part No., else the kind's own name, muted). The words are the tree's own facts, so they follow the
 * tree when the person leaves Description. In a file of its own so that none of it is in the first load of the estimate page (NFR-009).
 */

/** The row's own place, in words: its kind, its level (a Main Assembly is level 1) and the row it is under. Empty when the row is not in the tree (yet). */
export function partEyebrow(nodes: ReadonlyArray<PartItem>, partId: string): string {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const row = byId.get(partId);
  if (row === undefined) return '';
  const parent = byId.get(row.parentId ?? '');
  let level = 1;
  for (let up = parent; up !== undefined; up = byId.get(up.parentId ?? '')) level += 1;
  const under = parent === undefined ? '' : `, under ${parent.slNo} ${rowNameOf(parent.label, nodeKindLabel(parent, nodes))}`;
  return `${nodeKindLabel(row, nodes)} · level ${level}${under}`;
}

export interface PartHeadProps {
  readonly partId: string;
  readonly slNo: string;
  /** The tree as it is now; null until it is read. */
  readonly nodes: ReadonlyArray<PartItem> | null;
  readonly titleId: string;
  /** The title takes the focus when the last field is left with Enter and there is no Calculate button to take it. */
  readonly titleRef: Ref<HTMLHeadingElement>;
}

export function PartHead({ partId, slNo, nodes, titleId, titleRef }: PartHeadProps) {
  const row = nodes?.find((node) => node.id === partId);
  const eyebrow = nodes === null ? '' : partEyebrow(nodes, partId);
  return (
    <>
      {eyebrow === '' ? null : <p data-part-eyebrow="" className="text-label font-semibold tracking-[0.06em] text-ink-2 uppercase">{eyebrow}</p>}
      <h3 id={titleId} ref={titleRef} tabIndex={-1} className="text-sub font-semibold text-ink">
        <span className="font-mono">{slNo}</span>
        {' · '}
        {row === undefined || nodes === null ? 'Part' : <RowName label={row.label} kindLabel={nodeKindLabel(row, nodes)} />}
      </h3>
    </>
  );
}
