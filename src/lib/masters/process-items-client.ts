import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome, type Refusal } from '../api-client';

import type { PropagationChoice, PropagationCounts } from './default-propagation';

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
  /** How many listed customers hold a value other than the default (the column of SCR-11). */
  readonly customersWithOwnValue: number;
}

/** A customer that holds a value other than the new default: the save lists it and leaves it alone (STORY-02.08 AC-2). */
export interface DifferingCustomerRow {
  readonly customerId: string;
  readonly name: string;
  /** Decimal text, for example "1.50". */
  readonly value: string;
}

/** What a save that changed the default did to the customers: the old default, how many moved by themselves, and who differs. */
export interface PropagationRow {
  readonly previousDefault: string;
  readonly moved: number;
  readonly differing: ReadonlyArray<DifferingCustomerRow>;
}

/** The answer of a save: the rate, and `propagation`, which is null when the save did not change the default. */
export interface ProcessItemSavedRow extends ProcessItemRow {
  readonly propagation: PropagationRow | null;
}

/** What the dialog sends for one customer: Apply or Keep, with the value that was listed (AC-3). */
export interface PropagationChoiceInput {
  readonly customerId: string;
  readonly choice: PropagationChoice;
  readonly shownValue: string;
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
  const own = value['customersWithOwnValue'];
  return usedBy === null || typeof own !== 'number' ? null : { id, name, unit, defaultValue, usedBy, customersWithOwnValue: own };
}

function toDifferingCustomer(value: unknown): DifferingCustomerRow | null {
  if (!isRecord(value)) return null;
  const { customerId, name, value: current } = value;
  return typeof customerId === 'string' && typeof name === 'string' && typeof current === 'string' ? { customerId, name, value: current } : null;
}

function toPropagation(value: unknown): PropagationRow | null {
  if (!isRecord(value) || typeof value['previousDefault'] !== 'string' || typeof value['moved'] !== 'number' || !Array.isArray(value['differing'])) return null;
  const differing = value['differing'].map(toDifferingCustomer);
  return differing.every((row): row is DifferingCustomerRow => row !== null) ? { previousDefault: value['previousDefault'], moved: value['moved'], differing } : null;
}

function toSavedProcessItem(value: unknown): ProcessItemSavedRow | null {
  const item = toProcessItemRow(value);
  if (item === null || !isRecord(value)) return null;
  const raw = value['propagation'];
  if (raw === null) return { ...item, propagation: null };
  const propagation = toPropagation(raw);
  return propagation === null ? null : { ...item, propagation };
}

function toCounts(value: unknown): PropagationCounts | null {
  if (!isRecord(value)) return null;
  const { applied, kept, skipped } = value;
  return typeof applied === 'number' && typeof kept === 'number' && typeof skipped === 'number' ? { applied, kept, skipped } : null;
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

/** `PATCH /api/v1/process-items/{id}`: a name, a unit, or a default value. A new default answers with what it did to the customers (`propagation`). */
export function updateProcessItem(id: string, changes: ProcessItemChangesInput, doFetch: Fetch = fetch): Promise<Outcome<ProcessItemSavedRow>> {
  return sendJson(
    doFetch,
    `${PROCESS_ITEMS_PATH}/${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) },
    toSavedProcessItem,
  );
}

/** `POST /api/v1/process-items/{id}/propagation`: Save choices of the dialog "Customers differ" (STORY-02.08 AC-3). A 409 `DEFAULT_CHANGED` says the default changed again. */
export function savePropagationChoices(
  id: string,
  newDefault: string,
  choices: ReadonlyArray<PropagationChoiceInput>,
  doFetch: Fetch = fetch,
): Promise<Outcome<PropagationCounts>> {
  return sendJson(
    doFetch,
    `${PROCESS_ITEMS_PATH}/${encodeURIComponent(id)}/propagation`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ newDefault, choices }) },
    toCounts,
  );
}

/** `DELETE /api/v1/process-items/{id}`. The answer is 204; a 409 carries the formulas that use the rate (`formulasOf`). */
export function deleteProcessItem(id: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, `${PROCESS_ITEMS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: ACCEPT_JSON }, readNothing);
}
