import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';
import type { FieldKind } from '../fields/types';

/**
 * The browser's side of the insert wizard's routes (SCR-19; STORY-08.03): the options it opens on, the preview and the save. Nothing here decides anything: which letters change, what is valid, and every
 * sentence of a refusal are the server's, and this file only turns its answers into values the screen can show. It has no zod (NFR-009) and no password: an insert asks for none (FR-080).
 */

export interface InsertColumnOption {
  readonly id: string;
  readonly letter: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** An input whose value can be waited on or can hide a line (not a picture). */
  readonly watchable: boolean;
}

export interface InsertOptions {
  /** The version the wizard is opened on: the base of the save. */
  readonly version: number;
  readonly columns: ReadonlyArray<InsertColumnOption>;
  readonly sections: ReadonlyArray<{ readonly id: string; readonly number: number; readonly name: string }>;
  readonly stages: ReadonlyArray<{ readonly id: string; readonly number: number; readonly name: string; readonly subHeadings: ReadonlyArray<string> }>;
  readonly numberFormats: ReadonlyArray<string>;
}

export interface MovedView {
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

export interface InsertedView {
  readonly letter: string;
  readonly label: string;
  readonly kind: 'input' | 'output';
}

export interface InsertPreviewView {
  readonly baseVersion: number;
  readonly inserted: ReadonlyArray<InsertedView>;
  readonly moved: ReadonlyArray<MovedView>;
  readonly productCells: ReadonlyArray<MovedView>;
  /** The formula of each new output with its final letters. */
  readonly formulas: ReadonlyArray<{ readonly letter: string; readonly label: string; readonly formula: string }>;
}

export interface InsertSavedView {
  readonly version: number;
  readonly letters: ReadonlyArray<string>;
  readonly message: string;
}

const OPTIONS_PATH = '/api/v1/config/insert-options';
const PREVIEW_PATH = '/api/v1/config/fields/preview';
const SAVE_PATH = '/api/v1/config/fields';

const isText = (value: unknown): value is string => typeof value === 'string';

function readList<T>(value: unknown, readItem: (item: unknown) => T | null): ReadonlyArray<T> | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(readItem);
  return items.every((item): item is T => item !== null) ? items : null;
}

function readColumn(value: unknown): InsertColumnOption | null {
  if (!isRecord(value) || !isText(value['id']) || !isText(value['letter']) || !isText(value['label']) || typeof value['watchable'] !== 'boolean') return null;
  const kind = value['kind'];
  return kind === 'input' || kind === 'auto' || kind === 'output' ? { id: value['id'], letter: value['letter'], label: value['label'], kind, watchable: value['watchable'] } : null;
}

function readSection(value: unknown): InsertOptions['sections'][number] | null {
  return isRecord(value) && isText(value['id']) && typeof value['number'] === 'number' && isText(value['name']) ? { id: value['id'], number: value['number'], name: value['name'] } : null;
}

function readStage(value: unknown): InsertOptions['stages'][number] | null {
  if (!isRecord(value) || !isText(value['id']) || typeof value['number'] !== 'number' || !isText(value['name'])) return null;
  const subHeadings = readList(value['subHeadings'], (item) => (isText(item) ? item : null));
  return subHeadings === null ? null : { id: value['id'], number: value['number'], name: value['name'], subHeadings };
}

function readOptions(body: unknown): InsertOptions | null {
  if (!isRecord(body) || typeof body['version'] !== 'number') return null;
  const columns = readList(body['columns'], readColumn);
  const sections = readList(body['sections'], readSection);
  const stages = readList(body['stages'], readStage);
  const numberFormats = readList(body['numberFormats'], (item) => (isText(item) ? item : null));
  return columns === null || sections === null || stages === null || numberFormats === null ? null : { version: body['version'], columns, sections, stages, numberFormats };
}

function readMoved(value: unknown): MovedView | null {
  return isRecord(value) && isText(value['label']) && isText(value['from']) && isText(value['to']) ? { label: value['label'], from: value['from'], to: value['to'] } : null;
}

function readInserted(value: unknown): InsertedView | null {
  if (!isRecord(value) || !isText(value['letter']) || !isText(value['label'])) return null;
  const kind = value['kind'];
  return kind === 'input' || kind === 'output' ? { letter: value['letter'], label: value['label'], kind } : null;
}

function readFormula(value: unknown): InsertPreviewView['formulas'][number] | null {
  return isRecord(value) && isText(value['letter']) && isText(value['label']) && isText(value['formula']) ? { letter: value['letter'], label: value['label'], formula: value['formula'] } : null;
}

function readPreview(body: unknown): InsertPreviewView | null {
  if (!isRecord(body) || typeof body['baseVersion'] !== 'number') return null;
  const inserted = readList(body['inserted'], readInserted);
  const moved = readList(body['moved'], readMoved);
  const productCells = readList(body['productCells'], readMoved);
  const formulas = readList(body['formulas'], readFormula);
  return inserted === null || moved === null || productCells === null || formulas === null ? null : { baseVersion: body['baseVersion'], inserted, moved, productCells, formulas };
}

function readSaved(body: unknown): InsertSavedView | null {
  if (!isRecord(body) || typeof body['version'] !== 'number' || !isText(body['message'])) return null;
  const letters = readList(body['letters'], (item) => (isText(item) ? item : null));
  return letters === null ? null : { version: body['version'], letters, message: body['message'] };
}

/** `GET /api/v1/config/insert-options`. */
export function loadInsertOptions(doFetch: Fetch = fetch): Promise<Outcome<InsertOptions>> {
  return sendJson(doFetch, OPTIONS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readOptions);
}

/** `POST /api/v1/config/fields/preview`. `lettersOnly` asks for the letters alone while step 2 is still being filled in. A refusal carries the server's sentence under each control's name. */
export function previewInsert(spec: unknown, lettersOnly: boolean, doFetch: Fetch = fetch): Promise<Outcome<InsertPreviewView>> {
  return sendJson(doFetch, PREVIEW_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ spec, lettersOnly }) }, readPreview);
}

/** `POST /api/v1/config/fields`. */
export function saveInsert(spec: unknown, baseVersion: number, doFetch: Fetch = fetch): Promise<Outcome<InsertSavedView>> {
  return sendJson(doFetch, SAVE_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ spec, baseVersion }) }, readSaved);
}
