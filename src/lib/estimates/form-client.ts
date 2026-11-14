import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

import type { Completeness } from './tree-client';

/**
 * The browser's side of the part form's routes (STORY-05.03; SCR-05; architecture section 6 "Estimate form", "Node", "Save inputs" and "Safe options"): read the form, read
 * the part's values, save them, and read the materials to choose from. Nothing here decides anything: whether the estimate is the person's, whether it may still be changed,
 * whether a value is valid and what may be stored are the server's, and this file only reads its answer (an answer of the wrong shape is a failure, not a crash). A field is
 * its ID, letter, label, unit, hint and rule; a material is an ID, a name and Material Considered, and nothing else is read from an answer.
 */

/** How a field is filled, as the server states it: typed as a number or a text, chosen from the materials, or shown and never typed. */
export type FormRule =
  | { readonly type: 'number'; readonly decimals: number }
  | { readonly type: 'text'; readonly maxLength: number; readonly multiline: boolean }
  | { readonly type: 'select'; readonly source: 'materials' }
  | { readonly type: 'derived'; readonly from: string | null };

export interface FormField {
  readonly id: string;
  readonly letter: string;
  readonly label: string;
  readonly kind: 'input' | 'auto';
  readonly unit: string | null;
  readonly hint: string | null;
  readonly required: boolean;
  readonly editable: boolean;
  readonly rule: FormRule;
}

export interface FormSection {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly shortName: string;
  readonly columnRange: string;
  readonly fields: ReadonlyArray<FormField>;
}

export interface FormView {
  readonly sections: ReadonlyArray<FormSection>;
  /** ISO 8601 UTC text of the last write to any part, or null. */
  readonly lastSavedAt: string | null;
}

/** What the server holds of a part's inputs: its revision, how complete it is, and the text of each value by field ID. */
export interface PartInputs {
  readonly id: string;
  readonly revision: number;
  readonly completeness: Completeness;
  readonly inputs: Readonly<Record<string, string>>;
}

/** A material to choose from: the ID, the name (Material in Drawing) and Material Considered, null for an entry that has none. No number of any kind. */
export interface MaterialChoice {
  readonly id: string;
  readonly name: string;
  readonly materialConsidered: string | null;
}

/** The code of the 409 for a part that changed since the person looked. */
export const PART_CHANGED_CODE = 'PART_CHANGED';

const isText = (value: unknown): value is string => typeof value === 'string';
const isNonEmptyText = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isCompleteness = (value: unknown): value is Completeness => value === 'EMPTY' || value === 'PARTIAL' || value === 'COMPLETE';

function toRule(value: unknown): FormRule | null {
  if (!isRecord(value)) return null;
  switch (value['type']) {
    case 'number':
      return typeof value['decimals'] === 'number' ? { type: 'number', decimals: value['decimals'] } : null;
    case 'text':
      return typeof value['maxLength'] === 'number' && typeof value['multiline'] === 'boolean' ? { type: 'text', maxLength: value['maxLength'], multiline: value['multiline'] } : null;
    case 'select':
      return value['source'] === 'materials' ? { type: 'select', source: 'materials' } : null;
    case 'derived': {
      const from = value['from'];
      return from === null || isNonEmptyText(from) ? { type: 'derived', from } : null;
    }
    default:
      return null;
  }
}

function toField(value: unknown): FormField | null {
  if (!isRecord(value)) return null;
  const { id, letter, label, kind, unit, hint, required, editable } = value;
  const rule = toRule(value['rule']);
  if (!isNonEmptyText(id) || !isNonEmptyText(letter) || !isNonEmptyText(label) || (kind !== 'input' && kind !== 'auto') || rule === null) return null;
  if ((unit !== null && !isText(unit)) || (hint !== null && !isText(hint)) || typeof required !== 'boolean' || typeof editable !== 'boolean') return null;
  return { id, letter, label, kind, unit, hint, required, editable, rule };
}

function toSection(value: unknown): FormSection | null {
  if (!isRecord(value) || !Array.isArray(value['fields'])) return null;
  const { id, number, name, shortName, columnRange } = value;
  const fields = value['fields'].map(toField);
  if (!isNonEmptyText(id) || typeof number !== 'number' || !isNonEmptyText(name) || !isNonEmptyText(shortName) || !isNonEmptyText(columnRange)) return null;
  return fields.every((field) => field !== null) ? { id, number, name, shortName, columnRange, fields } : null;
}

function toForm(body: unknown): FormView | null {
  if (!isRecord(body) || !Array.isArray(body['sections'])) return null;
  const lastSavedAt = body['lastSavedAt'];
  if (lastSavedAt !== null && !isNonEmptyText(lastSavedAt)) return null;
  const sections = body['sections'].map(toSection);
  return sections.every((section) => section !== null) ? { sections, lastSavedAt } : null;
}

/** The values of a part as a record by field ID, from the list of entries the server sends. */
function toInputs(value: unknown): Record<string, string> | null {
  if (!Array.isArray(value)) return null;
  const inputs: Record<string, string> = {};
  for (const entry of value) {
    if (!isRecord(entry) || !isNonEmptyText(entry['fieldId']) || !isText(entry['value'])) return null;
    inputs[entry['fieldId']] = entry['value'];
  }
  return inputs;
}

function toPartInputs(body: unknown): PartInputs | null {
  if (!isRecord(body)) return null;
  const { id, revision, completeness } = body;
  const inputs = toInputs(body['inputs']);
  if (!isNonEmptyText(id) || typeof revision !== 'number' || !isCompleteness(completeness) || inputs === null) return null;
  return { id, revision, completeness, inputs };
}

function toMaterial(value: unknown): MaterialChoice | null {
  if (!isRecord(value)) return null;
  const { id, name, materialConsidered } = value;
  if (!isNonEmptyText(id) || !isNonEmptyText(name) || (materialConsidered !== null && !isText(materialConsidered))) return null;
  return { id, name, materialConsidered };
}

function toMaterials(body: unknown): ReadonlyArray<MaterialChoice> | null {
  if (!isRecord(body) || !Array.isArray(body['options'])) return null;
  const options = body['options'].map(toMaterial);
  return options.every((option) => option !== null) ? options : null;
}

const base = (estimateId: string): string => `/api/v1/estimates/${encodeURIComponent(estimateId)}`;

/** `GET /api/v1/estimates/{id}/form`: the sections and fields of the part form, and when a part was last written. */
export function loadForm(estimateId: string, doFetch: Fetch = fetch): Promise<Outcome<FormView>> {
  return sendJson(doFetch, `${base(estimateId)}/form`, { method: 'GET', headers: ACCEPT_JSON }, toForm);
}

/** `GET /api/v1/estimates/{id}/nodes/{nodeId}`: the part's revision and what was typed into it, by field ID. */
export function loadPartInputs(estimateId: string, nodeId: string, doFetch: Fetch = fetch): Promise<Outcome<PartInputs>> {
  return sendJson(doFetch, `${base(estimateId)}/nodes/${encodeURIComponent(nodeId)}`, { method: 'GET', headers: ACCEPT_JSON }, toPartInputs);
}

export interface SaveInputsRequest {
  /** The part's revision as the person saw it. */
  readonly revision: number;
  /** The text typed, by field ID. A blank clears the value. */
  readonly values: Readonly<Record<string, string>>;
}

/** `PATCH /api/v1/estimates/{id}/nodes/{nodeId}/inputs`: the answer is the part as it is now. A refusal of a value carries the server's words under the field's ID. */
export function savePartInputs(estimateId: string, nodeId: string, request: SaveInputsRequest, doFetch: Fetch = fetch): Promise<Outcome<PartInputs>> {
  return sendJson(doFetch, `${base(estimateId)}/nodes/${encodeURIComponent(nodeId)}/inputs`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(request) }, toPartInputs);
}

/** `GET /api/v1/options/materials`: the materials to choose from, by name, with Material Considered. */
export function loadMaterialOptions(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<MaterialChoice>>> {
  return sendJson(doFetch, '/api/v1/options/materials', { method: 'GET', headers: ACCEPT_JSON }, toMaterials);
}
