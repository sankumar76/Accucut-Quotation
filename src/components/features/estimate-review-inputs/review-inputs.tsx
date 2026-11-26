'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { createSaveGate } from '@/lib/estimates/save-gate';
import type { PartItem } from '@/lib/estimates/tree-client';

import { PartForm } from '../estimate-workspace/part-form';


export interface ReviewInputsProps {
  readonly estimateId: string;
  /** Every row of the estimate, for the form's head ("Sub-Assembly · level 2, under 1 ..."). **No figure**: the page maps the rows down to where each sits, its number, its kind and its name before they reach this client code (NFR-002). */
  readonly rows: ReadonlyArray<PartItem>;
  /** The row whose inputs are shown (the page resolves `?row`). */
  readonly selectedId: string;
  /** The words of the block's one notice, by status (`review-texts.ts`). */
  readonly notice: string;
  /** The row's own figure line, drawn on the server and handed in as an element. */
  readonly rowLine: ReactNode;
  /** The row's eyebrow, title and figure line as the server drew them, shown while the form is read. */
  readonly head: ReactNode;
  /** What is said once, politely, after a row is chosen: "Showing the inputs of 1.4 Top cover. Read-only." */
  readonly showing: string;
}

const noop = (): void => undefined;
const WIDE = '(min-width: 1024px)';

/**
 * The Lead's and the Admin's view of one row's inputs on SCR-06 (AQP-488, DEF-131 Stage 1; UX ruling `lead-admin-edit-inputs-2026-11-27.md` section 3): the **Engineer's own form**, `PartForm`, with `editable` false
 * and the review look (`PartReview`), so there is no second form (UD-1). It reads the form and the part through the same routes the Engineer uses (`GET /form`, `GET /nodes/{id}`, which the server serves to a Lead and
 * an Admin), saves nothing, starts no autosave and holds no figure: the row line is an element the server drew.
 *
 * It lives in its own folder, outside the review's own folder, whose files are all server components. It is the one client file of the block and is imported by the review alone. After a row is chosen (the address
 * changed, not the first paint) it moves the focus to the form's title, says what is shown once, and under 1024 px folds the parts tree so the inputs are in view.
 */
export function ReviewInputs({ estimateId, rows, selectedId, notice, rowLine, head, showing }: ReviewInputsProps) {
  const part = useMemo(() => {
    const row = rows.find((candidate) => candidate.id === selectedId);
    return row === undefined ? null : { id: row.id, slNo: row.slNo, revision: 0 };
  }, [rows, selectedId]);
  const [gate] = useState(createSaveGate);
  const [none] = useState<ReadonlySet<string>>(() => new Set());
  // A row was chosen after the page was drawn: the first paint steals no focus and says nothing.
  const [seen, setSeen] = useState(selectedId);
  const [chosen, setChosen] = useState(false);
  if (seen !== selectedId) {
    setSeen(selectedId);
    setChosen(true);
  }

  useEffect(() => {
    if (!chosen || window.matchMedia(WIDE).matches) return;
    document.querySelector<HTMLDetailsElement>('[data-review-tree]')?.removeAttribute('open');
  }, [chosen, selectedId]);

  return (
    <div id="row-inputs" className="min-w-0 scroll-mt-[var(--sticky-top,var(--topbar-h))]">
      <PartForm
        estimateId={estimateId}
        part={part}
        editable={false}
        nodes={rows}
        onSaved={noop}
        onChanged={noop}
        onNamed={noop}
        onServerIgnored={noop}
        missing={none}
        gate={gate}
        review={{ notice, rowLine, head, focusTitle: chosen }}
      />
      <p role="status" className="sr-only">
        {chosen ? showing : ''}
      </p>
    </div>
  );
}
