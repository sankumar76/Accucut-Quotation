/**
 * The eight sections and six stages of the seed registry, and the stable IDs the seed derives (STORY-03.01,
 * SPEC sections 7.1 and 7.4). Split from `seed-config.ts` so each file stays within the 400-line limit
 * of the coding standards. Structure only: names, display modes and which letters total a stage.
 */

// ---- Stable IDs --------------------------------------------------------------------------------------
// Opaque and fixed once stored. Derived from the draft's place in each list below, so they are the same
// on every machine and in every test. Rates have their own fixed IDs in `seed-ids.ts`.

export const FIELD_ID_NAMESPACE = 1;
export const SECTION_ID_NAMESPACE = 2;
export const STAGE_ID_NAMESPACE = 3;
const ID_NAMESPACE_DIGITS = 4;
const ID_ORDINAL_DIGITS = 8;

export function seedId(namespace: number, ordinal: number): string {
  return `00000000-0000-4000-8000-${String(namespace).padStart(ID_NAMESPACE_DIGITS, '0')}${String(ordinal).padStart(ID_ORDINAL_DIGITS, '0')}`;
}

// ---- Sections (SPEC section 7.1) ---------------------------------------------------------------------

export interface SectionDraft {
  readonly name: string;
  readonly shortName: string;
  readonly displayMode: 'cards' | 'multi-select';
}

/** In form order. The number is the 1-based place in this list; short names are the labels of the jump strip on SCR-05. */
export const SECTION_DRAFTS: ReadonlyArray<SectionDraft> = [
  { name: 'Part Details', shortName: 'Part details', displayMode: 'cards' },
  { name: 'Material and Dimensions', shortName: 'Material', displayMode: 'cards' },
  { name: 'Cutting Process', shortName: 'Cutting', displayMode: 'cards' },
  { name: 'Bending', shortName: 'Bending', displayMode: 'cards' },
  { name: 'Fasteners', shortName: 'Fasteners', displayMode: 'cards' },
  { name: 'Welding', shortName: 'Welding', displayMode: 'cards' },
  // All eight treatment flags are one multi-select drop-down: selected is 1, not selected is 0.
  { name: 'Surface Treatment', shortName: 'Surface', displayMode: 'multi-select' },
  { name: 'Other Costs and Remarks', shortName: 'Other', displayMode: 'cards' },
];

// ---- Stages (SPEC section 7.4) -----------------------------------------------------------------------

export interface StageDraft {
  readonly name: string;
  readonly shortName: string;
  readonly subHeadings: ReadonlyArray<string>;
  /** Letters of the fields whose sum is the stage total. */
  readonly totalLetters: ReadonlyArray<string>;
}

/**
 * Stage 3's total is Total Process Cost (AY) and stage 5 adds Rejection to Transportation (BC to BF), as
 * architecture section 4.5 says. For the other stages the total is the stage's closing figure; stage 1 has
 * none, as weights and areas are not added together. These are defaults that a later configuration edit
 * can change.
 */
export const STAGE_DRAFTS: ReadonlyArray<StageDraft> = [
  { name: 'Weights & Areas', shortName: 'Weights', subHeadings: [], totalLetters: [] },
  { name: 'Material Cost', shortName: 'Material', subHeadings: [], totalLetters: ['AK'] },
  {
    name: 'Process Costs',
    shortName: 'Process',
    subHeadings: ['Cutting', 'Bending', 'Welding', 'Surface Treatment', 'Entered directly', 'Process Total'],
    totalLetters: ['AY'],
  },
  { name: 'Sub Total', shortName: 'Sub total', subHeadings: [], totalLetters: ['BB'] },
  { name: 'Rejection, Overheads & Logistics', shortName: 'Overheads', subHeadings: [], totalLetters: ['BC', 'BD', 'BE', 'BF'] },
  { name: 'Pricing', shortName: 'Pricing', subHeadings: [], totalLetters: ['BG'] },
];

export const STAGE_WEIGHTS = 1;
export const STAGE_MATERIAL = 2;
export const STAGE_PROCESS = 3;
export const STAGE_SUB_TOTAL = 4;
export const STAGE_OVERHEADS = 5;
export const STAGE_PRICING = 6;
