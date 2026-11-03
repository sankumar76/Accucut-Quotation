/**
 * Seed configuration, version 1: the SPEC section 7 field registry (STORY-03.01).
 *
 * Structure only: field definitions, sections, stages and formulas. No master value, no rate and no cell
 * value from the sample workbook is in this file (ADR-014, NFR-006). The formulas are the ones SPEC
 * section 7.4 prints, which are already public in the requirements file; one differs on purpose, Scrap
 * Weight (O), as SPEC section 7.4 and architecture section 4.9 explain.
 *
 * This is the one place besides tests where column letters are written by hand (coding standards section
 * 10). They label the drafts below so the table can be checked against SPEC section 7 line by line; the
 * stored document has no letter at all. Each draft's letter is checked against its position when the
 * module loads, so a field that is missing or out of order stops the build instead of shifting every
 * later letter.
 *
 * ASSUMPTION (SPEC section 15 item 3, ASSUMPTION-46): header texts are the SPEC's labels, and widths and
 * number formats are sensible defaults, not values read from the sample worksheet. A later change to this
 * module never touches an install that already has a version: `ensureSeedVersion` runs only when none exists.
 */
import { assertNever } from '../../../src/lib/assert-never';
import { columnLetterToIndex, indexToColumnLetter } from '../../../src/lib/columns';
import type { FieldDefinition } from '../../../src/lib/fields/field-schema';
import { toInternalForm, type ReferenceContext } from '../../../src/lib/fields/formula-references';
import { parseConfigDocument, type ConfigDocument } from '../../../src/lib/fields/schema';
import { SEED_PROCESS_ITEMS } from './seed-ids';

/** Why version 1 exists. Stored in `config_versions.reason`. */
export const SEED_VERSION_REASON = 'Seed configuration (SPEC section 7)';

// ---- Stable IDs --------------------------------------------------------------------------------------
// Opaque and fixed once stored. Derived from the draft's place in each list below, so they are the same
// on every machine and in every test. Rates have their own fixed IDs in `seed-ids.ts`.

const FIELD_ID_NAMESPACE = 1;
const SECTION_ID_NAMESPACE = 2;
const STAGE_ID_NAMESPACE = 3;
const ID_NUMBER_DIGITS = 8;

function seedId(namespace: number, number: number): string {
  return `00000000-0000-4000-8000-${String(namespace).padStart(4, '0')}${String(number).padStart(ID_NUMBER_DIGITS, '0')}`;
}

// ---- Sections (SPEC section 7.1) ---------------------------------------------------------------------

interface SectionDraft {
  readonly name: string;
  readonly shortName: string;
  readonly displayMode: 'cards' | 'multi-select';
}

/** In form order. The number is the 1-based place in this list; short names are the labels of the jump strip on SCR-05. */
const SECTION_DRAFTS: ReadonlyArray<SectionDraft> = [
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

interface StageDraft {
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
const STAGE_DRAFTS: ReadonlyArray<StageDraft> = [
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

const STAGE_WEIGHTS = 1;
const STAGE_MATERIAL = 2;
const STAGE_PROCESS = 3;
const STAGE_SUB_TOTAL = 4;
const STAGE_OVERHEADS = 5;
const STAGE_PRICING = 6;

// ---- Fields ------------------------------------------------------------------------------------------

type SystemRoleName = FieldDefinition['systemRole'];

interface CommonDraft {
  /** The SPEC letter. Checked against the draft's position at load. */
  readonly letter: string;
  readonly key: string;
  readonly label: string;
  readonly systemRole?: SystemRoleName;
  readonly unit?: string;
  readonly hint?: string;
  readonly displayUnit?: string;
  readonly width?: number;
  readonly numFmt?: string;
}

interface InputDraft extends CommonDraft {
  readonly kind: 'input';
  readonly dataType: 'number' | 'text' | 'select' | 'select_other' | 'flag' | 'image';
  /** Section number 1 to 8, and place on the Engineer's form. */
  readonly section: number;
  readonly formOrder: number;
  readonly mandatory: boolean;
  readonly defaultValue?: string;
  /** Hidden while the field with this letter holds one of these values. */
  readonly hiddenWhen?: { readonly letter: string; readonly values: ReadonlyArray<string> };
  /** Cost-view placement for inputs that SPEC section 7.4 lists under a stage (AP and AU). */
  readonly stage?: { readonly number: number; readonly group: string };
}

interface AutoDraft extends CommonDraft {
  readonly kind: 'auto';
  readonly dataType: 'text' | 'auto_lookup';
  readonly section: number;
  readonly formOrder: number;
  readonly engineerVisible: boolean;
}

interface OutputDraft extends CommonDraft {
  readonly kind: 'output';
  readonly stage: { readonly number: number; readonly group?: string };
  /** Display form, as SPEC section 7.4 prints it. Absent for the Approved Quote Price. */
  readonly formula?: string;
  /** Letter of the treatment flag that hides this line while it is 0. */
  readonly hideWhenZero?: string;
  readonly scope?: 'product';
}

type FieldDraft = InputDraft | AutoDraft | OutputDraft;

const DEFAULT_WIDTH = { number: 12, text: 20, select: 24, image: 14, flag: 12, output: 14 };
const NUMBER_FORMAT = { number: '0.00', text: '@', flag: '0', money: '#,##0.00' };
const NOT_APPLICABLE_HINT = (what: string): string => `Choose 'Not applicable' if this row has no ${what}`;

const FASTENERS_LETTER = 'S';
const FASTENERS_NONE = 'None';

/** Shorthand for a number input of SPEC section 7.1, number(2dp). */
function numberInput(
  letter: string,
  key: string,
  label: string,
  section: number,
  formOrder: number,
  extra: Partial<InputDraft> = {},
): InputDraft {
  return { letter, key, label, kind: 'input', dataType: 'number', section, formOrder, mandatory: true, ...extra };
}

function flagInput(letter: string, key: string, label: string, formOrder: number): InputDraft {
  // A flag that is not chosen is 0, so an absent key is valid and the field is never "missing".
  return { letter, key, label, kind: 'input', dataType: 'flag', section: 7, formOrder, mandatory: false, defaultValue: '0' };
}

function output(letter: string, key: string, label: string, stage: OutputDraft['stage'], formula: string | undefined, extra: Partial<OutputDraft> = {}): OutputDraft {
  return { letter, key, label, kind: 'output', stage, ...(formula === undefined ? {} : { formula }), ...extra };
}

function treatmentCost(letter: string, key: string, label: string, flag: string, formula: string): OutputDraft {
  return output(letter, key, label, { number: STAGE_PROCESS, group: 'Surface Treatment' }, formula, { hideWhenZero: flag });
}

/**
 * Every field of SPEC sections 7.1 and 7.4 in column order: 35 inputs and auto fields, 32 outputs, 67 in all.
 * The input rows carry their place on the Engineer's form (`formOrder`), which differs from column order.
 */
const FIELD_DRAFTS: ReadonlyArray<FieldDraft> = [
  // 01 Part Details
  { letter: 'A', key: 'sl-no', label: 'Sl. No', kind: 'auto', dataType: 'text', section: 1, formOrder: 1, engineerVisible: false, systemRole: 'sl-no', width: 8, numFmt: NUMBER_FORMAT.text },
  { letter: 'B', key: 'part-no', label: 'Part No.', kind: 'input', dataType: 'text', section: 1, formOrder: 2, mandatory: true },
  // Optional: Calculate does not require a picture (D-31).
  { letter: 'C', key: 'part-model', label: 'Part Model', kind: 'input', dataType: 'image', section: 1, formOrder: 3, mandatory: false },
  { letter: 'D', key: 'description', label: 'Description', kind: 'input', dataType: 'text', section: 1, formOrder: 4, mandatory: true, width: 30 },
  // 02 Material and Dimensions
  { letter: 'E', key: 'material-in-drawing', label: 'Material in Drawing', kind: 'input', dataType: 'select', section: 2, formOrder: 7, mandatory: true, hint: NOT_APPLICABLE_HINT('material') },
  { letter: 'F', key: 'material-considered', label: 'Material Considered', kind: 'auto', dataType: 'auto_lookup', section: 2, formOrder: 8, engineerVisible: true },
  { letter: 'G', key: 'treatment-color', label: 'Treatment / Color', kind: 'input', dataType: 'select_other', section: 1, formOrder: 5, mandatory: true, hint: NOT_APPLICABLE_HINT('treatment or colour') },
  // QTY per Assy is the count for the whole order, typed on every row (D-12, D-34).
  { letter: 'H', key: 'qty-per-assy', label: 'QTY per Assy', kind: 'input', dataType: 'number', section: 1, formOrder: 6, mandatory: true, systemRole: 'quantity', hint: 'The count of this part for the whole order' },
  // I carries a price: never visible to an Engineer.
  { letter: 'I', key: 'material-rate-per-kg', label: 'Material Rate / Kg', kind: 'auto', dataType: 'auto_lookup', section: 2, formOrder: 9, engineerVisible: false },
  numberInput('J', 'length', 'Length', 2, 10),
  numberInput('K', 'width', 'Width', 2, 11),
  numberInput('L', 'thickness', 'Thickness', 2, 12),
  output('M', 'blank-weight', 'Blank Weight', { number: STAGE_WEIGHTS }, '(L * K * J * Material-Specific-Gravity) / 1000000', { displayUnit: 'kg', numFmt: NUMBER_FORMAT.number }),
  numberInput('N', 'part-weight', 'Part Weight', 2, 13, { unit: 'kg' }),
  // Differs from SPEC 1.0 (`M - N`): zero for the hidden "Not applicable" material (SPEC 7.4, architecture 4.9).
  output('O', 'scrap-weight', 'Scrap Weight', { number: STAGE_WEIGHTS }, 'IF(Material-Specific-Gravity > 0, M - N, 0)', { displayUnit: 'kg', numFmt: NUMBER_FORMAT.number }),
  // 03 Cutting Process
  numberInput('P', 'cutting-time', 'Cutting Time', 3, 14, { unit: 'sec' }),
  numberInput('Q', 'cutting-length', 'Cutting Length', 3, 15),
  // 04 Bending
  numberInput('R', 'bend-count', 'No. of Bend', 4, 16),
  // 05 Fasteners: T and U show only while S is not "None" and not blank; otherwise they are hidden and 0.
  { letter: FASTENERS_LETTER, key: 'fasteners', label: 'Fasteners', kind: 'input', dataType: 'text', section: 5, formOrder: 17, mandatory: true, defaultValue: FASTENERS_NONE },
  numberInput('T', 'fasteners-qty', 'Fasteners Qty', 5, 18, { hiddenWhen: { letter: FASTENERS_LETTER, values: [FASTENERS_NONE, ''] } }),
  numberInput('U', 'fasteners-cost', 'Fasteners Cost', 5, 19, { hiddenWhen: { letter: FASTENERS_LETTER, values: [FASTENERS_NONE, ''] } }),
  // 06 Welding
  numberInput('V', 'weld', 'Weld', 6, 20),
  numberInput('W', 'drilling', 'Drilling', 6, 21),
  numberInput('X', 'tapping', 'Tapping', 6, 22),
  numberInput('Y', 'csk', 'CSK', 6, 23),
  // 07 Surface Treatment
  flagInput('Z', 'hot-dip-galvanizing', 'Hot Dip Galvanizing', 24),
  flagInput('AA', 'primer', 'Primer', 25),
  flagInput('AB', 'shot-blasting', 'Shot Blasting', 26),
  flagInput('AC', 'polishing', 'Polishing', 27),
  // The Plating flag is unused in any formula and Plating Cost (AU) is typed in (SPEC section 15 item 6, D-40).
  flagInput('AD', 'plating', 'Plating', 28),
  flagInput('AE', 'powder-coating', 'Powder Coating', 29),
  flagInput('AF', 'foam', 'Foam', 30),
  flagInput('AG', 'soft-anodize', 'Soft Anodize', 31),
  output('AH', 'area-sq-in', 'Area in Sq. in', { number: STAGE_WEIGHTS }, '(J * K * 2) / 645', { displayUnit: 'sq in', numFmt: NUMBER_FORMAT.number }),
  output('AI', 'area-sq-ft', 'Area in Sq. ft', { number: STAGE_WEIGHTS }, 'AH / 144', { displayUnit: 'sq ft', numFmt: NUMBER_FORMAT.number }),
  // 08 Other Costs and Remarks: the form shows AP, AU, BM, then AJ.
  { letter: 'AJ', key: 'remarks', label: 'Remarks', kind: 'input', dataType: 'text', section: 8, formOrder: 35, mandatory: true, width: 40 },
  output('AK', 'material-cost', 'Material Cost', { number: STAGE_MATERIAL }, '(M * I) - (O * Material-Scrap-Rate)'),
  output('AL', 'cutting-cost', 'Cutting Cost', { number: STAGE_PROCESS, group: 'Cutting' }, 'P * Cutting-Rate-per-Sec'),
  output('AM', 'bending-cost', 'Bending Cost', { number: STAGE_PROCESS, group: 'Bending' }, 'R * Bending-Rate-per-stroke'),
  output('AN', 'drilling-tapping-cost', 'Drilling / Tapping Cost', { number: STAGE_PROCESS, group: 'Welding' }, '(W + X + Y) * Drilling-Tapping-Rate'),
  output('AO', 'welding-cost', 'Welding Cost', { number: STAGE_PROCESS, group: 'Welding' }, 'N * Welding-rate-per-kg * V'),
  numberInput('AP', 'machining-cost', 'Machining Cost', 8, 32, { stage: { number: STAGE_PROCESS, group: 'Entered directly' } }),
  treatmentCost('AQ', 'hot-dip-galvanizing-cost', 'Hot Dip Galvanizing Cost', 'Z', '(N * Dip-Galvanizing-Cost-per-kg) * Z'),
  treatmentCost('AR', 'primer-cost', 'Primer Cost', 'AA', '(AI * Primer-rate-per-sqft) * AA'),
  treatmentCost('AS', 'shot-blasting-cost', 'Shot Blasting Cost', 'AB', '(N * Shot-Blasting-rate-per-kg) * AB'),
  treatmentCost('AT', 'polishing-cost', 'Polishing Cost', 'AC', 'AC * ((AH / 2) * Polishing-rate-per-sqin)'),
  numberInput('AU', 'plating-cost', 'Plating Cost', 8, 33, { stage: { number: STAGE_PROCESS, group: 'Entered directly' } }),
  treatmentCost('AV', 'powder-coating-cost', 'Powder Coating Cost', 'AE', 'AE * (AI * Powder-rate-per-sqft)'),
  treatmentCost('AW', 'foam-cost', 'Foam Cost', 'AF', 'AF * AI * Foam Cost'),
  treatmentCost('AX', 'soft-anodize-cost', 'Soft Anodize Cost', 'AG', 'AG * (AH * Soft-Anodize-rate-per-sqin)'),
  output('AY', 'total-process-cost', 'Total Process Cost', { number: STAGE_PROCESS, group: 'Process Total' }, 'AL + AM + AN + AO + AP + AQ + AR + AS + AT + AU + AV + AW + AX'),
  output('AZ', 'bought-out-fasteners', 'BO Cost / Fasteners', { number: STAGE_SUB_TOTAL }, 'T * U'),
  output('BA', 'cost-per-piece', 'Material Cost + Total Process Cost + Others', { number: STAGE_SUB_TOTAL }, 'AK + AY + AZ'),
  // H is an operand here and in no other seed formula: BB carries the whole-order count (D-12).
  output('BB', 'sub-total-1', 'Sub Total 1', { number: STAGE_SUB_TOTAL }, 'BA * H'),
  // Rejection is not defined yet: seeded as 0 (SPEC section 15 item 1).
  output('BC', 'rejection', 'Rejection', { number: STAGE_OVERHEADS }, '0'),
  output('BD', 'oh-profit', 'OH Profit', { number: STAGE_OVERHEADS }, 'BB * OH Profit %'),
  output('BE', 'inspection-packing', 'Inspection & Packing', { number: STAGE_OVERHEADS }, 'BB * Inspection & Packing %'),
  output('BF', 'transportation', 'Transportation', { number: STAGE_OVERHEADS }, 'BB * Transport %'),
  output('BG', 'unit-price', 'Unit Production Price (INR)', { number: STAGE_PRICING }, 'BB + BC + BD + BE + BF', { systemRole: 'unit-price' }),
  output('BH', 'exchange-rate-usd', 'Exchange Rate USD', { number: STAGE_PRICING }, 'ExchangeRate-USD', { numFmt: NUMBER_FORMAT.number }),
  output('BI', 'exchange-rate-eur', 'Exchange Rate EUR', { number: STAGE_PRICING }, 'ExchangeRate-EUR', { numFmt: NUMBER_FORMAT.number }),
  output('BJ', 'unit-price-usd', 'Unit Production Price (USD)', { number: STAGE_PRICING }, 'BG / BH', { displayUnit: '$' }),
  output('BK', 'unit-price-eur', 'Unit Production Price (EUR)', { number: STAGE_PRICING }, 'BG / BI', { displayUnit: '€' }),
  // Product-level: one value per estimate, shown in row 2 (SPEC section 7.4).
  output('BL', 'total-price', 'Total Unit Production Price (INR)', { number: STAGE_PRICING }, 'SUM(BG)', { systemRole: 'total', scope: 'product' }),
  numberInput('BM', 'tool-cost', 'Tool Cost', 8, 34, { systemRole: 'tool-cost' }),
  output('BN', 'price-per-tool-cost', 'Total Unit Production Price (INR) / Tool Cost (INR)', { number: STAGE_PRICING }, 'BL / SUM(BM)', { scope: 'product', numFmt: NUMBER_FORMAT.number }),
  // Entered at approval, so it has no formula.
  output('BO', 'approved-price', 'Approved Quote Price', { number: STAGE_PRICING }, undefined, { systemRole: 'approved-price', scope: 'product' }),
];

// ---- Build -------------------------------------------------------------------------------------------

function assertLettersMatchPositions(): void {
  FIELD_DRAFTS.forEach((draft, index) => {
    if (columnLetterToIndex(draft.letter) !== index + 1) {
      throw new Error(`Seed field "${draft.key}" is written as column ${draft.letter} but sits at position ${index + 1} (${indexToColumnLetter(index + 1)}).`);
    }
  });
}

function widthOf(draft: FieldDraft): number {
  if (draft.width !== undefined) return draft.width;
  if (draft.kind === 'output') return DEFAULT_WIDTH.output;
  switch (draft.dataType) {
    case 'number':
    case 'flag':
      return DEFAULT_WIDTH.number;
    case 'image':
      return DEFAULT_WIDTH.image;
    case 'select':
    case 'select_other':
      return DEFAULT_WIDTH.select;
    case 'text':
    case 'auto_lookup':
      return DEFAULT_WIDTH.text;
    default:
      return assertNever(draft);
  }
}

function numFmtOf(draft: FieldDraft): string {
  if (draft.numFmt !== undefined) return draft.numFmt;
  if (draft.kind === 'output') return NUMBER_FORMAT.money;
  switch (draft.dataType) {
    case 'number':
      return NUMBER_FORMAT.number;
    case 'flag':
      return NUMBER_FORMAT.flag;
    default:
      return NUMBER_FORMAT.text;
  }
}

/** How a draft's letters and numbers turn into IDs of the document being built. */
interface Ids {
  readonly field: (letter: string) => string;
  readonly section: (number: number) => string;
  readonly stage: (number: number) => string;
}

const ids: Ids = {
  field: (letter) => seedId(FIELD_ID_NAMESPACE, columnLetterToIndex(letter)),
  section: (number) => seedId(SECTION_ID_NAMESPACE, number),
  stage: (number) => seedId(STAGE_ID_NAMESPACE, number),
};

function sharedProperties(draft: FieldDraft, index: number) {
  return {
    id: ids.field(draft.letter),
    key: draft.key,
    label: draft.label,
    position: index + 1,
    width: widthOf(draft),
    numFmt: numFmtOf(draft),
    rowScope: draft.kind === 'output' && draft.scope === 'product' ? 'product' : 'row',
    systemRole: draft.systemRole ?? null,
    unit: draft.unit ?? null,
    hint: draft.hint ?? null,
    displayUnit: draft.displayUnit ?? null,
  };
}

function inputField(draft: InputDraft, index: number) {
  return {
    ...sharedProperties(draft, index),
    kind: draft.kind,
    dataType: draft.dataType,
    sectionId: ids.section(draft.section),
    stageId: draft.stage === undefined ? null : ids.stage(draft.stage.number),
    group: draft.stage?.group ?? null,
    formOrder: draft.formOrder,
    mandatory: draft.mandatory,
    // Every input is on the Engineer's form (ADR-008).
    engineerVisible: true,
    defaultValue: draft.defaultValue ?? null,
    visibleWhen:
      draft.hiddenWhen === undefined
        ? null
        : { fieldId: ids.field(draft.hiddenWhen.letter), operator: 'not-in', values: [...draft.hiddenWhen.values] },
    options: null,
  };
}

function autoField(draft: AutoDraft, index: number) {
  return {
    ...sharedProperties(draft, index),
    kind: draft.kind,
    dataType: draft.dataType,
    sectionId: ids.section(draft.section),
    stageId: null,
    group: null,
    formOrder: draft.formOrder,
    mandatory: false,
    engineerVisible: draft.engineerVisible,
  };
}

function outputField(draft: OutputDraft, index: number, context: ReferenceContext) {
  return {
    ...sharedProperties(draft, index),
    kind: draft.kind,
    dataType: 'number',
    sectionId: null,
    stageId: ids.stage(draft.stage.number),
    group: draft.stage.group ?? null,
    formOrder: null,
    mandatory: false,
    // Calculated values never reach an Engineer (ADR-008).
    engineerVisible: false,
    formula: draft.formula === undefined ? null : toInternalForm(draft.formula, context),
    hideWhenZero: draft.hideWhenZero === undefined ? null : ids.field(draft.hideWhenZero),
  };
}

function buildField(draft: FieldDraft, index: number, context: ReferenceContext) {
  switch (draft.kind) {
    case 'input':
      return inputField(draft, index);
    case 'auto':
      return autoField(draft, index);
    case 'output':
      return outputField(draft, index, context);
    default:
      return assertNever(draft);
  }
}

function buildDocument(): unknown {
  assertLettersMatchPositions();
  const context: ReferenceContext = { fieldIds: FIELD_DRAFTS.map((draft) => ids.field(draft.letter)), rates: SEED_PROCESS_ITEMS };
  return {
    sections: SECTION_DRAFTS.map((draft, index) => ({ id: ids.section(index + 1), number: index + 1, ...draft })),
    stages: STAGE_DRAFTS.map(({ totalLetters, ...draft }, index) => ({
      id: ids.stage(index + 1),
      number: index + 1,
      ...draft,
      subHeadings: [...draft.subHeadings],
      totalFieldIds: totalLetters.map(ids.field),
    })),
    fields: FIELD_DRAFTS.map((draft, index) => buildField(draft, index, context)),
  };
}

/** The validated document that becomes version 1. Loading this module throws if the seed is not valid. */
export const seedConfig: ConfigDocument = parseConfigDocument(buildDocument());
