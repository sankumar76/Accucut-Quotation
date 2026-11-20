import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome, type Refusal } from '../api-client';
import type { FieldUse } from '../fields/uses';

/**
 * The browser's side of the delete dialog's two routes (SCR-20; STORY-08.04): the read of what uses a field and the delete. Nothing here decides anything: what uses a field, whether the field may be deleted, whether
 * the password is right and what the letters become are the server's, and this file only turns its answers into values the dialog can show. It has no zod (NFR-009), and it keeps no password: the delete takes it as an
 * argument, puts it in the body of the one request, and the caller drops it after the answer.
 */

export interface FieldReferencesView {
  readonly fieldId: string;
  readonly letter: string;
  readonly label: string;
  readonly uses: ReadonlyArray<FieldUse>;
}

export interface DeletedFieldView {
  readonly version: number;
  readonly message: string;
}

const fieldPath = (fieldId: string): string => `/api/v1/config/fields/${encodeURIComponent(fieldId)}`;

const isText = (value: unknown): value is string => typeof value === 'string';

function readUse(value: unknown): FieldUse | null {
  if (!isRecord(value)) return null;
  const { kind } = value;
  if (kind === 'stage-total') {
    return isText(value['stageId']) && typeof value['number'] === 'number' && isText(value['name']) ? { kind, stageId: value['stageId'], number: value['number'], name: value['name'] } : null;
  }
  if (!isText(value['fieldId']) || !isText(value['letter']) || !isText(value['label'])) return null;
  const column = { fieldId: value['fieldId'], letter: value['letter'], label: value['label'] };
  if (kind === 'formula') return isText(value['formula']) ? { kind, ...column, formula: value['formula'] } : null;
  return kind === 'hide-when-zero' || kind === 'visibility-rule' ? { kind, ...column } : null;
}

/** A list of uses, or `null` when it is not a list or one of its entries is not a use. */
function readUses(value: unknown): ReadonlyArray<FieldUse> | null {
  if (!Array.isArray(value)) return null;
  const uses = value.map(readUse);
  return uses.every((use): use is FieldUse => use !== null) ? uses : null;
}

function readReferences(body: unknown): FieldReferencesView | null {
  if (!isRecord(body) || !isText(body['fieldId']) || !isText(body['letter']) || !isText(body['label'])) return null;
  const uses = readUses(body['uses']);
  return uses === null ? null : { fieldId: body['fieldId'], letter: body['letter'], label: body['label'], uses };
}

function readDeleted(body: unknown): DeletedFieldView | null {
  return isRecord(body) && typeof body['version'] === 'number' && isText(body['message']) ? { version: body['version'], message: body['message'] } : null;
}

/** `GET /api/v1/config/fields/{id}/references`: the field and everything that uses it. 404 and 409 `SYSTEM_FIELD` arrive as refusals. */
export function listFieldReferences(fieldId: string, doFetch: Fetch = fetch): Promise<Outcome<FieldReferencesView>> {
  return sendJson(doFetch, `${fieldPath(fieldId)}/references`, { method: 'GET', headers: ACCEPT_JSON }, readReferences);
}

/**
 * `DELETE /api/v1/config/fields/{id}` with the Admin's password in the body. A wrong password (422 `STEP_UP_FAILED`), a block (429 `STEP_UP_LOCKED`), a field that is used (409 `FIELD_IN_USE`, with the uses) and a
 * version that moved on (409 `CONFIG_VERSION_CHANGED`) arrive as refusals with the server's sentence.
 */
export function deleteConfigField(fieldId: string, password: string, doFetch: Fetch = fetch): Promise<Outcome<DeletedFieldView>> {
  return sendJson(doFetch, fieldPath(fieldId), { method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ password }) }, readDeleted);
}

/** The uses a 409 `FIELD_IN_USE` carries, or `null` for any other refusal or a body whose list is not one. */
export function usesOfRefusal(refusal: Refusal): ReadonlyArray<FieldUse> | null {
  return refusal.body['uses'] === undefined ? null : readUses(refusal.body['uses']);
}
