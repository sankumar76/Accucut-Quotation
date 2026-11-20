import { FORM_SECTION_NUMBERS } from '../estimate/form-fields';
import { NUMBER_RULE_MESSAGE, validateNumberInput, validateTextInput } from '../estimate/validation';
import { MAX_EXCEL_WIDTH } from '../fields/field-schema';
import type { ConfigDocument } from '../fields/schema';

import {
  AFTER_REQUIRED_MESSAGE,
  FORMAT_MESSAGE,
  FORMULA_REQUIRED_MESSAGE,
  GROUP_UNKNOWN_MESSAGE,
  HIDE_FIELD_MESSAGE,
  HIDE_PAIR_MESSAGE,
  LABEL_REQUIRED_MESSAGE,
  SECTION_REQUIRED_MESSAGE,
  STAGE_REQUIRED_MESSAGE,
  VALUE_TYPE_MESSAGE,
  WATCH_FIELD_MESSAGE,
  WIDTH_MESSAGE,
} from './field-insert-words';

/**
 * The rules for what the Admin types in SCR-19 (STORY-08.03 AC-2, AC-7), as pure checks over the current document. Each returns the problems it finds, each under the name of the control it belongs to
 * (`input.label`, `cost.formula`), so a form can show every one at once and link the summary to the controls. The server runs these again whatever the browser did (a bypass still gets a 422), and the
 * registry's own schema is the last gate after them (`parseConfigDocument`).
 */

/** The value types an insert offers (decision D-2: the Engineer's form draws only these two). */
export const INSERTABLE_DATA_TYPES = ['number', 'text'] as const;
export type InsertableDataType = (typeof INSERTABLE_DATA_TYPES)[number];

/** The smallest Excel column width (AC-2: "widths are 1 to 255"). */
export const MIN_COLUMN_WIDTH = 1;
export { MAX_EXCEL_WIDTH as MAX_COLUMN_WIDTH };

/** The longest label, unit and hint: the registry schema's own limit. */
export const MAX_FIELD_TEXT_LENGTH = 200;

/** What the Admin gives for the new input. Blank text means "none". */
export interface NewInput {
  readonly label: string;
  readonly dataType: InsertableDataType;
  readonly defaultValue: string;
  readonly sectionId: string;
  readonly unit: string;
  readonly hint: string;
  readonly width: number;
  readonly numFmt: string;
  /** The field this one waits for ("Only when another field has a value"), or `null` for "Always". */
  readonly watchFieldId: string | null;
}

/** What the Admin gives for a new output, or for the cost column of the pair. */
export interface NewOutput {
  readonly label: string;
  /** In the letters the worksheet will have after the insert (decision D-1). */
  readonly formula: string;
  readonly stageId: string;
  readonly group: string | null;
  readonly width: number;
  readonly numFmt: string;
}

export interface InsertIssue {
  readonly field: string;
  readonly message: string;
}

/** The number formats the registry already uses, in the order they are first met. An insert offers these and no other (AC-2). */
export function numberFormatsOf(document: ConfigDocument): string[] {
  return [...new Set(document.fields.map((field) => field.numFmt))];
}

/** The sections an input may go in: the ones the Engineer's form draws (decision D-2). */
export function insertableSections(document: ConfigDocument) {
  return document.sections.filter((section) => FORM_SECTION_NUMBERS.includes(section.number)).sort((a, b) => a.number - b.number);
}

/** The fields an input or a line may wait on or be hidden by: inputs the Engineer fills (not a picture, which has no value to read). */
export function isWatchable(field: ConfigDocument['fields'][number]): boolean {
  return field.kind === 'input' && field.dataType !== 'image';
}

function labelIssue(path: string, label: string): InsertIssue[] {
  const checked = validateTextInput(label, { multiline: false, maxLength: MAX_FIELD_TEXT_LENGTH });
  if (checked.ok) return checked.value === null ? [{ field: `${path}.label`, message: LABEL_REQUIRED_MESSAGE }] : [];
  return [{ field: `${path}.label`, message: checked.message }];
}

function optionalTextIssue(path: string, name: string, value: string): InsertIssue[] {
  const checked = validateTextInput(value, { multiline: false, maxLength: MAX_FIELD_TEXT_LENGTH });
  return checked.ok ? [] : [{ field: `${path}.${name}`, message: checked.message }];
}

function presentationIssues(document: ConfigDocument, path: string, presentation: { readonly width: number; readonly numFmt: string }): InsertIssue[] {
  const issues: InsertIssue[] = [];
  if (!Number.isFinite(presentation.width) || presentation.width < MIN_COLUMN_WIDTH || presentation.width > MAX_EXCEL_WIDTH) issues.push({ field: `${path}.width`, message: WIDTH_MESSAGE });
  if (!numberFormatsOf(document).includes(presentation.numFmt)) issues.push({ field: `${path}.numFmt`, message: FORMAT_MESSAGE });
  return issues;
}

function defaultIssue(input: NewInput): InsertIssue[] {
  if (input.dataType === 'number') {
    const checked = validateNumberInput(input.defaultValue);
    return checked.ok ? [] : [{ field: 'input.defaultValue', message: checked.message || NUMBER_RULE_MESSAGE }];
  }
  return optionalTextIssue('input', 'defaultValue', input.defaultValue);
}

/** Every problem of the new input's details. */
export function inputIssues(document: ConfigDocument, input: NewInput): InsertIssue[] {
  const issues = [...labelIssue('input', input.label)];
  if (!INSERTABLE_DATA_TYPES.includes(input.dataType)) issues.push({ field: 'input.dataType', message: VALUE_TYPE_MESSAGE });
  issues.push(...defaultIssue(input));
  if (!insertableSections(document).some((section) => section.id === input.sectionId)) issues.push({ field: 'input.sectionId', message: SECTION_REQUIRED_MESSAGE });
  issues.push(...optionalTextIssue('input', 'unit', input.unit), ...optionalTextIssue('input', 'hint', input.hint));
  issues.push(...presentationIssues(document, 'input', input));
  if (input.watchFieldId !== null && !document.fields.some((field) => field.id === input.watchFieldId && isWatchable(field))) issues.push({ field: 'input.watchFieldId', message: WATCH_FIELD_MESSAGE });
  return issues;
}

/** Every problem of an output's details except its formula, which is read by the formula check. `path` is `output` or `cost`. */
export function outputIssues(document: ConfigDocument, path: 'output' | 'cost', output: NewOutput): InsertIssue[] {
  const issues = [...labelIssue(path, output.label)];
  if (output.formula.trim() === '') issues.push({ field: `${path}.formula`, message: FORMULA_REQUIRED_MESSAGE });
  const stage = document.stages.find((candidate) => candidate.id === output.stageId);
  if (stage === undefined) issues.push({ field: `${path}.stageId`, message: STAGE_REQUIRED_MESSAGE });
  else if (output.group !== null && !stage.subHeadings.includes(output.group)) issues.push({ field: `${path}.group`, message: GROUP_UNKNOWN_MESSAGE });
  issues.push(...presentationIssues(document, path, output));
  return issues;
}

/**
 * An input whose value a line can be hidden by (`hideWhenZero`): one that holds a number, a Number or a flag. The cost view reads the value as a decimal and takes anything else as 0, so a line hidden by a text or a
 * choice would be hidden on every estimate for good (review SQR-01). The seed uses the rule with its numeric flags only.
 */
export function canHideWhenZero(field: ConfigDocument['fields'][number]): boolean {
  return field.kind === 'input' && (field.dataType === 'number' || field.dataType === 'flag');
}

/** The "hide the line when this field is 0" choice of a single output must name an input of the registry that holds a number. */
export function hideFieldIssues(document: ConfigDocument, hideWhenZeroFieldId: string | null): InsertIssue[] {
  if (hideWhenZeroFieldId === null) return [];
  return document.fields.some((field) => field.id === hideWhenZeroFieldId && canHideWhenZero(field)) ? [] : [{ field: 'output.hideWhenZeroFieldId', message: HIDE_FIELD_MESSAGE }];
}

/** A pair hides its cost line on its new input, so the new input must be a Number (the checkbox is on by default and is turned off for Text on the screen). */
export function pairHideIssues(input: NewInput, hideWhenInputIsZero: boolean): InsertIssue[] {
  return hideWhenInputIsZero && input.dataType !== 'number' ? [{ field: 'cost.hideWhenInputIsZero', message: HIDE_PAIR_MESSAGE }] : [];
}

/** A column named as "insert after" must be in the current version. */
export function afterIssue(document: ConfigDocument, field: string, afterFieldId: string | null): InsertIssue[] {
  if (afterFieldId === null) return [];
  return document.fields.some((candidate) => candidate.id === afterFieldId) ? [] : [{ field, message: AFTER_REQUIRED_MESSAGE }];
}
