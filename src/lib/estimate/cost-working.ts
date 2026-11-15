import 'server-only';

import { Decimal, type Value } from '../decimal';
import { fieldLetter, findFieldById, findFieldByKey, referenceContext } from '../fields/registry';
import type { FieldDefinition, StageDefinition } from '../fields/field-schema';
import type { ConfigDocument } from '../fields/schema';
import { MATERIAL_IN_DRAWING_KEY, MATERIAL_RATE_KEY, type MaterialOperandKey } from '../fields/types';
import {
  createRateLookup,
  evaluateWithWorking,
  extractReferences,
  isPercentRate,
  toDisplayForm,
  toWorkingForm,
  type CompiledPlan,
  type FormulaReference,
  type Resolver,
} from '../formula';
import { isNotApplicableName } from '../masters/system-entries';
import { NO_FIGURE, toTwoPlaces } from '../money';

import { typedFieldValue } from './row-calculator';

/**
 * The working of one row (STORY-06.03; FR-058, FR-059, FR-060, FR-026; SPEC sections 7.4 and 14 items 1 and 5; architecture sections 4.9 and 6 "Cost details"): every calculated field of a stored row in the six
 * stages, each with its formula in letters, the same formula with the values it was worked out from, and its value, so a Lead can repeat the arithmetic by hand.
 *
 * **Restricted** (ADR-008, NFR-002): this module holds formulas, rates and calculated costs, so nothing an Engineer's code path can reach may import it (`eslint.config.mjs`, `server-only`).
 *
 * **It never recomputes with today's masters.** Everything is read from the calculation record: the row's stored `inputs` and `outputs`, the master snapshot the calculation used, and the
 * configuration version it was made with (its fields, formulas and stages). Each formula is evaluated again from those stored operands, and the answer **must equal the stored output**; if it
 * does not, the record cannot be explained and this throws (a fault in the data, a 500 with fixed words), instead of printing a working that does not reproduce the figure beside it.
 *
 * **What the working prints (UX SCR-07, UX-01):** inputs and rates as typed (a percent rate as its percentage, 11%), calculated values to 4 decimals, so the arithmetic repeated by hand gives
 * the printed figure. A division by zero is the dash. Pure: it reads nothing and writes nothing.
 */

/** A row's stored values by field ID, as the record keeps them: full-precision decimal text, words, or `null` for no figure. */
export type StoredFigures = Readonly<Record<string, string | null>>;

/** What the calculation record's master snapshot holds that a working needs (the shape of `MasterSnapshot`, without its customer). */
export interface WorkingSnapshot {
  readonly rates: ReadonlyArray<{ readonly id: string; readonly name: string; readonly value: string }>;
  readonly materials: ReadonlyArray<{ readonly materialInDrawing: string; readonly pricePerKg: string; readonly specificGravity: string; readonly scrapRate: string }>;
  readonly exchangeRates: { readonly usd: string | null; readonly eur: string | null };
}

export interface CostWorkingInput {
  /** The configuration version the calculation was made with. */
  readonly document: ConfigDocument;
  /** The compiled plan of that same version. */
  readonly plan: CompiledPlan;
  /** The row's stored inputs: the typed numbers and flags as typed, and the words of E and F as they were then. */
  readonly inputs: StoredFigures;
  /** The row's stored outputs, M to BK. */
  readonly outputs: StoredFigures;
  readonly snapshot: WorkingSnapshot;
}

export type WorkingLineKind = 'calculated' | 'typed' | 'lookup';

/** One line of a stage. */
export interface WorkingLine {
  readonly letter: string;
  readonly name: string;
  readonly kind: WorkingLineKind;
  /** The sub-heading of the stage this line is under, or `null`. */
  readonly group: string | null;
  /** The unit the value is shown with (kg, sq in, $), or `null`. */
  readonly unit: string | null;
  /** The formula in letters and rate names, as the registry holds it. `null` for a typed or looked-up value. */
  readonly formula: string | null;
  /** The same formula with the operands' values. `null` where there is none to print (typed values, and the three lines of a "Not applicable" row that read the material). */
  readonly working: string | null;
  /** The stored value: decimal text, or `null` for no figure (a division by zero) or for a value left blank. */
  readonly value: string | null;
  /** True where the value is left empty on purpose (the material rate of a "Not applicable" row), so the screen shows an empty cell and not the dash. */
  readonly blank: boolean;
  /** True for a treatment line whose flag is not selected: it is still calculated and exported as 0, and the screen does not list it. */
  readonly hidden: boolean;
}

/** The total on a stage's heading, and, only when it differs from the lines as shown, what the shown lines add to. */
export interface WorkingStageTotal {
  readonly letters: ReadonlyArray<string>;
  readonly value: string | null;
  readonly shownLinesSum: string | null;
}

export interface WorkingStage {
  readonly number: number;
  readonly name: string;
  readonly subHeadings: ReadonlyArray<string>;
  readonly lines: ReadonlyArray<WorkingLine>;
  readonly total: WorkingStageTotal | null;
}

export interface CostWorking {
  /** True for a row whose material is "Not applicable": no worked line for the lines that read the material. */
  readonly notApplicable: boolean;
  /** How many treatment lines are hidden because their flag is not selected. */
  readonly hiddenLineCount: number;
  readonly stages: ReadonlyArray<WorkingStage>;
}

/** The record cannot be explained: a formula evaluated from the stored operands does not give the stored figure. A fault in the data, never a user's: the message holds no figure and no formula. */
export class WorkingMismatchError extends Error {
  constructor() {
    super('The stored figures of a row cannot be reproduced from the calculation record.');
    this.name = 'WorkingMismatchError';
  }
}

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;
const WORKING_PLACES = 4;
const ZERO_TEXT = '0';

const decimalOf = (text: string | null | undefined): Value => (text !== undefined && text !== null && DECIMAL_TEXT.test(text) ? new Decimal(text) : null);
const fourPlaces = (text: string | null | undefined): string => {
  const value = decimalOf(text);
  return value === null ? NO_FIGURE : value.toFixed(WORKING_PLACES);
};

type SnapshotMaterial = WorkingSnapshot['materials'][number];

const MATERIAL_TEXT: Readonly<Record<MaterialOperandKey, (material: SnapshotMaterial) => string>> = {
  pricePerKg: (material) => material.pricePerKg,
  specificGravity: (material) => material.specificGravity,
  scrapRate: (material) => material.scrapRate,
};

/** The material of the row, found by its words in the snapshot (the record keeps the words of E as they were at the calculation). */
function materialOf(document: ConfigDocument, input: CostWorkingInput): SnapshotMaterial {
  const field = findFieldByKey(document, MATERIAL_IN_DRAWING_KEY);
  const words = field === undefined ? undefined : input.inputs[field.id];
  const found = typeof words === 'string' ? input.snapshot.materials.find((material) => material.materialInDrawing === words) : undefined;
  if (found === undefined) throw new Error('The calculation record holds no material for a row.');
  return found;
}

/** The typed numbers and flags of the row, as `typedFieldValue` reads them (an absent one is 0 there). */
function typedMapOf(document: ConfigDocument, inputs: StoredFigures): ReadonlyMap<string, Value> {
  const typed = new Map<string, Value>();
  for (const field of document.fields) {
    if (field.kind !== 'input' || (field.dataType !== 'number' && field.dataType !== 'flag')) continue;
    const value = decimalOf(inputs[field.id]);
    if (value !== null) typed.set(field.id, value);
  }
  return typed;
}

/** The place of the row's typed value as text, for a working line: as typed, and 0 where nothing was typed. */
const typedText = (inputs: StoredFigures, fieldId: string): string => {
  const text = inputs[fieldId];
  return typeof text === 'string' && DECIMAL_TEXT.test(text) ? text : ZERO_TEXT;
};

/** What a stage lists: the row-scope fields placed in it, by position, and the material rate in the stage of the first formula that reads it (UX SCR-07: "I shown as reference"). */
function fieldsOfStage(document: ConfigDocument, stage: StageDefinition, lookupStageId: string | null, lookup: FieldDefinition | undefined): FieldDefinition[] {
  const own = document.fields.filter((field) => field.rowScope === 'row' && field.stageId === stage.id);
  const shown = lookup !== undefined && lookupStageId === stage.id ? [...own, lookup] : own;
  return shown.sort((a, b) => a.position - b.position);
}

/** The stage of the first calculated field (by position) whose formula reads the material rate, or `null` when none does. */
function stageOfFirstReader(document: ConfigDocument, lookup: FieldDefinition | undefined): string | null {
  if (lookup === undefined) return null;
  for (const field of [...document.fields].sort((a, b) => a.position - b.position)) {
    if (field.kind !== 'output' || field.formula === null || field.stageId === null) continue;
    if (extractReferences(field.formula).some((reference) => reference.kind === 'field' && reference.id === lookup.id)) return field.stageId;
  }
  return null;
}

function resolverOf(document: ConfigDocument, input: CostWorkingInput, material: SnapshotMaterial, lookup: FieldDefinition | undefined): Resolver {
  const typed = typedMapOf(document, input.inputs);
  const rates = input.snapshot.rates.map((rate) => ({ id: rate.id, name: rate.name, value: new Decimal(rate.value) }));
  const rate = createRateLookup(rates);
  const price = new Decimal(material.pricePerKg);
  const gravity = new Decimal(material.specificGravity);
  const scrap = new Decimal(material.scrapRate);
  return {
    fieldValue(fieldId) {
      const field = findFieldById(document, fieldId);
      if (field?.kind === 'output') return decimalOf(input.outputs[fieldId]);
      if (field?.kind === 'auto') return lookup !== undefined && field.id === lookup.id ? price : null;
      return typedFieldValue(document, typed, fieldId);
    },
    columnValues: () => [],
    rate,
    material: (key) => ({ pricePerKg: price, specificGravity: gravity, scrapRate: scrap })[key],
    exchangeRate: (currency) => decimalOf(currency === 'USD' ? input.snapshot.exchangeRates.usd : input.snapshot.exchangeRates.eur),
  };
}

/** How an operand is printed in a working line: inputs and rates as typed (a percent rate as its percentage), calculated values to 4 decimals. */
function operandTextOf(document: ConfigDocument, input: CostWorkingInput, material: SnapshotMaterial, lookup: FieldDefinition | undefined): (reference: FormulaReference) => string {
  return (reference) => {
    switch (reference.kind) {
      case 'field': {
        const field = findFieldById(document, reference.id);
        if (field?.kind === 'output') return fourPlaces(input.outputs[reference.id]);
        if (field?.kind === 'auto') return lookup !== undefined && field.id === lookup.id ? material.pricePerKg : NO_FIGURE;
        return typedText(input.inputs, reference.id);
      }
      case 'rate': {
        const rate = input.snapshot.rates.find((candidate) => candidate.id === reference.id);
        if (rate === undefined) return NO_FIGURE;
        return isPercentRate(rate.name) ? `${rate.value}%` : rate.value;
      }
      case 'material':
        return MATERIAL_TEXT[reference.key](material);
      case 'exchange':
        return input.snapshot.exchangeRates[reference.currency === 'USD' ? 'usd' : 'eur'] ?? NO_FIGURE;
      default:
        return NO_FIGURE;
    }
  };
}

/** True when the formula, on the path it took, read a `Material-*` operand or the material rate (I): the lines a "Not applicable" row prints no worked line for. */
const readsMaterial = (operands: ReadonlyArray<{ readonly kind: string; readonly reference?: FormulaReference }>, lookup: FieldDefinition | undefined): boolean =>
  operands.some(
    (operand) => operand.reference !== undefined && (operand.reference.kind === 'material' || (operand.reference.kind === 'field' && lookup !== undefined && operand.reference.id === lookup.id)),
  );

/** A flag that is not selected: 0, or not typed at all (SPEC section 7.4, "hide zero treatment lines"). */
const flagIsOff = (input: CostWorkingInput, flagFieldId: string): boolean => (decimalOf(input.inputs[flagFieldId]) ?? new Decimal(0)).isZero();

function lineOf(
  field: FieldDefinition,
  context: {
    readonly input: CostWorkingInput;
    readonly notApplicable: boolean;
    readonly lookup: FieldDefinition | undefined;
    readonly resolver: Resolver;
    readonly operandText: (reference: FormulaReference) => string;
    readonly displayContext: ReturnType<typeof referenceContext>;
    readonly material: SnapshotMaterial;
  },
): WorkingLine {
  const { input, notApplicable, lookup, resolver, operandText, displayContext, material } = context;
  const base = { letter: fieldLetter(field), name: field.label, group: field.group, unit: field.displayUnit, formula: null, working: null, hidden: false, blank: false };
  if (field.kind === 'auto') return { ...base, kind: 'lookup', value: notApplicable ? null : material.pricePerKg, blank: notApplicable };
  if (field.kind === 'input') return { ...base, kind: 'typed', value: typedText(input.inputs, field.id) };
  const stored = input.outputs[field.id];
  if (stored === undefined) throw new WorkingMismatchError();
  const hidden = field.hideWhenZero !== null && flagIsOff(input, field.hideWhenZero);
  if (field.formula === null) return { ...base, kind: 'calculated', value: stored, hidden };
  const expression = input.plan.rowFormulas.find((formula) => formula.fieldId === field.id)?.expression;
  if (expression === undefined) throw new WorkingMismatchError();
  const evaluation = evaluateWithWorking(expression, resolver);
  const expected = decimalOf(stored);
  // The working must give the stored figure, or there is nothing honest to print beside it.
  if (evaluation.value === null ? stored !== null : expected === null || !evaluation.value.equals(expected)) throw new WorkingMismatchError();
  const skipWorking = notApplicable && readsMaterial(evaluation.operands, lookup);
  return {
    ...base,
    kind: 'calculated',
    formula: toDisplayForm(field.formula, displayContext),
    working: skipWorking ? null : toWorkingForm(field.formula, operandText),
    value: stored,
    hidden,
  };
}

/** The total of a stage and, when the lines as shown add to something else than the rounded total, what they add to. */
function totalOf(document: ConfigDocument, stage: StageDefinition, outputs: StoredFigures): WorkingStageTotal | null {
  if (stage.totalFieldIds.length === 0) return null;
  const letters = stage.totalFieldIds.map((id) => {
    const field = findFieldById(document, id);
    return field === undefined ? NO_FIGURE : fieldLetter(field);
  });
  const values = stage.totalFieldIds.map((id) => decimalOf(outputs[id]));
  if (values.some((value) => value === null)) return { letters, value: null, shownLinesSum: null };
  const exact = values.reduce<Decimal>((sum, value) => sum.plus(value ?? 0), new Decimal(0));
  const shown = values.reduce<Decimal>((sum, value) => sum.plus(toTwoPlaces((value ?? new Decimal(0)).toString()) ?? 0), new Decimal(0));
  const roundedTotal = toTwoPlaces(exact.toString());
  const differs = roundedTotal === null || !shown.equals(new Decimal(roundedTotal));
  return { letters, value: exact.toString(), shownLinesSum: differs ? shown.toFixed(2) : null };
}

/** The working of a stored row. Throws `WorkingMismatchError` when the record cannot reproduce its own figures. */
export function buildCostWorking(input: CostWorkingInput): CostWorking {
  const { document } = input;
  const material = materialOf(document, input);
  const notApplicable = isNotApplicableName(material.materialInDrawing);
  const lookup = findFieldByKey(document, MATERIAL_RATE_KEY);
  const lookupStageId = stageOfFirstReader(document, lookup);
  const context = {
    input,
    notApplicable,
    lookup,
    material,
    resolver: resolverOf(document, input, material, lookup),
    operandText: operandTextOf(document, input, material, lookup),
    displayContext: referenceContext(document, input.snapshot.rates.map(({ id, name }) => ({ id, name }))),
  };
  const stages = [...document.stages]
    .sort((a, b) => a.number - b.number)
    .map((stage): WorkingStage => ({
      number: stage.number,
      name: stage.name,
      subHeadings: stage.subHeadings,
      lines: fieldsOfStage(document, stage, lookupStageId, lookup).map((field) => lineOf(field, context)),
      total: totalOf(document, stage, input.outputs),
    }));
  return { notApplicable, hiddenLineCount: stages.reduce((count, stage) => count + stage.lines.filter((line) => line.hidden).length, 0), stages };
}
