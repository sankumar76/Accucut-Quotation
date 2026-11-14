/**
 * The Calculate button's id and the one thing the form does with it (STORY-05.09 AC-9): Enter on the last field of the form puts focus on it. Kept apart from the bar that draws the button
 * (`calculate-bar.tsx`, fetched after the page is up) so the form carries these few lines and not the bar (NFR-009).
 */
export const CALCULATE_BUTTON_ID = 'calculate-button';

/**
 * Puts focus on the Calculate button and answers whether it took it. It never presses it: Enter on the last field **moves** to Calculate and does not submit. False while the button is not there
 * (the estimate is no longer a draft, or the bar's code has not arrived) or is busy, and the caller then keeps its own fallback.
 */
export function focusCalculate(): boolean {
  const button = document.getElementById(CALCULATE_BUTTON_ID);
  if (button === null || button.matches(':disabled')) return false;
  button.focus();
  return true;
}
