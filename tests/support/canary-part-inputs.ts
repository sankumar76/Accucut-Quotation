import { formFieldById } from '../../src/lib/estimate/form-fields';
import { validateNumberInput, validateTextInput, type InputCheck } from '../../src/lib/estimate/validation';
import type { ConfigDocument } from '../../src/lib/fields/schema';
import { MATERIAL_RATE_KEY } from '../../src/lib/fields/types';

import { canaryEstimateInputs } from './canary-estimate-builder';
import { MATERIAL_CANARIES } from './material-master-canary';

/**
 * What the canary part of the confidentiality scan holds (STORY-05.04 AC-7; STORY-01.03 AC-6; test strategy section 6; review SQR-05 of STORY-05.03): the **typed** values of the canary
 * estimate (`canary-estimate-builder.ts`: Tool, Machining, Plating and Fasteners Cost among them, which an Engineer rightly sees, FR-008), stored as the part form stores them (by field ID,
 * normalised text), and **two things no answer may carry**: a Restricted value under Material Rate / Kg (I), which is a canary price the scan forbids, and a key that is no field at all.
 *
 * The scan then reads the routes that return a part (`GET /nodes/{id}`, `PATCH .../inputs`) and the page, as an Engineer, with the typed values really stored. A route that returned the stored
 * `inputs` as they are, and not the projection of the form's fields, would send the planted price, and the scan would find it. A field a story adds to the form takes its typed value from the
 * builder (which fails its own test until it has one), so the new sections are scanned with no edit here.
 *
 * It takes the registry as a parameter and imports no module that is server-only: the unit test gives it the seed registry, and the E2E set-up gives it the version stored in the E2E
 * database (a Playwright process cannot load the formula engine). The typed values must be ones the form accepts: each is read by the field's own rule, so a value that a person could not
 * type is no canary.
 */

/** A canary price (STORY-02.03) that the scan forbids in every printed form. */
export const CANARY_PLANTED_RATE: string = MATERIAL_CANARIES[0]?.pricePerKg ?? '';
/** A stored key that is not a field ID of the registry (a field that a later registry removed). */
export const CANARY_UNKNOWN_KEY = 'invented-removed-field';

/** The ID of the field Material Rate / Kg (I): never on the form, so a value stored under it is Restricted by the registry itself. */
export function canaryRateFieldId(document: ConfigDocument): string {
  const field = document.fields.find((candidate) => candidate.key === MATERIAL_RATE_KEY);
  if (field === undefined) throw new Error('The registry has no Material Rate / Kg.');
  return field.id;
}

function checkedByRule(document: ConfigDocument, fieldId: string, text: string): InputCheck {
  const rule = formFieldById(document, fieldId)?.rule;
  if (rule === undefined || rule.type === 'derived' || rule.type === 'select') return { ok: true, value: null };
  return rule.type === 'number' ? validateNumberInput(text) : validateTextInput(text, { multiline: rule.multiline, maxLength: rule.maxLength });
}

export interface TypedCanaryValue {
  readonly key: string;
  readonly fieldId: string;
  /** What the form stores for it. */
  readonly stored: string;
}

/** The typed inputs of the canary estimate that the part form can store today, as it stores them. A value the field's own rule refuses is returned in `refused`. */
export function canaryTypedValues(document: ConfigDocument): { readonly values: ReadonlyArray<TypedCanaryValue>; readonly refused: ReadonlyArray<string> } {
  const values: TypedCanaryValue[] = [];
  const refused: string[] = [];
  for (const [key, text] of Object.entries(canaryEstimateInputs())) {
    const field = document.fields.find((candidate) => candidate.key === key);
    if (field === undefined) throw new Error(`The canary estimate has a value for "${key}", which the registry does not have.`);
    if (formFieldById(document, field.id)?.editable !== true) continue;
    const check = checkedByRule(document, field.id, text);
    if (!check.ok) refused.push(`${key}: "${text}" (${check.message})`);
    else if (check.value !== null) values.push({ key, fieldId: field.id, stored: check.value });
  }
  return { values, refused };
}

/** The whole `inputs` of the canary part: the typed values, the planted Restricted value and the unknown key. Throws if a typed value is one the form refuses. */
export function canaryPartInputs(document: ConfigDocument): Record<string, string> {
  const { values, refused } = canaryTypedValues(document);
  if (refused.length > 0) throw new Error(`The canary estimate holds values that the part form refuses: ${refused.join('; ')}.`);
  return { ...Object.fromEntries(values.map((value) => [value.fieldId, value.stored])), [canaryRateFieldId(document)]: CANARY_PLANTED_RATE, [CANARY_UNKNOWN_KEY]: 'x' };
}
