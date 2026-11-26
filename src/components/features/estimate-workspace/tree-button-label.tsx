import { GitBranch } from 'lucide-react';

import { Icon } from '@/components/shared/icon';
import { rowNameOf } from '@/lib/estimates/row-name';

import { TREE_TITLE } from './estimate-texts';

export interface TreeButtonLabelProps {
  /** The number of the part that is open, or `null` while no part is known. */
  readonly slNo: string | null;
  /** Its name as typed; empty when it has none. */
  readonly name: string;
  /** The name of its kind ("Part" or "Sub-part" by its siblings), shown when the part has no name (DEF-089). */
  readonly kindLabel?: string;
}

/**
 * What the button that opens the parts tree shows on a phone and a tablet (AQP-458, DEF-101; UX spec SCR-05 "Responsive"): the branch icon, "Parts tree" and, muted at the far right and cut with an ellipsis where
 * it is long, the number and the name of the part that is open ("1.1 Base frame"). Its accessible name is the text, "Parts tree 1.1 Base frame"; the icon says nothing of its own. A part with no name shows its
 * kind's own name, as the tree's rows do.
 */
export function TreeButtonLabel({ slNo, name, kindLabel = '' }: TreeButtonLabelProps) {
  const part = slNo === null ? '' : `${slNo} ${rowNameOf(name, kindLabel)}`.trim();
  return (
    <>
      <Icon icon={GitBranch} />
      <span className="flex-1 shrink-0 text-left">{TREE_TITLE}</span>
      {part === '' ? null : (
        <>
          {' '}
          <span className="min-w-0 truncate text-label font-normal text-ink-2">{part}</span>
        </>
      )}
    </>
  );
}
