import { ACCEPT_JSON, isRecord, JSON_HEADERS, sendJson, type Fetch, type Outcome } from '../api-client';

/**
 * The browser's side of the checkpoint routes (SCR-21; STORY-08.06): the list, the current version line, the save of a name and the revert. Nothing here decides anything: who may call, whether a name is free, whether
 * the target can be used, whether the password is right and what the new version is are the server's, and this file only turns its answers into values the screen can show. It has no zod (NFR-009), and it keeps no
 * password: the revert takes it as an argument, puts it in the body of the one request, and the caller drops it after the answer.
 */

/** A checkpoint as the screen lists it. */
export interface CheckpointRow {
  readonly id: string;
  readonly name: string;
  /** The version the checkpoint names. The revert is by this ID. */
  readonly versionId: string;
  readonly versionNumber: number;
  /** An ISO 8601 instant in UTC; the screen shows IST. */
  readonly savedAt: string;
  /** `null` for the seed checkpoint, which no person saved. */
  readonly savedBy: string | null;
}

/** The current version line (`GET /api/v1/config/current`). */
export interface CurrentVersion {
  readonly number: number;
  readonly savedBy: string | null;
  readonly savedAt: string;
  readonly estimatesInUse: number;
}

/** What a revert answered: the version it made, the one it copied, and the version that was latest before (the undo's target). */
export interface RevertedVersion {
  readonly version: number;
  readonly copiedFrom: number;
  readonly undoVersionId: string;
}

const CHECKPOINTS_PATH = '/api/v1/config/checkpoints';
const CURRENT_PATH = '/api/v1/config/current';

const isText = (value: unknown): value is string => typeof value === 'string';
const isWholeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function readRow(value: unknown): CheckpointRow | null {
  if (!isRecord(value)) return null;
  const { id, name, versionId, versionNumber, savedAt, savedBy } = value;
  if (!isText(id) || !isText(name) || !isText(versionId) || !isWholeNumber(versionNumber) || !isText(savedAt) || !(savedBy === null || isText(savedBy))) return null;
  return { id, name, versionId, versionNumber, savedAt, savedBy };
}

function readRows(body: unknown): ReadonlyArray<CheckpointRow> | null {
  if (!isRecord(body) || !Array.isArray(body['checkpoints'])) return null;
  const rows = body['checkpoints'].map(readRow);
  return rows.every((row): row is CheckpointRow => row !== null) ? rows : null;
}

function readCurrent(body: unknown): CurrentVersion | null {
  if (!isRecord(body)) return null;
  const { number, savedBy, savedAt, estimatesInUse } = body;
  if (!isWholeNumber(number) || !(savedBy === null || isText(savedBy)) || !isText(savedAt) || !isWholeNumber(estimatesInUse)) return null;
  return { number, savedBy, savedAt, estimatesInUse };
}

function readReverted(body: unknown): RevertedVersion | null {
  return isRecord(body) && isWholeNumber(body['version']) && isWholeNumber(body['copiedFrom']) && isText(body['undoVersionId']) ? { version: body['version'], copiedFrom: body['copiedFrom'], undoVersionId: body['undoVersionId'] } : null;
}

/** `GET /api/v1/config/checkpoints`: every checkpoint, newest first. */
export function listCheckpoints(doFetch: Fetch = fetch): Promise<Outcome<ReadonlyArray<CheckpointRow>>> {
  return sendJson(doFetch, CHECKPOINTS_PATH, { method: 'GET', headers: ACCEPT_JSON }, readRows);
}

/** `GET /api/v1/config/current`: the number, saver, time and use count of the current version. */
export function readCurrentVersion(doFetch: Fetch = fetch): Promise<Outcome<CurrentVersion>> {
  return sendJson(doFetch, CURRENT_PATH, { method: 'GET', headers: ACCEPT_JSON }, readCurrent);
}

/** `POST /api/v1/config/checkpoints`: a name for the current latest version. A name that is empty, too long or taken arrives as a refusal with the server's sentence. */
export function saveCheckpoint(name: string, doFetch: Fetch = fetch): Promise<Outcome<CheckpointRow>> {
  return sendJson(doFetch, CHECKPOINTS_PATH, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name }) }, readRow);
}

/**
 * `POST /api/v1/config/versions/{id}/revert` with the Admin's password and the number of the version the screen showed as current. A wrong password (422 `STEP_UP_FAILED`), a block (429 `STEP_UP_LOCKED`), a
 * version that moved on (409 `CONFIG_VERSION_CHANGED`), a target that is the current configuration (409 `NOTHING_TO_REVERT`) and a target that can no longer be used (422) arrive as refusals with the server's sentence.
 */
export function revertToVersion(versionId: string, password: string, baseVersion: number, doFetch: Fetch = fetch): Promise<Outcome<RevertedVersion>> {
  return sendJson(doFetch, `/api/v1/config/versions/${encodeURIComponent(versionId)}/revert`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ password, baseVersion }) }, readReverted);
}
