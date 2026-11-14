/**
 * Whether an estimate's calculated figures may be read (STORY-03.05; FR-100, FR-101; ADR-007; architecture section 4.8).
 *
 * "Cleared" is a rule on reading, never a change to a record: a calculation is immutable and an approved one must survive, so nothing is
 * deleted or nulled. The state is worked out from two counts already held: `estimates.inputs_revision` (raised by every real input change)
 * and the `inputs_revision` the linked calculation was made at.
 *
 * | State         | Condition                                 |
 * | ------------- | ----------------------------------------- |
 * | `none`        | no calculation is linked to the estimate  |
 * | `current`     | the two revisions are equal               |
 * | `out-of-date` | they differ                               |
 *
 * One rule, no exceptions by column or by row: **no calculated value is read unless the state is `current`**. Every read of a figure from
 * `calculations` or `calculation_rows` goes through this module (architecture section 10).
 *
 * Pure, and it holds no figure itself (only counts), so it is not Restricted: an Engineer's code may know the state. `figuresWhenCurrent`
 * hands a figure on only when the state is `current`; it does not make an Engineer's code able to reach the figure in the first place,
 * which the import rule on the calculation repository and service does (ADR-008, NFR-002).
 */

export type FigureState = 'none' | 'current' | 'out-of-date';

export interface FigureStateInput {
  /** `estimates.inputs_revision`: raised by every real input change, in the same transaction. */
  readonly inputsRevision: number;
  /** `calculations.inputs_revision` of the calculation the estimate is linked to, or `null` while it has none. */
  readonly calculationInputsRevision: number | null;
}

/** The state of an estimate's figures. A calculation that is somehow ahead of its estimate counts as out of date, never as current. */
export function figureState({ inputsRevision, calculationInputsRevision }: FigureStateInput): FigureState {
  if (calculationInputsRevision === null) return 'none';
  return calculationInputsRevision === inputsRevision ? 'current' : 'out-of-date';
}

/** The figures when the state is `current`, and `null` (nothing) in any other state. */
export function figuresWhenCurrent<T>(state: FigureState, figures: T): T | null {
  return state === 'current' ? figures : null;
}
