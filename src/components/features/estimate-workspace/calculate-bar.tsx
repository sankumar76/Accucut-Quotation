import { Button } from '@/components/ui/button';

import { CALCULATE_BAR_LABEL, CALCULATE_HINT, CALCULATE_LABEL, CALCULATING_LABEL, SUBMITTED_LABEL } from './estimate-texts';

/** The id of the Calculate button: Enter on the last field of the form puts focus on it (STORY-05.09 AC-9; UX spec SCR-05 "Interactions"). */
export const CALCULATE_BUTTON_ID = 'calculate-button';

/**
 * Puts focus on the Calculate button and answers whether it took it. It never presses it: Enter on the last field **moves** to Calculate and does not submit. False while the button is
 * not there (the estimate is no longer a draft) or is busy, and the caller then keeps its own fallback.
 */
export function focusCalculate(): boolean {
  const button = document.getElementById(CALCULATE_BUTTON_ID);
  if (button === null || button.matches(':disabled')) return false;
  button.focus();
  return true;
}

export interface CalculateBarProps {
  /** True once the estimate has been submitted (by this press or an earlier one): the button reads "Submitted" and is off. */
  readonly submitted: boolean;
  readonly busy: boolean;
  readonly onCalculate: () => void;
}

/**
 * The action bar of SCR-05 (STORY-05.09 AC-2, AC-9; UX spec SCR-05 "Submitted", UX-14): a bar that stays at the bottom edge of the workspace while the form scrolls, with the one button that
 * submits. It is a measured sticky bar (`data-sticky-bar`), so the page's `scroll-padding` keeps a focused field clear of it (WCAG 2.4.11), and it wraps on a phone with the button at full width.
 * After a good Calculate the button reads "Submitted" and is disabled. Nothing here knows a figure: it has none to show (NFR-002). Save draft is STORY-05.08's and joins this bar.
 */
export function CalculateBar({ submitted, busy, onCalculate }: CalculateBarProps) {
  return (
    <div
      role="group"
      aria-label={CALCULATE_BAR_LABEL}
      data-sticky-bar="bottom"
      data-calculate-bar=""
      className="sticky bottom-0 z-(--z-bar) flex flex-wrap items-center justify-between gap-s-3 rounded-md border border-border bg-surface px-s-4 py-s-3 shadow-card"
    >
      <p className="min-w-0 text-label text-ink-3">{CALCULATE_HINT}</p>
      {submitted ? (
        <Button id={CALCULATE_BUTTON_ID} variant="secondary" disabled className="w-full sm:w-auto">
          {SUBMITTED_LABEL}
        </Button>
      ) : (
        <Button id={CALCULATE_BUTTON_ID} loading={busy} onClick={onCalculate} className="w-full sm:w-auto">
          {busy ? CALCULATING_LABEL : CALCULATE_LABEL}
        </Button>
      )}
    </div>
  );
}
