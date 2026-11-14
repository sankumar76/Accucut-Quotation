/** The code of a task: `Q-<year>-<running number, at least 4 digits>` (STORY-04.01 AC-2, FR-041). The year is the year in IST (`istYearOf`). */

const CODE_PREFIX = 'Q';
const MIN_DIGITS = 4;

export function formatTaskCode(year: number, runningNumber: number): string {
  return `${CODE_PREFIX}-${year}-${String(runningNumber).padStart(MIN_DIGITS, '0')}`;
}
