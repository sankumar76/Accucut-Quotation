import { assertNever } from '../assert-never';
import type { InputFieldDefinition, OutputFieldDefinition } from '../fields/field-schema';
import { fieldLetter, referenceContext } from '../fields/registry';
import { ConfigDocumentError, parseConfigDocument, type ConfigDocument } from '../fields/schema';
import { toDisplayForm, type RateReference } from '../formula';
import { validateNumberInput, validateTextInput } from '../estimate/validation';

import { describeLetterChanges, orderAfterInsert, type LetterChanges, type NewColumnSummary, type Slot } from './field-insert-changes';
import { AFTER_REQUIRED_MESSAGE, DOCUMENT_REFUSED_MESSAGE } from './field-insert-words';
import { afterIssue, hideFieldIssues, inputIssues, outputIssues, MAX_FIELD_TEXT_LENGTH, type InsertIssue, type NewInput, type NewOutput } from './field-insert-check';
import { checkFormulaEdit } from './formula-edit';

/**
 * Inserting fields into the registry (STORY-08.03; FR-074, FR-075, FR-077; BR-035, BR-038; SPEC sections 8.1 and 8.3; ADR-004; architecture sections 4.5 and 6 "Insert preview" and "Insert field"). Pure: the current
 * document and the rate list go in, and the next document and the letter changes come out; nothing is stored, logged or read from a clock. **`insertFields` is the one function behind both the preview and the
 * save**, so the letters the Admin is shown are the letters stored (AC-3, AC-5).
 *
 * **Re-lettering is positions, nothing else** (BR-035): the new fields take their places in the list, every position is renumbered 1 to N in list order, and a letter is derived from it. No stored formula is
 * rewritten, because a formula holds `{{f:<id>}}` and every field keeps its ID. The product's cells (BL2, BN2, BO2) move with their columns because nothing finds them by letter.
 *
 * **Formula letters (decision D-1):** the formula of a new output is typed in the letters the worksheet will have **after** the insert, as in Excel where the column is inserted first. So the document with the
 * new fields in place is built first, and the typed text is read against it. That is what lets the pair's cost formula name the new input, which has no letter today.
 *
 * **Defaults (BR-038, AC-6):** a new input is mandatory, visible to the Engineer and drawn in its section after the section's last field (the next free `formOrder`); a new output is hidden from every Engineer
 * and is added to no stage total and no other formula, so it joins a total only when that total's formula is edited.
 */

export type { InsertIssue, NewInput, NewOutput } from './field-insert-check';
export type { LetterChanges } from './field-insert-changes';

/** The cost column of the pair: an output, and where it goes. */
export interface NewCostColumn extends NewOutput {
  /** The column it goes after: `null` (the default) is right after the new input. */
  readonly afterFieldId: string | null;
  /** "Hide the line when this input is 0" (default on): the cost view leaves the line out while the new input is 0 (`hideWhenZero`). */
  readonly hideWhenInputIsZero: boolean;
}

/** A single new output: it may name an existing input that hides its line while it is 0 (the treatment flags do this in the seed). */
export interface NewSingleOutput extends NewOutput {
  readonly hideWhenZeroFieldId: string | null;
}

export type InsertSpec =
  | { readonly kind: 'input'; readonly afterFieldId: string; readonly input: NewInput }
  | { readonly kind: 'output'; readonly afterFieldId: string; readonly output: NewSingleOutput }
  | { readonly kind: 'pair'; readonly afterFieldId: string; readonly input: NewInput; readonly cost: NewCostColumn };

/** A new output has this formula until the typed one is read against the document that holds the new fields: `0` is valid in every document and reads nothing. */
const PLACEHOLDER_FORMULA = '0';

const MAX_KEY_LENGTH = 60;
/** Leaves room for a `-12` suffix under the key's length limit. */
const MAX_KEY_BASE_LENGTH = 50;
const FALLBACK_KEY = 'field';

/** The IDs the new fields get. `crypto.randomUUID` in production; a test passes its own so a run is repeatable. */
export type NewIdSource = () => string;

const randomId: NewIdSource = () => crypto.randomUUID();

export interface InsertedField {
  readonly id: string;
  readonly kind: 'input' | 'output';
}

/** A new output's formula as the Admin reads it, with the letters of the finished worksheet. */
export interface NewFormulaView {
  readonly letter: string;
  readonly label: string;
  readonly formula: string;
}

export type InsertResult =
  | { readonly ok: false; readonly issues: ReadonlyArray<InsertIssue> }
  | {
      readonly ok: true;
      /** The next document, already through the registry's own schema and rules (`parseConfigDocument`, the last gate). */
      readonly document: ConfigDocument;
      readonly inserted: ReadonlyArray<InsertedField>;
      readonly changes: LetterChanges;
      readonly formulas: ReadonlyArray<NewFormulaView>;
    };

export interface InsertRequest {
  readonly document: ConfigDocument;
  readonly rates: ReadonlyArray<RateReference>;
  readonly spec: InsertSpec;
  readonly newId?: NewIdSource | undefined;
}

/** A lower-case, hyphen-joined key from a label, made unique in the document by a numeric suffix (`cutting-cost`, `cutting-cost-2`). A label with no letter or digit in it gets `field`. */
export function keyFor(label: string, taken: ReadonlySet<string>): string {
  const words = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const startsWell = /^[a-z]/.test(words);
  const base = (startsWell ? words : words === '' ? FALLBACK_KEY : `${FALLBACK_KEY}-${words}`).slice(0, MAX_KEY_BASE_LENGTH).replace(/-+$/g, '');
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${String(suffix)}`.slice(0, MAX_KEY_LENGTH);
    if (!taken.has(candidate)) return candidate;
  }
}

/** The text the Admin typed, trimmed, or `null` for blank. The same rule as every other typed text (`validateTextInput`). */
function typedOrNull(value: string): string | null {
  const checked = validateTextInput(value, { multiline: false, maxLength: MAX_FIELD_TEXT_LENGTH });
  return checked.ok ? checked.value : null;
}

function defaultOf(input: NewInput): string | null {
  const checked = input.dataType === 'number' ? validateNumberInput(input.defaultValue) : validateTextInput(input.defaultValue, { multiline: false, maxLength: MAX_FIELD_TEXT_LENGTH });
  return checked.ok ? checked.value : null;
}

function nextFormOrder(document: ConfigDocument): number {
  return document.fields.reduce((highest, field) => Math.max(highest, field.formOrder ?? 0), 0) + 1;
}

function newInputField(document: ConfigDocument, input: NewInput, id: string, key: string): InputFieldDefinition {
  return {
    id,
    key,
    label: input.label.trim(),
    position: 1,
    sectionId: input.sectionId,
    width: input.width,
    numFmt: input.numFmt,
    rowScope: 'row',
    systemRole: null,
    unit: typedOrNull(input.unit),
    hint: typedOrNull(input.hint),
    displayUnit: null,
    stageId: null,
    group: null,
    formOrder: nextFormOrder(document),
    mandatory: true,
    engineerVisible: true,
    kind: 'input',
    dataType: input.dataType,
    defaultValue: defaultOf(input),
    visibleWhen: input.watchFieldId === null ? null : { fieldId: input.watchFieldId, operator: 'not-in', values: [''] },
    options: null,
  };
}

function newOutputField(output: NewOutput, id: string, key: string, hideWhenZero: string | null): OutputFieldDefinition {
  return {
    id,
    key,
    label: output.label.trim(),
    position: 1,
    sectionId: null,
    width: output.width,
    numFmt: output.numFmt,
    rowScope: 'row',
    systemRole: null,
    unit: null,
    hint: null,
    displayUnit: null,
    stageId: output.stageId,
    group: output.group,
    formOrder: null,
    mandatory: false,
    engineerVisible: false,
    kind: 'output',
    dataType: 'number',
    formula: PLACEHOLDER_FORMULA,
    hideWhenZero,
  };
}

/** The slots of a spec, for the IDs given. The pair's cost column is right after its input unless it names another column; naming the input's own column means the same as the default. */
export function slotsOf(spec: InsertSpec, firstId: string, secondId: string): Slot[] {
  if (spec.kind !== 'pair') return [{ id: firstId, afterId: spec.afterFieldId }];
  const costAfter = spec.cost.afterFieldId === null || spec.cost.afterFieldId === spec.afterFieldId ? firstId : spec.cost.afterFieldId;
  return [
    { id: firstId, afterId: spec.afterFieldId },
    { id: secondId, afterId: costAfter },
  ];
}

function positionIssues(document: ConfigDocument, spec: InsertSpec): InsertIssue[] {
  return [...afterIssue(document, 'afterFieldId', spec.afterFieldId), ...(spec.kind === 'pair' ? afterIssue(document, 'cost.afterFieldId', spec.cost.afterFieldId) : [])];
}

function detailIssues(document: ConfigDocument, spec: InsertSpec): InsertIssue[] {
  switch (spec.kind) {
    case 'input':
      return inputIssues(document, spec.input);
    case 'output':
      return [...outputIssues(document, 'output', spec.output), ...hideFieldIssues(document, spec.output.hideWhenZeroFieldId)];
    case 'pair':
      return [...inputIssues(document, spec.input), ...outputIssues(document, 'cost', spec.cost)];
    default:
      return assertNever(spec, 'insert spec');
  }
}

function summariesOf(spec: InsertSpec, ids: ReadonlyArray<string>): NewColumnSummary[] {
  const [first = '', second = ''] = ids;
  switch (spec.kind) {
    case 'input':
      return [{ id: first, label: spec.input.label.trim(), kind: 'input' }];
    case 'output':
      return [{ id: first, label: spec.output.label.trim(), kind: 'output' }];
    case 'pair':
      return [
        { id: first, label: spec.input.label.trim(), kind: 'input' },
        { id: second, label: spec.cost.label.trim(), kind: 'output' },
      ];
    default:
      return assertNever(spec, 'insert spec');
  }
}

/** The letters a placed spec would change, for the live list of step 2 and the preview. Looks at positions only, so a half-typed formula or label does not stop it. `null` when the spec names no column. */
export function previewLetters(document: ConfigDocument, spec: InsertSpec): LetterChanges | null {
  const ids = ['new-input', 'new-output'];
  const after = orderAfterInsert(
    document.fields.map((field) => field.id),
    slotsOf(spec, ids[0] ?? '', ids[1] ?? ''),
  );
  if (after === null) return null;
  const summaries = summariesOf(spec, ids).map((summary) => ({ ...summary, label: summary.label === '' ? 'New field' : summary.label }));
  return describeLetterChanges(document, after, summaries);
}

function renumbered(document: ConfigDocument, order: ReadonlyArray<string>, added: ReadonlyArray<InputFieldDefinition | OutputFieldDefinition>): ConfigDocument {
  const byId = new Map([...document.fields, ...added].map((field) => [field.id, field]));
  const fields = order.flatMap((id, index) => {
    const field = byId.get(id);
    return field === undefined ? [] : [{ ...field, position: index + 1 }];
  });
  return { ...document, fields };
}

/** Builds the new fields of a spec in the order of its slots. The IDs and keys are chosen here. */
function buildFields(document: ConfigDocument, spec: InsertSpec, ids: ReadonlyArray<string>): Array<InputFieldDefinition | OutputFieldDefinition> {
  const [firstId = '', secondId = ''] = ids;
  const taken = new Set(document.fields.map((field) => field.key));
  switch (spec.kind) {
    case 'input':
      return [newInputField(document, spec.input, firstId, keyFor(spec.input.label, taken))];
    case 'output':
      return [newOutputField(spec.output, firstId, keyFor(spec.output.label, taken), spec.output.hideWhenZeroFieldId)];
    case 'pair': {
      const input = newInputField(document, spec.input, firstId, keyFor(spec.input.label, taken));
      taken.add(input.key);
      return [input, newOutputField(spec.cost, secondId, keyFor(spec.cost.label, taken), spec.cost.hideWhenInputIsZero ? firstId : null)];
    }
    default:
      return assertNever(spec, 'insert spec');
  }
}

function formulaOf(spec: InsertSpec): string | null {
  switch (spec.kind) {
    case 'input':
      return null;
    case 'output':
      return spec.output.formula;
    case 'pair':
      return spec.cost.formula;
    default:
      return assertNever(spec, 'insert spec');
  }
}

type Checked = { readonly ok: true; readonly document: ConfigDocument } | { readonly ok: false; readonly issues: ReadonlyArray<InsertIssue> };

/** The typed formula, read against the document that holds the new fields (decision D-1), and then the registry's own last gate. */
function readTypedFormula(draft: ConfigDocument, rates: ReadonlyArray<RateReference>, spec: InsertSpec, added: ReadonlyArray<InputFieldDefinition | OutputFieldDefinition>): Checked {
  let document = draft;
  const formula = formulaOf(spec);
  const outputId = added.find((field) => field.kind === 'output')?.id;
  if (formula !== null && outputId !== undefined) {
    const checked = checkFormulaEdit({ document, rates, fieldId: outputId, text: formula });
    if (!checked.ok) return { ok: false, issues: [{ field: spec.kind === 'pair' ? 'cost.formula' : 'output.formula', message: checked.message }] };
    document = checked.edited;
  }
  try {
    return { ok: true, document: parseConfigDocument(document) };
  } catch (error) {
    // The registry's own rules refuse the result: a rule of the schema or of the document, never a value the Admin typed that the checks missed. The words hold no value (AC-7).
    if (error instanceof ConfigDocumentError) return { ok: false, issues: [{ field: 'document', message: DOCUMENT_REFUSED_MESSAGE }] };
    throw error;
  }
}

/** The new outputs' formulas as the Admin reads them, with the letters of the finished worksheet (step 3). */
function newFormulasOf(document: ConfigDocument, rates: ReadonlyArray<RateReference>, addedIds: ReadonlySet<string>): NewFormulaView[] {
  const context = referenceContext(document, rates);
  return document.fields.flatMap((field): NewFormulaView[] =>
    field.kind === 'output' && field.formula !== null && addedIds.has(field.id) ? [{ letter: fieldLetter(field), label: field.label, formula: toDisplayForm(field.formula, context) }] : [],
  );
}

/**
 * Inserts the field or the pair the spec describes. Every problem with what was typed comes back at once as `issues` (a client that skips the checks gets them here); the formula is read by the same check as the
 * formula editor (`checkFormulaEdit`, SCR-18's words), over the document with the new fields in place, so a single output that names its own new letter is a loop and the pair's cost formula that names the new
 * input is not (AC-7, decision D-1).
 */
export function insertFields({ document, rates, spec, newId = randomId }: InsertRequest): InsertResult {
  const issues = [...positionIssues(document, spec), ...detailIssues(document, spec)];
  const ids = spec.kind === 'pair' ? [newId(), newId()] : [newId()];
  const order = orderAfterInsert(
    document.fields.map((field) => field.id),
    slotsOf(spec, ids[0] ?? '', ids[1] ?? ''),
  );
  if (order === null || issues.length > 0) return { ok: false, issues: issues.length > 0 ? issues : [{ field: 'afterFieldId', message: AFTER_REQUIRED_MESSAGE }] };

  const added = buildFields(document, spec, ids);
  const checked = readTypedFormula(renumbered(document, order, added), rates, spec, added);
  if (!checked.ok) return checked;
  const changes = describeLetterChanges(document, order, summariesOf(spec, ids));
  const formulas = newFormulasOf(checked.document, rates, new Set(ids));
  return { ok: true, document: checked.document, inserted: added.map(({ id, kind }) => ({ id, kind })), changes, formulas };
}

/** The preview: the letters and formulas of `insertFields`, without the document. The same call as the save, so the two cannot differ (AC-3). */
export function previewInsert(request: InsertRequest): { readonly ok: false; readonly issues: ReadonlyArray<InsertIssue> } | { readonly ok: true; readonly changes: LetterChanges; readonly formulas: ReadonlyArray<NewFormulaView> } {
  const result = insertFields(request);
  return result.ok ? { ok: true, changes: result.changes, formulas: result.formulas } : result;
}
