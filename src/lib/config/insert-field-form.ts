import type { InsertColumnOption, InsertOptions, InsertPreviewView, MovedView } from './insert-field-client';

/**
 * What the insert wizard (SCR-19, STORY-08.03) holds while the Admin types, and how it becomes the body of the preview and the save. Nothing here decides anything: whether a label is empty, a column exists or
 * a formula is valid is the server's (`src/lib/config/field-insert.ts` runs again on every call). This file only keeps the typed text, builds the request from it, and lays the server's answers out for the
 * screen. It has no zod and imports no server code (NFR-009: it is part of the wizard's lazy chunk).
 */

export type InsertKind = 'input' | 'output' | 'pair';
export type CostPosition = 'after-input' | 'other';
export type VisibilityChoice = 'always' | 'when';
export type ValueType = 'number' | 'text';

export interface InputDetails {
  readonly label: string;
  readonly dataType: ValueType;
  readonly defaultValue: string;
  readonly sectionId: string;
  readonly unit: string;
  readonly hint: string;
  /** Typed text: a number is read from it when the request is built. */
  readonly width: string;
  readonly numFmt: string;
  readonly visibility: VisibilityChoice;
  readonly watchFieldId: string;
}

export interface OutputDetails {
  readonly label: string;
  readonly formula: string;
  readonly stageId: string;
  /** `''` is "no sub-heading". */
  readonly group: string;
  readonly width: string;
  readonly numFmt: string;
}

export interface SingleOutputDetails extends OutputDetails {
  /** `''` is "never hide". */
  readonly hideWhenZeroFieldId: string;
}

export interface CostDetails extends OutputDetails {
  readonly position: CostPosition;
  readonly afterFieldId: string;
  readonly hideWhenInputIsZero: boolean;
}

export interface InsertForm {
  readonly kind: InsertKind;
  /** The column the new field goes after; `''` until one is chosen. */
  readonly afterFieldId: string;
  readonly input: InputDetails;
  readonly output: SingleOutputDetails;
  readonly cost: CostDetails;
}

/** The request body of the preview and the save: the shape `insertSpecSchema` reads. */
export type SpecBody =
  | { readonly kind: 'input'; readonly afterFieldId: string; readonly input: InputBody }
  | { readonly kind: 'output'; readonly afterFieldId: string; readonly output: OutputBody & { readonly hideWhenZeroFieldId: string | null } }
  | {
      readonly kind: 'pair';
      readonly afterFieldId: string;
      readonly input: InputBody;
      readonly cost: OutputBody & { readonly afterFieldId: string | null; readonly hideWhenInputIsZero: boolean };
    };

interface InputBody {
  readonly label: string;
  readonly dataType: ValueType;
  readonly defaultValue: string;
  readonly sectionId: string;
  readonly unit: string;
  readonly hint: string;
  readonly width: number;
  readonly numFmt: string;
  readonly watchFieldId: string | null;
}

interface OutputBody {
  readonly label: string;
  readonly formula: string;
  readonly stageId: string;
  readonly group: string | null;
  readonly width: number;
  readonly numFmt: string;
}

const DEFAULT_INPUT_WIDTH = '12';
const DEFAULT_OUTPUT_WIDTH = '14';
const NUMBER_FORMAT = '0.00';
const TEXT_FORMAT = '@';
const MONEY_FORMAT = '#,##0.00';

function pickFormat(options: InsertOptions, wanted: string): string {
  return options.numberFormats.includes(wanted) ? wanted : (options.numberFormats[0] ?? wanted);
}

/** The form as it opens: an input, the column pre-chosen from `?after=` when the worksheet has it, and every control at its default. A new pair's cost line is hidden when the input is 0 (AC-2). */
export function initialForm(options: InsertOptions, afterId: string | null): InsertForm {
  const known = afterId !== null && options.columns.some((column) => column.id === afterId);
  return {
    kind: 'input',
    afterFieldId: known ? afterId : '',
    input: { label: '', dataType: 'number', defaultValue: '', sectionId: '', unit: '', hint: '', width: DEFAULT_INPUT_WIDTH, numFmt: pickFormat(options, NUMBER_FORMAT), visibility: 'always', watchFieldId: '' },
    output: { label: '', formula: '', stageId: '', group: '', width: DEFAULT_OUTPUT_WIDTH, numFmt: pickFormat(options, MONEY_FORMAT), hideWhenZeroFieldId: '' },
    cost: { label: '', formula: '', stageId: '', group: '', width: DEFAULT_OUTPUT_WIDTH, numFmt: pickFormat(options, MONEY_FORMAT), position: 'after-input', afterFieldId: '', hideWhenInputIsZero: true },
  };
}

/** The format a type of value starts with when it is chosen: text is drawn as text, a number as a number (the Admin can still change it). */
export function formatFor(options: InsertOptions, dataType: ValueType): string {
  return pickFormat(options, dataType === 'text' ? TEXT_FORMAT : NUMBER_FORMAT);
}

/** How many fields the insert makes: the button says "Insert 2 fields" for a pair. */
export function insertCount(kind: InsertKind): number {
  return kind === 'pair' ? 2 : 1;
}

/** The typed width as a number. Text that is not a number goes as `0`, which the server refuses in its own words ("Enter a width from 1 to 255."), so the browser repeats no rule. */
export function parseWidth(text: string): number {
  const typed = text.trim();
  if (!/^\d+(\.\d+)?$/.test(typed)) return 0;
  return Number(typed);
}

const orNull = (text: string): string | null => (text === '' ? null : text);

function inputBody(input: InputDetails): InputBody {
  return {
    label: input.label,
    dataType: input.dataType,
    defaultValue: input.defaultValue,
    sectionId: input.sectionId,
    unit: input.unit,
    hint: input.hint,
    width: parseWidth(input.width),
    numFmt: input.numFmt,
    // "Only when another field has a value" with no field chosen goes as an empty ID, which the server answers with "Choose the field to watch."
    watchFieldId: input.visibility === 'when' ? input.watchFieldId : null,
  };
}

function outputBody(output: OutputDetails): OutputBody {
  return { label: output.label, formula: output.formula, stageId: output.stageId, group: orNull(output.group), width: parseWidth(output.width), numFmt: output.numFmt };
}

/** The request for the form as it stands. The same body serves the live list of step 2 (`lettersOnly`), the preview and the save. */
export function buildSpec(form: InsertForm): SpecBody {
  switch (form.kind) {
    case 'input':
      return { kind: 'input', afterFieldId: form.afterFieldId, input: inputBody(form.input) };
    case 'output':
      return { kind: 'output', afterFieldId: form.afterFieldId, output: { ...outputBody(form.output), hideWhenZeroFieldId: orNull(form.output.hideWhenZeroFieldId) } };
    case 'pair':
      return {
        kind: 'pair',
        afterFieldId: form.afterFieldId,
        input: inputBody(form.input),
        cost: { ...outputBody(form.cost), afterFieldId: form.cost.position === 'after-input' ? null : form.cost.afterFieldId, hideWhenInputIsZero: form.cost.hideWhenInputIsZero },
      };
  }
}

/** The part of the form that decides where the new fields go: when it is the same, the letters are the same, so the live list asks again only when this changes. */
export function placeKey(form: InsertForm): string {
  return JSON.stringify([form.kind, form.afterFieldId, form.kind === 'pair' ? [form.cost.position, form.cost.afterFieldId] : null]);
}

/** The id of the control for a server field name (`input.label` is `insert-input-label`), so an error links to the control it is about. */
export function controlId(field: string): string {
  return `insert-${field.replace('.', '-')}`;
}

/** The controls of step 2 in the order they are drawn, for each kind: the summary lists a refusal in this order and focus goes to the first. */
const INPUT_ORDER = ['input.label', 'input.dataType', 'input.defaultValue', 'afterFieldId', 'input.sectionId', 'input.unit', 'input.hint', 'input.width', 'input.numFmt', 'input.watchFieldId'] as const;
const OUTPUT_ORDER = ['output.label', 'afterFieldId', 'output.stageId', 'output.group', 'output.hideWhenZeroFieldId', 'output.width', 'output.numFmt', 'output.formula'] as const;
const COST_ORDER = ['cost.label', 'cost.afterFieldId', 'cost.stageId', 'cost.group', 'cost.width', 'cost.numFmt', 'cost.formula'] as const;

export function fieldOrder(kind: InsertKind): ReadonlyArray<string> {
  switch (kind) {
    case 'input':
      return INPUT_ORDER;
    case 'output':
      return OUTPUT_ORDER;
    case 'pair':
      return [...INPUT_ORDER, ...COST_ORDER];
  }
}

export interface IssueItem {
  readonly field: string;
  readonly fieldId: string;
  readonly message: string;
}

/** The refused controls in the order of the form. A message for a name that has no control (`document`) is not here: the screen shows it as a notice of its own. */
export function issueItems(kind: InsertKind, errors: Readonly<Record<string, string>>): ReadonlyArray<IssueItem> {
  return fieldOrder(kind).flatMap((field) => {
    const message = errors[field];
    return message === undefined ? [] : [{ field, fieldId: controlId(field), message }];
  });
}

/** The messages the form's own controls do not carry: the server's sentence for the registry as a whole. */
export function strayMessages(kind: InsertKind, errors: Readonly<Record<string, string>>): ReadonlyArray<string> {
  const known = new Set(fieldOrder(kind));
  return Object.entries(errors).flatMap(([field, message]) => (known.has(field) ? [] : [message]));
}

/** A column as a choice in a select: `AX Soft Anodize Cost`. */
export function columnChoice(column: InsertColumnOption): string {
  return `${column.letter} ${column.label}`;
}

export interface LetterRow {
  readonly key: string;
  readonly was: string | null;
  readonly becomes: string;
  readonly label: string;
  /** The product's cell that moves with this column (`BL2 to BN2`), when it has one. */
  readonly cell: { readonly from: string; readonly to: string } | null;
  readonly isNew: boolean;
  /** What a new field is (input or output); `null` for a column that only moves. */
  readonly kind: 'input' | 'output' | null;
}

const CELL_ROW = /^\d+$/;

/** The product's cell of a moved column: the same label, and the column's old letter followed by a row number (`BL` and `BL2`). */
function cellOf(moved: MovedView, cells: ReadonlyArray<MovedView>): MovedView | undefined {
  return cells.find((cell) => cell.label === moved.label && cell.from.startsWith(moved.from) && CELL_ROW.test(cell.from.slice(moved.from.length)));
}

/** The rows of the letters table: the new fields first, then every column whose letter changes, each with its product cell. A cell with no column of its own (it never happens with the registry as seeded) gets a row so it is not lost. */
export function letterRows(preview: Pick<InsertPreviewView, 'inserted' | 'moved' | 'productCells'>): ReadonlyArray<LetterRow> {
  const added = preview.inserted.map((field): LetterRow => ({ key: `new-${field.letter}`, was: null, becomes: field.letter, label: field.label, cell: null, isNew: true, kind: field.kind }));
  const used = new Set<MovedView>();
  const moved = preview.moved.map((column): LetterRow => {
    const cell = cellOf(column, preview.productCells);
    if (cell !== undefined) used.add(cell);
    return { key: `moved-${column.from}`, was: column.from, becomes: column.to, label: column.label, cell: cell === undefined ? null : { from: cell.from, to: cell.to }, isNew: false, kind: null };
  });
  const alone = preview.productCells.filter((cell) => !used.has(cell)).map((cell): LetterRow => ({ key: `cell-${cell.from}`, was: cell.from, becomes: cell.to, label: cell.label, cell: null, isNew: false, kind: null }));
  return [...added, ...moved, ...alone];
}

/** The new fields as the lead line of step 3 names them: `AY Rework allowance`. */
export function newFieldNames(preview: Pick<InsertPreviewView, 'inserted'>): ReadonlyArray<string> {
  return preview.inserted.map((field) => `${field.letter} ${field.label}`);
}
