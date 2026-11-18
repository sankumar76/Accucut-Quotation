import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of the formula editor's routes (SCR-18; STORY-08.02): the live check, the sample rows, the version the editor opens on and the save. Nothing here decides anything: whether a formula is
 * valid, what it uses and what it feeds, who may save and whether the password is right are the server's, and this file only turns its answers into values the screen can show. It has no zod (NFR-009), and it
 * keeps no password: the save takes it as an argument and the caller drops it after the answer.
 */

export interface FormulaUseView {
  readonly kind: 'field' | 'rate' | 'value';
  readonly name: string;
}

export interface FedFieldView {
  readonly letter: string;
  readonly label: string;
}

export interface PreviewOperandView {
  readonly name: string;
  readonly value: string | null;
}

export interface FormulaPreviewView {
  readonly estimateCode: string;
  readonly slNo: string | null;
  readonly value: string | null;
  /** Two decimals, or the dash. */
  readonly shown: string;
  readonly operands: ReadonlyArray<PreviewOperandView>;
}

export interface FormulaCheckView {
  readonly message: string;
  readonly uses: ReadonlyArray<FormulaUseView>;
  readonly feeds: ReadonlyArray<FedFieldView>;
  /** The sentence under the formula of the estimate total, or `null`. */
  readonly note: string | null;
  readonly preview: FormulaPreviewView | null;
}

export interface SampleRowView {
  readonly id: string;
  readonly slNo: string;
  readonly name: string;
}

export interface SampleRowsView {
  readonly estimateCode: string | null;
  readonly rows: ReadonlyArray<SampleRowView>;
  /** The fixed operands a formula may use, by name, for the suggestions. */
  readonly operandNames: ReadonlyArray<string>;
}

export interface SaveFormulaView {
  readonly version: number;
  readonly changed: boolean;
  readonly message: string;
}

const CHECK_PATH = '/api/v1/config/formula-check';
const SAMPLE_ROWS_PATH = '/api/v1/config/sample-rows';
const CURRENT_PATH = '/api/v1/config/current';
const fieldFormulaPath = (fieldId: string): string => `/api/v1/config/fields/${encodeURIComponent(fieldId)}/formula`;

const isText = (value: unknown): value is string => typeof value === 'string';
const textOrNull = (value: unknown): string | null | undefined => (value === null || isText(value) ? value : undefined);

function readList<T>(value: unknown, readItem: (item: unknown) => T | null): ReadonlyArray<T> | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(readItem);
  return items.every((item): item is T => item !== null) ? items : null;
}

function readUse(value: unknown): FormulaUseView | null {
  if (!isRecord(value) || !isText(value['name'])) return null;
  const kind = value['kind'];
  return kind === 'field' || kind === 'rate' || kind === 'value' ? { kind, name: value['name'] } : null;
}

function readFed(value: unknown): FedFieldView | null {
  return isRecord(value) && isText(value['letter']) && isText(value['label']) ? { letter: value['letter'], label: value['label'] } : null;
}

function readOperand(value: unknown): PreviewOperandView | null {
  if (!isRecord(value) || !isText(value['name'])) return null;
  const shown = textOrNull(value['value']);
  return shown === undefined ? null : { name: value['name'], value: shown };
}

function readPreview(value: unknown): FormulaPreviewView | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isText(value['estimateCode']) || !isText(value['shown'])) return undefined;
  const slNo = textOrNull(value['slNo']);
  const result = textOrNull(value['value']);
  const operands = readList(value['operands'], readOperand);
  if (slNo === undefined || result === undefined || operands === null) return undefined;
  return { estimateCode: value['estimateCode'], slNo, value: result, shown: value['shown'], operands };
}

function readCheck(body: unknown): FormulaCheckView | null {
  if (!isRecord(body) || body['valid'] !== true || !isText(body['message'])) return null;
  const uses = readList(body['uses'], readUse);
  const feeds = readList(body['feeds'], readFed);
  const preview = readPreview(body['preview']);
  const note = textOrNull(body['note']);
  return uses === null || feeds === null || preview === undefined || note === undefined ? null : { message: body['message'], uses, feeds, note, preview };
}

function readSampleRow(value: unknown): SampleRowView | null {
  return isRecord(value) && isText(value['id']) && isText(value['slNo']) && isText(value['name']) ? { id: value['id'], slNo: value['slNo'], name: value['name'] } : null;
}

function readSampleRows(body: unknown): SampleRowsView | null {
  if (!isRecord(body)) return null;
  const rows = readList(body['rows'], readSampleRow);
  const operandNames = readList(body['operandNames'], (name) => (isText(name) ? name : null));
  const estimate = body['estimate'];
  if (rows === null || operandNames === null) return null;
  if (estimate === null) return { estimateCode: null, rows, operandNames };
  return isRecord(estimate) && isText(estimate['code']) ? { estimateCode: estimate['code'], rows, operandNames } : null;
}

function readSaved(body: unknown): SaveFormulaView | null {
  if (!isRecord(body) || typeof body['version'] !== 'number' || typeof body['changed'] !== 'boolean' || !isText(body['message'])) return null;
  return { version: body['version'], changed: body['changed'], message: body['message'] };
}

function readVersionNumber(body: unknown): number | null {
  return isRecord(body) && typeof body['number'] === 'number' ? body['number'] : null;
}

/** `POST /api/v1/config/formula-check`. A formula that cannot be saved is a refusal with the SCR-18 sentence under `text`. */
export function checkFormula(request: { readonly fieldId: string; readonly text: string; readonly sampleRowId?: string }, doFetch: Fetch = fetch): Promise<Outcome<FormulaCheckView>> {
  return sendJson(doFetch, CHECK_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) }, readCheck);
}

/** `GET /api/v1/config/sample-rows`. */
export function listSampleRows(doFetch: Fetch = fetch): Promise<Outcome<SampleRowsView>> {
  return sendJson(doFetch, SAMPLE_ROWS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readSampleRows);
}

/** The number of the configuration version in force: the version the editor is opened on and the save is checked against (`GET /api/v1/config/current`). */
export function readConfigVersionNumber(doFetch: Fetch = fetch): Promise<Outcome<number>> {
  return sendJson(doFetch, CURRENT_PATH, { method: 'GET', headers: ACCEPT_JSON }, readVersionNumber);
}

/** `PUT /api/v1/config/fields/{id}/formula`. The password travels in the body of this one request and is kept nowhere. */
export function saveFormula(
  fieldId: string,
  request: { readonly text: string; readonly password: string; readonly baseVersion: number },
  doFetch: Fetch = fetch,
): Promise<Outcome<SaveFormulaView>> {
  return sendJson(doFetch, fieldFormulaPath(fieldId), { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(request) }, readSaved);
}
