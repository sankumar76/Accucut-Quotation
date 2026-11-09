import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

import type { MaterialFields, MaterialValues } from './materials';

/**
 * The browser's side of the Material Master routes (SCR-13; `/api/v1/materials`, architecture section 6): three small calls and the
 * reading of their answers. Nothing here decides anything: who may call, whether a name is free, and whether a specific gravity is above
 * 0 are the server's, and this file only turns its answer into something the screen can show.
 */

/** A material as SCR-13 shows it. The numbers are decimal text with at least two decimals, for example "7.37". */
export interface MaterialRow extends MaterialValues {
  readonly id: string;
}

const MATERIALS_PATH = '/api/v1/materials';

export function toMaterialRow(value: unknown): MaterialRow | null {
  if (!isRecord(value)) return null;
  const { id, materialInDrawing, materialConsidered, pricePerKg, specificGravity, scrapRate } = value;
  if (typeof id !== 'string' || typeof materialInDrawing !== 'string' || typeof materialConsidered !== 'string') return null;
  if (typeof pricePerKg !== 'string' || typeof specificGravity !== 'string' || typeof scrapRate !== 'string') return null;
  return { id, materialInDrawing, materialConsidered, pricePerKg, specificGravity, scrapRate };
}

function readMaterials(body: unknown): ReadonlyArray<MaterialRow> | null {
  if (!isRecord(body) || !Array.isArray(body['materials'])) return null;
  const rows = body['materials'].map(toMaterialRow);
  return rows.every((row): row is MaterialRow => row !== null) ? rows : null;
}

/** `GET /api/v1/materials`. */
export function listMaterials(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<MaterialRow>>> {
  return sendJson(doFetch, MATERIALS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readMaterials);
}

/** `POST /api/v1/materials`. */
export function createMaterial(input: MaterialValues, doFetch: Fetch = fetch): Promise<Outcome<MaterialRow>> {
  return sendJson(doFetch, MATERIALS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }, toMaterialRow);
}

/** `PATCH /api/v1/materials/{id}`: any of the fields. */
export function updateMaterial(id: string, changes: MaterialFields, doFetch: Fetch = fetch): Promise<Outcome<MaterialRow>> {
  return sendJson(
    doFetch,
    `${MATERIALS_PATH}/${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) },
    toMaterialRow,
  );
}
