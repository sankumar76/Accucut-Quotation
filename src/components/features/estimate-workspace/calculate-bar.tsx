import { Button } from '@/components/ui/button';
import type { SaveGate } from '@/lib/estimates/save-gate';

import { CALCULATE_BUTTON_ID } from './calculate-button';
import { QuantityWarningDialog } from './quantity-warning-dialog';
import { SaveDraftButton, SaveDraftNotice, useSaveDraft } from './save-bar';
import type { CalculateState } from './use-calculate';

/** The words of the bar: the one button's three states and the line beside it. None names a rate, a price or a formula (UX-24). They are here and not in `estimate-texts.ts`, which the first load carries whole. */
const CALCULATE_BAR_LABEL = 'Calculate';
const CALCULATE_LABEL = 'Calculate';
const CALCULATING_LABEL = 'Calculating';
const SUBMITTED_LABEL = 'Submitted';
const CALCULATE_HINT = 'Every part is checked. Nothing is submitted until all of them are complete.';

export interface CalculateBarProps {
  /** True once the estimate has been submitted (by this press or an earlier one): the button reads "Submitted" and is off. */
  readonly submitted: boolean;
  /** What a press does and the state it leaves (`useCalculate`): whether one is in flight, and the quantity warning while its dialog is open (STORY-05.12). One prop, so the page's first load carries as little as possible (NFR-009). */
  readonly calculation: CalculateState;
  /** The page's save gate: Save draft sends again what the form shows and waits on it (STORY-05.08). */
  readonly gate: SaveGate;
  /** Chooses the part of a warned row in the tree. */
  readonly onChoosePart: (nodeId: string) => void;
}

/**
 * The action bar of SCR-05 (STORY-05.09 AC-2, AC-9; UX spec SCR-05 "Submitted", UX-14): a bar that stays at the bottom edge of the workspace while the form scrolls, with the one button that
 * submits. It is a measured sticky bar (`data-sticky-bar`), so the page's `scroll-padding` keeps a focused field clear of it (WCAG 2.4.11), and it wraps on a phone with the button at full width.
 * After a good Calculate the button reads "Submitted" and is disabled. Nothing here knows a figure: it has none to show (NFR-002). Save draft (STORY-05.08, `save-bar.tsx`) sits beside it while the estimate can still be changed, with the line "Draft saved at 10:42 IST." under the hint.
 * The quantity warning's dialog (STORY-05.12) is drawn from here: it belongs to the press, and living in this file keeps it out of the page's first load.
 */
export function CalculateBar({ submitted, calculation, gate, onChoosePart }: CalculateBarProps) {
  const { busy, warning } = calculation;
  const draft = useSaveDraft(gate);
  return (
    <>
      <div
        role="group"
        aria-label={CALCULATE_BAR_LABEL}
        data-sticky-bar="bottom"
        data-calculate-bar=""
        className="sticky bottom-0 z-(--z-bar) flex flex-wrap items-center justify-between gap-s-3 rounded-md border border-border bg-surface px-s-4 py-s-3 shadow-card"
      >
        <div className="flex min-w-0 flex-col gap-s-1">
          <p className="min-w-0 text-label text-ink-3">{CALCULATE_HINT}</p>
          {submitted ? null : <SaveDraftNotice draft={draft} />}
        </div>
        <div className="flex w-full gap-s-2 sm:w-auto">
          {submitted ? null : <SaveDraftButton draft={draft} />}
          {submitted ? (
            <Button id={CALCULATE_BUTTON_ID} variant="secondary" disabled className="flex-1 sm:flex-none">
              {SUBMITTED_LABEL}
            </Button>
          ) : (
            <Button id={CALCULATE_BUTTON_ID} loading={busy} onClick={() => void calculation.calculate()} className="flex-1 sm:flex-none">
              {busy ? CALCULATING_LABEL : CALCULATE_LABEL}
            </Button>
          )}
        </div>
      </div>
      {warning === null ? null : (
        <QuantityWarningDialog
          key={warning.inputsRevision}
          rows={warning.rows}
          changed={warning.changed}
          busy={busy}
          onGoBack={() => calculation.setWarning(null)}
          onGoAhead={() => void calculation.calculate(warning.inputsRevision)}
          onChoosePart={onChoosePart}
        />
      )}
    </>
  );
}
