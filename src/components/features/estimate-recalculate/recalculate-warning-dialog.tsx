'use client';

import { QuantityWarningDialogView } from '@/components/shared/quantity-warning-dialog';
import { goAheadLabel, LEAD_WARNING_NOTE } from '@/lib/estimate/lead-warning-copy';
import type { WarnedRowView } from '@/lib/estimates/calculate-client';

export interface RecalculateWarningDialogProps {
  /** The rows the server named, in reading order: at least one while the dialog is on the page. */
  readonly rows: ReadonlyArray<WarnedRowView>;
  /** True when the list is a new one: the person pressed the way on and something had changed in between, so nothing was calculated. */
  readonly changed: boolean;
  /** True while the way on is on its way: its button is held and the dialog cannot be dismissed. */
  readonly busy: boolean;
  /** The label of the button that was pressed, "Recalculate" or "Calculate": the way on is that and "anyway". */
  readonly pressed: string;
  /** "Go back" and Escape: closes the dialog and changes nothing. */
  readonly onGoBack: () => void;
  /** "Recalculate anyway": sends the acknowledgement for the revision of this list. */
  readonly onGoAhead: () => void;
  /** Radix has no trigger to return focus to, so the button places it. */
  readonly onCloseAutoFocus: (event: Event) => void;
}

/**
 * The Lead's and the Admin's quantity warning (STORY-06.10 AC-1; UX spec v0.30 SCR-06 state "Quantity warning (Recalculate)"; UX-44, A-26): the dialog of SCR-05 and the same words, plus "You are asked each time you
 * press Calculate or Recalculate, even if the Engineer already went ahead.", with the buttons "Go back" and "Recalculate anyway" ("Calculate anyway" on a Draft). It is the shared `QuantityWarningDialogView`; what
 * is its own is that a row is plain text (the review has no form to go to) and the label of the way on. **It is not in the first load** (NFR-009, ADR-016): the Recalculate button fetches it with a bare `import()`
 * only when the server has answered with the 409, and imports its props as a type only. Nothing here is a figure: the rows are the server's sentences about a 0 the person typed (NFR-002).
 */
export function RecalculateWarningDialog({ rows, changed, busy, pressed, onGoBack, onGoAhead, onCloseAutoFocus }: RecalculateWarningDialogProps) {
  return (
    <QuantityWarningDialogView
      lines={rows.map((row) => ({ key: row.nodeId, text: row.message }))}
      changed={changed}
      busy={busy}
      goAheadLabel={goAheadLabel(pressed)}
      note={LEAD_WARNING_NOTE}
      onGoBack={onGoBack}
      onGoAhead={onGoAhead}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  );
}
