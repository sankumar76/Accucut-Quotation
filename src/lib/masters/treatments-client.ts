import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

import type { TreatmentFields, TreatmentValues } from './treatments';

/**
 * The browser's side of the Treatment routes (SCR-13, the Treatment / Color tab; `/api/v1/treatments`, architecture section 6): four small calls
 * and the reading of their answers. Nothing here decides anything: who may call, whether a name is free or kept by the system, and whether an
 * entry is locked are the server's, and this file only turns its answer into something the screen can show.
 */

/** A treatment as SCR-13 shows it. `locked` is true for the system entry "Other", which has no rename and no delete. */
export interface TreatmentRow extends TreatmentValues {
  readonly id: string;
  readonly locked: boolean;
}

const TREATMENTS_PATH = '/api/v1/treatments';

export function toTreatmentRow(value: unknown): TreatmentRow | null {
  if (!isRecord(value)) return null;
  const { id, name, locked } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof locked !== 'boolean') return null;
  return { id, name, locked };
}

function readTreatments(body: unknown): ReadonlyArray<TreatmentRow> | null {
  if (!isRecord(body) || !Array.isArray(body['treatments'])) return null;
  const rows = body['treatments'].map(toTreatmentRow);
  return rows.every((row): row is TreatmentRow => row !== null) ? rows : null;
}

/** The reading of an answer that has no body (a 204): there is nothing to read, and it worked. */
const readNothing = (): true => true;

/** `GET /api/v1/treatments`. */
export function listTreatments(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<TreatmentRow>>> {
  return sendJson(doFetch, TREATMENTS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readTreatments);
}

/** `POST /api/v1/treatments`. */
export function createTreatment(input: TreatmentValues, doFetch: Fetch = fetch): Promise<Outcome<TreatmentRow>> {
  return sendJson(doFetch, TREATMENTS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toTreatmentRow);
}

/** `PATCH /api/v1/treatments/{id}`: the new name. */
export function updateTreatment(id: string, changes: TreatmentFields, doFetch: Fetch = fetch): Promise<Outcome<TreatmentRow>> {
  return sendJson(
    doFetch,
    `${TREATMENTS_PATH}/${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) },
    toTreatmentRow,
  );
}

/** `DELETE /api/v1/treatments/{id}`. The answer is 204. */
export function deleteTreatment(id: string, doFetch: Fetch = fetch): Promise<Outcome<true>> {
  return sendJson(doFetch, `${TREATMENTS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: ACCEPT_JSON }, readNothing);
}
