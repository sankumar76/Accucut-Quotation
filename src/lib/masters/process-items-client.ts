import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome, type Refusal } from '../api-client';

/**
 * The browser's side of the Process Master routes (SCR-11; `/api/v1/process-items`, architecture section 6): four small calls and
 * the reading of their answers. Nothing here decides anything: who may call, whether a name is free or safe in a formula, and
 * whether a rate may be deleted are the server's, and this file only turns its answer into something the screen can show.
 */

/** One formula that uses a rate: the field's column letter and its label. */
export interface FormulaUseRow {
  readonly letter: string;
  readonly label: string;
}

export interface ProcessItemRow {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  /** Decimal text, for example "1.37". */
  readonly defaultValue: string;
  readonly usedBy: ReadonlyArray<FormulaUseRow>;
}

export interface ProcessItemInput {
  readonly name: string;
  readonly unit: string;
  readonly defaultValue: string;
}

export interface ProcessItemChangesInput {
  readonly name?: string | undefined;
  readonly unit?: string | undefined;
  readonly defaultValue?: string | undefined;
}

const PROCESS_ITEMS_PATH = '/api/v1/process-items';

function toFormulaUse(value: unknown): FormulaUseRow | null {
  if (!isRecord(value) || typeof value['letter'] !== 'string' || typeof value['label'] !== 'string') return null;
  return { letter: value['letter'], label: value['label'] };
}

function toFormulaUses(value: unknown): ReadonlyArray<FormulaUseRow> | null {
  if (!Array.isArray(value)) return null;
  const uses = value.map(toFormulaUse);
  return uses.every((use): use is FormulaUseRow => use !== null) ? uses : null;
}

export function toProcessItemRow(value: unknown): ProcessItemRow | null {
  if (!isRecord(value)) return null;
  const { id, name, unit, defaultValue } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof unit !== 'string' || typeof defaultValue !== 'string') return null;
  const usedBy = toFormulaUses(value['usedBy']);
  return usedBy === null ? null : { id, name, unit, defaultValue, usedBy };
}

function readItems(body: unknown): ReadonlyArray<ProcessItemRow> | null {
  if (!isRecord(body) || !Array.isArray(body['processItems'])) return null;
  const rows = body['processItems'].map(toProcessItemRow);
  return rows.every((row): row is ProcessItemRow => row !== null) ? rows : null;
}

/** The formulas a 409 "cannot be deleted" names, or an empty list when the refusal is of another kind. */
export function formulasOf(refusal: Refusal): ReadonlyArray<FormulaUseRow> {
  return toFormulaUses(refusal.body['usedBy']) ?? [];
}

/** The reading of an answer that has no body (a 204): there is nothing to read, and it worked. */
const readNothing = (): true => true;

/** `GET /api/v1/process-items`. */
export function listProcessItems(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<ProcessItemRow>>> {
  return sendJson(doFetch, PROCESS_ITEMS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readItems);
}

/** `POST /api/v1/process-items`. */
export function createProcessItem(input: ProcessItemInput, doFetch: Fetch = fetch): Promise<Outcome<ProcessItemRow>> {
  return sendJson(doFetch, PROCESS_ITEMS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toProcessItemRow);
}

/** `PATCH /api/v1/process-items/{id}`: a name, a unit, or a default value. */
export function updateProcessItem(id: string, changes: ProcessItemChangesInput, doFetch: Fetch = fetch): Promise<Outcome<ProcessItemRow>> {
  return sendJson(
    doFetch,
    `${PROCESS_ITEMS_PATH}/${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) },
    toProcessItemRow,
  );
}

/** `DELETE /api/v1/process-items/{id}`. The answer is 204; a 409 carries the formulas that use the rate (`formulasOf`). */
export function deleteProcessItem(id: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, `${PROCESS_ITEMS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: ACCEPT_JSON }, readNothing);
}
