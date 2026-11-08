import { Decimal } from 'decimal.js';

/**
 * The canary estimate builder (STORY-01.03 T7, AC-7; test strategy section 6, "Typed values are allowed").
 *
 * An Engineer sees what they typed, Machining, Plating, Tool and Fasteners Cost included (FR-008), so a typed value found in
 * a response is no leak. That makes one mistake dangerous: if an output equalled a typed value, the scan would raise a false
 * alarm. An estimate with only Machining Cost set makes Total Process Cost equal it, and so do other chains that reduce to one
 * term. The inputs below are therefore chosen so that no output of the seed registry equals any typed value:
 *   - every field a person types has a value, none is 0 (an output of 0 would equal a typed 0), and every number is distinct
 *     from every other (flags excepted, which are 0 or 1);
 *   - the numbers carry irregular fractions, so a product or a sum of them is not another typed number;
 *   - every treatment flag is on and fasteners are chosen, so each cost line is a real product of several terms.
 *
 * Estimates and calculations arrive in later stories. Until then the builder is verified on its own, against the seed
 * registry and the real formula engine (`tests/security/canary-estimate-builder.test.ts`), and a story that adds an input
 * field adds its value here (that test fails until it does). The keys are the registry's field keys, which are stable; a story
 * that stores the estimate maps them to field IDs.
 *
 * Every value is invented. None is a quantity, dimension or price from a real drawing or from the sample workbook.
 */

/** Keys of input fields that take no typed value here: a picture is uploaded, not typed. */
export const CANARY_NO_TYPED_VALUE_KEYS: ReadonlyArray<string> = ['part-model'];

/** The treatment flags: 1 means chosen. They are the only typed numbers allowed to repeat. */
export const CANARY_FLAG_KEYS: ReadonlyArray<string> = [
  'hot-dip-galvanizing',
  'primer',
  'shot-blasting',
  'polishing',
  'plating',
  'powder-coating',
  'foam',
  'soft-anodize',
];

const CANARY_INPUTS: Readonly<Record<string, string>> = {
  'part-no': 'CANARY-PN-4417',
  description: 'Invented bracket for the canary estimate',
  'material-in-drawing': 'Invented-material-A',
  'treatment-color': 'Invented-colour-A',
  'qty-per-assy': '7',
  length: '412.5',
  width: '318.25',
  thickness: '2.75',
  'part-weight': '4.125',
  'cutting-time': '38.5',
  'cutting-length': '960.5',
  'bend-count': '6',
  fasteners: 'Invented-bolt',
  'fasteners-qty': '5',
  'fasteners-cost': '3.5',
  weld: '3',
  drilling: '4',
  tapping: '2',
  csk: '9',
  ...Object.fromEntries(CANARY_FLAG_KEYS.map((key) => [key, '1'])),
  remarks: 'Invented remark for the canary estimate',
  'machining-cost': '1234.5',
  'plating-cost': '678.25',
  'tool-cost': '45678.75',
};

/** What the Engineer types into the canary estimate, by field key. A fresh copy each call. */
export function canaryEstimateInputs(): Record<string, string> {
  return { ...CANARY_INPUTS };
}

export interface InputOutputCollision {
  readonly outputKey: string;
  readonly inputKey: string;
  readonly value: string;
}

function asDecimal(text: string | null | undefined): Decimal | null {
  if (text === null || text === undefined || !/^-?\d+(\.\d+)?$/.test(text.trim())) return null;
  return new Decimal(text.trim());
}

/**
 * The outputs that equal a typed value, by number (`2.50` equals `2.5`). Text and empty values are skipped: a word is no figure.
 * The rule of AC-7 holds when the list is empty. A later story that calculates the canary estimate passes its outputs here.
 */
export function findOutputsEqualToInputs(
  inputs: Readonly<Record<string, string>>,
  outputs: Readonly<Record<string, string | null>>,
): ReadonlyArray<InputOutputCollision> {
  const typed = Object.entries(inputs).flatMap(([inputKey, text]) => {
    const value = asDecimal(text);
    return value === null ? [] : [{ inputKey, value }];
  });
  return Object.entries(outputs).flatMap(([outputKey, text]) => {
    const output = asDecimal(text);
    if (output === null) return [];
    return typed.filter((entry) => entry.value.equals(output)).map((entry) => ({ outputKey, inputKey: entry.inputKey, value: output.toFixed() }));
  });
}

/** Throws when an output equals a typed value, naming each pair, so a story's own test reads the rule in one line. */
export function assertNoOutputEqualsInput(inputs: Readonly<Record<string, string>>, outputs: Readonly<Record<string, string | null>>): void {
  const collisions = findOutputsEqualToInputs(inputs, outputs);
  if (collisions.length > 0) {
    const listed = collisions.map((entry) => `${entry.outputKey} equals the typed ${entry.inputKey} (${entry.value})`).join('; ');
    throw new Error(`The canary estimate would raise a false alarm: ${listed}.`);
  }
}
