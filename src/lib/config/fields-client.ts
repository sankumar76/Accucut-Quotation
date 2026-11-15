import { ACCEPT_JSON, isRecord, sendJson, type Fetch, type Outcome } from '../api-client';
import { FIELD_KINDS, type FieldKind } from '../fields/types';

/**
 * The browser's side of `GET /api/v1/config/fields` (SCR-17; STORY-08.01): one call and the reading of its answer. Nothing here decides anything: who may call, what a
 * field's letter is and how a formula reads are the server's, and this file only turns its answer into rows the screen can show. It has no zod, so the page does not carry it
 * (NFR-009), and it holds no formula and no rate name: they arrive in the answer, for the Admin and the Lead only.
 */

/** A row of the table, as the server sent it. */
export interface ConfigFieldRow {
  readonly id: string;
  /** The Excel column letter now. */
  readonly letter: string;
  readonly label: string;
  /** "Section 2: Material and Dimensions", "Stage 3: Process Costs", or `null`. */
  readonly place: string | null;
  readonly kind: FieldKind;
  /** The formula in display form, or `null` for a field that has none. */
  readonly formula: string | null;
  /** `'total'` is the estimate total (BL), which has a sentence of its own; any other text is a System field with no sentence. `null` is not a System field. */
  readonly systemRole: string | null;
  /** One sentence that explains the formula (the estimate total), or null. */
  readonly note: string | null;
  readonly canEditFormula: boolean;
}

const CONFIG_FIELDS_PATH = '/api/v1/config/fields';

function isKind(value: unknown): value is FieldKind {
  return FIELD_KINDS.some((kind) => kind === value);
}

function textOrNull(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined;
}

export function toConfigFieldRow(value: unknown): ConfigFieldRow | null {
  if (!isRecord(value)) return null;
  const { id, letter, label, kind, canEditFormula } = value;
  const place = textOrNull(value['place']);
  const formula = textOrNull(value['formula']);
  const systemRole = textOrNull(value['systemRole']);
  const note = textOrNull(value['note']);
  if (typeof id !== 'string' || typeof letter !== 'string' || typeof label !== 'string' || !isKind(kind) || typeof canEditFormula !== 'boolean') return null;
  if (place === undefined || formula === undefined || systemRole === undefined || note === undefined) return null;
  return { id, letter, label, place, kind, formula, systemRole, note, canEditFormula };
}

function readFields(body: unknown): ReadonlyArray<ConfigFieldRow> | null {
  if (!isRecord(body) || !Array.isArray(body['fields'])) return null;
  const rows = body['fields'].map(toConfigFieldRow);
  return rows.every((row): row is ConfigFieldRow => row !== null) ? rows : null;
}

/** `GET /api/v1/config/fields`. */
export function listConfigFields(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<ConfigFieldRow>>> {
  return sendJson(doFetch, CONFIG_FIELDS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readFields);
}
